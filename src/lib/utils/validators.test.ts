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

// ── Branch coverage: isValidAction ────────────────────────────────────

describe('isValidAction – uncovered branches', () => {
  it('returns false when folderId is present but not a string', () => {
    expect(isValidAction({ type: 'moveToFolder', folderId: 123 })).toBe(false);
    expect(isValidAction({ type: 'moveToFolder', folderId: true })).toBe(false);
  });

  it('returns false when tagKey is present but not a string', () => {
    expect(isValidAction({ type: 'addTag', tagKey: 42 })).toBe(false);
    expect(isValidAction({ type: 'addTag', tagKey: false })).toBe(false);
  });

  it('returns false when priority is present but an invalid value', () => {
    expect(isValidAction({ type: 'setPriority', priority: 'critical' })).toBe(false);
    expect(isValidAction({ type: 'setPriority', priority: 999 })).toBe(false);
  });

  it('returns false when templateId is present but not a string', () => {
    expect(isValidAction({ type: 'autoRespond', templateId: 100 })).toBe(false);
    expect(isValidAction({ type: 'autoRespond', templateId: null })).toBe(false);
  });

  it('returns true when optional fields are undefined (not present)', () => {
    expect(isValidAction({ type: 'markRead' })).toBe(true);
    expect(isValidAction({ type: 'setPriority', priority: 'high' })).toBe(true);
    expect(isValidAction({ type: 'addTag', tagKey: 'important' })).toBe(true);
    expect(isValidAction({ type: 'autoRespond', templateId: 'tpl-1' })).toBe(true);
  });
});

// ── Branch coverage: isValidRule ──────────────────────────────────────

describe('isValidRule – uncovered branches', () => {
  it('returns false when id is a non-string falsy value', () => {
    expect(isValidRule({ ...validRule(), id: 0 })).toBe(false);
    expect(isValidRule({ ...validRule(), id: null })).toBe(false);
    expect(isValidRule({ ...validRule(), id: undefined })).toBe(false);
  });

  it('returns false when enabled is a non-boolean truthy value', () => {
    expect(isValidRule({ ...validRule(), enabled: 1 })).toBe(false);
    expect(isValidRule({ ...validRule(), enabled: 'true' })).toBe(false);
  });

  it('returns false when stopProcessing would be checked (but it is not — rule passes with non-boolean stopProcessing)', () => {
    // stopProcessing is NOT validated by isValidRule — it's repaired in sanitize
    // This test confirms isValidRule passes even when stopProcessing is wrong type
    expect(isValidRule({ ...validRule(), stopProcessing: 'yes' })).toBe(true);
  });
});

// ── Branch coverage: repairRule (via sanitizeRules) ───────────────────

describe('repairRule – uncovered branches', () => {
  it('repairs non-array conditions to empty array', () => {
    const result = sanitizeRules([{ ...validRule(), conditions: 'bad' }]);
    expect(result[0].conditions).toEqual([]);
  });

  it('repairs non-array actions to empty array', () => {
    const result = sanitizeRules([{ ...validRule(), actions: 'bad' }]);
    expect(result[0].actions).toEqual([]);
  });

  it('repairs conditionLogic "any" is preserved, other values default to "all"', () => {
    const resultAny = sanitizeRules([{ ...validRule(), conditionLogic: 'any' }]);
    expect(resultAny[0].conditionLogic).toBe('any');

    const resultBad = sanitizeRules([{ ...validRule(), conditionLogic: 'invalid' }]);
    expect(resultBad[0].conditionLogic).toBe('all');

    const resultMissing = sanitizeRules([{ ...validRule(), conditionLogic: undefined }]);
    expect(resultMissing[0].conditionLogic).toBe('all');
  });

  it('repairs missing or wrong-typed id with a generated UUID', () => {
    const result = sanitizeRules([{ ...validRule(), id: '' }]);
    expect(result[0].id).toBe('test-uuid');

    const result2 = sanitizeRules([{ ...validRule(), id: 123 }]);
    expect(result2[0].id).toBe('test-uuid');
  });

  it('repairs missing or wrong-typed name to empty string', () => {
    const result = sanitizeRules([{ ...validRule(), name: 42 }]);
    expect(result[0].name).toBe('');
  });

  it('repairs missing or wrong-typed enabled to true', () => {
    const result = sanitizeRules([{ ...validRule(), enabled: 'yes' }]);
    expect(result[0].enabled).toBe(true);
  });

  it('repairs missing or wrong-typed stopProcessing to false', () => {
    const result = sanitizeRules([{ ...validRule(), stopProcessing: 'yes' }]);
    expect(result[0].stopProcessing).toBe(false);
  });

  it('repairs missing or wrong-typed createdAt and updatedAt to Date.now()', () => {
    const before = Date.now();
    const result = sanitizeRules([{ ...validRule(), createdAt: 'bad', updatedAt: null }]);
    const after = Date.now();
    expect(result[0].createdAt).toBeGreaterThanOrEqual(before);
    expect(result[0].createdAt).toBeLessThanOrEqual(after);
    expect(result[0].updatedAt).toBeGreaterThanOrEqual(before);
    expect(result[0].updatedAt).toBeLessThanOrEqual(after);
  });

  it('preserves valid numeric createdAt and updatedAt', () => {
    const result = sanitizeRules([{ ...validRule(), createdAt: 1000, updatedAt: 2000 }]);
    expect(result[0].createdAt).toBe(1000);
    expect(result[0].updatedAt).toBe(2000);
  });

  it('filters out non-object entries inside conditions and actions arrays', () => {
    const result = sanitizeRules([
      {
        ...validRule(),
        conditions: [validCondition(), 'not-an-object', null, 42],
        actions: [validAction(), 'bad', null],
      },
    ]);
    expect(result[0].conditions).toHaveLength(1);
    expect(result[0].actions).toHaveLength(1);
  });
});

// ── Branch coverage: repairAction (via sanitizeRules) ─────────────────

describe('repairAction – uncovered branches', () => {
  it('repairs unknown action type to "markRead"', () => {
    const result = sanitizeRules([{ ...validRule(), actions: [{ type: 'unknownType' }] }]);
    expect(result[0].actions[0].type).toBe('markRead');
  });

  it('includes folderId only when it is a string', () => {
    const withString = sanitizeRules([
      { ...validRule(), actions: [{ type: 'moveToFolder', folderId: 'f1' }] },
    ]);
    expect(withString[0].actions[0].folderId).toBe('f1');

    const withNumber = sanitizeRules([
      { ...validRule(), actions: [{ type: 'moveToFolder', folderId: 123 }] },
    ]);
    expect(withNumber[0].actions[0].folderId).toBeUndefined();
  });

  it('includes tagKey only when it is a string', () => {
    const withString = sanitizeRules([
      { ...validRule(), actions: [{ type: 'addTag', tagKey: 'urgent' }] },
    ]);
    expect(withString[0].actions[0].tagKey).toBe('urgent');

    const withNumber = sanitizeRules([
      { ...validRule(), actions: [{ type: 'addTag', tagKey: 99 }] },
    ]);
    expect(withNumber[0].actions[0].tagKey).toBeUndefined();
  });

  it('includes priority only when it is a valid priority string', () => {
    const withValid = sanitizeRules([
      { ...validRule(), actions: [{ type: 'setPriority', priority: 'high' }] },
    ]);
    expect(withValid[0].actions[0].priority).toBe('high');

    const withInvalid = sanitizeRules([
      { ...validRule(), actions: [{ type: 'setPriority', priority: 'mega' }] },
    ]);
    expect(withInvalid[0].actions[0].priority).toBeUndefined();

    const withNumber = sanitizeRules([
      { ...validRule(), actions: [{ type: 'setPriority', priority: 5 }] },
    ]);
    expect(withNumber[0].actions[0].priority).toBeUndefined();
  });

  it('includes templateId only when it is a string', () => {
    const withString = sanitizeRules([
      { ...validRule(), actions: [{ type: 'autoRespond', templateId: 'tpl-1' }] },
    ]);
    expect(withString[0].actions[0].templateId).toBe('tpl-1');

    const withNumber = sanitizeRules([
      { ...validRule(), actions: [{ type: 'autoRespond', templateId: 55 }] },
    ]);
    expect(withNumber[0].actions[0].templateId).toBeUndefined();
  });
});

// ── Branch coverage: repairTemplate (via sanitizeTemplates) ───────────

describe('repairTemplate – uncovered branches', () => {
  it('repairs missing or wrong-typed id with a generated UUID', () => {
    const result = sanitizeTemplates([{ name: 'T', subject: 'S', body: 'B', id: '' }]);
    expect(result[0].id).toBe('test-uuid');

    const result2 = sanitizeTemplates([{ name: 'T', subject: 'S', body: 'B', id: 123 }]);
    expect(result2[0].id).toBe('test-uuid');
  });

  it('repairs missing or wrong-typed name to empty string', () => {
    const result = sanitizeTemplates([{ id: 'tpl-1', subject: 'S', body: 'B', name: 42 }]);
    expect(result[0].name).toBe('');
  });

  it('repairs missing or wrong-typed subject to empty string', () => {
    const result = sanitizeTemplates([{ id: 'tpl-1', name: 'N', body: 'B', subject: null }]);
    expect(result[0].subject).toBe('');
  });

  it('repairs missing or wrong-typed body to empty string', () => {
    const result = sanitizeTemplates([{ id: 'tpl-1', name: 'N', subject: 'S', body: 123 }]);
    expect(result[0].body).toBe('');
  });

  it('repairs missing or wrong-typed isPlainText to true', () => {
    const result = sanitizeTemplates([
      { id: 'tpl-1', name: 'N', subject: 'S', body: 'B', isPlainText: 'yes' },
    ]);
    expect(result[0].isPlainText).toBe(true);

    const result2 = sanitizeTemplates([{ id: 'tpl-1', name: 'N', subject: 'S', body: 'B' }]);
    expect(result2[0].isPlainText).toBe(true);
  });

  it('repairs invalid sendMode to "draft"', () => {
    const result = sanitizeTemplates([
      { id: 'tpl-1', name: 'N', subject: 'S', body: 'B', sendMode: 'invalid' },
    ]);
    expect(result[0].sendMode).toBe('draft');
  });

  it('preserves valid sendMode values', () => {
    const result = sanitizeTemplates([
      { id: 'tpl-1', name: 'N', subject: 'S', body: 'B', sendMode: 'sendNow' },
    ]);
    expect(result[0].sendMode).toBe('sendNow');

    const result2 = sanitizeTemplates([
      { id: 'tpl-1', name: 'N', subject: 'S', body: 'B', sendMode: 'sendLater' },
    ]);
    expect(result2[0].sendMode).toBe('sendLater');
  });

  it('repairs invalid replyType to "replyToSender"', () => {
    const result = sanitizeTemplates([
      { id: 'tpl-1', name: 'N', subject: 'S', body: 'B', replyType: 'bad' },
    ]);
    expect(result[0].replyType).toBe('replyToSender');
  });

  it('preserves valid replyType "replyToAll"', () => {
    const result = sanitizeTemplates([
      { id: 'tpl-1', name: 'N', subject: 'S', body: 'B', replyType: 'replyToAll' },
    ]);
    expect(result[0].replyType).toBe('replyToAll');
  });
});

// ── Branch coverage: repairActivityEntry (via sanitizeActivityLog) ────

describe('repairActivityEntry – uncovered branches', () => {
  it('repairs missing or wrong-typed timestamp to 0', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), timestamp: 'bad' }]);
    expect(result[0].timestamp).toBe(0);
  });

  it('repairs missing or wrong-typed ruleId to empty string', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), ruleId: 42 }]);
    expect(result[0].ruleId).toBe('');
  });

  it('repairs missing or wrong-typed ruleName to empty string', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), ruleName: null }]);
    expect(result[0].ruleName).toBe('');
  });

  it('repairs missing or wrong-typed messageId to 0', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), messageId: 'bad' }]);
    expect(result[0].messageId).toBe(0);
  });

  it('repairs missing or wrong-typed subject to empty string', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), subject: 123 }]);
    expect(result[0].subject).toBe('');
  });

  it('repairs missing or wrong-typed from to empty string', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), from: true }]);
    expect(result[0].from).toBe('');
  });

  it('repairs non-array actions to empty array', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), actions: 'not-array' }]);
    expect(result[0].actions).toEqual([]);
  });

  it('filters out non-string entries inside actions array', () => {
    const result = sanitizeActivityLog([
      { ...validActivityEntry(), actions: ['valid', 42, null, 'also-valid'] },
    ]);
    expect(result[0].actions).toEqual(['valid', 'also-valid']);
  });

  it('repairs invalid type to "error"', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), type: 'unknown' }]);
    expect(result[0].type).toBe('error');
  });

  it('preserves valid type "autoResponse"', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), type: 'autoResponse' }]);
    expect(result[0].type).toBe('autoResponse');
  });

  it('includes optional details when it is a string', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), details: 'some detail' }]);
    expect(result[0].details).toBe('some detail');
  });

  it('omits details when it is not a string', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), details: 123 }]);
    expect(result[0].details).toBeUndefined();
  });

  it('includes optional accountId when it is a string', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), accountId: 'acc-1' }]);
    expect(result[0].accountId).toBe('acc-1');
  });

  it('omits accountId when it is not a string', () => {
    const result = sanitizeActivityLog([{ ...validActivityEntry(), accountId: 99 }]);
    expect(result[0].accountId).toBeUndefined();
  });
});

// ── Branch coverage: sanitizeSettings – individual field repairs ──────

describe('sanitizeSettings – individual field repairs', () => {
  it('repairs wrong-typed classificationEnabled to default', () => {
    const result = sanitizeSettings({ classificationEnabled: 'yes' });
    expect(result.classificationEnabled).toBe(true);
  });

  it('repairs wrong-typed autoResponseEnabled to default', () => {
    const result = sanitizeSettings({ autoResponseEnabled: 'yes' });
    expect(result.autoResponseEnabled).toBe(true);
  });

  it('repairs wrong-typed processExistingOnStartup to default', () => {
    const result = sanitizeSettings({ processExistingOnStartup: 1 });
    expect(result.processExistingOnStartup).toBe(false);
  });

  it('repairs wrong-typed maxAutoResponsesPerHour to default', () => {
    const result = sanitizeSettings({ maxAutoResponsesPerHour: 'ten' });
    expect(result.maxAutoResponsesPerHour).toBe(10);
  });

  it('repairs wrong-typed logRetentionDays to default', () => {
    const result = sanitizeSettings({ logRetentionDays: true });
    expect(result.logRetentionDays).toBe(30);
  });

  it('repairs wrong-typed notifyOnClassification to default', () => {
    const result = sanitizeSettings({ notifyOnClassification: 0 });
    expect(result.notifyOnClassification).toBe(true);
  });

  it('repairs wrong-typed notifyOnAutoResponse to default', () => {
    const result = sanitizeSettings({ notifyOnAutoResponse: 'no' });
    expect(result.notifyOnAutoResponse).toBe(true);
  });

  it('repairs wrong-typed openaiApiKey to default', () => {
    const result = sanitizeSettings({ openaiApiKey: 123 });
    expect(result.openaiApiKey).toBe('');
  });

  it('repairs wrong-typed openaiModel to default', () => {
    const result = sanitizeSettings({ openaiModel: null });
    expect(result.openaiModel).toBe('openai/gpt-4o-mini');
  });

  it('repairs wrong-typed customBaseUrl to default', () => {
    const result = sanitizeSettings({ customBaseUrl: 42 });
    expect(result.customBaseUrl).toBe('');
  });

  it('repairs wrong-typed aiConsentAccepted to default', () => {
    const result = sanitizeSettings({ aiConsentAccepted: 'yes' });
    expect(result.aiConsentAccepted).toBe(false);
  });

  it('preserves valid aiProvider values', () => {
    expect(sanitizeSettings({ aiProvider: 'openai' }).aiProvider).toBe('openai');
    expect(sanitizeSettings({ aiProvider: 'anthropic' }).aiProvider).toBe('anthropic');
    expect(sanitizeSettings({ aiProvider: 'google' }).aiProvider).toBe('google');
    expect(sanitizeSettings({ aiProvider: 'custom' }).aiProvider).toBe('custom');
  });
});
