/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Rule } from '../types/rules';
import { classifyMessage, executeActions, clearMessageCache } from './classifier';

vi.mock('../lib/utils/storage', () => ({
  getRules: vi.fn(),
  appendActivityLog: vi.fn(),
}));

vi.mock('./message-utils', () => ({
  extractBodyText: vi.fn(),
  hasAttachments: vi.fn(),
}));

import { getRules, appendActivityLog } from '../lib/utils/storage';
import { extractBodyText, hasAttachments } from './message-utils';

const mockGetRules = vi.mocked(getRules);
const mockAppendActivityLog = vi.mocked(appendActivityLog);
const mockExtractBodyText = vi.mocked(extractBodyText);
const mockHasAttachments = vi.mocked(hasAttachments);

const mockMessagesGetFull = vi.fn();
const mockMessagesMove = vi.fn();
const mockMessagesUpdate = vi.fn();

vi.stubGlobal('messenger', {
  messages: {
    getFull: mockMessagesGetFull,
    move: mockMessagesMove,
    update: mockMessagesUpdate,
  },
});

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    enabled: true,
    conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
    conditionLogic: 'all',
    actions: [{ type: 'markRead' }],
    stopProcessing: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeHeader(overrides: Record<string, unknown> = {}): any {
  return {
    id: 1,
    author: 'test@example.com',
    subject: 'Test Subject',
    recipients: ['user@example.com'],
    tags: [],
    folder: { accountId: 'acc1', name: 'Inbox', path: 'INBOX' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  clearMessageCache();
  mockAppendActivityLog.mockResolvedValue(undefined);
  mockMessagesGetFull.mockResolvedValue({ headers: {}, parts: [] });
  mockMessagesMove.mockResolvedValue(undefined);
  mockMessagesUpdate.mockResolvedValue(undefined);
});

describe('classifyMessage (integration)', () => {
  it('returns empty array when no rules exist', async () => {
    mockGetRules.mockResolvedValue([]);
    const header = makeHeader();

    const results = await classifyMessage(header);

    expect(results).toEqual([]);
  });

  it('returns empty array when no enabled rules', async () => {
    mockGetRules.mockResolvedValue([makeRule({ enabled: false })]);
    const header = makeHeader();

    const results = await classifyMessage(header);

    expect(results).toEqual([]);
  });

  it('matches rule on from field with contains', async () => {
    const rule = makeRule({
      conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
    });
    mockGetRules.mockResolvedValue([rule]);
    const header = makeHeader({ author: 'test@example.com' });

    const results = await classifyMessage(header);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('rule-1');
    expect(results[0].messageId).toBe(header.id);
  });

  it('matches rule on subject field with equals', async () => {
    const rule = makeRule({
      conditions: [
        { field: 'subject', operator: 'equals', value: 'Test Subject', caseSensitive: false },
      ],
    });
    mockGetRules.mockResolvedValue([rule]);
    const header = makeHeader({ subject: 'Test Subject' });

    const results = await classifyMessage(header);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('rule-1');
  });

  it('matches rule on body field using getFull and extractBodyText', async () => {
    const fullMessage = { headers: {}, parts: [{ body: 'Important body content' }] };
    mockMessagesGetFull.mockResolvedValue(fullMessage);
    mockExtractBodyText.mockReturnValue('Important body content');

    const rule = makeRule({
      conditions: [
        { field: 'body', operator: 'contains', value: 'Important', caseSensitive: false },
      ],
    });
    mockGetRules.mockResolvedValue([rule]);
    const header = makeHeader();

    const results = await classifyMessage(header);

    expect(results).toHaveLength(1);
    expect(mockMessagesGetFull).toHaveBeenCalledWith(header.id);
    expect(mockExtractBodyText).toHaveBeenCalledWith(fullMessage);
  });

  it('matches rule with hasAttachments condition', async () => {
    mockHasAttachments.mockResolvedValue(true);

    const rule = makeRule({
      conditions: [
        { field: 'hasAttachments', operator: 'is', value: '', boolValue: true, caseSensitive: false },
      ],
    });
    mockGetRules.mockResolvedValue([rule]);
    const header = makeHeader();

    const results = await classifyMessage(header);

    expect(results).toHaveLength(1);
    expect(mockHasAttachments).toHaveBeenCalledWith(header.id);
  });

  it('conditionLogic all requires all conditions to match', async () => {
    const rule = makeRule({
      conditionLogic: 'all',
      conditions: [
        { field: 'from', operator: 'contains', value: 'test', caseSensitive: false },
        { field: 'subject', operator: 'contains', value: 'missing', caseSensitive: false },
      ],
    });
    mockGetRules.mockResolvedValue([rule]);
    const header = makeHeader({ author: 'test@example.com', subject: 'Test Subject' });

    const results = await classifyMessage(header);

    expect(results).toEqual([]);
  });

  it('conditionLogic any matches if any condition matches', async () => {
    const rule = makeRule({
      conditionLogic: 'any',
      conditions: [
        { field: 'from', operator: 'contains', value: 'nomatch', caseSensitive: false },
        { field: 'subject', operator: 'contains', value: 'Test', caseSensitive: false },
      ],
    });
    mockGetRules.mockResolvedValue([rule]);
    const header = makeHeader({ author: 'other@example.com', subject: 'Test Subject' });

    const results = await classifyMessage(header);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('rule-1');
  });

  it('stopProcessing stops after first matching rule', async () => {
    const rule1 = makeRule({
      id: 'rule-1',
      stopProcessing: true,
      conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
    });
    const rule2 = makeRule({
      id: 'rule-2',
      conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
    });
    mockGetRules.mockResolvedValue([rule1, rule2]);
    const header = makeHeader({ author: 'test@example.com' });

    const results = await classifyMessage(header);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('rule-1');
  });

  it('returns multiple matches for multiple matching rules', async () => {
    const rule1 = makeRule({
      id: 'rule-1',
      stopProcessing: false,
      conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
    });
    const rule2 = makeRule({
      id: 'rule-2',
      stopProcessing: false,
      conditions: [{ field: 'subject', operator: 'contains', value: 'Test', caseSensitive: false }],
    });
    mockGetRules.mockResolvedValue([rule1, rule2]);
    const header = makeHeader({ author: 'test@example.com', subject: 'Test Subject' });

    const results = await classifyMessage(header);

    expect(results).toHaveLength(2);
    expect(results[0].rule.id).toBe('rule-1');
    expect(results[1].rule.id).toBe('rule-2');
  });
});

describe('executeActions (integration)', () => {
  it('calls messenger.messages.move for moveToFolder action', async () => {
    const rule = makeRule({
      actions: [{ type: 'moveToFolder', folderId: 'folder-123' }],
    });
    const header = makeHeader();
    const results = [{ rule, messageId: header.id }];

    await executeActions(header, results);

    expect(mockMessagesMove).toHaveBeenCalledWith([header.id], 'folder-123');
  });

  it('skips moveToFolder when folderId is missing', async () => {
    const rule = makeRule({
      actions: [{ type: 'moveToFolder' }],
    });
    const header = makeHeader();
    const results = [{ rule, messageId: header.id }];

    await executeActions(header, results);

    expect(mockMessagesMove).not.toHaveBeenCalled();
  });

  it('calls messenger.messages.update for addTag', async () => {
    const rule = makeRule({
      actions: [{ type: 'addTag', tagKey: '$label1' }],
    });
    const header = makeHeader({ tags: [] });
    const results = [{ rule, messageId: header.id }];

    await executeActions(header, results);

    expect(mockMessagesUpdate).toHaveBeenCalledWith(header.id, {
      tags: ['$label1'],
    });
  });

  it('does not add duplicate tag', async () => {
    const rule = makeRule({
      actions: [{ type: 'addTag', tagKey: '$label1' }],
    });
    const header = makeHeader({ tags: ['$label1'] });
    const results = [{ rule, messageId: header.id }];

    await executeActions(header, results);

    expect(mockMessagesUpdate).not.toHaveBeenCalled();
  });

  it('sets flagged=true for setPriority high', async () => {
    const rule = makeRule({
      actions: [{ type: 'setPriority', priority: 'high' }],
    });
    const header = makeHeader();
    const results = [{ rule, messageId: header.id }];

    await executeActions(header, results);

    expect(mockMessagesUpdate).toHaveBeenCalledWith(header.id, { flagged: true });
  });

  it('sets read=true for markRead', async () => {
    const rule = makeRule({
      actions: [{ type: 'markRead' }],
    });
    const header = makeHeader();
    const results = [{ rule, messageId: header.id }];

    await executeActions(header, results);

    expect(mockMessagesUpdate).toHaveBeenCalledWith(header.id, { read: true });
  });

  it('does not call messenger for autoRespond (handled separately)', async () => {
    const rule = makeRule({
      actions: [{ type: 'autoRespond', templateId: 'tpl-1' }],
    });
    const header = makeHeader();
    const results = [{ rule, messageId: header.id }];

    await executeActions(header, results);

    expect(mockMessagesMove).not.toHaveBeenCalled();
    expect(mockMessagesUpdate).not.toHaveBeenCalled();
  });

  it('calls appendActivityLog for each matched rule', async () => {
    const rule1 = makeRule({ id: 'rule-1', name: 'Rule One', actions: [{ type: 'markRead' }] });
    const rule2 = makeRule({ id: 'rule-2', name: 'Rule Two', actions: [{ type: 'markRead' }] });
    const header = makeHeader({ id: 5, subject: 'Log Subject', author: 'sender@test.com' });
    const results = [
      { rule: rule1, messageId: header.id },
      { rule: rule2, messageId: header.id },
    ];

    await executeActions(header, results);

    expect(mockAppendActivityLog).toHaveBeenCalledTimes(2);
    expect(mockAppendActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'rule-1',
        ruleName: 'Rule One',
        messageId: 5,
        subject: 'Log Subject',
        from: 'sender@test.com',
        actions: ['markRead'],
        type: 'classification',
        accountId: 'acc1',
      }),
    );
    expect(mockAppendActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'rule-2',
        ruleName: 'Rule Two',
        messageId: 5,
        subject: 'Log Subject',
        from: 'sender@test.com',
        actions: ['markRead'],
        type: 'classification',
        accountId: 'acc1',
      }),
    );
  });
});
