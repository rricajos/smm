/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect } from 'vitest';
import { activityToCSV, filterAndSortActivity } from './csv-export';
import type { ActivityEntry } from '../../types/settings';

function makeEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    timestamp: new Date('2024-06-15T10:00:00Z').getTime(),
    ruleId: 'r1',
    ruleName: 'Rule 1',
    messageId: 1,
    subject: 'Test Subject',
    from: 'alice@test.com',
    actions: ['move', 'tag'],
    type: 'classification',
    ...overrides,
  };
}

describe('activityToCSV', () => {
  it('generates CSV with headers and rows', () => {
    const entries = [makeEntry()];
    const csv = activityToCSV(entries);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2); // header + 1 row
    expect(lines[0]).toContain('Date');
    expect(lines[1]).toContain('Rule 1');
    expect(lines[1]).toContain('alice@test.com');
  });

  it('escapes double quotes in values', () => {
    const entries = [makeEntry({ subject: 'He said "hello"' })];
    const csv = activityToCSV(entries);
    expect(csv).toContain('He said ""hello""');
  });

  it('handles empty entries', () => {
    const csv = activityToCSV([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1); // header only
  });

  it('joins actions with semicolons', () => {
    const entries = [makeEntry({ actions: ['move', 'tag', 'markRead'] })];
    const csv = activityToCSV(entries);
    expect(csv).toContain('move; tag; markRead');
  });

  it('uses custom headers when provided', () => {
    const csv = activityToCSV([], ['Fecha', 'Tipo', 'Regla', 'Asunto', 'De', 'Acciones', 'Detalles']);
    expect(csv).toContain('Fecha');
  });
});

describe('filterAndSortActivity', () => {
  const entries = [
    makeEntry({ timestamp: 100, type: 'classification', subject: 'Alpha', from: 'alice@t.com', ruleName: 'Rule A' }),
    makeEntry({ timestamp: 200, type: 'autoResponse', subject: 'Beta', from: 'bob@t.com', ruleName: 'Rule B' }),
    makeEntry({ timestamp: 300, type: 'classification', subject: 'Gamma', from: 'carol@t.com', ruleName: 'Rule C' }),
  ];

  it('filters by type', () => {
    const result = filterAndSortActivity(entries, {
      filterType: 'classification',
      searchQuery: '',
      sortColumn: 'timestamp',
      sortDir: 'desc',
    });
    expect(result).toHaveLength(2);
    expect(result.every(e => e.type === 'classification')).toBe(true);
  });

  it('filters by search query across subject, from, ruleName', () => {
    const result = filterAndSortActivity(entries, {
      filterType: 'all',
      searchQuery: 'bob',
      sortColumn: 'timestamp',
      sortDir: 'desc',
    });
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe('bob@t.com');
  });

  it('sorts by timestamp descending', () => {
    const result = filterAndSortActivity(entries, {
      filterType: 'all',
      searchQuery: '',
      sortColumn: 'timestamp',
      sortDir: 'desc',
    });
    expect(result[0].timestamp).toBe(300);
    expect(result[2].timestamp).toBe(100);
  });

  it('sorts by timestamp ascending', () => {
    const result = filterAndSortActivity(entries, {
      filterType: 'all',
      searchQuery: '',
      sortColumn: 'timestamp',
      sortDir: 'asc',
    });
    expect(result[0].timestamp).toBe(100);
    expect(result[2].timestamp).toBe(300);
  });

  it('sorts by string column (subject)', () => {
    const result = filterAndSortActivity(entries, {
      filterType: 'all',
      searchQuery: '',
      sortColumn: 'subject',
      sortDir: 'asc',
    });
    expect(result[0].subject).toBe('Alpha');
    expect(result[2].subject).toBe('Gamma');
  });

  it('returns all when filterType is all and no search', () => {
    const result = filterAndSortActivity(entries, {
      filterType: 'all',
      searchQuery: '',
      sortColumn: 'timestamp',
      sortDir: 'desc',
    });
    expect(result).toHaveLength(3);
  });
});
