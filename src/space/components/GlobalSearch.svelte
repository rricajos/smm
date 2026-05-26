<script lang="ts">
  /* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */
  import type { Rule } from '../../types/rules';
  import type { ResponseTemplate } from '../../types/templates';
  import { t } from '../../lib/i18n';

  interface SearchResult {
    type: 'rule' | 'template' | 'log';
    id: string;
    title: string;
    subtitle: string;
    tabId: string;
  }

  interface Props {
    rules: Rule[];
    templates: ResponseTemplate[];
    activity: any[];
    onnavigate: (tabId: string, searchQuery: string) => void;
  }

  let { rules, templates, activity, onnavigate }: Props = $props();


  let query = $state('');
  let showResults = $state(false);
  let selectedIndex = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state(undefined);

  let results = $derived<SearchResult[]>(computeResults());

  function computeResults(): SearchResult[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const items: SearchResult[] = [];
    const MAX = 5;

    let count = 0;
    for (const rule of rules) {
      if (count >= MAX) break;
      if (rule.name.toLowerCase().includes(q) ||
          rule.conditions.some(c => (c.value || '').toLowerCase().includes(q))) {
        items.push({
          type: 'rule', id: rule.id,
          title: rule.name,
          subtitle: rule.enabled ? $t('common_active') : $t('common_inactive'),
          tabId: 'rules',
        });
        count++;
      }
    }

    count = 0;
    for (const tmpl of templates) {
      if (count >= MAX) break;
      if (tmpl.name.toLowerCase().includes(q) ||
          tmpl.subject.toLowerCase().includes(q)) {
        items.push({
          type: 'template', id: tmpl.id,
          title: tmpl.name,
          subtitle: tmpl.subject,
          tabId: 'templates',
        });
        count++;
      }
    }

    count = 0;
    for (const entry of activity) {
      if (count >= MAX) break;
      if ((entry.subject || '').toLowerCase().includes(q) ||
          (entry.from || '').toLowerCase().includes(q) ||
          (entry.ruleName || '').toLowerCase().includes(q)) {
        items.push({
          type: 'log', id: String(entry.timestamp),
          title: entry.subject || $t('editor_no_subject'),
          subtitle: `${entry.ruleName} - ${entry.from}`,
          tabId: 'log',
        });
        count++;
      }
    }

    return items;
  }

  function handleSelect(result: SearchResult) {
    onnavigate(result.tabId, query);
    query = '';
    showResults = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
    } else if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      showResults = false;
      inputEl?.blur();
    }
  }

  $effect(() => {
    void query;
    selectedIndex = -1;
  });

  export function focus() {
    inputEl?.focus();
  }
</script>

<div class="global-search">
  <input
    type="text"
    class="search-input"
    placeholder={$t('search_placeholder')}
    bind:value={query}
    bind:this={inputEl}
    onfocus={() => (showResults = true)}
    onblur={() => setTimeout(() => (showResults = false), 200)}
    onkeydown={handleKeydown}
    aria-label={$t('search_aria')}
    role="combobox"
    aria-expanded={showResults && results.length > 0}
    aria-controls="global-search-listbox"
  />

  {#if showResults && results.length > 0}
    <div class="search-results" role="listbox" id="global-search-listbox">
      {#each results as result, i}
        <button
          class="search-result"
          class:selected={i === selectedIndex}
          onmousedown={() => handleSelect(result)}
          role="option"
          aria-selected={i === selectedIndex}
        >
          <span class="result-type-badge result-type-{result.type}">
            {result.type === 'rule' ? $t('search_rule') : result.type === 'template' ? $t('search_template') : $t('search_log')}
          </span>
          <div class="result-text">
            <span class="result-title">{result.title}</span>
            <span class="result-subtitle">{result.subtitle}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .global-search {
    position: relative;
    flex: 1;
    max-width: 260px;
  }
  .search-input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    background: var(--bg-secondary, #f0f0f4);
    color: var(--text-color, #15141a);
    box-sizing: border-box;
  }
  .search-input::placeholder {
    color: var(--text-secondary, #999);
  }
  .search-input:focus {
    outline: 2px solid var(--primary-color, #0060df);
    outline-offset: -1px;
  }
  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--bg-primary, white);
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    z-index: 100;
    max-height: 360px;
    overflow-y: auto;
  }
  .search-result {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    width: 100%;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: var(--text-color, #15141a);
  }
  .search-result:hover,
  .search-result.selected {
    background: var(--bg-hover, #e0e0e6);
  }
  .result-type-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    font-weight: 500;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .result-type-rule { background: #d4edda; color: #155724; }
  .result-type-template { background: #cce5ff; color: #004085; }
  .result-type-log { background: #fff3cd; color: #856404; }
  .result-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .result-title {
    font-size: 12px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .result-subtitle {
    font-size: 11px;
    color: var(--text-secondary, #666);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (prefers-color-scheme: dark) {
    .search-results { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4); }
    .result-type-rule { background: #1b4332; color: #95d5b2; }
    .result-type-template { background: #1a3a5c; color: #90caf9; }
    .result-type-log { background: #332d00; color: #ffb74d; }
  }
</style>
