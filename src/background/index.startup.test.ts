/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
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
  getAllFolders: vi.fn().mockResolvedValue([]),
}));
vi.mock('../lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('./folder-ops', () => ({
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  renameFolder: vi.fn(),
  moveFolderContents: vi.fn(),
  getFolderTree: vi.fn(),
}));
vi.mock('./email-queries', () => ({
  getRecentEmails: vi.fn(),
  getAllEmailHeaders: vi.fn(),
  markEmailsAnalyzed: vi.fn(),
}));
vi.mock('./rule-testing', () => ({
  testRule: vi.fn(),
  processExisting: vi.fn(),
  testSingleRule: vi.fn(),
}));

vi.stubGlobal('messenger', {
  spacesToolbar: { addButton: vi.fn(), clickButton: vi.fn().mockResolvedValue(undefined) },
  messages: {
    get: vi.fn().mockResolvedValue({ id: 1, subject: 'Test', author: 'a@b.com' }),
    getFull: vi.fn().mockResolvedValue(null),
    tags: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(undefined),
    },
    onNewMailReceived: { addListener: vi.fn() },
  },
  runtime: { onMessage: { addListener: vi.fn() } },
  storage: {
    local: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
  },
  tabs: { query: vi.fn().mockResolvedValue([]) },
  messageDisplay: { getDisplayedMessages: vi.fn().mockResolvedValue([]) },
  notifications: { create: vi.fn() },
  accounts: { list: vi.fn().mockResolvedValue([]) },
  folders: { getSubFolders: vi.fn().mockResolvedValue([]) },
});

async function flushAsync() {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('startup initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('runs log cleanup and logs when entries removed', async () => {
    const { cleanupOldActivityEntries } = await import('../lib/utils/storage');
    const { logger } = await import('../lib/utils/logger');
    vi.mocked(cleanupOldActivityEntries).mockResolvedValueOnce(5);

    await import('./index');
    await flushAsync();

    expect(cleanupOldActivityEntries).toHaveBeenCalledWith(30);
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('removed 5'));
  });

  it('skips log cleanup when logRetentionDays is 0', async () => {
    const { getSettings, cleanupOldActivityEntries } = await import('../lib/utils/storage');
    vi.mocked(getSettings).mockResolvedValueOnce({
      classificationEnabled: true,
      autoResponseEnabled: true,
      logRetentionDays: 0,
      notifyOnClassification: false,
      notifyOnAutoResponse: false,
      processExistingOnStartup: false,
      maxAutoResponsesPerHour: 10,
      aiProvider: 'openrouter',
      openaiApiKey: '',
      openaiModel: '',
      customBaseUrl: '',
      aiConsentAccepted: false,
    });

    await import('./index');
    await flushAsync();

    expect(cleanupOldActivityEntries).not.toHaveBeenCalled();
  });

  it('handles log cleanup error gracefully', async () => {
    const { getSettings } = await import('../lib/utils/storage');
    const { logger } = await import('../lib/utils/logger');
    vi.mocked(getSettings).mockRejectedValueOnce(new Error('storage fail'));

    await import('./index');
    await flushAsync();

    expect(logger.error).toHaveBeenCalledWith('Error during log cleanup', expect.any(Error));
  });

  it('creates analyzed tag when not found', async () => {
    await import('./index');
    await flushAsync();

    expect(messenger.messages.tags.create).toHaveBeenCalledWith(
      'smm_analyzed',
      expect.any(String),
      '#90CAF9',
    );
  });

  it('skips tag creation when tag already exists', async () => {
    (messenger.messages.tags.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { key: 'smm_analyzed', tag: 'Analyzed', color: '#90CAF9' },
    ]);

    await import('./index');
    await flushAsync();

    expect(messenger.messages.tags.create).not.toHaveBeenCalled();
  });

  it('handles tag creation error gracefully', async () => {
    (messenger.messages.tags.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('tag fail'),
    );
    const { logger } = await import('../lib/utils/logger');

    await import('./index');
    await flushAsync();

    expect(logger.error).toHaveBeenCalledWith('Error creating analyzed tag', expect.any(Error));
  });
});
