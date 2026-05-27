/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect } from 'vitest';
import { validateRule } from './rule-validation';
import type { Condition, Action } from '../../types/rules';

// Simple pass-through translator for tests
const t = (key: string, params?: Record<string, string | number>) => {
  if (params) {
    let str = key;
    for (const [k, v] of Object.entries(params)) {
      str += `:${k}=${v}`;
    }
    return str;
  }
  return key;
};

function cond(overrides: Partial<Condition> = {}): Condition {
  return {
    field: 'from' as const,
    operator: 'contains' as const,
    value: 'test',
    caseSensitive: false,
    ...overrides,
  };
}

function action(overrides: Partial<Action> = {}): Action {
  return {
    type: 'markRead' as const,
    ...overrides,
  };
}

describe('validateRule', () => {
  it('returns no errors for a valid rule', () => {
    const errs = validateRule('My Rule', [cond()], [action()], t);
    expect(errs).toHaveLength(0);
  });

  it('requires a non-empty name', () => {
    const errs = validateRule('', [cond()], [action()], t);
    expect(errs).toContain('editor_name_required');
  });

  it('requires a name with non-whitespace content', () => {
    const errs = validateRule('   ', [cond()], [action()], t);
    expect(errs).toContain('editor_name_required');
  });

  it('requires at least one condition', () => {
    const errs = validateRule('Rule', [], [action()], t);
    expect(errs).toContain('editor_min_condition');
  });

  it('requires at least one action', () => {
    const errs = validateRule('Rule', [cond()], [], t);
    expect(errs).toContain('editor_min_action');
  });

  it('flags empty condition value', () => {
    const errs = validateRule('Rule', [cond({ value: '' })], [action()], t);
    expect(errs.some(e => e.includes('editor_condition_empty'))).toBe(true);
  });

  it('allows empty value for hasAttachments field', () => {
    const errs = validateRule(
      'Rule',
      [cond({ field: 'hasAttachments', value: '', boolValue: true })],
      [action()],
      t,
    );
    expect(errs).toHaveLength(0);
  });

  it('flags invalid regex pattern', () => {
    const errs = validateRule(
      'Rule',
      [cond({ operator: 'matches', value: '[invalid(' })],
      [action()],
      t,
    );
    expect(errs.some(e => e.includes('editor_regex_invalid'))).toBe(true);
  });

  it('accepts valid regex pattern', () => {
    const errs = validateRule(
      'Rule',
      [cond({ operator: 'matches', value: '^test.*$' })],
      [action()],
      t,
    );
    expect(errs).toHaveLength(0);
  });

  it('flags moveToFolder without folderId', () => {
    const errs = validateRule(
      'Rule',
      [cond()],
      [action({ type: 'moveToFolder' })],
      t,
    );
    expect(errs.some(e => e.includes('editor_action_select_folder'))).toBe(true);
  });

  it('accepts moveToFolder with folderId', () => {
    const errs = validateRule(
      'Rule',
      [cond()],
      [action({ type: 'moveToFolder', folderId: 'folder-1' })],
      t,
    );
    expect(errs).toHaveLength(0);
  });

  it('flags addTag without tagKey', () => {
    const errs = validateRule(
      'Rule',
      [cond()],
      [action({ type: 'addTag' })],
      t,
    );
    expect(errs.some(e => e.includes('editor_action_select_tag'))).toBe(true);
  });

  it('flags autoRespond without templateId', () => {
    const errs = validateRule(
      'Rule',
      [cond()],
      [action({ type: 'autoRespond' })],
      t,
    );
    expect(errs.some(e => e.includes('editor_action_select_template'))).toBe(true);
  });

  it('collects multiple errors at once', () => {
    const errs = validateRule('', [], [], t);
    expect(errs).toHaveLength(3);
    expect(errs).toContain('editor_name_required');
    expect(errs).toContain('editor_min_condition');
    expect(errs).toContain('editor_min_action');
  });

  it('validates multiple conditions and actions', () => {
    const errs = validateRule(
      'Rule',
      [cond({ value: '' }), cond({ operator: 'matches', value: '[bad(' })],
      [action({ type: 'moveToFolder' }), action({ type: 'addTag' })],
      t,
    );
    // 1 empty condition + 1 invalid regex + 1 missing folder + 1 missing tag = 4
    expect(errs).toHaveLength(4);
  });
});
