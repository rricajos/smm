/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect } from 'vitest';
import { exportConfiguration, validateImportData, detectConflicts } from './config-io';
import type { Rule } from '../../types/rules';
import type { ResponseTemplate } from '../../types/templates';
import type { Settings } from '../../types/settings';

const sampleRule: Rule = {
  id: 'rule-1',
  name: 'Test Rule',
  enabled: true,
  conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
  conditionLogic: 'all',
  actions: [{ type: 'markRead' }],
  stopProcessing: false,
  createdAt: 1000,
  updatedAt: 2000,
};

const sampleTemplate: ResponseTemplate = {
  id: 'tmpl-1',
  name: 'Test Template',
  subject: 'Re: {{subject}}',
  body: 'Hello {{senderName}}',
  isPlainText: true,
  sendMode: 'draft',
  replyType: 'replyToSender',
};

const sampleSettings: Settings = {
  classificationEnabled: true,
  autoResponseEnabled: false,
  processExistingOnStartup: false,
  maxAutoResponsesPerHour: 10,
  logRetentionDays: 30,
  notifyOnClassification: true,
  notifyOnAutoResponse: false,
  aiProvider: 'openrouter',
  openaiApiKey: 'sk-test',
  openaiModel: 'gpt-4o-mini',
  customBaseUrl: '',
  aiConsentAccepted: true,
};

describe('exportConfiguration', () => {
  it('returns correct structure with version and timestamp', () => {
    const result = exportConfiguration([sampleRule], [sampleTemplate], sampleSettings);
    expect(result.version).toBe(1);
    expect(result.exportedAt).toBeTruthy();
    expect(new Date(result.exportedAt).getTime()).not.toBeNaN();
  });

  it('deep clones the data (mutations do not affect original)', () => {
    const rules = [{ ...sampleRule }];
    const templates = [{ ...sampleTemplate }];
    const result = exportConfiguration(rules, templates, sampleSettings);
    result.rules[0].name = 'MUTATED';
    result.templates[0].name = 'MUTATED';
    expect(rules[0].name).toBe('Test Rule');
    expect(templates[0].name).toBe('Test Template');
  });

  it('handles empty arrays', () => {
    const result = exportConfiguration([], [], sampleSettings);
    expect(result.rules).toEqual([]);
    expect(result.templates).toEqual([]);
  });

  it('excludes API key from exported settings', () => {
    const settingsWithKey = { ...sampleSettings, openaiApiKey: 'sk-secret-key-12345' };
    const result = exportConfiguration([sampleRule], [sampleTemplate], settingsWithKey);
    expect(result.settings.openaiApiKey).toBe('');
    expect(result.settings.aiProvider).toBe('openrouter');
  });
});

describe('validateImportData', () => {
  it('rejects null input', () => {
    const result = validateImportData(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.data).toBeNull();
  });

  it('rejects non-object input', () => {
    const result = validateImportData('not an object');
    expect(result.valid).toBe(false);
  });

  it('rejects missing rules field', () => {
    const result = validateImportData({ templates: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('rules'))).toBe(true);
  });

  it('rejects missing templates field', () => {
    const result = validateImportData({ rules: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('templates'))).toBe(true);
  });

  it('rejects rules missing required fields', () => {
    const result = validateImportData({
      rules: [{ id: 'r1' }], // missing name, conditions, actions
      templates: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Regla 1'))).toBe(true);
  });

  it('rejects templates missing required fields', () => {
    const result = validateImportData({
      rules: [],
      templates: [{ name: 'T1' }], // missing id
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Plantilla 1'))).toBe(true);
  });

  it('validates correct data successfully', () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      rules: [sampleRule],
      templates: [sampleTemplate],
      settings: sampleSettings,
    };
    const result = validateImportData(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data).not.toBeNull();
    expect(result.data!.rules).toHaveLength(1);
    expect(result.data!.templates).toHaveLength(1);
  });

  it('defaults version to 1 if missing', () => {
    const data = { rules: [sampleRule], templates: [sampleTemplate] };
    const result = validateImportData(data);
    expect(result.valid).toBe(true);
    expect(result.data!.version).toBe(1);
  });

  it('defaults settings to empty object if missing', () => {
    const data = { rules: [sampleRule], templates: [sampleTemplate] };
    const result = validateImportData(data);
    expect(result.valid).toBe(true);
    expect(result.data!.settings).toEqual({});
  });

  it('reports multiple errors at once', () => {
    const result = validateImportData({
      rules: [{ id: 'x' }],
      templates: [{ name: 'y' }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
  });
});

describe('detectConflicts', () => {
  const existingRules: Rule[] = [sampleRule];
  const existingTemplates: ResponseTemplate[] = [sampleTemplate];

  it('detects conflict by matching ID', () => {
    const importData = exportConfiguration([sampleRule], [], sampleSettings);
    const result = detectConflicts(importData, existingRules, existingTemplates);
    expect(result.conflicts.rules).toHaveLength(1);
    expect(result.conflicts.rules[0].imported.id).toBe(sampleRule.id);
    expect(result.conflicts.rules[0].existing.id).toBe(sampleRule.id);
    expect(result.newItems.rules).toHaveLength(0);
  });

  it('detects conflict by matching name (case-insensitive)', () => {
    const importedRule: Rule = { ...sampleRule, id: 'different-id', name: 'test rule' }; // lowercase
    const importData = exportConfiguration([importedRule], [], sampleSettings);
    const result = detectConflicts(importData, existingRules, existingTemplates);
    expect(result.conflicts.rules).toHaveLength(1);
  });

  it('detects template conflicts by ID', () => {
    const importData = exportConfiguration([], [sampleTemplate], sampleSettings);
    const result = detectConflicts(importData, existingRules, existingTemplates);
    expect(result.conflicts.templates).toHaveLength(1);
    expect(result.newItems.templates).toHaveLength(0);
  });

  it('detects template conflicts by name (case-insensitive)', () => {
    const importedTmpl: ResponseTemplate = { ...sampleTemplate, id: 'diff-id', name: 'TEST TEMPLATE' };
    const importData = exportConfiguration([], [importedTmpl], sampleSettings);
    const result = detectConflicts(importData, existingRules, existingTemplates);
    expect(result.conflicts.templates).toHaveLength(1);
  });

  it('identifies new rules (no ID or name match)', () => {
    const newRule: Rule = { ...sampleRule, id: 'new-id', name: 'Brand New Rule' };
    const importData = exportConfiguration([newRule], [], sampleSettings);
    const result = detectConflicts(importData, existingRules, existingTemplates);
    expect(result.conflicts.rules).toHaveLength(0);
    expect(result.newItems.rules).toHaveLength(1);
    expect(result.newItems.rules[0].name).toBe('Brand New Rule');
  });

  it('identifies new templates', () => {
    const newTmpl: ResponseTemplate = { ...sampleTemplate, id: 'new-id', name: 'New Template' };
    const importData = exportConfiguration([], [newTmpl], sampleSettings);
    const result = detectConflicts(importData, existingRules, existingTemplates);
    expect(result.conflicts.templates).toHaveLength(0);
    expect(result.newItems.templates).toHaveLength(1);
  });

  it('handles empty import data', () => {
    const importData = exportConfiguration([], [], sampleSettings);
    const result = detectConflicts(importData, existingRules, existingTemplates);
    expect(result.conflicts.rules).toHaveLength(0);
    expect(result.conflicts.templates).toHaveLength(0);
    expect(result.newItems.rules).toHaveLength(0);
    expect(result.newItems.templates).toHaveLength(0);
  });

  it('handles empty existing data', () => {
    const importData = exportConfiguration([sampleRule], [sampleTemplate], sampleSettings);
    const result = detectConflicts(importData, [], []);
    expect(result.conflicts.rules).toHaveLength(0);
    expect(result.conflicts.templates).toHaveLength(0);
    expect(result.newItems.rules).toHaveLength(1);
    expect(result.newItems.templates).toHaveLength(1);
  });

  it('mixes conflicts and new items correctly', () => {
    const newRule: Rule = { ...sampleRule, id: 'new-id', name: 'New' };
    const conflictRule: Rule = { ...sampleRule }; // same id
    const importData = exportConfiguration([conflictRule, newRule], [], sampleSettings);
    const result = detectConflicts(importData, existingRules, []);
    expect(result.conflicts.rules).toHaveLength(1);
    expect(result.newItems.rules).toHaveLength(1);
  });
});
