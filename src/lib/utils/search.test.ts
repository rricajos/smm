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
    const rules = [
      makeRule({
        id: 'r1',
        name: 'My Rule',
        conditions: [
          { field: 'from', operator: 'contains', value: 'github.com', caseSensitive: false },
        ],
      }),
    ];
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

// --- Branch coverage: additional uncovered paths ---

describe('searchRules – branch coverage', () => {
  it('matches rule via condition with empty/undefined c.value (c.value || "" fallback)', () => {
    // When c.value is undefined, the fallback '' should be used and not crash
    const rules = [
      makeRule({
        id: 'r1',
        name: 'No Match Name',
        conditions: [
          {
            field: 'from',
            operator: 'contains',
            value: undefined as unknown as string,
            caseSensitive: false,
          },
        ],
      }),
    ];
    // Searching for the rule name should still find it
    const result = searchRules('no match', rules, labels);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('handles condition with empty string value', () => {
    const rules = [
      makeRule({
        id: 'r1',
        name: 'Some Rule',
        conditions: [{ field: 'from', operator: 'contains', value: '', caseSensitive: false }],
      }),
    ];
    // Search by name, not by condition value
    const result = searchRules('some', rules, labels);
    expect(result).toHaveLength(1);
  });

  it('uses default max parameter (5) when not provided', () => {
    const rules = Array.from({ length: 10 }, (_, i) =>
      makeRule({ id: `r${i}`, name: `Rule ${i}` }),
    );
    // Do not pass max parameter – should default to 5
    const result = searchRules('rule', rules, labels);
    expect(result).toHaveLength(5);
  });

  it('shows inactive subtitle for disabled rules', () => {
    const rules = [makeRule({ id: 'r1', name: 'Disabled Rule', enabled: false })];
    const result = searchRules('disabled', rules, labels);
    expect(result).toHaveLength(1);
    expect(result[0].subtitle).toBe('Inactive');
  });

  it('does not match when neither name nor condition values match', () => {
    const rules = [
      makeRule({
        id: 'r1',
        name: 'Newsletter',
        conditions: [
          { field: 'from', operator: 'contains', value: 'news@company.com', caseSensitive: false },
        ],
      }),
    ];
    const result = searchRules('zzzznotfound', rules, labels);
    expect(result).toEqual([]);
  });
});

describe('searchActivity – branch coverage', () => {
  it('handles entries with undefined subject', () => {
    const entries = [
      makeEntry({
        subject: undefined as unknown as string,
        from: 'alice@test.com',
        ruleName: 'Rule 1',
      }),
    ];
    // Search by from field
    const result = searchActivity('alice', entries, labels);
    expect(result).toHaveLength(1);
    // Title should be noSubject label since subject is falsy
    expect(result[0].title).toBe('(No subject)');
  });

  it('handles entries with undefined from', () => {
    const entries = [
      makeEntry({
        subject: 'Test Subject',
        from: undefined as unknown as string,
        ruleName: 'Rule 1',
      }),
    ];
    // Search by subject
    const result = searchActivity('test subject', entries, labels);
    expect(result).toHaveLength(1);
    expect(result[0].subtitle).toContain('Rule 1');
  });

  it('handles entries with undefined ruleName', () => {
    const entries = [
      makeEntry({
        subject: 'Test Subject',
        from: 'alice@test.com',
        ruleName: undefined as unknown as string,
      }),
    ];
    // Search by subject
    const result = searchActivity('test', entries, labels);
    expect(result).toHaveLength(1);
    expect(result[0].subtitle).toContain('alice@test.com');
  });

  it('handles entries where all searchable fields are undefined', () => {
    const entries = [
      makeEntry({
        subject: undefined as unknown as string,
        from: undefined as unknown as string,
        ruleName: undefined as unknown as string,
      }),
    ];
    // Search for something that won't match empty strings
    const result = searchActivity('something', entries, labels);
    expect(result).toEqual([]);
  });

  it('matches entry by ruleName field', () => {
    const entries = [
      makeEntry({ subject: 'Unrelated', from: 'nobody@t.com', ruleName: 'Special Filter' }),
    ];
    const result = searchActivity('special', entries, labels);
    expect(result).toHaveLength(1);
    expect(result[0].subtitle).toContain('Special Filter');
  });

  it('uses default max parameter (5) when not provided', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ timestamp: Date.now() + i, subject: `Entry ${i}` }),
    );
    const result = searchActivity('entry', entries, labels);
    expect(result).toHaveLength(5);
  });
});

describe('searchTemplates – branch coverage', () => {
  it('uses default max parameter (5) when not provided', () => {
    const templates = Array.from({ length: 10 }, (_, i) =>
      makeTemplate({ id: `t${i}`, name: `Template ${i}` }),
    );
    const result = searchTemplates('template', templates);
    expect(result).toHaveLength(5);
  });
});
