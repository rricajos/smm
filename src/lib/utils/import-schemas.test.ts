/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect } from 'vitest';
import {
  importRuleSchema,
  importTemplateSchema,
  importSettingsSchema,
  importDataSchema,
} from './import-schemas';
import { DEFAULT_SETTINGS } from './constants';

function validRule() {
  return {
    id: 'r1',
    name: 'Test Rule',
    enabled: true,
    conditions: [{ field: 'from', operator: 'contains', value: 'test' }],
    conditionLogic: 'all',
    actions: [{ type: 'markRead' }],
    stopProcessing: false,
    createdAt: 1000,
    updatedAt: 2000,
  };
}

function validTemplate() {
  return {
    id: 't1',
    name: 'Test Template',
    subject: 'Re: hello',
    body: 'Thanks!',
    isPlainText: true,
    sendMode: 'draft',
    replyType: 'replyToSender',
  };
}

describe('importRuleSchema', () => {
  it('parses a valid rule', () => {
    const result = importRuleSchema.safeParse(validRule());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('r1');
      expect(result.data.name).toBe('Test Rule');
    }
  });

  it('rejects rule with empty id', () => {
    const result = importRuleSchema.safeParse({ ...validRule(), id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects rule with empty name', () => {
    const result = importRuleSchema.safeParse({ ...validRule(), name: '' });
    expect(result.success).toBe(false);
  });

  it('requires at least 1 condition', () => {
    const result = importRuleSchema.safeParse({ ...validRule(), conditions: [] });
    expect(result.success).toBe(false);
  });

  it('requires at least 1 action', () => {
    const result = importRuleSchema.safeParse({ ...validRule(), actions: [] });
    expect(result.success).toBe(false);
  });

  it('applies defaults for missing optional fields', () => {
    const minimal = {
      id: 'r2',
      name: 'Minimal',
      conditions: [{ field: 'subject', operator: 'contains', value: 'hi' }],
      actions: [{ type: 'markRead' }],
    };
    const result = importRuleSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
      expect(result.data.conditionLogic).toBe('all');
      expect(result.data.stopProcessing).toBe(false);
      expect(result.data.createdAt).toBeGreaterThan(0);
    }
  });

  it('coerces invalid conditionLogic to default', () => {
    const result = importRuleSchema.safeParse({ ...validRule(), conditionLogic: 'invalid' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conditionLogic).toBe('all');
    }
  });

  it('coerces invalid condition field to default', () => {
    const rule = {
      ...validRule(),
      conditions: [{ field: 'invalid_field', operator: 'contains', value: 'x' }],
    };
    const result = importRuleSchema.safeParse(rule);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conditions[0].field).toBe('subject');
    }
  });
});

describe('importTemplateSchema', () => {
  it('parses a valid template', () => {
    const result = importTemplateSchema.safeParse(validTemplate());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('t1');
      expect(result.data.sendMode).toBe('draft');
    }
  });

  it('rejects template with empty id', () => {
    const result = importTemplateSchema.safeParse({ ...validTemplate(), id: '' });
    expect(result.success).toBe(false);
  });

  it('coerces invalid sendMode to draft', () => {
    const result = importTemplateSchema.safeParse({ ...validTemplate(), sendMode: 'invalid' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sendMode).toBe('draft');
    }
  });

  it('coerces invalid replyType to default', () => {
    const result = importTemplateSchema.safeParse({ ...validTemplate(), replyType: 'bogus' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.replyType).toBe('replyToSender');
    }
  });
});

describe('importSettingsSchema', () => {
  it('parses valid settings', () => {
    const result = importSettingsSchema.safeParse(DEFAULT_SETTINGS);
    expect(result.success).toBe(true);
  });

  it('coerces invalid aiProvider to default', () => {
    const result = importSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, aiProvider: 'invalid' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aiProvider).toBe(DEFAULT_SETTINGS.aiProvider);
    }
  });

  it('applies defaults for missing fields', () => {
    const result = importSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.classificationEnabled).toBe(DEFAULT_SETTINGS.classificationEnabled);
      expect(result.data.maxAutoResponsesPerHour).toBe(DEFAULT_SETTINGS.maxAutoResponsesPerHour);
    }
  });
});

describe('importDataSchema', () => {
  it('parses a complete export', () => {
    const data = {
      version: 1,
      exportedAt: '2025-01-01',
      rules: [validRule()],
      templates: [validTemplate()],
      settings: DEFAULT_SETTINGS,
    };
    const result = importDataSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rules).toHaveLength(1);
      expect(result.data.templates).toHaveLength(1);
    }
  });

  it('requires rules array', () => {
    const result = importDataSchema.safeParse({
      version: 1,
      exportedAt: '',
      templates: [],
    });
    expect(result.success).toBe(false);
  });

  it('requires templates array', () => {
    const result = importDataSchema.safeParse({
      version: 1,
      exportedAt: '',
      rules: [],
    });
    expect(result.success).toBe(false);
  });

  it('defaults settings when missing', () => {
    const data = {
      version: 1,
      exportedAt: '',
      rules: [],
      templates: [],
    };
    const result = importDataSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.settings.classificationEnabled).toBe(
        DEFAULT_SETTINGS.classificationEnabled,
      );
    }
  });
});
