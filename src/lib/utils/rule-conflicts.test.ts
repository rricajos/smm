/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect } from 'vitest';
import { detectRuleConflicts } from './rule-conflicts';
import type { Rule } from '../../types/rules';

function makeRule(partial: Partial<Rule> & Pick<Rule, 'id' | 'name' | 'conditions' | 'actions'>): Rule {
  return {
    enabled: true,
    conditionLogic: 'all',
    stopProcessing: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...partial,
  };
}

describe('detectRuleConflicts', () => {
  it('returns empty array when no rules', () => {
    expect(detectRuleConflicts([])).toEqual([]);
  });

  it('returns empty array for a single rule', () => {
    const rules = [makeRule({
      id: '1', name: 'R1',
      conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
      actions: [{ type: 'markRead' }],
    })];
    expect(detectRuleConflicts(rules)).toEqual([]);
  });

  it('ignores disabled rules', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1', enabled: false,
        conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'a' }],
      }),
      makeRule({
        id: '2', name: 'R2', enabled: false,
        conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'b' }],
      }),
    ];
    expect(detectRuleConflicts(rules)).toEqual([]);
  });

  it('detects contradictory moves', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1',
        conditions: [{ field: 'from', operator: 'contains', value: 'newsletter', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'folder-a' }],
      }),
      makeRule({
        id: '2', name: 'R2',
        conditions: [{ field: 'from', operator: 'contains', value: 'newsletter', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'folder-b' }],
      }),
    ];
    const conflicts = detectRuleConflicts(rules);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('contradictory_move');
    expect(conflicts[0].severity).toBe('warning');
    expect(conflicts[0].ruleA.id).toBe('1');
    expect(conflicts[0].ruleB.id).toBe('2');
  });

  it('detects contradictory priorities', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1',
        conditions: [{ field: 'subject', operator: 'contains', value: 'urgent', caseSensitive: false }],
        actions: [{ type: 'setPriority', priority: 'highest' }],
      }),
      makeRule({
        id: '2', name: 'R2',
        conditions: [{ field: 'subject', operator: 'contains', value: 'urgent', caseSensitive: false }],
        actions: [{ type: 'setPriority', priority: 'low' }],
      }),
    ];
    const conflicts = detectRuleConflicts(rules);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('contradictory_priority');
    expect(conflicts[0].severity).toBe('warning');
    expect(conflicts[0].params).toEqual({ a: 'highest', b: 'low' });
  });

  it('detects redundant rules (identical actions, overlapping conditions)', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1',
        conditions: [{ field: 'from', operator: 'contains', value: 'spam@', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'trash' }, { type: 'markRead' }],
      }),
      makeRule({
        id: '2', name: 'R2',
        conditions: [{ field: 'from', operator: 'contains', value: 'spam@', caseSensitive: false }],
        actions: [{ type: 'markRead' }, { type: 'moveToFolder', folderId: 'trash' }],
      }),
    ];
    const conflicts = detectRuleConflicts(rules);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('redundant');
    expect(conflicts[0].severity).toBe('info');
  });

  it('detects both contradictory move and priority in same pair', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1',
        conditions: [{ field: 'from', operator: 'contains', value: 'boss', caseSensitive: false }],
        actions: [
          { type: 'moveToFolder', folderId: 'a' },
          { type: 'setPriority', priority: 'high' },
        ],
      }),
      makeRule({
        id: '2', name: 'R2',
        conditions: [{ field: 'from', operator: 'contains', value: 'boss', caseSensitive: false }],
        actions: [
          { type: 'moveToFolder', folderId: 'b' },
          { type: 'setPriority', priority: 'low' },
        ],
      }),
    ];
    const conflicts = detectRuleConflicts(rules);
    expect(conflicts).toHaveLength(2);
    const types = conflicts.map(c => c.type).sort();
    expect(types).toEqual(['contradictory_move', 'contradictory_priority']);
  });

  it('does not flag rules with non-overlapping conditions', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1',
        conditions: [{ field: 'from', operator: 'contains', value: 'alice', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'a' }],
      }),
      makeRule({
        id: '2', name: 'R2',
        conditions: [{ field: 'from', operator: 'contains', value: 'bob', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'b' }],
      }),
    ];
    expect(detectRuleConflicts(rules)).toEqual([]);
  });

  it('detects overlap when one value is substring of another', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1',
        conditions: [{ field: 'from', operator: 'contains', value: 'news', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'a' }],
      }),
      makeRule({
        id: '2', name: 'R2',
        conditions: [{ field: 'from', operator: 'contains', value: 'newsletter', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'b' }],
      }),
    ];
    const conflicts = detectRuleConflicts(rules);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('contradictory_move');
  });

  it('detects overlap on boolean hasAttachments field', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1',
        conditions: [{ field: 'hasAttachments', operator: 'is', value: '', boolValue: true, caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'a' }],
      }),
      makeRule({
        id: '2', name: 'R2',
        conditions: [{ field: 'hasAttachments', operator: 'is', value: '', boolValue: true, caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'b' }],
      }),
    ];
    const conflicts = detectRuleConflicts(rules);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('contradictory_move');
  });

  it('does not flag hasAttachments with different bool values', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1',
        conditions: [{ field: 'hasAttachments', operator: 'is', value: '', boolValue: true, caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'a' }],
      }),
      makeRule({
        id: '2', name: 'R2',
        conditions: [{ field: 'hasAttachments', operator: 'is', value: '', boolValue: false, caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'b' }],
      }),
    ];
    expect(detectRuleConflicts(rules)).toEqual([]);
  });

  it('does not flag same move folder as contradictory', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1',
        conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'same-folder' }],
      }),
      makeRule({
        id: '2', name: 'R2',
        conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'same-folder' }],
      }),
    ];
    const conflicts = detectRuleConflicts(rules);
    // Same folder → not contradictory_move, but should be redundant
    expect(conflicts.every(c => c.type !== 'contradictory_move')).toBe(true);
    expect(conflicts.some(c => c.type === 'redundant')).toBe(true);
  });

  it('handles rules with different operators as non-overlapping', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1',
        conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'a' }],
      }),
      makeRule({
        id: '2', name: 'R2',
        conditions: [{ field: 'from', operator: 'equals', value: 'test', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'b' }],
      }),
    ];
    // Different operators → no overlap detected by current implementation
    expect(detectRuleConflicts(rules)).toEqual([]);
  });

  it('handles conditions on different fields as non-overlapping', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1',
        conditions: [{ field: 'from', operator: 'contains', value: 'test', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'a' }],
      }),
      makeRule({
        id: '2', name: 'R2',
        conditions: [{ field: 'subject', operator: 'contains', value: 'test', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'b' }],
      }),
    ];
    expect(detectRuleConflicts(rules)).toEqual([]);
  });

  it('comparison is case-insensitive', () => {
    const rules = [
      makeRule({
        id: '1', name: 'R1',
        conditions: [{ field: 'from', operator: 'contains', value: 'Newsletter', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'a' }],
      }),
      makeRule({
        id: '2', name: 'R2',
        conditions: [{ field: 'from', operator: 'contains', value: 'newsletter', caseSensitive: false }],
        actions: [{ type: 'moveToFolder', folderId: 'b' }],
      }),
    ];
    const conflicts = detectRuleConflicts(rules);
    expect(conflicts).toHaveLength(1);
  });
});
