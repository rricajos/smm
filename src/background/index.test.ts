/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before importing the module
vi.mock('./classifier', () => ({
  classifyMessage: vi.fn().mockResolvedValue([]),
  executeActions: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./autoresponder', () => ({
  triggerAutoResponse: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../lib/utils/storage', () => ({
  getSettings: vi.fn().mockResolvedValue({
    classificationEnabled: true,
    autoResponseEnabled: true,
    logRetentionDays: 30,
    notifyOnClassification: false,
  }),
  cleanupOldActivityEntries: vi.fn().mockResolvedValue(0),
}));
vi.mock('../lib/i18n', () => ({
  getLocaleFromStorage: vi.fn().mockResolvedValue('es'),
  translate: vi.fn((_loc: string, key: string) => key),
}));
vi.mock('./message-utils', () => ({
  getAllFolders: vi.fn().mockResolvedValue([
    { id: 'f1', accountId: 'a1', name: 'Inbox', path: 'Inbox' },
  ]),
}));
vi.mock('../lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('./folder-ops', () => ({
  createFolder: vi.fn().mockResolvedValue({ id: 'new-folder', name: 'New' }),
  deleteFolder: vi.fn().mockResolvedValue(undefined),
  renameFolder: vi.fn().mockResolvedValue(undefined),
  moveFolderContents: vi.fn().mockResolvedValue(undefined),
  getFolderTree: vi.fn().mockResolvedValue([]),
}));
vi.mock('./email-queries', () => ({
  getRecentEmails: vi.fn().mockResolvedValue([]),
  getAllEmailHeaders: vi.fn().mockResolvedValue([]),
  markEmailsAnalyzed: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./rule-testing', () => ({
  testRule: vi.fn().mockResolvedValue({ matched: true, results: ['Rule A'] }),
  processExisting: vi.fn().mockResolvedValue({ processed: 10, matched: 3, errors: 0 }),
  testSingleRule: vi.fn().mockResolvedValue({ processed: 5, matched: 2, details: [] }),
}));

// Stub messenger global
let onMessageCallback: (msg: unknown, sender: unknown) => Promise<unknown>;

vi.stubGlobal('messenger', {
  spacesToolbar: {
    addButton: vi.fn(),
    clickButton: vi.fn().mockResolvedValue(undefined),
  },
  messages: {
    get: vi.fn().mockResolvedValue({ id: 1, subject: 'Test', author: 'a@b.com' }),
    tags: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(undefined),
    },
    onNewMailReceived: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    onMessage: {
      addListener: vi.fn((cb: (msg: unknown, sender: unknown) => Promise<unknown>) => {
        onMessageCallback = cb;
      }),
    },
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
  },
  messageDisplay: {
    getDisplayedMessages: vi.fn().mockResolvedValue([]),
  },
  notifications: {
    create: vi.fn(),
  },
  accounts: {
    list: vi.fn().mockResolvedValue([]),
  },
  folders: {
    getSubFolders: vi.fn().mockResolvedValue([]),
  },
});

// Import after mocks are set up
beforeEach(async () => {
  vi.clearAllMocks();
  // Re-import to re-register the listener
  await import('./index');
});

describe('background message handler', () => {
  it('GET_FOLDERS dispatches to getAllFolders', async () => {
    const { getAllFolders } = await import('./message-utils');
    const result = await onMessageCallback({ type: 'GET_FOLDERS' }, {});
    expect(getAllFolders).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'f1', accountId: 'a1', name: 'Inbox', path: 'Inbox' }]);
  });

  it('TEST_RULE dispatches to testRule with correct args', async () => {
    const { testRule } = await import('./rule-testing');
    const result = await onMessageCallback(
      { type: 'TEST_RULE', messageId: 42, ruleId: 'r1' },
      {},
    );
    expect(testRule).toHaveBeenCalledWith(42, 'r1');
    expect(result).toEqual({ matched: true, results: ['Rule A'] });
  });

  it('PROCESS_EXISTING dispatches with limit, default 50', async () => {
    const { processExisting } = await import('./rule-testing');
    await onMessageCallback({ type: 'PROCESS_EXISTING' }, {});
    expect(processExisting).toHaveBeenCalledWith(50);
  });

  it('PROCESS_EXISTING uses custom limit when provided', async () => {
    const { processExisting } = await import('./rule-testing');
    await onMessageCallback({ type: 'PROCESS_EXISTING', limit: 100 }, {});
    expect(processExisting).toHaveBeenCalledWith(100);
  });

  it('CREATE_FOLDER dispatches correctly', async () => {
    const { createFolder } = await import('./folder-ops');
    await onMessageCallback(
      { type: 'CREATE_FOLDER', parentFolderId: 'p1', folderName: 'New' },
      {},
    );
    expect(createFolder).toHaveBeenCalledWith('p1', 'New');
  });

  it('DELETE_FOLDER dispatches correctly', async () => {
    const { deleteFolder } = await import('./folder-ops');
    await onMessageCallback({ type: 'DELETE_FOLDER', folderId: 'f1' }, {});
    expect(deleteFolder).toHaveBeenCalledWith('f1');
  });

  it('CLASSIFY_MESSAGE calls processMessage flow', async () => {
    const result = await onMessageCallback({ type: 'CLASSIFY_MESSAGE', messageId: 1 }, {});
    expect(messenger.messages.get).toHaveBeenCalledWith(1);
    expect(result).toEqual({ success: true });
  });

  it('unknown message type returns error', async () => {
    const result = await onMessageCallback({ type: 'UNKNOWN_TYPE' }, {});
    expect(result).toEqual({ error: 'Unknown message type' });
  });
});
