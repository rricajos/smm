<script lang="ts">
  /* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */
  import { t } from '../../lib/i18n';
  import type { RuleSuggestion } from '../../lib/services/openai';
  import Button from '../../lib/components/Button.svelte';

  interface Props {
    loading: boolean;
    batchLoading: boolean;
    batchProgress: { current: number; total: number; processed: number } | null;
    accountList: Array<{ id: string; name: string; email: string }>;
    suggestions: RuleSuggestion[];
    onanalyze: () => void;
    onanalyzeall: (accountId: string, limit: number, skipAnalyzed: boolean) => void;
    ongeneratefromdescription: (description: string) => void;
    onaccept: (suggestion: RuleSuggestion) => void;
    onedit: (suggestion: RuleSuggestion) => void;
    ondiscard: (suggestion: RuleSuggestion) => void;
    onbatchcancel: () => void;
  }

  let {
    loading, batchLoading, batchProgress, accountList, suggestions,
    onanalyze, onanalyzeall, ongeneratefromdescription,
    onaccept, onedit, ondiscard, onbatchcancel,
  }: Props = $props();

  let description = $state('');
  let selectedAccountId = $state('');
  let batchLimit = $state(500);
  let skipAnalyzed = $state(true);

  $effect(() => {
    if (accountList.length > 0 && !selectedAccountId) {
      selectedAccountId = accountList[0].id;
    }
  });

  function handleGenerate() {
    if (!description.trim()) return;
    ongeneratefromdescription(description.trim());
  }

  function handleAnalyzeAll() {
    onanalyzeall(selectedAccountId, batchLimit, skipAnalyzed);
  }

  function confidenceLabel(c: number): string {
    return c >= 0.8 ? $t('ai_confidence_high') : c >= 0.5 ? $t('ai_confidence_medium') : $t('ai_confidence_low');
  }

  function confidenceClass(c: number): string {
    return c >= 0.8 ? 'high' : c >= 0.5 ? 'medium' : 'low';
  }
</script>

<section class="section">
  <h4>{$t('ai_quick_analyze_title')}</h4>
  <p class="description">{$t('ai_quick_analyze_desc')}</p>
  <Button variant="primary" onclick={onanalyze} disabled={loading}>
    {loading ? $t('ai_quick_analyzing') : $t('ai_quick_analyze_btn')}
  </Button>
</section>

<section class="section batch-section">
  <h4>{$t('ai_batch_title')}</h4>
  <p class="description">{$t('ai_batch_desc')}</p>
  <div class="batch-options">
    {#if accountList.length > 0}
      <div class="batch-account-selector">
        <label for="batch-account-select">{$t('ai_batch_account')}</label>
        <select id="batch-account-select" bind:value={selectedAccountId} disabled={batchLoading}>
          {#each accountList as acc}
            <option value={acc.id}>{acc.name || acc.email}</option>
          {/each}
        </select>
      </div>
    {/if}
    <div class="batch-limit-selector">
      <label for="batch-limit-input">{$t('ai_batch_limit')}</label>
      <input id="batch-limit-input" type="number" min="10" max="10000" step="50" bind:value={batchLimit} disabled={batchLoading} />
      <span class="batch-limit-hint">{$t('ai_batch_limit_hint')}</span>
    </div>
    <label class="batch-checkbox">
      <input type="checkbox" bind:checked={skipAnalyzed} disabled={batchLoading} />
      <span>{$t('ai_batch_skip_analyzed')}</span>
      <span class="batch-limit-hint">{$t('ai_batch_skip_analyzed_hint')}</span>
    </label>
  </div>
  {#if batchProgress}
    <div class="batch-progress">
      <div class="batch-progress-bar" role="progressbar" aria-valuenow={batchProgress.current} aria-valuemin={0} aria-valuemax={batchProgress.total}>
        <div class="batch-progress-fill" style="width: {Math.round((batchProgress.current / batchProgress.total) * 100)}%"></div>
      </div>
      <span class="batch-progress-text">{$t('ai_batch_progress', { current: batchProgress.current, total: batchProgress.total, processed: batchProgress.processed })}</span>
    </div>
  {/if}
  <div class="batch-actions">
    <Button variant="primary" onclick={handleAnalyzeAll} disabled={loading || batchLoading}>
      {batchLoading ? (batchProgress ? $t('ai_batch_progress', { current: batchProgress.current, total: batchProgress.total, processed: batchProgress.processed }) : $t('ai_batch_fetching')) : $t('ai_batch_btn')}
    </Button>
    {#if batchLoading}
      <Button variant="danger" onclick={onbatchcancel}>{$t('ai_batch_cancel')}</Button>
    {/if}
  </div>
</section>

<section class="section">
  <h4>{$t('ai_quick_describe_title')}</h4>
  <p class="description">{$t('ai_quick_describe_desc')}</p>
  <div class="input-row">
    <textarea bind:value={description} placeholder={$t('ai_quick_describe_placeholder')} rows="3" disabled={loading}></textarea>
    <Button variant="primary" onclick={handleGenerate} disabled={loading || !description.trim()}>
      {loading ? $t('ai_quick_generating') : $t('ai_quick_generate_btn')}
    </Button>
  </div>
</section>

{#if loading}
  <div class="loading"><div class="spinner"></div><span>{$t('ai_quick_consulting')}</span></div>
{/if}

{#if suggestions.length > 0}
  <section class="section suggestions-section">
    <h4>{$t('ai_suggestions_title')} ({suggestions.length})</h4>
    <div class="suggestion-list">
      {#each suggestions as suggestion}
        <div class="suggestion-card">
          <div class="suggestion-header">
            <span class="suggestion-name">{suggestion.rule.name}</span>
            <span class="confidence {confidenceClass(suggestion.confidence)}">
              {$t('ai_confidence_label', { level: confidenceLabel(suggestion.confidence), pct: Math.round(suggestion.confidence * 100) })}
            </span>
          </div>
          <p class="suggestion-explanation">{suggestion.explanation}</p>
          <div class="suggestion-details">
            <span class="detail-label">{$t('ai_conditions_label')}</span>
            {#each suggestion.rule.conditions as cond}
              <span class="detail-chip">{cond.field} {cond.operator} "{cond.value || (cond.boolValue ? $t('common_yes') : $t('common_no'))}"</span>
            {/each}
          </div>
          <div class="suggestion-details">
            <span class="detail-label">{$t('ai_actions_label')}</span>
            {#each suggestion.rule.actions as act}
              <span class="detail-chip">{act.type}{act.folderId ? ` -> ${act.folderId}` : ''}{act.tagKey ? ` -> ${act.tagKey}` : ''}</span>
            {/each}
          </div>
          <div class="suggestion-actions">
            <Button variant="primary" size="sm" onclick={() => onaccept(suggestion)}>{$t('common_accept')}</Button>
            <Button size="sm" onclick={() => onedit(suggestion)}>{$t('common_edit')}</Button>
            <Button variant="danger" size="sm" onclick={() => ondiscard(suggestion)}>{$t('common_discard')}</Button>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .section { border: 1px solid var(--border-color, #e0e0e6); border-radius: 8px; padding: 16px; background: var(--bg-primary, white); }
  .section h4 { margin: 0 0 6px 0; font-size: 14px; font-weight: 600; }
  .description { margin: 0 0 12px 0; font-size: 12px; color: var(--text-secondary, #666); }
  .input-row { display: flex; flex-direction: column; gap: 8px; }
  .input-row textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border-color, #ccc); border-radius: 4px; font-size: 13px; font-family: inherit; box-sizing: border-box; resize: vertical; }
  .loading { display: flex; align-items: center; gap: 10px; padding: 16px; justify-content: center; color: var(--text-secondary, #666); font-size: 13px; }
  .spinner { width: 20px; height: 20px; border: 2px solid var(--border-color, #e0e0e6); border-top-color: var(--primary-color, #0060df); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Suggestions */
  .suggestions-section h4 { margin-bottom: 12px; }
  .suggestion-list { display: flex; flex-direction: column; gap: 10px; }
  .suggestion-card { border: 1px solid var(--border-color, #e0e0e6); border-radius: 6px; padding: 12px; background: var(--bg-secondary, #f9f9fb); }
  .suggestion-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .suggestion-name { font-weight: 600; font-size: 13px; }
  .confidence { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
  .confidence.high { background: #e8f5e9; color: #2e7d32; }
  .confidence.medium { background: #fff3e0; color: #e65100; }
  .confidence.low { background: #ffeef0; color: #c62828; }
  .suggestion-explanation { margin: 0 0 8px 0; font-size: 12px; color: var(--text-secondary, #666); }
  .suggestion-details { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-bottom: 6px; font-size: 11px; }
  .detail-label { font-weight: 500; color: var(--text-secondary, #666); }
  .detail-chip { background: var(--bg-hover, #e0e0e6); padding: 2px 8px; border-radius: 10px; font-size: 11px; }
  .suggestion-actions { display: flex; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-color, #e0e0e6); }

  /* Batch analysis */
  .batch-section { border-color: var(--primary-color, #0060df); border-style: dashed; }
  .batch-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
  .batch-account-selector { display: flex; align-items: center; gap: 6px; font-size: 12px; }
  .batch-account-selector label { white-space: nowrap; font-weight: 500; color: var(--text-secondary, #666); }
  .batch-account-selector select {
    flex: 1; padding: 4px 8px; border: 1px solid var(--border-color, #ccc); border-radius: 4px;
    font-size: 12px; font-family: inherit; background: var(--bg-secondary, #f0f0f4); color: inherit;
  }
  .batch-limit-selector { display: flex; align-items: center; gap: 6px; font-size: 12px; }
  .batch-limit-selector label { white-space: nowrap; font-weight: 500; color: var(--text-secondary, #666); }
  .batch-limit-selector input {
    width: 90px; padding: 4px 8px; border: 1px solid var(--border-color, #ccc); border-radius: 4px;
    font-size: 12px; font-family: inherit; background: var(--bg-secondary, #f0f0f4); color: inherit;
    text-align: center;
  }
  .batch-limit-hint { font-size: 11px; color: var(--text-secondary, #999); font-style: italic; }
  .batch-checkbox { display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; }
  .batch-checkbox input { margin: 0; cursor: pointer; }
  .batch-checkbox span { color: var(--text-secondary, #666); }
  .batch-progress { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
  .batch-progress-bar { width: 100%; height: 6px; background: var(--bg-hover, #e0e0e6); border-radius: 3px; overflow: hidden; }
  .batch-progress-fill { height: 100%; background: var(--primary-color, #0060df); border-radius: 3px; transition: width 0.3s ease; }
  .batch-progress-text { font-size: 11px; color: var(--text-secondary, #666); }
  .batch-actions { display: flex; gap: 8px; align-items: center; }

  @media (prefers-color-scheme: dark) {
    .confidence.high { background: #1b4332; color: #95d5b2; }
    .confidence.medium { background: #332d00; color: #ffb74d; }
    .confidence.low { background: #4a1c1c; color: #ef9a9a; }
  }
</style>
