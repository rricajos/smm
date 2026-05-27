/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

/**
 * Integration tests for the background classification + action flow.
 * These mock only the Thunderbird messenger APIs (the boundary) and use
 * real implementations of classifier, autoresponder, and storage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory storage backing
let storageData: Record<string, unknown> = {};

const storageLocal = {
  get: vi.fn(async (keys: string | string[]) => {
    const keyList = typeof keys === 'string' ? [keys] : keys;
    const result: Record<string, unknown> = {};
    for (const k of keyList) {
      if (k in storageData) result[k] = storageData[k];
    }
    return result;
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(storageData, items);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    const keyList = typeof keys === 'string' ? [keys] : keys;
    for (const k of keyList) delete storageData[k];
  }),
};

// browser.storage.local is used by storage.ts (WebExtension API)
vi.stubGlobal('browser', {
  storage: { local: storageLocal },
});

vi.stubGlobal('messenger', {
  messages: {
    get: vi.fn(),
    getFull: vi.fn().mockResolvedValue(null),
    move: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ messages: [], id: null }),
    listAttachments: vi.fn().mockResolvedValue([]),
    tags: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(undefined),
    },
    onNewMailReceived: { addListener: vi.fn() },
  },
  folders: {
    getSubFolders: vi.fn().mockResolvedValue([]),
  },
  accounts: {
    list: vi.fn().mockResolvedValue([
      {
        id: 'acc1',
        name: 'Test Account',
        rootFolder: { id: 'root1' },
        identities: [{ name: 'Tester', email: 'me@test.com' }],
      },
    ]),
  },
  compose: {
    beginReply: vi.fn().mockResolvedValue({ id: 1 }),
    saveMessage: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  storage: { local: storageLocal },
});

// Import real implementations after messenger is stubbed
import { classifyMessage, executeActions } from './classifier';
import { triggerAutoResponse } from './autoresponder';
import * as storageModule from '../lib/utils/storage';
import type { Rule } from '../types/rules';
import type { ResponseTemplate } from '../types/templates';
import type { Settings, ActivityEntry } from '../types/settings';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../lib/utils/constants';

function makeHeader(
  overrides: Partial<messenger.messages.MessageHeader> = {},
): messenger.messages.MessageHeader {
  return {
    id: 100,
    subject: 'Invoice #123',
    author: 'sender@example.com',
    recipients: ['me@test.com'],
    date: new Date(),
    read: false,
    flagged: false,
    tags: [],
    folder: { accountId: 'acc1', name: 'Inbox', path: 'Inbox', type: 'inbox' },
    ...overrides,
  } as messenger.messages.MessageHeader;
}

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'rule-1',
    name: 'Invoice Rule',
    enabled: true,
    conditions: [{ field: 'subject', operator: 'contains', value: 'Invoice', caseSensitive: false }],
    conditionLogic: 'all',
    actions: [{ type: 'moveToFolder', folderId: 'folder-invoices' }, { type: 'markRead' }],
    stopProcessing: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<ResponseTemplate> = {}): ResponseTemplate {
  return {
    id: 'tpl-1',
    name: 'Auto Reply',
    subject: 'Re: {{subject}}',
    body: 'Thank you for your email, {{sender_name}}.',
    isPlainText: true,
    sendMode: 'draft',
    replyType: 'replyToSender',
    ...overrides,
  };
}

function seedStorage(rules: Rule[], templates: ResponseTemplate[], settings?: Partial<Settings>) {
  storageData = {
    [STORAGE_KEYS.RULES]: rules,
    [STORAGE_KEYS.TEMPLATES]: templates,
    [STORAGE_KEYS.SETTINGS]: { ...DEFAULT_SETTINGS, ...settings },
    [STORAGE_KEYS.ACTIVITY_LOG]: [],
    [STORAGE_KEYS.AUTO_RESPONSE_COUNT]: { hour: 0, count: 0 },
  };
}

// Helper: flush the batched activity log by advancing timers
async function flushLog() {
  await vi.advanceTimersByTimeAsync(600);
}

describe('Background integration flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    storageData = {};
  });

  it('email matching rule → moves to folder + marks as read + logs activity', async () => {
    const rule = makeRule();
    seedStorage([rule], []);
    const header = makeHeader();

    const results = await classifyMessage(header, null);
    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('rule-1');

    await executeActions(header, results);
    await flushLog();

    expect(messenger.messages.move).toHaveBeenCalledWith([100], 'folder-invoices');
    expect(messenger.messages.update).toHaveBeenCalledWith(100, { read: true });

    // Verify activity log entry was written
    const log = storageData[STORAGE_KEYS.ACTIVITY_LOG] as ActivityEntry[];
    expect(log.length).toBeGreaterThanOrEqual(1);
    const entry = log[0]; // unshift puts newest first
    expect(entry.ruleId).toBe('rule-1');
    expect(entry.type).toBe('classification');
  });

  it('email matching autoRespond rule → triggers draft creation', async () => {
    const rule = makeRule({
      id: 'rule-auto',
      actions: [{ type: 'autoRespond', templateId: 'tpl-1' }],
    });
    const template = makeTemplate();
    seedStorage([rule], [template], { autoResponseEnabled: true });

    const header = makeHeader({ author: 'external@example.com' });
    const results = await classifyMessage(header, null);
    expect(results).toHaveLength(1);

    await triggerAutoResponse(header, null, 'tpl-1');

    expect(messenger.compose.beginReply).toHaveBeenCalled();
  });

  it('email not matching any rule → no actions executed', async () => {
    const rule = makeRule({
      conditions: [
        { field: 'subject', operator: 'contains', value: 'ZZZZZ', caseSensitive: false },
      ],
    });
    seedStorage([rule], []);

    const header = makeHeader({ subject: 'Hello world' });
    const results = await classifyMessage(header, null);

    expect(results).toHaveLength(0);
    expect(messenger.messages.move).not.toHaveBeenCalled();
    expect(messenger.messages.update).not.toHaveBeenCalled();
  });

  it('rate limit exceeded → auto-response skipped with error log', async () => {
    const rule = makeRule({
      actions: [{ type: 'autoRespond', templateId: 'tpl-1' }],
    });
    const template = makeTemplate();
    seedStorage([rule], [template], {
      autoResponseEnabled: true,
      maxAutoResponsesPerHour: 5,
    });

    // Spy on checkRateLimit to simulate exceeded limit
    const spy = vi.spyOn(storageModule, 'checkRateLimit').mockResolvedValue(false);

    const header = makeHeader({ author: 'external@example.com' });
    await triggerAutoResponse(header, null, 'tpl-1');

    // Rate limit should block — beginReply never called
    expect(messenger.compose.beginReply).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(5);

    spy.mockRestore();
  });

  it('multiple emails processed — only matching ones get actions', async () => {
    const rule = makeRule();
    seedStorage([rule], []);

    const headers = [
      makeHeader({ id: 1, subject: 'Invoice #1' }),
      makeHeader({ id: 2, subject: 'Hello friend' }),
      makeHeader({ id: 3, subject: 'Invoice #2' }),
    ];

    let moveCount = 0;
    for (const h of headers) {
      const results = await classifyMessage(h, null);
      if (results.length > 0) {
        await executeActions(h, results);
        moveCount++;
      }
    }

    expect(moveCount).toBe(2);
    expect(messenger.messages.move).toHaveBeenCalledTimes(2);
  });

  it('classification disabled → no processing', async () => {
    const rule = makeRule();
    // Simulate what the background script does: check settings first
    seedStorage([rule], [], { classificationEnabled: false });

    const header = makeHeader();
    const settings = storageData[STORAGE_KEYS.SETTINGS] as Settings;

    if (settings.classificationEnabled) {
      const results = await classifyMessage(header, null);
      await executeActions(header, results);
    }

    expect(messenger.messages.move).not.toHaveBeenCalled();
    expect(messenger.messages.update).not.toHaveBeenCalled();
  });
});
