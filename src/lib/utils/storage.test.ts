/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getRules,
  saveRules,
  getTemplates,
  saveTemplates,
  getSettings,
  saveSettings,
  getActivityLog,
  appendActivityLog,
  clearActivityLog,
  cleanupOldActivityEntries,
  getAutoResponseCount,
  incrementAutoResponseCount,
  checkRateLimit,
} from './storage';
import { STORAGE_KEYS, DEFAULT_SETTINGS, MAX_ACTIVITY_LOG_ENTRIES } from './constants';
import type { ActivityEntry } from '../../types/settings';
import type { Rule } from '../../types/rules';
import type { ResponseTemplate } from '../../types/templates';

let mockStorage: Record<string, unknown> = {};

const mockBrowser = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => {
        if (key in mockStorage) {
          return { [key]: mockStorage[key] };
        }
        return {};
      }),
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(mockStorage, data);
      }),
    },
  },
};

vi.stubGlobal('browser', mockBrowser);

function makeEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    timestamp: Date.now(),
    ruleId: 'rule-1',
    ruleName: 'Test Rule',
    messageId: 100,
    subject: 'Test Subject',
    from: 'sender@test.com',
    actions: ['markRead'],
    type: 'classification',
    ...overrides,
  };
}

describe('getRules', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('returns empty array when no data is stored', async () => {
    const result = await getRules();
    expect(result).toEqual([]);
  });

  it('returns stored rules', async () => {
    const rules: Rule[] = [
      {
        id: 'r1',
        name: 'Rule 1',
        enabled: true,
        conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
        conditionLogic: 'all',
        actions: [{ type: 'markRead' }],
        stopProcessing: false,
        createdAt: 1000,
        updatedAt: 2000,
      },
    ];
    mockStorage[STORAGE_KEYS.RULES] = rules;
    const result = await getRules();
    expect(result).toEqual(rules);
  });

  it('returns empty array when stored value is undefined', async () => {
    mockStorage[STORAGE_KEYS.RULES] = undefined;
    const result = await getRules();
    expect(result).toEqual([]);
  });
});

describe('saveRules', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('saves rules to the correct storage key', async () => {
    const rules: Rule[] = [
      {
        id: 'r1',
        name: 'Rule 1',
        enabled: true,
        conditions: [],
        conditionLogic: 'all',
        actions: [],
        stopProcessing: false,
        createdAt: 1000,
        updatedAt: 2000,
      },
    ];
    await saveRules(rules);
    expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.RULES]: rules,
    });
  });

  it('overwrites existing rules', async () => {
    const original: Rule[] = [
      {
        id: 'r1',
        name: 'Old',
        enabled: true,
        conditions: [],
        conditionLogic: 'all',
        actions: [],
        stopProcessing: false,
        createdAt: 1000,
        updatedAt: 2000,
      },
    ];
    await saveRules(original);

    const updated: Rule[] = [
      {
        id: 'r2',
        name: 'New',
        enabled: false,
        conditions: [],
        conditionLogic: 'any',
        actions: [],
        stopProcessing: true,
        createdAt: 3000,
        updatedAt: 4000,
      },
    ];
    await saveRules(updated);

    expect(mockStorage[STORAGE_KEYS.RULES]).toEqual(updated);
  });
});

describe('getTemplates', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('returns empty array when no data is stored', async () => {
    const result = await getTemplates();
    expect(result).toEqual([]);
  });

  it('returns stored templates', async () => {
    const templates: ResponseTemplate[] = [
      {
        id: 'tmpl-1',
        name: 'Template 1',
        subject: 'Re: {{subject}}',
        body: 'Hello',
        isPlainText: true,
        sendMode: 'draft',
        replyType: 'replyToSender',
      },
    ];
    mockStorage[STORAGE_KEYS.TEMPLATES] = templates;
    const result = await getTemplates();
    expect(result).toEqual(templates);
  });
});

describe('saveTemplates', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('saves templates to the correct storage key', async () => {
    const templates: ResponseTemplate[] = [
      {
        id: 'tmpl-1',
        name: 'Template 1',
        subject: 'Re: {{subject}}',
        body: 'Hello',
        isPlainText: true,
        sendMode: 'draft',
        replyType: 'replyToSender',
      },
    ];
    await saveTemplates(templates);
    expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.TEMPLATES]: templates,
    });
  });
});

describe('getSettings', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('returns DEFAULT_SETTINGS when nothing is stored', async () => {
    const result = await getSettings();
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('merges partial stored settings with defaults', async () => {
    mockStorage[STORAGE_KEYS.SETTINGS] = { logRetentionDays: 60 };
    const result = await getSettings();
    expect(result.logRetentionDays).toBe(60);
    expect(result.classificationEnabled).toBe(DEFAULT_SETTINGS.classificationEnabled);
    expect(result.aiProvider).toBe(DEFAULT_SETTINGS.aiProvider);
  });

  it('stored values override defaults', async () => {
    mockStorage[STORAGE_KEYS.SETTINGS] = {
      classificationEnabled: false,
      autoResponseEnabled: false,
      maxAutoResponsesPerHour: 50,
    };
    const result = await getSettings();
    expect(result.classificationEnabled).toBe(false);
    expect(result.autoResponseEnabled).toBe(false);
    expect(result.maxAutoResponsesPerHour).toBe(50);
    // Defaults for non-overridden fields
    expect(result.logRetentionDays).toBe(DEFAULT_SETTINGS.logRetentionDays);
  });
});

describe('saveSettings', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('saves settings to the correct storage key', async () => {
    await saveSettings(DEFAULT_SETTINGS);
    expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
    });
  });
});

describe('getActivityLog', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('returns empty array when no data is stored', async () => {
    const result = await getActivityLog();
    expect(result).toEqual([]);
  });

  it('returns stored activity entries', async () => {
    const entries: ActivityEntry[] = [makeEntry(), makeEntry({ ruleId: 'rule-2' })];
    mockStorage[STORAGE_KEYS.ACTIVITY_LOG] = entries;
    const result = await getActivityLog();
    expect(result).toEqual(entries);
    expect(result).toHaveLength(2);
  });
});

describe('appendActivityLog', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('adds entry to buffer and schedules flush', async () => {
    const entry = makeEntry();
    await appendActivityLog(entry);
    // Timer scheduled but not yet fired, so storage should not have been written
    // (only 1 entry < 10 threshold)
    expect(mockBrowser.storage.local.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ [STORAGE_KEYS.ACTIVITY_LOG]: expect.anything() }),
    );
  });

  it('flushes after timeout', async () => {
    const entry = makeEntry();
    await appendActivityLog(entry);

    // Advance timers past the 500ms flush delay
    await vi.advanceTimersByTimeAsync(500);

    expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.ACTIVITY_LOG]: [entry],
    });
  });

  it('flushes immediately when 10+ entries are pending', async () => {
    mockStorage[STORAGE_KEYS.ACTIVITY_LOG] = [];
    for (let i = 0; i < 10; i++) {
      await appendActivityLog(makeEntry({ ruleId: `rule-${i}` }));
    }
    // The 10th entry should trigger an immediate flush
    expect(mockBrowser.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ [STORAGE_KEYS.ACTIVITY_LOG]: expect.any(Array) }),
    );
    const savedLog = mockStorage[STORAGE_KEYS.ACTIVITY_LOG] as ActivityEntry[];
    expect(savedLog).toHaveLength(10);
  });

  it('respects MAX_ACTIVITY_LOG_ENTRIES cap', async () => {
    // Pre-fill storage with MAX entries
    const existingEntries = Array.from({ length: MAX_ACTIVITY_LOG_ENTRIES }, (_, i) =>
      makeEntry({ ruleId: `existing-${i}`, timestamp: 1000 + i }),
    );
    mockStorage[STORAGE_KEYS.ACTIVITY_LOG] = existingEntries;

    // Append 10 new entries to trigger immediate flush
    for (let i = 0; i < 10; i++) {
      await appendActivityLog(makeEntry({ ruleId: `new-${i}`, timestamp: 99999 + i }));
    }

    const savedLog = mockStorage[STORAGE_KEYS.ACTIVITY_LOG] as ActivityEntry[];
    expect(savedLog).toHaveLength(MAX_ACTIVITY_LOG_ENTRIES);
    // New entries are unshifted (prepended), so first entry should be a new one
    expect(savedLog[0].ruleId).toBe('new-0');
  });

  it('prepends new entries to the front of the log', async () => {
    const existingEntry = makeEntry({ ruleId: 'old', timestamp: 1000 });
    mockStorage[STORAGE_KEYS.ACTIVITY_LOG] = [existingEntry];

    const newEntry = makeEntry({ ruleId: 'new', timestamp: 9999 });
    await appendActivityLog(newEntry);

    await vi.advanceTimersByTimeAsync(500);

    const savedLog = mockStorage[STORAGE_KEYS.ACTIVITY_LOG] as ActivityEntry[];
    expect(savedLog[0].ruleId).toBe('new');
    expect(savedLog[1].ruleId).toBe('old');
  });
});

describe('clearActivityLog', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('sets the activity log key to an empty array', async () => {
    mockStorage[STORAGE_KEYS.ACTIVITY_LOG] = [makeEntry()];
    await clearActivityLog();
    expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.ACTIVITY_LOG]: [],
    });
  });
});

describe('cleanupOldActivityEntries', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('returns 0 when retentionDays is 0', async () => {
    const removed = await cleanupOldActivityEntries(0);
    expect(removed).toBe(0);
  });

  it('returns 0 when retentionDays is negative', async () => {
    const removed = await cleanupOldActivityEntries(-5);
    expect(removed).toBe(0);
  });

  it('removes entries older than the retention period', async () => {
    const now = Date.now();
    const oldEntry = makeEntry({ timestamp: now - 31 * 86400000 }); // 31 days ago
    const recentEntry = makeEntry({ timestamp: now - 1 * 86400000 }); // 1 day ago
    mockStorage[STORAGE_KEYS.ACTIVITY_LOG] = [recentEntry, oldEntry];

    const removed = await cleanupOldActivityEntries(30);

    expect(removed).toBe(1);
    const savedLog = mockStorage[STORAGE_KEYS.ACTIVITY_LOG] as ActivityEntry[];
    expect(savedLog).toHaveLength(1);
    expect(savedLog[0]).toEqual(recentEntry);
  });

  it('returns the count of removed entries', async () => {
    const now = Date.now();
    const oldEntries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ timestamp: now - (10 + i) * 86400000 }),
    );
    mockStorage[STORAGE_KEYS.ACTIVITY_LOG] = oldEntries;

    const removed = await cleanupOldActivityEntries(7);
    expect(removed).toBe(5);
  });

  it('does not write to storage when nothing to remove', async () => {
    const now = Date.now();
    const recentEntry = makeEntry({ timestamp: now - 1000 });
    mockStorage[STORAGE_KEYS.ACTIVITY_LOG] = [recentEntry];

    const removed = await cleanupOldActivityEntries(30);
    expect(removed).toBe(0);
    // set should only have been called by the get-based path, not for writing filtered results
    expect(mockBrowser.storage.local.set).not.toHaveBeenCalled();
  });

  it('handles empty log gracefully', async () => {
    mockStorage[STORAGE_KEYS.ACTIVITY_LOG] = [];
    const removed = await cleanupOldActivityEntries(30);
    expect(removed).toBe(0);
  });
});

describe('getAutoResponseCount', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
  });

  it('returns default {hour: 0, count: 0} when nothing is stored', async () => {
    const result = await getAutoResponseCount();
    expect(result).toEqual({ hour: 0, count: 0 });
  });

  it('returns stored value', async () => {
    const stored = { hour: 12345, count: 7 };
    mockStorage[STORAGE_KEYS.AUTO_RESPONSE_COUNT] = stored;
    const result = await getAutoResponseCount();
    expect(result).toEqual(stored);
  });
});

describe('incrementAutoResponseCount', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates new counter for the current hour when no data exists', async () => {
    const currentHour = Math.floor(Date.now() / 3600000);
    await incrementAutoResponseCount();

    expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.AUTO_RESPONSE_COUNT]: { hour: currentHour, count: 1 },
    });
  });

  it('increments count for the same hour', async () => {
    const currentHour = Math.floor(Date.now() / 3600000);
    mockStorage[STORAGE_KEYS.AUTO_RESPONSE_COUNT] = { hour: currentHour, count: 3 };

    await incrementAutoResponseCount();

    expect(mockStorage[STORAGE_KEYS.AUTO_RESPONSE_COUNT]).toEqual({
      hour: currentHour,
      count: 4,
    });
  });

  it('resets count for a new hour', async () => {
    const oldHour = Math.floor(Date.now() / 3600000) - 1;
    mockStorage[STORAGE_KEYS.AUTO_RESPONSE_COUNT] = { hour: oldHour, count: 9 };

    await incrementAutoResponseCount();

    const currentHour = Math.floor(Date.now() / 3600000);
    expect(mockStorage[STORAGE_KEYS.AUTO_RESPONSE_COUNT]).toEqual({
      hour: currentHour,
      count: 1,
    });
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    mockStorage = {};
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when count is under the limit', async () => {
    const currentHour = Math.floor(Date.now() / 3600000);
    mockStorage[STORAGE_KEYS.AUTO_RESPONSE_COUNT] = { hour: currentHour, count: 5 };

    const result = await checkRateLimit(10);
    expect(result).toBe(true);
  });

  it('returns false when count is at the limit', async () => {
    const currentHour = Math.floor(Date.now() / 3600000);
    mockStorage[STORAGE_KEYS.AUTO_RESPONSE_COUNT] = { hour: currentHour, count: 10 };

    const result = await checkRateLimit(10);
    expect(result).toBe(false);
  });

  it('returns true when the stored hour is stale (different from current)', async () => {
    const oldHour = Math.floor(Date.now() / 3600000) - 2;
    mockStorage[STORAGE_KEYS.AUTO_RESPONSE_COUNT] = { hour: oldHour, count: 999 };

    const result = await checkRateLimit(10);
    expect(result).toBe(true);
  });

  it('returns true when no data is stored', async () => {
    const result = await checkRateLimit(10);
    expect(result).toBe(true);
  });
});
