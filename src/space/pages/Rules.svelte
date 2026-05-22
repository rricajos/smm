<script lang="ts">
  import type { Rule, Condition } from '../../types/rules';
  import type { ResponseTemplate } from '../../types/templates';
  import { rules } from '../../lib/stores/rules';
  import { templates } from '../../lib/stores/templates';
  import { settings } from '../../lib/stores/settings';
  import { exportConfiguration, validateImportData, detectConflicts, type ImportValidationResult, type ImportOptions } from '../../lib/utils/config-io';
  import { detectRuleConflicts, type RuleConflict } from '../../lib/utils/rule-conflicts';
  import Button from '../../lib/components/Button.svelte';
  import Modal from '../../lib/components/Modal.svelte';
  import ConfirmDialog from '../../lib/components/ConfirmDialog.svelte';
  import ImportModal from '../components/ImportModal.svelte';
  import RuleEditor from '../components/RuleEditor.svelte';
  import PresetGallery from '../components/PresetGallery.svelte';
  import { t } from '../../lib/i18n';
  import type { Translations } from '../../lib/i18n/types';

  declare const browser: any;

  interface Props {
    onrequestai?: (prompt: string) => void;
  }

  let { onrequestai }: Props = $props();

  let currentRules = $state<Rule[]>([]);
  let currentTemplates = $state<ResponseTemplate[]>([]);
  let currentSettings = $state<any>({});
  let showEditor = $state(false);
  let showImportModal = $state(false);
  let importValidation = $state<ImportValidationResult | null>(null);
  let importError = $state('');
  let editingRule = $state<Rule | null>(null);
  let folders = $state<any[]>([]);
  let tags = $state<any[]>([]);

  // Test rule state
  let testingRuleId = $state<string | null>(null);
  let testResult = $state<{ processed: number; matched: number; details: Array<{ subject: string; from: string }> } | null>(null);
  let showTestModal = $state(false);
  let testRuleName = $state('');

  // Broken references
  let brokenRefs = $state<Record<string, string[]>>({});

  // Preset gallery
  let showPresetGallery = $state(false);

  // Confirm delete state
  let confirmDelete = $state<{ show: boolean; id: string; name: string }>({ show: false, id: '', name: '' });

  // Filter
  let filterQuery = $state('');

  let filteredRules = $derived(
    filterQuery.trim()
      ? currentRules.filter(r => {
          const q = filterQuery.toLowerCase().trim();
          return r.name.toLowerCase().includes(q) ||
            r.conditions.some(c => (c.value || '').toLowerCase().includes(q)) ||
            r.actions.some(a => a.type.toLowerCase().includes(q));
        })
      : currentRules,
  );

  // Rule conflict detection
  let ruleConflicts = $derived(detectRuleConflicts(currentRules));

  // Drag & drop state
  let dragIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);

  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);
  t.subscribe((fn) => (T = fn));
  rules.subscribe((v) => (currentRules = v));
  templates.subscribe((v) => (currentTemplates = v));
  settings.subscribe((v) => (currentSettings = v));

  // Load folders and tags from background
  async function loadMetadata() {
    try {
      folders = await browser.runtime.sendMessage({ type: 'GET_FOLDERS' });
    } catch { folders = []; }
    try {
      tags = await browser.runtime.sendMessage({ type: 'GET_TAGS' });
    } catch { tags = []; }
  }

  loadMetadata();

  // Check for broken references whenever rules or metadata change
  $effect(() => {
    const refs: Record<string, string[]> = {};
    const folderIds = new Set(folders.map((f: any) => f.id));
    const tagKeys = new Set(tags.map((t: any) => t.key));
    const templateIds = new Set(currentTemplates.map(t => t.id));

    for (const rule of currentRules) {
      const problems: string[] = [];
      for (const action of rule.actions) {
        if (action.type === 'moveToFolder' && action.folderId && folderIds.size > 0 && !folderIds.has(action.folderId)) {
          problems.push(T('rules_broken_folder', { id: action.folderId }));
        }
        if (action.type === 'addTag' && action.tagKey && tagKeys.size > 0 && !tagKeys.has(action.tagKey)) {
          problems.push(T('rules_broken_tag', { key: action.tagKey }));
        }
        if (action.type === 'autoRespond' && action.templateId && templateIds.size > 0 && !templateIds.has(action.templateId)) {
          problems.push(T('rules_broken_template'));
        }
      }
      if (problems.length > 0) refs[rule.id] = problems;
    }
    brokenRefs = refs;
  });

  function openNewRule() {
    editingRule = null;
    showEditor = true;
  }

  function openEditRule(rule: Rule) {
    editingRule = rule;
    showEditor = true;
  }

  function handleSave(rule: Rule) {
    if (editingRule) {
      rules.updateRule(rule.id, rule);
    } else {
      rules.addRule(rule);
    }
    showEditor = false;
    editingRule = null;
  }

  function handleDelete(id: string, name: string) {
    confirmDelete = { show: true, id, name };
  }

  function confirmDeleteRule() {
    rules.deleteRule(confirmDelete.id);
    confirmDelete = { show: false, id: '', name: '' };
  }

  function duplicateRule(rule: Rule) {
    const dup: Rule = {
      ...JSON.parse(JSON.stringify(rule)),
      id: crypto.randomUUID(),
      name: `${rule.name} ${T('rules_copy_suffix')}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    rules.addRule(dup);
  }

  async function testRule(rule: Rule) {
    testingRuleId = rule.id;
    testRuleName = rule.name;
    testResult = null;
    showTestModal = true;

    try {
      const result = await browser.runtime.sendMessage({
        type: 'TEST_SINGLE_RULE',
        rule: JSON.parse(JSON.stringify(rule)),
        limit: 50,
      });
      testResult = result;
    } catch (err: any) {
      testResult = { processed: 0, matched: 0, details: [] };
    } finally {
      testingRuleId = null;
    }
  }

  function moveRule(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentRules.length) return;
    const ids = currentRules.map((r) => r.id);
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    rules.reorderRules(ids);
  }

  function handleDragStart(e: DragEvent, index: number) {
    dragIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragOverIndex = index;
  }

  function handleDrop(e: DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      const ids = currentRules.map(r => r.id);
      const [movedId] = ids.splice(dragIndex, 1);
      ids.splice(index, 0, movedId);
      rules.reorderRules(ids);
    }
    dragIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    dragIndex = null;
    dragOverIndex = null;
  }

  function handleRuleKeydown(e: KeyboardEvent, index: number) {
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      moveRule(index, -1);
    } else if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      moveRule(index, 1);
    }
  }

  function handleExport() {
    const data = exportConfiguration(currentRules, currentTemplates, currentSettings);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    importError = '';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const raw = JSON.parse(text);
        const result = validateImportData(raw);
        if (!result.valid) {
          importError = result.errors.join(' ');
          return;
        }
        importValidation = detectConflicts(result.data!, currentRules, currentTemplates);
        showImportModal = true;
      } catch {
        importError = T('rules_import_json_error');
      }
    };
    input.click();
  }

  async function handleImport(options: ImportOptions) {
    if (!importValidation?.data) return;
    const data = importValidation.data;

    if (options.importRules) {
      let finalRules = [...currentRules];
      // Add new rules
      for (const r of importValidation.newItems.rules) {
        finalRules.push(r);
      }
      // Handle conflicts
      for (const conflict of importValidation.conflicts.rules) {
        const resolution = options.conflictResolutions[`rule:${conflict.imported.id}`] || 'skip';
        if (resolution === 'replace') {
          finalRules = finalRules.map(r => r.id === conflict.existing.id ? conflict.imported : r);
        } else if (resolution === 'duplicate') {
          finalRules.push({ ...conflict.imported, id: crypto.randomUUID(), name: `${conflict.imported.name} ${T('rules_imported_suffix')}` });
        }
      }
      await rules.setRules(finalRules);
    }

    if (options.importTemplates) {
      let finalTemplates = [...currentTemplates];
      for (const t of importValidation.newItems.templates) {
        finalTemplates.push(t);
      }
      for (const conflict of importValidation.conflicts.templates) {
        const resolution = options.conflictResolutions[`tmpl:${conflict.imported.id}`] || 'skip';
        if (resolution === 'replace') {
          finalTemplates = finalTemplates.map(t => t.id === conflict.existing.id ? conflict.imported : t);
        } else if (resolution === 'duplicate') {
          finalTemplates.push({ ...conflict.imported, id: crypto.randomUUID(), name: `${conflict.imported.name} ${T('rules_imported_suffix')}` });
        }
      }
      await templates.setTemplates(finalTemplates);
    }

    if (options.importSettings && data.settings) {
      await settings.save(data.settings);
    }

    showImportModal = false;
    importValidation = null;
  }

  function conditionSummary(rule: Rule): string {
    const logic = rule.conditionLogic === 'all' ? T('logic_and') : T('logic_or');
    return rule.conditions
      .map((c) => {
        if (c.field === 'hasAttachments') return c.boolValue ? T('cond_has_attachments') : T('cond_no_attachments');
        return `${c.field} ${c.operator} "${c.value}"`;
      })
      .join(logic);
  }

  function actionSummary(rule: Rule): string {
    const labels: Record<string, string> = {
      moveToFolder: T('action_move'),
      addTag: T('action_tag'),
      setPriority: T('action_priority'),
      markRead: T('action_read'),
      autoRespond: T('action_autorespond'),
    };
    return rule.actions.map((a) => labels[a.type] || a.type).join(', ');
  }

  // --- Conflict resolution ---
  const conflictI18nKey: Record<string, string> = {
    contradictory_move: 'conflict_move_different',
    contradictory_priority: 'conflict_priority_different',
    redundant: 'conflict_redundant',
  };

  function conflictDesc(conflict: RuleConflict): string {
    const key = conflictI18nKey[conflict.type];
    return key ? T(key as any, conflict.params) : conflict.description;
  }

  let mergedConflicts = $state(new Set<number>());

  let hasRedundantConflicts = $derived(ruleConflicts.some(c => c.type === 'redundant'));

  function condKey(c: Condition): string {
    return `${c.field}|${c.operator}|${(c.value || '').toLowerCase()}|${c.boolValue ?? ''}`;
  }

  function mergeRedundantConflict(conflictIdx: number, conflict: RuleConflict) {
    const ruleA = currentRules.find(r => r.id === conflict.ruleA.id);
    const ruleB = currentRules.find(r => r.id === conflict.ruleB.id);
    if (!ruleA || !ruleB) return;

    // Combine conditions, avoiding exact duplicates
    const existing = new Set(ruleA.conditions.map(condKey));
    const merged: Condition[] = [...ruleA.conditions];
    for (const cond of ruleB.conditions) {
      if (!existing.has(condKey(cond))) {
        merged.push(cond);
      }
    }

    rules.updateRule(ruleA.id, {
      ...ruleA,
      conditions: merged,
      conditionLogic: merged.length > 1 ? 'any' : ruleA.conditionLogic,
      updatedAt: Date.now(),
    });
    rules.deleteRule(ruleB.id);
    mergedConflicts = new Set([...mergedConflicts, conflictIdx]);
  }

  function mergeAllRedundant() {
    const deleted = new Set<string>();
    ruleConflicts.forEach((conflict, idx) => {
      if (conflict.type !== 'redundant') return;
      if (deleted.has(conflict.ruleA.id) || deleted.has(conflict.ruleB.id)) return;
      mergeRedundantConflict(idx, conflict);
      deleted.add(conflict.ruleB.id);
    });
  }

  function resolveConflictsWithAI() {
    if (!onrequestai || ruleConflicts.length === 0) return;
    const conflictLines = ruleConflicts.map((c, i) => {
      const type = c.type === 'redundant' ? T('conflict_redundant' as any) :
                   c.type === 'contradictory_move' ? T('conflict_move_different' as any) :
                   c.type === 'contradictory_priority' ? T('conflict_priority_different' as any) :
                   c.description;
      return `${i + 1}. "${c.ruleA.name}" + "${c.ruleB.name}": ${type}`;
    }).join('\n');
    const prompt = T('conflict_ai_prompt' as any, { n: ruleConflicts.length, conflicts: conflictLines });
    onrequestai(prompt);
  }

  // Reset merged set when conflicts change (e.g. after merge the list recomputes)
  $effect(() => {
    ruleConflicts; // track
    mergedConflicts = new Set();
  });
</script>

<div class="rules-page">
  <div class="header">
    <h3>{T('rules_title')}</h3>
    <div class="header-actions">
      <Button size="sm" onclick={() => (showPresetGallery = true)}>{T('rules_gallery')}</Button>
      <Button size="sm" onclick={handleExport}>{T('common_export')}</Button>
      <Button size="sm" onclick={handleImportClick}>{T('common_import')}</Button>
      <Button variant="primary" onclick={openNewRule}>{T('rules_new_rule')}</Button>
    </div>
  </div>
  {#if importError}
    <div class="import-error">{importError}</div>
  {/if}

  {#if currentRules.length > 3}
    <input
      type="text"
      class="filter-input"
      placeholder={T('rules_filter')}
      aria-label={T('rules_filter')}
      bind:value={filterQuery}
    />
  {/if}

  {#if ruleConflicts.length > 0}
    <div class="conflicts-section">
      <div class="conflicts-header">
        <div class="conflicts-header-left">
          <span class="conflicts-badge">{ruleConflicts.length}</span>
          <span class="conflicts-title">{T('conflicts_detected', { n: ruleConflicts.length, s: ruleConflicts.length > 1 ? 's' : '' })}</span>
        </div>
      </div>

      <div class="conflict-list">
        {#each ruleConflicts as conflict, idx}
          <div class="conflict-item" class:conflict-warning={conflict.severity === 'warning'} class:conflict-info={conflict.severity === 'info'}>
            <div class="conflict-text">
              <span class="conflict-rules">
                <button class="conflict-rule-link" onclick={() => { const r = currentRules.find(r => r.id === conflict.ruleA.id); if (r) openEditRule(r); }}>{conflict.ruleA.name}</button>
                <span class="conflict-amp">&amp;</span>
                <button class="conflict-rule-link" onclick={() => { const r = currentRules.find(r => r.id === conflict.ruleB.id); if (r) openEditRule(r); }}>{conflict.ruleB.name}</button>
              </span>
              <span class="conflict-desc">{conflictDesc(conflict)}</span>
            </div>
            {#if conflict.type === 'redundant' && !mergedConflicts.has(idx)}
              <Button size="xs" variant="primary" onclick={() => mergeRedundantConflict(idx, conflict)}>{T('conflict_merge')}</Button>
            {:else if mergedConflicts.has(idx)}
              <span class="conflict-merged-badge">{T('conflict_merged')}</span>
            {/if}
          </div>
        {/each}
      </div>

      <div class="conflicts-actions">
        {#if onrequestai}
          <Button variant="primary" onclick={resolveConflictsWithAI}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 2 2 3 2 6H14c0-3 2-4 2-6a4 4 0 0 0-4-4z"/><line x1="10" y1="16" x2="14" y2="16"/><line x1="10" y1="19" x2="14" y2="19"/><line x1="11" y1="22" x2="13" y2="22"/></svg>
            {T('conflict_resolve_ai')}
          </Button>
        {/if}
        {#if hasRedundantConflicts}
          <Button variant="ghost" onclick={mergeAllRedundant}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
            {T('conflict_merge_all')}
          </Button>
        {/if}
      </div>
    </div>
  {/if}

  {#if currentRules.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </div>
      <p class="empty-title">{T('empty_rules_title')}</p>
      <p class="empty-desc">{T('empty_rules_desc')}</p>
      <div class="empty-actions">
        <Button variant="primary" onclick={openNewRule}>{T('empty_rules_cta')}</Button>
        <Button size="sm" onclick={() => (showPresetGallery = true)}>{T('rules_gallery')}</Button>
      </div>
    </div>
  {:else}
    <div class="rule-list" role="list">
      {#each filteredRules as rule, i}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          class="rule-item"
          class:disabled={!rule.enabled}
          class:has-warning={brokenRefs[rule.id]}
          class:dragging={dragIndex === i}
          class:drag-over-above={dragOverIndex === i && dragIndex !== null && dragIndex > i}
          class:drag-over-below={dragOverIndex === i && dragIndex !== null && dragIndex < i}
          draggable="true"
          ondragstart={(e) => handleDragStart(e, i)}
          ondragover={(e) => handleDragOver(e, i)}
          ondragleave={() => (dragOverIndex = null)}
          ondrop={(e) => handleDrop(e, i)}
          ondragend={handleDragEnd}
          onkeydown={(e) => handleRuleKeydown(e, i)}
          role="listitem"
          tabindex="0"
        >
          <div class="drag-handle" aria-hidden="true">&#x2630;</div>

          <div class="rule-toggle">
            <input
              type="checkbox"
              checked={rule.enabled}
              onchange={() => rules.toggleRule(rule.id)}
              title={rule.enabled ? T('rules_toggle_disable') : T('rules_toggle_enable')}
            />
          </div>

          <div class="rule-info">
            <div class="rule-name">
              {rule.name}
              {#if brokenRefs[rule.id]}
                <span class="warning-badge" title={brokenRefs[rule.id].join(', ')}>⚠</span>
              {/if}
            </div>
            <div class="rule-details">
              <span class="conditions">{conditionSummary(rule)}</span>
              <span class="arrow-right"> -&gt; </span>
              <span class="actions">{actionSummary(rule)}</span>
            </div>
            {#if brokenRefs[rule.id]}
              <div class="broken-ref-warning">
                {#each brokenRefs[rule.id] as ref}
                  <span>{ref}</span>
                {/each}
              </div>
            {/if}
          </div>

          <div class="rule-actions">
            <Button size="sm" onclick={() => testRule(rule)} disabled={testingRuleId === rule.id}>
              {testingRuleId === rule.id ? T('rules_testing') : T('rules_test')}
            </Button>
            <Button size="sm" onclick={() => duplicateRule(rule)}>{T('common_duplicate')}</Button>
            <Button size="sm" onclick={() => openEditRule(rule)}>{T('common_edit')}</Button>
            <Button size="sm" variant="danger" onclick={() => handleDelete(rule.id, rule.name)} aria-label={T('common_delete')}>x</Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Test result modal -->
  <Modal title={T('rules_test_result_title', { name: testRuleName })} show={showTestModal} onclose={() => { showTestModal = false; testResult = null; }}>
    {#if !testResult}
      <div class="test-loading">
        <div class="spinner"></div>
        <span>{T('editor_test_hint')}</span>
      </div>
    {:else}
      <div class="test-results">
        <div class="test-stats">
          <div class="test-stat">
            <span class="test-stat-value">{testResult.processed}</span>
            <span class="test-stat-label">{T('dashboard_analyzed')}</span>
          </div>
          <div class="test-stat match">
            <span class="test-stat-value">{testResult.matched}</span>
            <span class="test-stat-label">{T('dashboard_matches')}</span>
          </div>
          <div class="test-stat">
            <span class="test-stat-value">{testResult.processed - testResult.matched}</span>
            <span class="test-stat-label">{T('dashboard_no_rule')}</span>
          </div>
        </div>

        {#if testResult.details.length > 0}
          <div class="test-detail-list">
            <h4>{T('dashboard_classified_emails')}</h4>
            <table class="test-table">
              <thead>
                <tr><th>{T('common_subject')}</th><th>{T('common_from')}</th></tr>
              </thead>
              <tbody>
                {#each testResult.details as d}
                  <tr>
                    <td class="truncate">{d.subject}</td>
                    <td class="truncate">{d.from}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="no-matches">{T('editor_test_no_match')}</p>
        {/if}

        <p class="test-note">{T('rules_test_note')}</p>
      </div>
    {/if}
  </Modal>

  <RuleEditor
    show={showEditor}
    rule={editingRule}
    {folders}
    {tags}
    templates={currentTemplates}
    existingRules={currentRules}
    onsave={handleSave}
    onclose={() => { showEditor = false; editingRule = null; }}
  />

  <ImportModal
    show={showImportModal}
    validation={importValidation}
    onimport={handleImport}
    onclose={() => { showImportModal = false; importValidation = null; }}
  />

  <PresetGallery
    show={showPresetGallery}
    {folders}
    {tags}
    oninstall={(rule) => rules.addRule(rule)}
    onclose={() => (showPresetGallery = false)}
  />

  <ConfirmDialog
    show={confirmDelete.show}
    title={T('confirm_delete_rule_title')}
    message={T('confirm_delete_rule_msg', { name: confirmDelete.name })}
    onconfirm={confirmDeleteRule}
    oncancel={() => (confirmDelete = { show: false, id: '', name: '' })}
  />
</div>

<style>
  .rules-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
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
  .filter-input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    box-sizing: border-box;
    background: var(--bg-primary, white);
    color: var(--text-color, #15141a);
  }
  .filter-input:focus {
    outline: 2px solid var(--primary-color, #0060df);
    outline-offset: -1px;
  }
  .import-error {
    padding: 8px 12px;
    background: #fce4ec;
    color: #c62828;
    border-radius: 6px;
    font-size: 12px;
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
    margin: 0 0 20px 0;
    max-width: 360px;
    line-height: 1.5;
  }
  .empty-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .rule-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .rule-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 6px;
    background: var(--bg-primary, white);
  }
  .rule-item.disabled {
    opacity: 0.5;
  }
  .rule-item.has-warning {
    border-color: #ffa726;
    background: #fff8e1;
  }
  .drag-handle {
    cursor: grab;
    padding: 0 4px;
    font-size: 16px;
    color: var(--text-secondary, #999);
    user-select: none;
    flex-shrink: 0;
    line-height: 1;
  }
  .drag-handle:active {
    cursor: grabbing;
  }
  .rule-item.dragging {
    opacity: 0.4;
  }
  .rule-item.drag-over-above {
    border-top: 2px solid var(--primary-color, #0060df);
    padding-top: 8px;
  }
  .rule-item.drag-over-below {
    border-bottom: 2px solid var(--primary-color, #0060df);
    padding-bottom: 8px;
  }
  .rule-item:focus-visible {
    outline: 2px solid var(--primary-color, #0060df);
    outline-offset: -2px;
  }
  .rule-toggle input {
    cursor: pointer;
  }
  .rule-info {
    flex: 1;
    min-width: 0;
  }
  .rule-name {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .warning-badge {
    font-size: 14px;
    cursor: help;
  }
  .rule-details {
    font-size: 11px;
    color: var(--text-secondary, #666);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .broken-ref-warning {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .broken-ref-warning span {
    font-size: 10px;
    padding: 1px 6px;
    background: #fff3e0;
    border: 1px solid #ffcc80;
    border-radius: 8px;
    color: #e65100;
  }
  .arrow-right {
    margin: 0 4px;
    color: var(--text-secondary, #999);
  }
  .rule-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  /* Test modal */
  .test-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px;
    justify-content: center;
    color: var(--text-secondary, #666);
    font-size: 13px;
  }
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--border-color, #e0e0e6);
    border-top-color: var(--primary-color, #0060df);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .test-results {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .test-stats {
    display: flex;
    gap: 24px;
    justify-content: center;
  }
  .test-stat {
    text-align: center;
  }
  .test-stat-value {
    display: block;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-secondary, #666);
  }
  .test-stat.match .test-stat-value {
    color: #2e7d32;
  }
  .test-stat-label {
    font-size: 11px;
    color: var(--text-secondary, #666);
  }
  .test-detail-list h4 {
    margin: 0 0 8px 0;
    font-size: 13px;
    font-weight: 600;
  }
  .test-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .test-table th {
    text-align: left;
    padding: 5px 8px;
    border-bottom: 2px solid var(--border-color, #e0e0e6);
    font-weight: 600;
    color: var(--text-secondary, #555);
  }
  .test-table td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--border-color, #f0f0f4);
  }
  .truncate {
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .no-matches {
    font-size: 13px;
    color: var(--text-secondary, #666);
    font-style: italic;
    text-align: center;
    padding: 16px;
  }
  .test-note {
    font-size: 11px;
    color: var(--text-secondary, #999);
    font-style: italic;
    text-align: center;
    margin: 0;
  }

  /* Conflicts */
  .conflicts-section {
    border: 1px solid #ffcc80;
    border-radius: 8px;
    background: linear-gradient(135deg, #fff8e1 0%, #fff3e0 100%);
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .conflicts-header {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    background: rgba(230, 81, 0, 0.06);
    border-bottom: 1px solid rgba(255, 204, 128, 0.5);
  }
  .conflicts-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .conflicts-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 11px;
    background: #e65100;
    color: white;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }
  .conflicts-title {
    font-size: 13px;
    font-weight: 600;
    color: #bf360c;
  }
  .conflict-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
  }
  .conflict-item {
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    transition: background 0.1s;
  }
  .conflict-item:hover {
    background: rgba(0, 0, 0, 0.04);
  }
  .conflict-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .conflict-warning {
    background: rgba(255, 152, 0, 0.08);
    border-left: 3px solid #ff9800;
  }
  .conflict-info {
    background: rgba(33, 150, 243, 0.06);
    border-left: 3px solid #90caf9;
  }
  .conflict-rules {
    font-weight: 600;
    color: var(--text-color, #15141a);
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .conflict-amp {
    font-weight: 400;
    font-size: 11px;
    color: var(--text-secondary, #999);
  }
  .conflict-desc {
    color: var(--text-secondary, #666);
    font-size: 11px;
  }
  .conflict-rule-link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    color: var(--primary-color, #0060df);
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 2px;
  }
  .conflict-rule-link:hover {
    text-decoration-style: solid;
  }
  .conflict-merged-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    background: #e8f5e9;
    color: #2e7d32;
    font-weight: 500;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .conflicts-actions {
    display: flex;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(230, 81, 0, 0.04);
    border-top: 1px solid rgba(255, 204, 128, 0.5);
  }
  .conflicts-actions :global(.btn) {
    flex: 1;
  }

  @media (prefers-color-scheme: dark) {
    .conflicts-section { background: linear-gradient(135deg, #332d00 0%, #2e2800 100%); border-color: #8d6e00; }
    .conflicts-header { background: rgba(141, 110, 0, 0.15); border-bottom-color: rgba(141, 110, 0, 0.3); }
    .conflicts-badge { background: #ff8f00; color: #1c1b22; }
    .conflicts-title { color: #ffb74d; }
    .conflict-item:hover { background: rgba(255, 255, 255, 0.04); }
    .conflict-warning { background: rgba(255, 152, 0, 0.1); border-left-color: #ff9800; }
    .conflict-info { background: rgba(66, 165, 245, 0.08); border-left-color: #42a5f5; }
    .conflicts-actions { background: rgba(141, 110, 0, 0.1); border-top-color: rgba(141, 110, 0, 0.3); }
    .conflict-merged-badge { background: #1b4332; color: #95d5b2; }
    .rule-item.has-warning { border-color: #8d6e00; background: #332d00; }
    .broken-ref-warning span { background: #332d00; border-color: #8d6e00; color: #ffb74d; }
    .test-stat.match .test-stat-value { color: #66bb6a; }
    .import-error { background: #4a1c1c; color: #ef9a9a; }
    .filter-input { background: var(--bg-secondary, #2b2a33); color: var(--text-color, #fbfbfe); }
  }
</style>
