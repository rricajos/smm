<script lang="ts">
  import type { ActivityEntry } from '../../types/settings';
  import { activity } from '../../lib/stores/activity';
  import { settings } from '../../lib/stores/settings';
  import { t } from '../../lib/i18n';
  import type { Translations } from '../../lib/i18n/types';
  import Button from '../../lib/components/Button.svelte';

  interface Props {
    initialSearch?: string;
  }
  let { initialSearch = '' }: Props = $props();

  let currentActivity = $state<ActivityEntry[]>([]);
  let filterType = $state<'all' | 'classification' | 'autoResponse' | 'error'>('all');
  let searchInput = $state('');
  let searchQuery = $state('');
  let page = $state(1);
  const PAGE_SIZE = 50;
  let expandedRow = $state<number | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function handleSearchInput(value: string) {
    searchInput = value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { searchQuery = value; }, 250);
  }

  type SortColumn = 'timestamp' | 'type' | 'ruleName' | 'subject' | 'from';
  let sortColumn = $state<SortColumn>('timestamp');
  let sortDir = $state<'asc' | 'desc'>('desc');

  function toggleSort(col: SortColumn) {
    if (sortColumn === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = col;
      sortDir = col === 'timestamp' ? 'desc' : 'asc';
    }
  }

  let retentionDays = $state(30);
  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);

  t.subscribe((fn) => (T = fn));
  activity.subscribe((v) => (currentActivity = v));
  settings.subscribe((v) => (retentionDays = v.logRetentionDays || 30));

  $effect(() => {
    if (initialSearch) {
      searchInput = initialSearch;
      searchQuery = initialSearch;
    }
  });

  let filtered = $derived(() => {
    const list = currentActivity.filter((entry) => {
      if (filterType !== 'all' && entry.type !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          entry.subject.toLowerCase().includes(q) ||
          entry.from.toLowerCase().includes(q) ||
          entry.ruleName.toLowerCase().includes(q)
        );
      }
      return true;
    });
    const col = sortColumn;
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a: any, b: any) => {
      if (col === 'timestamp') return (a.timestamp - b.timestamp) * dir;
      const va = (a[col] || '').toLowerCase();
      const vb = (b[col] || '').toLowerCase();
      return va < vb ? -dir : va > vb ? dir : 0;
    });
    return list;
  });

  let totalPages = $derived(Math.max(1, Math.ceil(filtered().length / PAGE_SIZE)));
  let paginated = $derived(filtered().slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));

  // Reset page when filter changes
  $effect(() => {
    // Track filter deps
    filterType; searchQuery;
    page = 1;
  });

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  function handleClear() {
    if (!confirm(T('log_clear_confirm'))) return;
    activity.clear();
  }

  function exportCSV() {
    const headers = [T('log_col_date'), T('log_col_type'), T('log_col_rule'), T('log_col_subject'), T('log_col_from'), T('log_col_actions'), T('log_col_details')];
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = filtered().map(e => [
      new Date(e.timestamp).toISOString(),
      e.type,
      e.ruleName,
      e.subject,
      e.from,
      e.actions.join('; '),
      e.details || '',
    ].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smm-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  let typeLabels = $derived<Record<string, string>>({
    classification: T('log_type_classification'),
    autoResponse: T('log_type_response'),
    error: T('log_type_error'),
  });
</script>

<div class="log-page">
  <div class="header">
    <h3>{T('log_title')}</h3>
    <div class="header-actions">
      <span class="retention-badge">{T('log_retention', { n: retentionDays })}</span>
      {#if filtered().length > 0}
        <Button size="sm" onclick={exportCSV}>{T('log_export_csv')}</Button>
      {/if}
      <Button size="sm" variant="danger" onclick={handleClear}>{T('log_clear')}</Button>
    </div>
  </div>

  <div class="filters">
    <input
      type="text"
      placeholder={T('log_search_placeholder')}
      value={searchInput}
      oninput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
    />
    <select bind:value={filterType}>
      <option value="all">{T('log_filter_all')}</option>
      <option value="classification">{T('log_filter_classifications')}</option>
      <option value="autoResponse">{T('log_filter_responses')}</option>
      <option value="error">{T('log_filter_errors')}</option>
    </select>
  </div>

  {#if filtered().length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <p class="empty-title">{T('empty_log_title')}</p>
      <p class="empty-desc">{T('empty_log_desc')}</p>
    </div>
  {:else}
    <table>
      <thead>
        <tr>
          <th class="sortable" class:sorted={sortColumn === 'timestamp'} onclick={() => toggleSort('timestamp')}>
            {T('log_col_date')}
            <span class="sort-arrow">{sortColumn === 'timestamp' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25BD'}</span>
          </th>
          <th class="sortable" class:sorted={sortColumn === 'type'} onclick={() => toggleSort('type')}>
            {T('log_col_type')}
            <span class="sort-arrow">{sortColumn === 'type' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25BD'}</span>
          </th>
          <th class="sortable" class:sorted={sortColumn === 'ruleName'} onclick={() => toggleSort('ruleName')}>
            {T('log_col_rule')}
            <span class="sort-arrow">{sortColumn === 'ruleName' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25BD'}</span>
          </th>
          <th class="sortable" class:sorted={sortColumn === 'subject'} onclick={() => toggleSort('subject')}>
            {T('log_col_subject')}
            <span class="sort-arrow">{sortColumn === 'subject' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25BD'}</span>
          </th>
          <th class="sortable" class:sorted={sortColumn === 'from'} onclick={() => toggleSort('from')}>
            {T('log_col_from')}
            <span class="sort-arrow">{sortColumn === 'from' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25BD'}</span>
          </th>
          <th>{T('log_col_actions')}</th>
          <th>{T('log_col_details')}</th>
        </tr>
      </thead>
      <tbody>
        {#each paginated as entry, i}
          <tr class="clickable-row" class:expanded-row={expandedRow === i} onclick={() => (expandedRow = expandedRow === i ? null : i)}>
            <td>{formatTime(entry.timestamp)}</td>
            <td>
              <span class="badge badge-{entry.type}">
                {typeLabels[entry.type] || entry.type}
              </span>
            </td>
            <td title={entry.ruleName}>{entry.ruleName}</td>
            <td class="truncate" title={entry.subject}>{entry.subject}</td>
            <td class="truncate" title={entry.from}>{entry.from}</td>
            <td title={entry.actions.join(', ')}>{entry.actions.join(', ')}</td>
            <td class="truncate" title={entry.details || ''}>{entry.details || ''}</td>
          </tr>
          {#if expandedRow === i}
            <tr class="detail-row">
              <td colspan="7">
                <div class="detail-content">
                  <div class="detail-field"><strong>{T('log_col_subject')}:</strong> {entry.subject}</div>
                  <div class="detail-field"><strong>{T('log_col_from')}:</strong> {entry.from}</div>
                  <div class="detail-field"><strong>{T('log_col_rule')}:</strong> {entry.ruleName}</div>
                  <div class="detail-field"><strong>{T('log_col_actions')}:</strong> {entry.actions.join(', ')}</div>
                  {#if entry.details}
                    <div class="detail-field"><strong>{T('log_col_details')}:</strong> {entry.details}</div>
                  {/if}
                </div>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
    <div class="pagination-row">
      <p class="count">{T('log_entries_count', { n: filtered().length, s: filtered().length !== 1 ? 's' : '' })}</p>
      {#if totalPages > 1}
        <div class="pagination">
          <button class="page-btn" disabled={page <= 1} onclick={() => (page = page - 1)}>{T('log_page_prev')}</button>
          <span class="page-info">{T('log_page_of', { current: page, total: totalPages })}</span>
          <button class="page-btn" disabled={page >= totalPages} onclick={() => (page = page + 1)}>{T('log_page_next')}</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .log-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header h3 {
    margin: 0;
    font-size: 15px;
  }
  .header-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .retention-badge {
    font-size: 11px;
    color: var(--text-secondary, #666);
    padding: 3px 8px;
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 10px;
    white-space: nowrap;
  }
  .filters {
    display: flex;
    gap: 8px;
  }
  .filters input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
  }
  .filters select {
    padding: 6px 10px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px;
    text-align: center;
  }
  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--bg-secondary, #f0f0f4);
    color: var(--text-secondary, #999);
    margin-bottom: 16px;
  }
  .empty-title {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 6px 0;
    color: var(--text-color, #15141a);
  }
  .empty-desc {
    font-size: 13px;
    color: var(--text-secondary, #666);
    margin: 0;
    max-width: 360px;
    line-height: 1.5;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 2px solid var(--border-color, #e0e0e6);
    font-weight: 600;
    color: var(--text-secondary, #555);
  }
  th.sortable {
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }
  th.sortable:hover {
    color: var(--primary-color, #0060df);
  }
  th.sorted {
    color: var(--primary-color, #0060df);
  }
  .sort-arrow {
    font-size: 9px;
    margin-left: 2px;
    opacity: 0.4;
  }
  th.sorted .sort-arrow {
    opacity: 1;
  }
  td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--border-color, #f0f0f4);
  }
  .truncate {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badge {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
  }
  .badge-classification { background: #d4edda; color: #155724; }
  .badge-autoResponse { background: #cce5ff; color: #004085; }
  .badge-error { background: #f8d7da; color: #721c24; }
  .clickable-row {
    cursor: pointer;
    transition: background 0.1s;
  }
  .clickable-row:hover {
    background: var(--bg-secondary, #f9f9fb);
  }
  .expanded-row {
    background: var(--bg-secondary, #f9f9fb);
  }
  .detail-row td {
    padding: 0;
    border-bottom: 2px solid var(--primary-color, #0060df);
  }
  .detail-content {
    padding: 10px 12px;
    background: var(--bg-secondary, #f9f9fb);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    animation: expandIn 0.15s ease;
  }
  @keyframes expandIn {
    from { opacity: 0; max-height: 0; }
    to { opacity: 1; max-height: 200px; }
  }
  .detail-field {
    line-height: 1.4;
    word-break: break-word;
  }
  .detail-field strong {
    color: var(--text-secondary, #555);
    margin-right: 4px;
  }

  @media (prefers-color-scheme: dark) {
    .badge-classification { background: #1b4332; color: #95d5b2; }
    .badge-autoResponse { background: #1a3a5c; color: #90caf9; }
    .badge-error { background: #4a1c1c; color: #ef9a9a; }
    .filters input, .filters select { background: var(--bg-secondary, #2b2a33); color: var(--text-color, #fbfbfe); }
    .clickable-row:hover, .expanded-row { background: #2b2a33; }
    .detail-content { background: #2b2a33; }
  }

  .pagination-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .count {
    font-size: 12px;
    color: var(--text-secondary, #666);
    margin: 0;
  }
  .pagination {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .page-btn {
    padding: 4px 10px;
    font-size: 12px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    background: var(--bg-secondary, #f0f0f4);
    cursor: pointer;
    font-family: inherit;
    color: var(--text-color, #15141a);
  }
  .page-btn:hover:not(:disabled) {
    background: var(--bg-hover, #e0e0e6);
  }
  .page-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .page-info {
    font-size: 12px;
    color: var(--text-secondary, #666);
  }
</style>
