/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import type { ActivityEntry } from '../../types/settings';

export interface WeeklyDataPoint {
  dayIndex: number;
  classifications: number;
  responses: number;
}

export interface RuleStat {
  id: string;
  name: string;
  count: number;
}

export interface SenderStat {
  from: string;
  count: number;
}

/**
 * Compute 7-day activity chart data.
 * dayIndex 0 = 6 days ago, dayIndex 6 = today.
 */
export function computeWeeklyData(log: ActivityEntry[], now: number = Date.now()): WeeklyDataPoint[] {
  const days: WeeklyDataPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const start = new Date(d).setHours(0, 0, 0, 0);
    const end = new Date(d).setHours(23, 59, 59, 999);
    days.push({
      dayIndex: 6 - i,
      classifications: log.filter(a => a.type === 'classification' && a.timestamp >= start && a.timestamp <= end).length,
      responses: log.filter(a => a.type === 'autoResponse' && a.timestamp >= start && a.timestamp <= end).length,
    });
  }
  return days;
}

/**
 * Aggregate per-rule statistics from activity entries.
 * Returns top `limit` rules sorted by count descending.
 */
export function computeRuleStats(entries: ActivityEntry[], limit: number = 5): RuleStat[] {
  const stats = new Map<string, { name: string; count: number }>();
  for (const entry of entries) {
    if (entry.ruleId) {
      const existing = stats.get(entry.ruleId);
      if (existing) {
        existing.count++;
      } else {
        stats.set(entry.ruleId, { name: entry.ruleName, count: 1 });
      }
    }
  }
  return [...stats.entries()]
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Aggregate top senders from activity entries.
 */
export function computeTopSenders(entries: ActivityEntry[], limit: number = 5): SenderStat[] {
  const senders = new Map<string, number>();
  for (const entry of entries) {
    if (entry.from) {
      senders.set(entry.from, (senders.get(entry.from) || 0) + 1);
    }
  }
  return [...senders.entries()]
    .map(([from, count]) => ({ from, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Filter activity entries by time range.
 */
export function filterByTimeRange(
  entries: ActivityEntry[],
  range: '7d' | '30d' | 'all',
  now: number = Date.now(),
): ActivityEntry[] {
  if (range === 'all') return entries;
  const ms = range === '7d' ? 7 * 86400000 : 30 * 86400000;
  const start = now - ms;
  return entries.filter(a => a.timestamp >= start);
}
