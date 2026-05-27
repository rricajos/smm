/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testRule, processExisting, testSingleRule } from './rule-testing';

vi.mock('./classifier', () => ({
  classifyMessage: vi.fn(),
  executeActions: vi.fn(),
  clearMessageCache: vi.fn(),
}));

vi.mock('../lib/utils/storage', () => ({
  getRules: vi.fn().mockResolvedValue([]),
  saveRules: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({
    classificationEnabled: true,
    autoResponseEnabled: false,
    notifyOnClassification: false,
  }),
}));

vi.mock('../lib/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { classifyMessage, executeActions, clearMessageCache } from './classifier';
import { getRules, saveRules } from '../lib/utils/storage';

const mockMessenger = {
  accounts: { list: vi.fn() },
  folders: { getSubFolders: vi.fn() },
  messages: {
    get: vi.fn(),
    getFull: vi.fn(),
    list: vi.fn(),
    continueList: vi.fn(),
  },
};

vi.stubGlobal('messenger', mockMessenger);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(classifyMessage).mockResolvedValue([]);
  vi.mocked(executeActions).mockResolvedValue(undefined);
});

describe('testRule', () => {
  it('returns matched true when rule matches', async () => {
    const header = { id: 1, subject: 'Test' } as any;
    mockMessenger.messages.get.mockResolvedValue(header);
    mockMessenger.messages.getFull.mockResolvedValue({ contentType: 'text/plain' });
    vi.mocked(classifyMessage).mockResolvedValue([
      { rule: { id: 'rule-1', name: 'MyRule' } as any, messageId: 1 },
    ]);

    const result = await testRule(1, 'rule-1');
    expect(result.matched).toBe(true);
    expect(result.results).toEqual(['MyRule']);
  });

  it('returns matched false when rule does not match', async () => {
    mockMessenger.messages.get.mockResolvedValue({ id: 1 });
    mockMessenger.messages.getFull.mockResolvedValue({ contentType: 'text/plain' });
    vi.mocked(classifyMessage).mockResolvedValue([]);

    const result = await testRule(1, 'rule-1');
    expect(result.matched).toBe(false);
    expect(result.results).toEqual([]);
  });

  it('handles getFull failure gracefully', async () => {
    mockMessenger.messages.get.mockResolvedValue({ id: 1 });
    mockMessenger.messages.getFull.mockRejectedValue(new Error('fail'));
    vi.mocked(classifyMessage).mockResolvedValue([]);

    const result = await testRule(1, 'rule-1');
    expect(result.matched).toBe(false);
  });
});

describe('processExisting', () => {
  function setupInbox(messages: any[]) {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work', rootFolder: { id: 'root1' } },
    ]);
    mockMessenger.folders.getSubFolders.mockResolvedValue([
      { id: 'inbox1', type: 'inbox', name: 'Inbox' },
    ]);
    mockMessenger.messages.list.mockResolvedValue({ messages });
  }

  it('processes messages and returns stats', async () => {
    setupInbox([
      { id: 1, author: 'a@t.com', subject: 'S1' },
      { id: 2, author: 'b@t.com', subject: 'S2' },
    ]);
    vi.mocked(classifyMessage)
      .mockResolvedValueOnce([{ rule: { id: 'r1', name: 'R1' } as any, messageId: 1 }])
      .mockResolvedValueOnce([]);

    const result = await processExisting(50);
    expect(result.processed).toBe(2);
    expect(result.matched).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.details).toHaveLength(1);
    expect(result.details![0].rules).toEqual(['R1']);
    expect(clearMessageCache).toHaveBeenCalled();
  });

  it('returns zeros when no accounts', async () => {
    mockMessenger.accounts.list.mockResolvedValue([]);
    const result = await processExisting(50);
    expect(result.processed).toBe(0);
    expect(result.matched).toBe(0);
  });

  it('respects limit', async () => {
    setupInbox(
      Array.from({ length: 10 }, (_, i) => ({ id: i, author: 'x@t.com', subject: `M${i}` })),
    );

    const result = await processExisting(3);
    expect(result.processed).toBe(3);
  });

  it('counts errors from individual classification failures', async () => {
    setupInbox([{ id: 1, author: 'a@t.com', subject: 'S1' }]);
    vi.mocked(classifyMessage).mockRejectedValue(new Error('fail'));

    const result = await processExisting(50);
    expect(result.processed).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.matched).toBe(0);
  });
});

describe('testSingleRule', () => {
  const fakeRule = {
    id: 'test-rule',
    name: 'Test Rule',
    enabled: false,
    conditions: [{ field: 'from' as const, operator: 'contains' as const, value: 'test', caseSensitive: false }],
    conditionLogic: 'all' as const,
    actions: [{ type: 'addTag' as const, tagKey: 'important' }],
    stopProcessing: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  function setupInbox(messages: any[]) {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work', rootFolder: { id: 'root1' } },
    ]);
    mockMessenger.folders.getSubFolders.mockResolvedValue([
      { id: 'inbox1', type: 'inbox', name: 'Inbox' },
    ]);
    mockMessenger.messages.list.mockResolvedValue({ messages });
  }

  it('temporarily swaps rules and restores them', async () => {
    setupInbox([{ id: 1, author: 'test@t.com', subject: 'S1' }]);
    vi.mocked(getRules).mockResolvedValue([{ id: 'orig', name: 'Original' }] as any);

    await testSingleRule(fakeRule, 50);

    // Should save temp rule then restore original
    expect(saveRules).toHaveBeenCalledTimes(2);
    expect(vi.mocked(saveRules).mock.calls[0][0]).toEqual([{ ...fakeRule, enabled: true }]);
    expect(vi.mocked(saveRules).mock.calls[1][0]).toEqual([{ id: 'orig', name: 'Original' }]);
  });

  it('returns matched details for matching messages', async () => {
    setupInbox([
      { id: 1, author: 'test@t.com', subject: 'Match' },
      { id: 2, author: 'other@t.com', subject: 'No match' },
    ]);
    vi.mocked(classifyMessage)
      .mockResolvedValueOnce([{ rule: fakeRule as any, messageId: 1 }])
      .mockResolvedValueOnce([]);

    const result = await testSingleRule(fakeRule, 50);
    expect(result.processed).toBe(2);
    expect(result.matched).toBe(1);
    expect(result.details).toEqual([{ subject: 'Match', from: 'test@t.com' }]);
  });

  it('restores rules even on error', async () => {
    setupInbox([{ id: 1, author: 'a@t.com', subject: 'S1' }]);
    vi.mocked(getRules).mockResolvedValue([{ id: 'orig' }] as any);
    vi.mocked(classifyMessage).mockRejectedValue(new Error('boom'));

    await testSingleRule(fakeRule, 50);
    // saveRules should still have been called to restore
    const calls = vi.mocked(saveRules).mock.calls;
    expect(calls[calls.length - 1][0]).toEqual([{ id: 'orig' }]);
  });

  it('returns zeros when no accounts', async () => {
    mockMessenger.accounts.list.mockResolvedValue([]);
    const result = await testSingleRule(fakeRule, 50);
    expect(result.processed).toBe(0);
    expect(result.matched).toBe(0);
  });
});
