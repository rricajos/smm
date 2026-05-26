<script lang="ts">
  import type { ImportValidationResult, ImportOptions } from '../../lib/utils/config-io';
  import Modal from '../../lib/components/Modal.svelte';
  import Button from '../../lib/components/Button.svelte';
  import { t } from '../../lib/i18n';

  interface Props {
    show: boolean;
    validation: ImportValidationResult | null;
    onimport: (options: ImportOptions) => void;
    onclose: () => void;
  }

  let { show, validation, onimport, onclose }: Props = $props();


  let importRules = $state(true);
  let importTemplates = $state(true);
  let importSettings = $state(false);
  let conflictResolutions = $state<Record<string, 'replace' | 'skip' | 'duplicate'>>({});

  // Initialize default resolutions when validation changes
  $effect(() => {
    if (validation) {
      const res: Record<string, 'replace' | 'skip' | 'duplicate'> = {};
      for (const c of validation.conflicts.rules) {
        res[`rule:${c.imported.id}`] = 'skip';
      }
      for (const c of validation.conflicts.templates) {
        res[`tmpl:${c.imported.id}`] = 'skip';
      }
      conflictResolutions = res;
    }
  });

  function handleImport() {
    onimport({
      importRules,
      importTemplates,
      importSettings,
      conflictResolutions,
    });
  }

  let totalNew = $derived(
    (validation?.newItems.rules.length || 0) + (validation?.newItems.templates.length || 0)
  );
  let totalConflicts = $derived(
    (validation?.conflicts.rules.length || 0) + (validation?.conflicts.templates.length || 0)
  );
</script>

<Modal title={$t('import_title')} {show} {onclose}>
  {#if validation}
    <div class="import-content">
      <div class="import-summary">
        <h4>{$t('import_file_summary')}</h4>
        <div class="summary-row">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={importRules} />
            <span>{validation.data?.rules.length || 0} {$t('tab_rules').toLowerCase()}</span>
          </label>
        </div>
        <div class="summary-row">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={importTemplates} />
            <span>{validation.data?.templates.length || 0} {$t('tab_templates').toLowerCase()}</span>
          </label>
        </div>
        <div class="summary-row">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={importSettings} />
            <span>{$t('import_general_settings')}</span>
          </label>
        </div>
        {#if totalNew > 0}
          <p class="new-count">{$t('import_new_items', { n: totalNew, s: totalNew !== 1 ? 's' : '' })}</p>
        {/if}
      </div>

      {#if totalConflicts > 0}
        <div class="conflicts-section">
          <h4>{$t('import_conflicts_title', { n: totalConflicts })}</h4>
          <p class="conflict-desc">{$t('import_conflicts_desc')}</p>

          {#if validation.conflicts.rules.length > 0 && importRules}
            {#each validation.conflicts.rules as conflict}
              <div class="conflict-item">
                <span class="conflict-name">{$t('import_conflict_rule', { name: conflict.imported.name })}</span>
                <select bind:value={conflictResolutions[`rule:${conflict.imported.id}`]}>
                  <option value="skip">{$t('import_skip')}</option>
                  <option value="replace">{$t('import_replace')}</option>
                  <option value="duplicate">{$t('import_duplicate')}</option>
                </select>
              </div>
            {/each}
          {/if}

          {#if validation.conflicts.templates.length > 0 && importTemplates}
            {#each validation.conflicts.templates as conflict}
              <div class="conflict-item">
                <span class="conflict-name">{$t('import_conflict_template', { name: conflict.imported.name })}</span>
                <select bind:value={conflictResolutions[`tmpl:${conflict.imported.id}`]}>
                  <option value="skip">{$t('import_skip')}</option>
                  <option value="replace">{$t('import_replace')}</option>
                  <option value="duplicate">{$t('import_duplicate')}</option>
                </select>
              </div>
            {/each}
          {/if}
        </div>
      {/if}

      <div class="import-actions">
        <Button variant="primary" onclick={handleImport}>{$t('import_btn')}</Button>
        <Button onclick={onclose}>{$t('common_cancel')}</Button>
      </div>
    </div>
  {/if}
</Modal>

<style>
  .import-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .import-summary h4,
  .conflicts-section h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
  }
  .summary-row {
    margin-bottom: 6px;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
  }
  .new-count {
    font-size: 12px;
    color: #2e7d32;
    margin: 8px 0 0 0;
    font-weight: 500;
  }
  .conflict-desc {
    font-size: 12px;
    color: var(--text-secondary, #666);
    margin: 0 0 8px 0;
  }
  .conflict-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border-color, #e0e0e6);
    font-size: 13px;
  }
  .conflict-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .conflict-item select {
    padding: 3px 6px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    background: var(--bg-secondary, #f0f0f4);
    color: inherit;
  }
  .import-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid var(--border-color, #e0e0e6);
  }

  @media (prefers-color-scheme: dark) {
    .new-count { color: #66bb6a; }
    .conflict-item select { background: #1c1b22; border-color: #4a4a5a; }
  }
</style>
