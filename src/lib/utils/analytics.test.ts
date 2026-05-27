/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect } from 'vitest';
import { computeWeeklyData, computeRuleStats, computeTopSenders, filterByTimeRange } from './analytics';
import type { ActivityEntry } from '../../types/settings';

function makeEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    timestamp: Date.now(),
    ruleId: 'r1',
    ruleName: 'Rule 1',
    messageId: 1,
    subject: 'Test',
    from: 'alice@test.com',
    actions: ['move'],
    type: 'classification',
    ...overrides,
  };
}

describe('computeWeeklyData', () => {
  it('returns 7 data points', () => {
    const result = computeWeeklyData([]);
    expect(result).toHaveLength(7);
  });

  it('counts classifications and responses for today', () => {
    const now = Date.now();
    const entries = [
      makeEntry({ timestamp: now, type: 'classification' }),
      makeEntry({ timestamp: now, type: 'classification' }),
      makeEntry({ timestamp: now, type: 'autoResponse' }),
    ];
    const result = computeWeeklyData(entries, now);
    const today = result[6]; // last element is today
    expect(today.classifications).toBe(2);
    expect(today.responses).toBe(1);
  });

  it('places entries in correct day buckets', () => {
    const now = new Date(2024, 5, 15, 12, 0, 0).getTime(); // June 15, noon
    const yesterday = new Date(2024, 5, 14, 10, 0, 0).getTime();
    const entries = [
      makeEntry({ timestamp: yesterday, type: 'classification' }),
    ];
    const result = computeWeeklyData(entries, now);
    expect(result[5].classifications).toBe(1); // dayIndex 5 = yesterday
    expect(result[6].classifications).toBe(0); // today
  });

  it('ignores entries older than 7 days', () => {
    const now = Date.now();
    const oldEntry = makeEntry({ timestamp: now - 8 * 86400000, type: 'classification' });
    const result = computeWeeklyData([oldEntry], now);
    const total = result.reduce((sum, d) => sum + d.classifications + d.responses, 0);
    expect(total).toBe(0);
  });
});

describe('computeRuleStats', () => {
  it('aggregates entries by ruleId', () => {
    const entries = [
      makeEntry({ ruleId: 'r1', ruleName: 'Rule A' }),
      makeEntry({ ruleId: 'r1', ruleName: 'Rule A' }),
      makeEntry({ ruleId: 'r2', ruleName: 'Rule B' }),
    ];
    const result = computeRuleStats(entries);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'r1', name: 'Rule A', count: 2 });
    expect(result[1]).toEqual({ id: 'r2', name: 'Rule B', count: 1 });
  });

  it('returns top N rules by count', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ ruleId: `r${i}`, ruleName: `Rule ${i}` }),
    );
    const result = computeRuleStats(entries, 3);
    expect(result).toHaveLength(3);
  });

  it('skips entries without ruleId', () => {
    const entries = [makeEntry({ ruleId: '' })];
    const result = computeRuleStats(entries);
    expect(result).toEqual([]);
  });

  it('returns empty for empty input', () => {
    expect(computeRuleStats([])).toEqual([]);
  });
});

describe('computeTopSenders', () => {
  it('aggregates by sender email', () => {
    const entries = [
      makeEntry({ from: 'alice@t.com' }),
      makeEntry({ from: 'alice@t.com' }),
      makeEntry({ from: 'bob@t.com' }),
    ];
    const result = computeTopSenders(entries);
    expect(result[0]).toEqual({ from: 'alice@t.com', count: 2 });
    expect(result[1]).toEqual({ from: 'bob@t.com', count: 1 });
  });

  it('respects limit', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ from: `user${i}@t.com` }),
    );
    expect(computeTopSenders(entries, 2)).toHaveLength(2);
  });

  it('skips entries without from', () => {
    const entries = [makeEntry({ from: '' })];
    expect(computeTopSenders(entries)).toEqual([]);
  });
});

describe('filterByTimeRange', () => {
  const now = Date.now();
  const entries = [
    makeEntry({ timestamp: now - 1 * 86400000 }),  // 1 day ago
    makeEntry({ timestamp: now - 10 * 86400000 }), // 10 days ago
    makeEntry({ timestamp: now - 40 * 86400000 }), // 40 days ago
  ];

  it('filters to last 7 days', () => {
    expect(filterByTimeRange(entries, '7d', now)).toHaveLength(1);
  });

  it('filters to last 30 days', () => {
    expect(filterByTimeRange(entries, '30d', now)).toHaveLength(2);
  });

  it('returns all entries for "all" range', () => {
    expect(filterByTimeRange(entries, 'all', now)).toHaveLength(3);
  });
});
