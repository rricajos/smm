/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import type { Rule } from '../../types/rules';

let mockStorage: Record<string, unknown> = {};

vi.stubGlobal('browser', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => (key in mockStorage ? { [key]: mockStorage[key] } : {})),
      set: vi.fn(async (data: Record<string, unknown>) => Object.assign(mockStorage, data)),
    },
    onChanged: { addListener: vi.fn() },
  },
});

import { rules } from './rules';

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    name: 'Test Rule',
    enabled: true,
    conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
    conditionLogic: 'all',
    actions: [{ type: 'markRead' }],
    stopProcessing: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage = {};
  // Reset store to empty
  rules.setRules([]);
});

describe('rules store', () => {
  it('has empty array as default', () => {
    expect(get(rules)).toEqual([]);
  });

  it('addRule() appends a rule and persists', async () => {
    const rule = makeRule({ id: 'r1' });
    await rules.addRule(rule);
    const current = get(rules);
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe('r1');
  });

  it('addRule() does not overwrite existing rules', async () => {
    await rules.addRule(makeRule({ id: 'r1', name: 'First' }));
    await rules.addRule(makeRule({ id: 'r2', name: 'Second' }));
    const current = get(rules);
    expect(current).toHaveLength(2);
    expect(current[0].name).toBe('First');
    expect(current[1].name).toBe('Second');
  });

  it('updateRule() merges partial into matching rule', async () => {
    await rules.addRule(makeRule({ id: 'r1', name: 'Original' }));
    await rules.updateRule('r1', { name: 'Updated' });
    expect(get(rules)[0].name).toBe('Updated');
  });

  it('updateRule() sets updatedAt', async () => {
    await rules.addRule(makeRule({ id: 'r1', updatedAt: 1000 }));
    await rules.updateRule('r1', { name: 'Changed' });
    expect(get(rules)[0].updatedAt).toBeGreaterThan(1000);
  });

  it('updateRule() does not modify other rules', async () => {
    await rules.addRule(makeRule({ id: 'r1', name: 'A' }));
    await rules.addRule(makeRule({ id: 'r2', name: 'B' }));
    await rules.updateRule('r1', { name: 'A-updated' });
    expect(get(rules)[1].name).toBe('B');
  });

  it('deleteRule() removes rule by id', async () => {
    await rules.addRule(makeRule({ id: 'r1' }));
    await rules.addRule(makeRule({ id: 'r2' }));
    await rules.deleteRule('r1');
    const current = get(rules);
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe('r2');
  });

  it('deleteRule() is a no-op for nonexistent id', async () => {
    await rules.addRule(makeRule({ id: 'r1' }));
    await rules.deleteRule('nonexistent');
    expect(get(rules)).toHaveLength(1);
  });

  it('reorderRules() reorders by given id array', async () => {
    await rules.addRule(makeRule({ id: 'a', name: 'A' }));
    await rules.addRule(makeRule({ id: 'b', name: 'B' }));
    await rules.addRule(makeRule({ id: 'c', name: 'C' }));
    await rules.reorderRules(['c', 'a', 'b']);
    const names = get(rules).map(r => r.name);
    expect(names).toEqual(['C', 'A', 'B']);
  });

  it('toggleRule() flips enabled', async () => {
    await rules.addRule(makeRule({ id: 'r1', enabled: true }));
    await rules.toggleRule('r1');
    expect(get(rules)[0].enabled).toBe(false);
    await rules.toggleRule('r1');
    expect(get(rules)[0].enabled).toBe(true);
  });

  it('setRules() replaces all rules', async () => {
    await rules.addRule(makeRule({ id: 'old' }));
    await rules.setRules([makeRule({ id: 'new1' }), makeRule({ id: 'new2' })]);
    const current = get(rules);
    expect(current).toHaveLength(2);
    expect(current[0].id).toBe('new1');
  });
});
