/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect } from 'vitest';
import { searchRules, searchTemplates, searchActivity } from './search';
import type { Rule } from '../../types/rules';
import type { ResponseTemplate } from '../../types/templates';
import type { ActivityEntry } from '../../types/settings';

const labels = { active: 'Active', inactive: 'Inactive', noSubject: '(No subject)' };

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    name: 'Test Rule',
    enabled: true,
    conditions: [{ field: 'from', operator: 'contains', value: 'alice', caseSensitive: false }],
    conditionLogic: 'all',
    actions: [{ type: 'addTag', tagKey: 'important' }],
    stopProcessing: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<ResponseTemplate> = {}): ResponseTemplate {
  return {
    id: 't1',
    name: 'Auto Reply',
    subject: 'Re: {{original_subject}}',
    body: 'Thank you',
    isPlainText: false,
    sendMode: 'draft',
    replyType: 'replyToSender',
    ...overrides,
  };
}

function makeEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    timestamp: Date.now(),
    ruleId: 'r1',
    ruleName: 'Rule 1',
    messageId: 1,
    subject: 'Test Subject',
    from: 'alice@test.com',
    actions: ['move'],
    type: 'classification',
    ...overrides,
  };
}

describe('searchRules', () => {
  it('finds rules by name', () => {
    const rules = [makeRule({ id: 'r1', name: 'Newsletter Filter' })];
    const result = searchRules('news', rules, labels);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Newsletter Filter');
    expect(result[0].tabId).toBe('rules');
  });

  it('finds rules by condition value', () => {
    const rules = [makeRule({
      id: 'r1',
      name: 'My Rule',
      conditions: [{ field: 'from', operator: 'contains', value: 'github.com', caseSensitive: false }],
    })];
    const result = searchRules('github', rules, labels);
    expect(result).toHaveLength(1);
  });

  it('shows active/inactive status', () => {
    const rules = [
      makeRule({ id: 'r1', name: 'Active Rule', enabled: true }),
      makeRule({ id: 'r2', name: 'Inactive Rule', enabled: false }),
    ];
    const results = searchRules('rule', rules, labels);
    expect(results[0].subtitle).toBe('Active');
    expect(results[1].subtitle).toBe('Inactive');
  });

  it('respects max limit', () => {
    const rules = Array.from({ length: 10 }, (_, i) =>
      makeRule({ id: `r${i}`, name: `Rule ${i}` }),
    );
    const result = searchRules('rule', rules, labels, 3);
    expect(result).toHaveLength(3);
  });

  it('returns empty for empty query', () => {
    expect(searchRules('', [makeRule()], labels)).toEqual([]);
    expect(searchRules('  ', [makeRule()], labels)).toEqual([]);
  });

  it('is case insensitive', () => {
    const rules = [makeRule({ name: 'URGENT' })];
    expect(searchRules('urgent', rules, labels)).toHaveLength(1);
  });
});

describe('searchTemplates', () => {
  it('finds templates by name', () => {
    const templates = [makeTemplate({ name: 'Vacation Reply' })];
    const result = searchTemplates('vacation', templates);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('template');
  });

  it('finds templates by subject', () => {
    const templates = [makeTemplate({ subject: 'Out of Office' })];
    const result = searchTemplates('office', templates);
    expect(result).toHaveLength(1);
  });

  it('returns empty for no match', () => {
    const templates = [makeTemplate()];
    expect(searchTemplates('nonexistent', templates)).toEqual([]);
  });
});

describe('searchActivity', () => {
  it('finds entries by subject', () => {
    const entries = [makeEntry({ subject: 'Invoice #123' })];
    const result = searchActivity('invoice', entries, labels);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('log');
  });

  it('finds entries by sender', () => {
    const entries = [makeEntry({ from: 'boss@company.com' })];
    const result = searchActivity('boss', entries, labels);
    expect(result).toHaveLength(1);
  });

  it('finds entries by rule name', () => {
    const entries = [makeEntry({ ruleName: 'Newsletter' })];
    const result = searchActivity('newsletter', entries, labels);
    expect(result).toHaveLength(1);
  });

  it('uses noSubject label when subject is empty', () => {
    const entries = [makeEntry({ subject: '', from: 'test@t.com' })];
    const result = searchActivity('test', entries, labels);
    expect(result[0].title).toBe('(No subject)');
  });

  it('returns empty for empty query', () => {
    expect(searchActivity('', [makeEntry()], labels)).toEqual([]);
  });
});
