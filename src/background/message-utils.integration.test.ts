/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOwnAddresses, getAllFolders, hasAttachments } from './message-utils';

const mockMessenger = {
  accounts: {
    list: vi.fn(),
  },
  folders: {
    getSubFolders: vi.fn(),
  },
  messages: {
    listAttachments: vi.fn(),
  },
};
vi.stubGlobal('messenger', mockMessenger);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getOwnAddresses', () => {
  it('returns emails from all accounts and identities', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      {
        id: 'acc1',
        name: 'Work',
        identities: [
          { email: 'alice@work.com' },
          { email: 'alice.backup@work.com' },
        ],
      },
      {
        id: 'acc2',
        name: 'Personal',
        identities: [
          { email: 'alice@personal.com' },
        ],
      },
    ]);

    const result = await getOwnAddresses();
    expect(result).toEqual(['alice@work.com', 'alice.backup@work.com', 'alice@personal.com']);
  });

  it('returns lowercased addresses', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      {
        id: 'acc1',
        name: 'Work',
        identities: [
          { email: 'Alice@Work.COM' },
          { email: 'BOB@Example.Org' },
        ],
      },
    ]);

    const result = await getOwnAddresses();
    expect(result).toEqual(['alice@work.com', 'bob@example.org']);
  });

  it('returns empty array when no accounts', async () => {
    mockMessenger.accounts.list.mockResolvedValue([]);

    const result = await getOwnAddresses();
    expect(result).toEqual([]);
  });

  it('returns empty array on API error', async () => {
    mockMessenger.accounts.list.mockRejectedValue(new Error('API unavailable'));

    const result = await getOwnAddresses();
    expect(result).toEqual([]);
  });
});

describe('getAllFolders', () => {
  it('returns flat list with accountName from all accounts', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work', rootFolder: { id: 'root1' } },
      { id: 'acc2', name: 'Personal', rootFolder: { id: 'root2' } },
    ]);

    mockMessenger.folders.getSubFolders.mockImplementation(async (folderId: string) => {
      if (folderId === 'root1') {
        return [{ id: 'folder1', name: 'Inbox', type: 'inbox' }];
      }
      if (folderId === 'root2') {
        return [{ id: 'folder2', name: 'Sent', type: 'sent' }];
      }
      return [];
    });

    const result = await getAllFolders();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'folder1', name: 'Inbox', accountName: 'Work' });
    expect(result[1]).toMatchObject({ id: 'folder2', name: 'Sent', accountName: 'Personal' });
  });

  it('includes nested subfolders recursively', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work', rootFolder: { id: 'root1' } },
    ]);

    mockMessenger.folders.getSubFolders.mockImplementation(async (folderId: string) => {
      if (folderId === 'root1') {
        return [{ id: 'inbox', name: 'Inbox', type: 'inbox' }];
      }
      if (folderId === 'inbox') {
        return [{ id: 'important', name: 'Important', type: 'inbox' }];
      }
      if (folderId === 'important') {
        return [{ id: 'vip', name: 'VIP', type: 'inbox' }];
      }
      return [];
    });

    const result = await getAllFolders();
    expect(result).toHaveLength(3);
    expect(result.map((f) => f.name)).toEqual(['Inbox', 'Important', 'VIP']);
    expect(result.every((f) => f.accountName === 'Work')).toBe(true);
  });

  it('returns empty for accounts with no subfolders', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Empty', rootFolder: { id: 'root1' } },
    ]);

    mockMessenger.folders.getSubFolders.mockResolvedValue([]);

    const result = await getAllFolders();
    expect(result).toEqual([]);
  });
});

describe('hasAttachments', () => {
  it('returns true when attachments exist', async () => {
    mockMessenger.messages.listAttachments.mockResolvedValue([
      { name: 'file.pdf', size: 1024, contentType: 'application/pdf' },
    ]);

    const result = await hasAttachments(42);
    expect(result).toBe(true);
    expect(mockMessenger.messages.listAttachments).toHaveBeenCalledWith(42);
  });

  it('returns false when no attachments', async () => {
    mockMessenger.messages.listAttachments.mockResolvedValue([]);

    const result = await hasAttachments(42);
    expect(result).toBe(false);
  });

  it('returns false on API error', async () => {
    mockMessenger.messages.listAttachments.mockRejectedValue(new Error('Message not found'));

    const result = await hasAttachments(999);
    expect(result).toBe(false);
  });
});
