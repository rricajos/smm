/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRecentEmails, getAllEmailHeaders, markEmailsAnalyzed } from './email-queries';

vi.mock('./message-utils', () => ({
  extractBodyText: vi.fn().mockReturnValue('Body text content here for snippet extraction'),
}));

vi.mock('../lib/i18n', () => ({
  getLocaleFromStorage: vi.fn().mockResolvedValue('en'),
  translate: vi.fn((_loc: string, key: string) => key),
}));

vi.mock('../lib/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockMessenger = {
  accounts: { list: vi.fn() },
  folders: { getSubFolders: vi.fn() },
  messages: {
    list: vi.fn(),
    continueList: vi.fn(),
    get: vi.fn(),
    getFull: vi.fn(),
    move: vi.fn(),
    update: vi.fn(),
    query: vi.fn(),
    tags: {
      list: vi.fn(),
      create: vi.fn(),
    },
  },
};

vi.stubGlobal('messenger', mockMessenger);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getRecentEmails', () => {
  it('fetches emails from inbox of each account', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work', rootFolder: { id: 'root1' } },
    ]);
    mockMessenger.folders.getSubFolders.mockResolvedValue([
      { id: 'inbox1', type: 'inbox', name: 'Inbox' },
    ]);
    mockMessenger.messages.list.mockResolvedValue({
      messages: [
        { id: 1, author: 'alice@test.com', subject: 'Hello' },
        { id: 2, author: 'bob@test.com', subject: 'World' },
      ],
    });
    mockMessenger.messages.getFull.mockResolvedValue({ contentType: 'text/plain', body: 'test' });

    const result = await getRecentEmails(50);
    expect(result).toHaveLength(2);
    expect(result[0].from).toBe('alice@test.com');
    expect(result[0].accountName).toBe('Work');
    expect(result[0].snippet).toBeTruthy();
  });

  it('returns empty when no accounts', async () => {
    mockMessenger.accounts.list.mockResolvedValue([]);
    expect(await getRecentEmails()).toEqual([]);
  });

  it('skips accounts without inbox', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work', rootFolder: { id: 'root1' } },
    ]);
    mockMessenger.folders.getSubFolders.mockResolvedValue([
      { id: 'sent1', type: 'sent', name: 'Sent' },
    ]);
    expect(await getRecentEmails()).toEqual([]);
  });

  it('respects maxCount limit', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work', rootFolder: { id: 'root1' } },
    ]);
    mockMessenger.folders.getSubFolders.mockResolvedValue([
      { id: 'inbox1', type: 'inbox', name: 'Inbox' },
    ]);
    mockMessenger.messages.list.mockResolvedValue({
      messages: Array.from({ length: 10 }, (_, i) => ({
        id: i, author: `user${i}@test.com`, subject: `Msg ${i}`,
      })),
    });
    mockMessenger.messages.getFull.mockResolvedValue({ contentType: 'text/plain', body: 'x' });

    const result = await getRecentEmails(3);
    expect(result).toHaveLength(3);
  });

  it('handles pagination across pages', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work', rootFolder: { id: 'root1' } },
    ]);
    mockMessenger.folders.getSubFolders.mockResolvedValue([
      { id: 'inbox1', type: 'inbox', name: 'Inbox' },
    ]);
    mockMessenger.messages.list.mockResolvedValue({
      id: 'page-1',
      messages: [{ id: 1, author: 'a@t.com', subject: 'A' }],
    });
    mockMessenger.messages.continueList.mockResolvedValue({
      messages: [{ id: 2, author: 'b@t.com', subject: 'B' }],
    });
    mockMessenger.messages.getFull.mockResolvedValue({ contentType: 'text/plain', body: 'x' });

    const result = await getRecentEmails(50);
    expect(result).toHaveLength(2);
  });
});

describe('getAllEmailHeaders', () => {
  it('fetches and sorts emails by date descending', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work' },
    ]);
    mockMessenger.messages.query.mockResolvedValue({
      messages: [
        { id: 1, author: 'a@t.com', subject: 'Old', date: new Date('2024-01-01'), folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' }, tags: [] },
        { id: 2, author: 'b@t.com', subject: 'New', date: new Date('2024-06-01'), folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' }, tags: [] },
      ],
    });

    const result = await getAllEmailHeaders({});
    expect(result.emails[0].subject).toBe('New');
    expect(result.emails[1].subject).toBe('Old');
  });

  it('skips system folders', async () => {
    mockMessenger.accounts.list.mockResolvedValue([{ id: 'acc1', name: 'Work' }]);
    mockMessenger.messages.query.mockResolvedValue({
      messages: [
        { id: 1, author: 'a@t.com', subject: 'Inbox msg', date: new Date(), folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' }, tags: [] },
        { id: 2, author: 'b@t.com', subject: 'Trash msg', date: new Date(), folder: { name: 'Trash', accountId: 'acc1', type: 'trash' }, tags: [] },
        { id: 3, author: 'c@t.com', subject: 'Sent msg', date: new Date(), folder: { name: 'Sent', accountId: 'acc1', type: 'sent' }, tags: [] },
      ],
    });

    const result = await getAllEmailHeaders({});
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].subject).toBe('Inbox msg');
  });

  it('skips analyzed emails when skipAnalyzed is true', async () => {
    mockMessenger.accounts.list.mockResolvedValue([{ id: 'acc1', name: 'Work' }]);
    mockMessenger.messages.query.mockResolvedValue({
      messages: [
        { id: 1, author: 'a@t.com', subject: 'New', date: new Date(), folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' }, tags: [] },
        { id: 2, author: 'b@t.com', subject: 'Analyzed', date: new Date(), folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' }, tags: ['smm_analyzed'] },
      ],
    });

    const result = await getAllEmailHeaders({ skipAnalyzed: true });
    expect(result.emails).toHaveLength(1);
    expect(result.skippedAnalyzed).toBe(1);
  });

  it('returns empty on no accounts', async () => {
    mockMessenger.accounts.list.mockResolvedValue([]);
    const result = await getAllEmailHeaders({});
    expect(result.emails).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('applies limit', async () => {
    mockMessenger.accounts.list.mockResolvedValue([{ id: 'acc1', name: 'Work' }]);
    const msgs = Array.from({ length: 20 }, (_, i) => ({
      id: i, author: 'x@t.com', subject: `M${i}`, date: new Date(2024, 0, i + 1),
      folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' }, tags: [],
    }));
    mockMessenger.messages.query.mockResolvedValue({ messages: msgs });

    const result = await getAllEmailHeaders({ limit: 5 });
    expect(result.emails).toHaveLength(5);
    expect(result.total).toBe(5);
  });
});

describe('markEmailsAnalyzed', () => {
  it('marks emails with the analyzed tag', async () => {
    mockMessenger.messages.tags.list.mockResolvedValue([{ key: 'smm_analyzed' }]);
    mockMessenger.messages.get.mockResolvedValue({ id: 1, tags: ['important'] });
    mockMessenger.messages.update.mockResolvedValue(undefined);

    const result = await markEmailsAnalyzed([1, 2]);
    expect(result.success).toBe(true);
    expect(result.marked).toBe(2);
    expect(mockMessenger.messages.update).toHaveBeenCalledTimes(2);
  });

  it('creates the tag if it does not exist', async () => {
    mockMessenger.messages.tags.list.mockResolvedValue([]);
    mockMessenger.messages.tags.create.mockResolvedValue(undefined);
    mockMessenger.messages.get.mockResolvedValue({ id: 1, tags: [] });
    mockMessenger.messages.update.mockResolvedValue(undefined);

    await markEmailsAnalyzed([1]);
    expect(mockMessenger.messages.tags.create).toHaveBeenCalledWith('smm_analyzed', expect.any(String), '#90CAF9');
  });

  it('skips already-analyzed emails', async () => {
    mockMessenger.messages.tags.list.mockResolvedValue([{ key: 'smm_analyzed' }]);
    mockMessenger.messages.get.mockResolvedValue({ id: 1, tags: ['smm_analyzed'] });

    const result = await markEmailsAnalyzed([1]);
    expect(result.marked).toBe(0);
    expect(mockMessenger.messages.update).not.toHaveBeenCalled();
  });
});
