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
        id: i,
        author: `user${i}@test.com`,
        subject: `Msg ${i}`,
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
    mockMessenger.accounts.list.mockResolvedValue([{ id: 'acc1', name: 'Work' }]);
    mockMessenger.messages.query.mockResolvedValue({
      messages: [
        {
          id: 1,
          author: 'a@t.com',
          subject: 'Old',
          date: new Date('2024-01-01'),
          folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
          tags: [],
        },
        {
          id: 2,
          author: 'b@t.com',
          subject: 'New',
          date: new Date('2024-06-01'),
          folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
          tags: [],
        },
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
        {
          id: 1,
          author: 'a@t.com',
          subject: 'Inbox msg',
          date: new Date(),
          folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
          tags: [],
        },
        {
          id: 2,
          author: 'b@t.com',
          subject: 'Trash msg',
          date: new Date(),
          folder: { name: 'Trash', accountId: 'acc1', type: 'trash' },
          tags: [],
        },
        {
          id: 3,
          author: 'c@t.com',
          subject: 'Sent msg',
          date: new Date(),
          folder: { name: 'Sent', accountId: 'acc1', type: 'sent' },
          tags: [],
        },
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
        {
          id: 1,
          author: 'a@t.com',
          subject: 'New',
          date: new Date(),
          folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
          tags: [],
        },
        {
          id: 2,
          author: 'b@t.com',
          subject: 'Analyzed',
          date: new Date(),
          folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
          tags: ['smm_analyzed'],
        },
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
      id: i,
      author: 'x@t.com',
      subject: `M${i}`,
      date: new Date(2024, 0, i + 1),
      folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
      tags: [],
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
    expect(mockMessenger.messages.tags.create).toHaveBeenCalledWith(
      'smm_analyzed',
      expect.any(String),
      '#90CAF9',
    );
  });

  it('skips already-analyzed emails', async () => {
    mockMessenger.messages.tags.list.mockResolvedValue([{ key: 'smm_analyzed' }]);
    mockMessenger.messages.get.mockResolvedValue({ id: 1, tags: ['smm_analyzed'] });

    const result = await markEmailsAnalyzed([1]);
    expect(result.marked).toBe(0);
    expect(mockMessenger.messages.update).not.toHaveBeenCalled();
  });
});

// --- Branch coverage: additional uncovered paths ---

describe('getRecentEmails – branch coverage', () => {
  it('paginates via page.id continuation and breaks when maxCount is reached mid-page', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work', rootFolder: { id: 'root1' } },
    ]);
    mockMessenger.folders.getSubFolders.mockResolvedValue([
      { id: 'inbox1', type: 'inbox', name: 'Inbox' },
    ]);
    // First page has 2 messages, with a continuation id
    mockMessenger.messages.list.mockResolvedValue({
      id: 'page-1',
      messages: [
        { id: 1, author: 'a@t.com', subject: 'A' },
        { id: 2, author: 'b@t.com', subject: 'B' },
      ],
    });
    // Second page has 3 messages, also with a continuation id
    mockMessenger.messages.continueList.mockResolvedValueOnce({
      id: 'page-2',
      messages: [
        { id: 3, author: 'c@t.com', subject: 'C' },
        { id: 4, author: 'd@t.com', subject: 'D' },
        { id: 5, author: 'e@t.com', subject: 'E' },
      ],
    });
    mockMessenger.messages.getFull.mockResolvedValue({ contentType: 'text/plain', body: 'x' });

    // maxCount=4: should collect 2 from page 1, then start page 2 and break after 2 more (mid-page)
    const result = await getRecentEmails(4);
    expect(result).toHaveLength(4);
    expect(result.map((e) => e.from)).toEqual(['a@t.com', 'b@t.com', 'c@t.com', 'd@t.com']);
    expect(mockMessenger.messages.continueList).toHaveBeenCalledWith('page-1');
  });

  it('stops iterating accounts when maxCount is already reached', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work', rootFolder: { id: 'root1' } },
      { id: 'acc2', name: 'Personal', rootFolder: { id: 'root2' } },
    ]);
    mockMessenger.folders.getSubFolders.mockResolvedValue([
      { id: 'inbox1', type: 'inbox', name: 'Inbox' },
    ]);
    mockMessenger.messages.list.mockResolvedValue({
      messages: [
        { id: 1, author: 'a@t.com', subject: 'A' },
        { id: 2, author: 'b@t.com', subject: 'B' },
      ],
    });
    mockMessenger.messages.getFull.mockResolvedValue({ contentType: 'text/plain', body: 'x' });

    const result = await getRecentEmails(2);
    expect(result).toHaveLength(2);
    // Second account should not be queried because maxCount already reached
    expect(mockMessenger.folders.getSubFolders).toHaveBeenCalledTimes(1);
  });
});

describe('getAllEmailHeaders – branch coverage', () => {
  it('filters out junk and drafts folder types', async () => {
    mockMessenger.accounts.list.mockResolvedValue([{ id: 'acc1', name: 'Work' }]);
    mockMessenger.messages.query.mockResolvedValue({
      messages: [
        {
          id: 1,
          author: 'a@t.com',
          subject: 'Inbox msg',
          date: new Date(),
          folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
          tags: [],
        },
        {
          id: 2,
          author: 'b@t.com',
          subject: 'Junk msg',
          date: new Date(),
          folder: { name: 'Junk', accountId: 'acc1', type: 'junk' },
          tags: [],
        },
        {
          id: 3,
          author: 'c@t.com',
          subject: 'Draft msg',
          date: new Date(),
          folder: { name: 'Drafts', accountId: 'acc1', type: 'drafts' },
          tags: [],
        },
      ],
    });

    const result = await getAllEmailHeaders({});
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].subject).toBe('Inbox msg');
  });

  it('paginates via page.id in getAllEmailHeaders', async () => {
    mockMessenger.accounts.list.mockResolvedValue([{ id: 'acc1', name: 'Work' }]);
    mockMessenger.messages.query.mockResolvedValue({
      id: 'qpage-1',
      messages: [
        {
          id: 1,
          author: 'a@t.com',
          subject: 'Msg1',
          date: new Date('2024-01-01'),
          folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
          tags: [],
        },
      ],
    });
    mockMessenger.messages.continueList.mockResolvedValue({
      messages: [
        {
          id: 2,
          author: 'b@t.com',
          subject: 'Msg2',
          date: new Date('2024-02-01'),
          folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
          tags: [],
        },
      ],
    });

    const result = await getAllEmailHeaders({});
    expect(result.emails).toHaveLength(2);
    expect(mockMessenger.messages.continueList).toHaveBeenCalledWith('qpage-1');
  });

  it('filters by accountId when provided', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work' },
      { id: 'acc2', name: 'Personal' },
    ]);
    mockMessenger.messages.query.mockResolvedValue({
      messages: [
        {
          id: 1,
          author: 'a@t.com',
          subject: 'Msg1',
          date: new Date(),
          folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
          tags: [],
        },
      ],
    });

    const result = await getAllEmailHeaders({ accountId: 'acc1' });
    expect(result.emails).toHaveLength(1);
    // Verify the query was called with the accountId
    expect(mockMessenger.messages.query).toHaveBeenCalledWith({ accountId: 'acc1' });
  });

  it('skipAnalyzed increments skippedAnalyzed count and reports it', async () => {
    mockMessenger.accounts.list.mockResolvedValue([{ id: 'acc1', name: 'Work' }]);
    mockMessenger.messages.query.mockResolvedValue({
      messages: [
        {
          id: 1,
          author: 'a@t.com',
          subject: 'Unanalyzed',
          date: new Date(),
          folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
          tags: [],
        },
        {
          id: 2,
          author: 'b@t.com',
          subject: 'Analyzed1',
          date: new Date(),
          folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
          tags: ['smm_analyzed'],
        },
        {
          id: 3,
          author: 'c@t.com',
          subject: 'Analyzed2',
          date: new Date(),
          folder: { name: 'Inbox', accountId: 'acc1', type: 'inbox' },
          tags: ['smm_analyzed'],
        },
      ],
    });

    const result = await getAllEmailHeaders({ skipAnalyzed: true });
    expect(result.emails).toHaveLength(1);
    expect(result.skippedAnalyzed).toBe(2);
  });

  it('handles messages with missing folder info gracefully', async () => {
    mockMessenger.accounts.list.mockResolvedValue([{ id: 'acc1', name: 'Work' }]);
    mockMessenger.messages.query.mockResolvedValue({
      messages: [
        {
          id: 1,
          author: 'a@t.com',
          subject: 'No folder',
          date: new Date(),
          folder: undefined,
          tags: [],
        },
      ],
    });

    const result = await getAllEmailHeaders({});
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].folderName).toBe('');
    expect(result.emails[0].accountName).toBe('');
  });
});

describe('markEmailsAnalyzed – branch coverage', () => {
  it('returns success with marked=0 for empty messageIds array', async () => {
    mockMessenger.messages.tags.list.mockResolvedValue([{ key: 'smm_analyzed' }]);

    const result = await markEmailsAnalyzed([]);
    expect(result.success).toBe(true);
    expect(result.marked).toBe(0);
    expect(mockMessenger.messages.get).not.toHaveBeenCalled();
    expect(mockMessenger.messages.update).not.toHaveBeenCalled();
  });

  it('skips message when tag already exists (does not call update)', async () => {
    mockMessenger.messages.tags.list.mockResolvedValue([{ key: 'smm_analyzed' }]);
    mockMessenger.messages.get.mockResolvedValueOnce({ id: 1, tags: ['smm_analyzed'] });
    mockMessenger.messages.get.mockResolvedValueOnce({ id: 2, tags: ['other'] });
    mockMessenger.messages.update.mockResolvedValue(undefined);

    const result = await markEmailsAnalyzed([1, 2]);
    expect(result.success).toBe(true);
    expect(result.marked).toBe(1);
    // update should only be called for message 2
    expect(mockMessenger.messages.update).toHaveBeenCalledTimes(1);
    expect(mockMessenger.messages.update).toHaveBeenCalledWith(2, {
      tags: ['other', 'smm_analyzed'],
    });
  });

  it('continues processing when individual message update throws error', async () => {
    mockMessenger.messages.tags.list.mockResolvedValue([{ key: 'smm_analyzed' }]);
    // First message: get succeeds but update throws
    mockMessenger.messages.get
      .mockResolvedValueOnce({ id: 1, tags: [] })
      .mockResolvedValueOnce({ id: 2, tags: [] });
    mockMessenger.messages.update
      .mockRejectedValueOnce(new Error('update failed'))
      .mockResolvedValueOnce(undefined);

    const result = await markEmailsAnalyzed([1, 2]);
    // The first message threw during the try block for that msgId,
    // so marked only increments for successful ones. But since the error
    // is caught at the individual message level (before marked++), we
    // need to check the actual flow. Looking at the code: update throws
    // before marked++, so marked=0 for msg 1. For msg 2 it succeeds, marked=1.
    // Actually wait - the update is called, then marked++ happens.
    // If update throws, the catch catches it, so marked doesn't increment for msg 1.
    expect(result.success).toBe(true);
    // msg 1 failed update (caught), msg 2 succeeded
    expect(result.marked).toBe(1);
    expect(mockMessenger.messages.update).toHaveBeenCalledTimes(2);
  });

  it('continues when messenger.messages.get throws for a message', async () => {
    mockMessenger.messages.tags.list.mockResolvedValue([{ key: 'smm_analyzed' }]);
    mockMessenger.messages.get
      .mockRejectedValueOnce(new Error('get failed'))
      .mockResolvedValueOnce({ id: 2, tags: [] });
    mockMessenger.messages.update.mockResolvedValue(undefined);

    const result = await markEmailsAnalyzed([1, 2]);
    expect(result.success).toBe(true);
    expect(result.marked).toBe(1);
  });
});
