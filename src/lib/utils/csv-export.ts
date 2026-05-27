/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import type { ActivityEntry } from '../../types/settings';

/**
 * Convert activity entries to CSV string with BOM for Excel compatibility.
 */
export function activityToCSV(
  entries: ActivityEntry[],
  headers: string[] = ['Date', 'Type', 'Rule', 'Subject', 'From', 'Actions', 'Details'],
): string {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = entries.map(e => [
    new Date(e.timestamp).toISOString(),
    e.type,
    e.ruleName,
    e.subject,
    e.from,
    e.actions.join('; '),
    e.details || '',
  ].map(escape).join(','));
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Filter and sort activity entries for display.
 */
export function filterAndSortActivity(
  entries: ActivityEntry[],
  opts: {
    filterType: 'all' | 'classification' | 'autoResponse' | 'error';
    searchQuery: string;
    sortColumn: 'timestamp' | 'type' | 'ruleName' | 'subject' | 'from';
    sortDir: 'asc' | 'desc';
  },
): ActivityEntry[] {
  const list = entries.filter((entry) => {
    if (opts.filterType !== 'all' && entry.type !== opts.filterType) return false;
    if (opts.searchQuery) {
      const q = opts.searchQuery.toLowerCase();
      return (
        entry.subject.toLowerCase().includes(q) ||
        entry.from.toLowerCase().includes(q) ||
        entry.ruleName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const dir = opts.sortDir === 'asc' ? 1 : -1;
  const col = opts.sortColumn;
  list.sort((a: ActivityEntry, b: ActivityEntry) => {
    if (col === 'timestamp') return (a.timestamp - b.timestamp) * dir;
    const va = String(a[col] || '').toLowerCase();
    const vb = String(b[col] || '').toLowerCase();
    return va < vb ? -dir : va > vb ? dir : 0;
  });

  return list;
}
