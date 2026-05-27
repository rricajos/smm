/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi } from 'vitest';

vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });

import {
  isValidCondition,
  isValidAction,
  isValidRule,
  isValidTemplate,
  isValidSettings,
  isValidActivityEntry,
  sanitizeRules,
  sanitizeTemplates,
  sanitizeSettings,
  sanitizeActivityLog,
} from './validators';

// ── Helpers: valid fixtures ────────────────────────────────────────────

const validCondition = () => ({
  field: 'subject' as const,
  operator: 'contains' as const,
  value: 'hello',
  caseSensitive: false,
});

const validAction = () => ({
  type: 'moveToFolder' as const,
  folderId: 'folder-1',
});

const validRule = () => ({
  id: 'rule-1',
  name: 'Test Rule',
  enabled: true,
  conditions: [validCondition()],
  conditionLogic: 'all' as const,
  actions: [validAction()],
  stopProcessing: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const validTemplate = () => ({
  id: 'tpl-1',
  name: 'Test Template',
  subject: 'Re: {{subject}}',
  body: 'Thank you for your message.',
  isPlainText: true,
  sendMode: 'draft' as const,
  replyType: 'replyToSender' as const,
});

const validSettings = () => ({
  classificationEnabled: true,
  autoResponseEnabled: true,
  processExistingOnStartup: false,
  maxAutoResponsesPerHour: 10,
  logRetentionDays: 30,
  notifyOnClassification: true,
  notifyOnAutoResponse: true,
  aiProvider: 'openrouter' as const,
  openaiApiKey: '',
  openaiModel: 'openai/gpt-4o-mini',
  customBaseUrl: '',
  aiConsentAccepted: false,
});

const validActivityEntry = () => ({
  timestamp: Date.now(),
  ruleId: 'rule-1',
  ruleName: 'Test Rule',
  messageId: 42,
  subject: 'Test Subject',
  from: 'sender@example.com',
  actions: ['moveToFolder:Inbox'],
  type: 'classification' as const,
});

// ── isValidCondition ───────────────────────────────────────────────────

describe('isValidCondition', () => {
  it('returns true for a valid condition', () => {
    expect(isValidCondition(validCondition())).toBe(true);
  });

  it('returns false when field is missing or invalid', () => {
    expect(isValidCondition({ ...validCondition(), field: 'invalid' })).toBe(false);
  });

  it('returns false when operator is invalid', () => {
    expect(isValidCondition({ ...validCondition(), operator: 'notAnOp' })).toBe(false);
  });

  it('returns false for a non-object value', () => {
    expect(isValidCondition('not-an-object')).toBe(false);
    expect(isValidCondition(42)).toBe(false);
  });

  it('returns false when value is missing or not a string', () => {
    expect(isValidCondition({ ...validCondition(), value: undefined })).toBe(false);
    expect(isValidCondition({ ...validCondition(), value: 123 })).toBe(false);
  });
});

// ── isValidAction ──────────────────────────────────────────────────────

describe('isValidAction', () => {
  it('returns true for a valid action', () => {
    expect(isValidAction(validAction())).toBe(true);
  });

  it('returns false when type is invalid', () => {
    expect(isValidAction({ type: 'unknownAction' })).toBe(false);
  });

  it('returns false when priority is invalid', () => {
    expect(isValidAction({ type: 'setPriority', priority: 'mega' })).toBe(false);
  });

  it('returns false for a non-object value', () => {
    expect(isValidAction(null)).toBe(false);
    expect(isValidAction([{ type: 'markRead' }])).toBe(false);
  });
});

// ── isValidRule ────────────────────────────────────────────────────────

describe('isValidRule', () => {
  it('returns true for a fully valid rule', () => {
    expect(isValidRule(validRule())).toBe(true);
  });

  it('returns false when id is an empty string', () => {
    expect(isValidRule({ ...validRule(), id: '' })).toBe(false);
  });

  it('returns false when name is not a string', () => {
    expect(isValidRule({ ...validRule(), name: 123 })).toBe(false);
  });

  it('returns false when enabled is not a boolean', () => {
    expect(isValidRule({ ...validRule(), enabled: 'yes' })).toBe(false);
  });

  it('returns false when conditions is not an array', () => {
    expect(isValidRule({ ...validRule(), conditions: 'none' })).toBe(false);
  });

  it('returns false when actions is not an array', () => {
    expect(isValidRule({ ...validRule(), actions: {} })).toBe(false);
  });

  it('returns false for a non-object input', () => {
    expect(isValidRule('string')).toBe(false);
    expect(isValidRule(123)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidRule(null)).toBe(false);
  });
});

// ── isValidTemplate ────────────────────────────────────────────────────

describe('isValidTemplate', () => {
  it('returns true for a valid template', () => {
    expect(isValidTemplate(validTemplate())).toBe(true);
  });

  it('returns false when id is an empty string', () => {
    expect(isValidTemplate({ ...validTemplate(), id: '' })).toBe(false);
  });

  it('returns false when subject is not a string', () => {
    expect(isValidTemplate({ ...validTemplate(), subject: 100 })).toBe(false);
  });

  it('returns false when body is not a string', () => {
    expect(isValidTemplate({ ...validTemplate(), body: null })).toBe(false);
  });

  it('returns false for a non-object input', () => {
    expect(isValidTemplate(undefined)).toBe(false);
    expect(isValidTemplate(42)).toBe(false);
  });
});

// ── isValidSettings ────────────────────────────────────────────────────

describe('isValidSettings', () => {
  it('returns true for a fully valid settings object', () => {
    expect(isValidSettings(validSettings())).toBe(true);
  });

  it('returns true for an empty object (partial settings are OK)', () => {
    expect(isValidSettings({})).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidSettings(null)).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isValidSettings([1, 2, 3])).toBe(false);
  });
});

// ── isValidActivityEntry ───────────────────────────────────────────────

describe('isValidActivityEntry', () => {
  it('returns true for a valid activity entry', () => {
    expect(isValidActivityEntry(validActivityEntry())).toBe(true);
  });

  it('returns false when timestamp is not a number', () => {
    expect(isValidActivityEntry({ ...validActivityEntry(), timestamp: 'now' })).toBe(false);
  });

  it('returns false when type is invalid', () => {
    expect(isValidActivityEntry({ ...validActivityEntry(), type: 'unknown' })).toBe(false);
  });
});

// ── sanitizeRules ──────────────────────────────────────────────────────

describe('sanitizeRules', () => {
  it('returns an empty array for non-array input', () => {
    expect(sanitizeRules(null)).toEqual([]);
    expect(sanitizeRules('rules')).toEqual([]);
    expect(sanitizeRules(123)).toEqual([]);
  });

  it('filters out non-object entries', () => {
    const result = sanitizeRules([validRule(), 'not-an-object', 42, null]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('rule-1');
  });

  it('repairs missing caseSensitive on conditions to false', () => {
    const ruleWithoutCaseSensitive = {
      ...validRule(),
      conditions: [{ field: 'from', operator: 'contains', value: 'test' }],
    };
    const result = sanitizeRules([ruleWithoutCaseSensitive]);
    expect(result[0].conditions[0].caseSensitive).toBe(false);
  });

  it('repairs missing conditionLogic to "all" and missing stopProcessing to false', () => {
    const bare = {
      id: 'rule-2',
      name: 'Bare Rule',
      enabled: true,
      conditions: [],
      actions: [],
    };
    const result = sanitizeRules([bare]);
    expect(result[0].conditionLogic).toBe('all');
    expect(result[0].stopProcessing).toBe(false);
  });
});

// ── sanitizeTemplates ──────────────────────────────────────────────────

describe('sanitizeTemplates', () => {
  it('returns an empty array for non-array input', () => {
    expect(sanitizeTemplates(undefined)).toEqual([]);
    expect(sanitizeTemplates({})).toEqual([]);
  });

  it('repairs missing sendMode to "draft" and replyType to "replyToSender"', () => {
    const bare = { id: 'tpl-2', name: 'Bare', subject: 'Hi', body: 'Hello' };
    const result = sanitizeTemplates([bare]);
    expect(result[0].sendMode).toBe('draft');
    expect(result[0].replyType).toBe('replyToSender');
  });
});

// ── sanitizeSettings ───────────────────────────────────────────────────

describe('sanitizeSettings', () => {
  it('returns default settings for non-object input', () => {
    const defaults = sanitizeSettings(null);
    expect(defaults.classificationEnabled).toBe(true);
    expect(defaults.autoResponseEnabled).toBe(true);
    expect(defaults.processExistingOnStartup).toBe(false);
    expect(defaults.maxAutoResponsesPerHour).toBe(10);
    expect(defaults.logRetentionDays).toBe(30);
    expect(defaults.notifyOnClassification).toBe(true);
    expect(defaults.notifyOnAutoResponse).toBe(true);
    expect(defaults.aiProvider).toBe('openrouter');
    expect(defaults.openaiApiKey).toBe('');
    expect(defaults.openaiModel).toBe('openai/gpt-4o-mini');
    expect(defaults.customBaseUrl).toBe('');
    expect(defaults.aiConsentAccepted).toBe(false);
  });

  it('preserves valid overrides and fills missing fields with defaults', () => {
    const partial = { classificationEnabled: false, maxAutoResponsesPerHour: 25 };
    const result = sanitizeSettings(partial);
    expect(result.classificationEnabled).toBe(false);
    expect(result.maxAutoResponsesPerHour).toBe(25);
    // Filled from defaults
    expect(result.autoResponseEnabled).toBe(true);
    expect(result.aiProvider).toBe('openrouter');
  });

  it('repairs an invalid aiProvider to the default "openrouter"', () => {
    const result = sanitizeSettings({ aiProvider: 'nonexistent' });
    expect(result.aiProvider).toBe('openrouter');
  });
});

// ── sanitizeActivityLog ────────────────────────────────────────────────

describe('sanitizeActivityLog', () => {
  it('returns an empty array for non-array input', () => {
    expect(sanitizeActivityLog(null)).toEqual([]);
    expect(sanitizeActivityLog('log')).toEqual([]);
  });

  it('repairs entries and filters out non-objects', () => {
    const raw = [
      validActivityEntry(),
      'not-an-object',
      { timestamp: 100, messageId: 7, type: 'error', actions: ['logged'] },
    ];
    const result = sanitizeActivityLog(raw);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('classification');
    expect(result[1].timestamp).toBe(100);
    expect(result[1].type).toBe('error');
    // Repaired missing fields
    expect(result[1].ruleId).toBe('');
    expect(result[1].ruleName).toBe('');
    expect(result[1].subject).toBe('');
    expect(result[1].from).toBe('');
  });
});
