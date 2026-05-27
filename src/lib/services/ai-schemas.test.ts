/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  conditionSchema,
  actionSchema,
  ruleDataSchema,
  rulesResponseSchema,
  consultantResponseSchema,
  safeParseAI,
} from './ai-schemas';

// Mock logger to suppress warnings during tests
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

beforeEach(() => vi.clearAllMocks());

describe('conditionSchema', () => {
  it('accepts a complete condition', () => {
    const result = conditionSchema.parse({
      field: 'from',
      operator: 'contains',
      value: 'test@example.com',
      caseSensitive: true,
    });
    expect(result.field).toBe('from');
    expect(result.operator).toBe('contains');
    expect(result.value).toBe('test@example.com');
    expect(result.caseSensitive).toBe(true);
  });

  it('applies defaults for missing fields', () => {
    const result = conditionSchema.parse({});
    expect(result.field).toBe('subject');
    expect(result.operator).toBe('contains');
    expect(result.value).toBe('');
    expect(result.caseSensitive).toBe(false);
  });

  it('preserves optional boolValue', () => {
    const result = conditionSchema.parse({ boolValue: true });
    expect(result.boolValue).toBe(true);
  });
});

describe('actionSchema', () => {
  it('accepts a complete action', () => {
    const result = actionSchema.parse({
      type: 'moveToFolder',
      folderId: 'folder-1',
    });
    expect(result.type).toBe('moveToFolder');
    expect(result.folderId).toBe('folder-1');
  });

  it('applies defaults and leaves optionals undefined', () => {
    const result = actionSchema.parse({});
    expect(result.type).toBe('markRead');
    expect(result.folderId).toBeUndefined();
    expect(result.tagKey).toBeUndefined();
  });
});

describe('ruleDataSchema', () => {
  it('accepts a full rule', () => {
    const result = ruleDataSchema.parse({
      name: 'Test Rule',
      confidence: 0.9,
      conditionLogic: 'any',
      conditions: [{ field: 'from', operator: 'equals', value: 'a@b.com' }],
      actions: [{ type: 'addTag', tagKey: 'important' }],
    });
    expect(result.name).toBe('Test Rule');
    expect(result.confidence).toBe(0.9);
    expect(result.conditions).toHaveLength(1);
    expect(result.actions).toHaveLength(1);
  });

  it('falls back to 0.5 for out-of-range confidence', () => {
    expect(ruleDataSchema.parse({ confidence: 1.5 }).confidence).toBe(0.5);
    expect(ruleDataSchema.parse({ confidence: -0.1 }).confidence).toBe(0.5);
  });

  it('falls back to 0.5 for non-number confidence', () => {
    expect(ruleDataSchema.parse({ confidence: 'high' }).confidence).toBe(0.5);
  });

  it('defaults confidence to 0.5', () => {
    const result = ruleDataSchema.parse({});
    expect(result.confidence).toBe(0.5);
  });

  it('defaults to empty arrays for conditions and actions', () => {
    const result = ruleDataSchema.parse({});
    expect(result.conditions).toEqual([]);
    expect(result.actions).toEqual([]);
  });
});

describe('rulesResponseSchema', () => {
  it('accepts { rules: [] }', () => {
    const result = rulesResponseSchema.parse({ rules: [] });
    expect(result.rules).toEqual([]);
  });

  it('defaults rules to empty array', () => {
    const result = rulesResponseSchema.parse({});
    expect(result.rules).toEqual([]);
  });

  it('applies defaults to partial rules', () => {
    const result = rulesResponseSchema.parse({
      rules: [{ name: 'Partial' }],
    });
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].name).toBe('Partial');
    expect(result.rules[0].conditions).toEqual([]);
    expect(result.rules[0].confidence).toBe(0.5);
  });
});

describe('consultantResponseSchema', () => {
  it('accepts a response with only message', () => {
    const result = consultantResponseSchema.parse({ message: 'Hello' });
    expect(result.message).toBe('Hello');
    expect(result.folder_proposals).toEqual([]);
    expect(result.rule_proposals).toEqual([]);
    expect(result.template_proposals).toEqual([]);
    expect(result.move_proposals).toEqual([]);
    expect(result.rule_consolidation_proposals).toEqual([]);
  });

  it('handles empty proposal arrays', () => {
    const result = consultantResponseSchema.parse({
      message: 'Test',
      folder_proposals: [],
      rule_proposals: [],
    });
    expect(result.folder_proposals).toEqual([]);
    expect(result.rule_proposals).toEqual([]);
  });

  it('strips unknown extra fields without crashing', () => {
    const result = consultantResponseSchema.parse({
      message: 'Hi',
      unknown_field: 'should be ignored',
    });
    expect(result.message).toBe('Hi');
    expect((result as Record<string, unknown>)['unknown_field']).toBeUndefined();
  });

  it('applies defaults to partial folder proposals', () => {
    const result = consultantResponseSchema.parse({
      folder_proposals: [{ name: 'Work' }],
    });
    expect(result.folder_proposals[0].name).toBe('Work');
    expect(result.folder_proposals[0].parentFolderId).toBe('');
    expect(result.folder_proposals[0].description).toBe('');
  });

  it('applies defaults to partial template proposals', () => {
    const result = consultantResponseSchema.parse({
      template_proposals: [{ name: 'Auto-reply' }],
    });
    const tp = result.template_proposals[0];
    expect(tp.name).toBe('Auto-reply');
    expect(tp.sendMode).toBe('draft');
    expect(tp.replyType).toBe('replyToSender');
    expect(tp.isPlainText).toBe(true);
  });
});

describe('safeParseAI', () => {
  it('returns validated data for valid input', () => {
    const result = safeParseAI(rulesResponseSchema, { rules: [{ name: 'R1' }] }, 'test');
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].name).toBe('R1');
  });

  it('returns fallback with defaults for empty object', () => {
    const result = safeParseAI(rulesResponseSchema, {}, 'test');
    expect(result.rules).toEqual([]);
  });

  it('returns fallback for null input', () => {
    const result = safeParseAI(rulesResponseSchema, null, 'test');
    expect(result.rules).toEqual([]);
  });

  it('returns fallback for string input', () => {
    const result = safeParseAI(rulesResponseSchema, 'not an object', 'test');
    expect(result.rules).toEqual([]);
  });

  it('returns fallback for undefined input', () => {
    const result = safeParseAI(rulesResponseSchema, undefined, 'test');
    expect(result.rules).toEqual([]);
  });

  it('logs warning on validation failure', async () => {
    const { logger } = await import('../utils/logger');
    safeParseAI(rulesResponseSchema, 'bad', 'testLabel');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('testLabel'),
      expect.anything(),
    );
  });
});
