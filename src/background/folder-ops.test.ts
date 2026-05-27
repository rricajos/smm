/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFolder, deleteFolder, renameFolder, moveFolderContents, getFolderTree } from './folder-ops';

vi.mock('../lib/i18n', () => ({
  getLocaleFromStorage: vi.fn().mockResolvedValue('en'),
  translate: vi.fn((_loc: string, key: string) => key),
}));

vi.mock('../lib/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockMessenger = {
  folders: {
    create: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    getSubFolders: vi.fn(),
    getFolderInfo: vi.fn(),
  },
  messages: {
    list: vi.fn(),
    continueList: vi.fn(),
    move: vi.fn(),
  },
  accounts: {
    list: vi.fn(),
  },
};

vi.stubGlobal('messenger', mockMessenger);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createFolder', () => {
  it('creates a folder and returns success', async () => {
    mockMessenger.folders.create.mockResolvedValue({
      id: 'folder-1', accountId: 'acc1', name: 'NewFolder', path: 'NewFolder',
    });
    const result = await createFolder('parent-id', 'NewFolder');
    expect(result.success).toBe(true);
    expect(result.folder).toEqual({ id: 'folder-1', name: 'NewFolder', path: 'NewFolder' });
    expect(mockMessenger.folders.create).toHaveBeenCalledWith('parent-id', 'NewFolder');
  });

  it('falls back to composite id when id is empty', async () => {
    mockMessenger.folders.create.mockResolvedValue({
      id: '', accountId: 'acc1', name: 'Test', path: 'Inbox/Test',
    });
    const result = await createFolder('parent', 'Test');
    expect(result.folder!.id).toBe('acc1:/Inbox/Test');
  });

  it('returns error on API failure', async () => {
    mockMessenger.folders.create.mockRejectedValue(new Error('Permission denied'));
    const result = await createFolder('parent', 'Folder');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Permission denied');
  });
});

describe('deleteFolder', () => {
  it('deletes a folder and returns success', async () => {
    mockMessenger.folders.delete.mockResolvedValue(undefined);
    const result = await deleteFolder('folder-1');
    expect(result.success).toBe(true);
    expect(mockMessenger.folders.delete).toHaveBeenCalledWith('folder-1');
  });

  it('returns error on API failure', async () => {
    mockMessenger.folders.delete.mockRejectedValue(new Error('Not found'));
    const result = await deleteFolder('bad-id');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });
});

describe('renameFolder', () => {
  it('renames a folder and returns updated info', async () => {
    mockMessenger.folders.rename.mockResolvedValue({
      id: 'folder-1', accountId: 'acc1', name: 'Renamed', path: 'Renamed',
    });
    const result = await renameFolder('folder-1', 'Renamed');
    expect(result.success).toBe(true);
    expect(result.folder).toEqual({ id: 'folder-1', name: 'Renamed', path: 'Renamed' });
  });

  it('returns error on API failure', async () => {
    mockMessenger.folders.rename.mockRejectedValue(new Error('Invalid name'));
    const result = await renameFolder('folder-1', '');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid name');
  });
});

describe('moveFolderContents', () => {
  it('moves messages and returns count', async () => {
    mockMessenger.messages.list.mockResolvedValue({
      messages: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    mockMessenger.messages.move.mockResolvedValue(undefined);
    const result = await moveFolderContents('src-folder', 'dest-folder', false);
    expect(result.success).toBe(true);
    expect(result.movedCount).toBe(3);
    expect(mockMessenger.messages.move).toHaveBeenCalledWith([1, 2, 3], 'dest-folder');
    expect(mockMessenger.folders.delete).not.toHaveBeenCalled();
  });

  it('deletes source folder when deleteSource is true', async () => {
    mockMessenger.messages.list.mockResolvedValue({ messages: [] });
    mockMessenger.folders.delete.mockResolvedValue(undefined);
    const result = await moveFolderContents('src', 'dest', true);
    expect(result.success).toBe(true);
    expect(result.movedCount).toBe(0);
    expect(mockMessenger.folders.delete).toHaveBeenCalledWith('src');
  });

  it('returns error for missing folder IDs', async () => {
    const result = await moveFolderContents('', 'dest', false);
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('handles pagination when collecting messages', async () => {
    mockMessenger.messages.list.mockResolvedValue({ id: 'page-1', messages: [{ id: 1 }] });
    mockMessenger.messages.continueList.mockResolvedValue({ messages: [{ id: 2 }] });
    mockMessenger.messages.move.mockResolvedValue(undefined);
    const result = await moveFolderContents('src', 'dest', false);
    expect(result.success).toBe(true);
    expect(result.movedCount).toBe(2);
  });
});

describe('getFolderTree', () => {
  it('builds tree from multiple accounts', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Work', rootFolder: { id: 'root1' } },
      { id: 'acc2', name: 'Personal', rootFolder: { id: 'root2' } },
    ]);
    mockMessenger.folders.getSubFolders.mockResolvedValue([]);
    const result = await getFolderTree();
    expect(result).toHaveLength(2);
    expect(result[0].accountName).toBe('Work');
    expect(result[1].accountName).toBe('Personal');
  });

  it('builds nested folder structure with message counts', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Main', rootFolder: { id: 'root1' } },
    ]);
    mockMessenger.folders.getSubFolders
      .mockResolvedValueOnce([{ id: 'inbox', accountId: 'acc1', name: 'Inbox', path: 'Inbox', type: 'inbox' }])
      .mockResolvedValueOnce([{ id: 'sub1', accountId: 'acc1', name: 'Work', path: 'Inbox/Work' }])
      .mockResolvedValue([]);
    mockMessenger.folders.getFolderInfo
      .mockResolvedValueOnce({ totalMessageCount: 10, unreadMessageCount: 3 })
      .mockResolvedValueOnce({ totalMessageCount: 5, unreadMessageCount: 1 });

    const result = await getFolderTree();
    expect(result).toHaveLength(1);
    const inbox = result[0].folders[0];
    expect(inbox.name).toBe('Inbox');
    expect(inbox.totalMessages).toBe(10);
    expect(inbox.children).toHaveLength(1);
    expect(inbox.children[0].name).toBe('Work');
  });

  it('returns empty array when no accounts', async () => {
    mockMessenger.accounts.list.mockResolvedValue([]);
    expect(await getFolderTree()).toEqual([]);
  });

  it('falls back to folder properties when getFolderInfo fails', async () => {
    mockMessenger.accounts.list.mockResolvedValue([
      { id: 'acc1', name: 'Main', rootFolder: { id: 'root1' } },
    ]);
    mockMessenger.folders.getSubFolders
      .mockResolvedValueOnce([{ id: 'f1', accountId: 'acc1', name: 'Inbox', path: 'Inbox', totalMessageCount: 7, unreadMessageCount: 2 }])
      .mockResolvedValue([]);
    mockMessenger.folders.getFolderInfo.mockRejectedValue(new Error('Not supported'));

    const result = await getFolderTree();
    expect(result[0].folders[0].totalMessages).toBe(7);
    expect(result[0].folders[0].unreadMessages).toBe(2);
  });
});
