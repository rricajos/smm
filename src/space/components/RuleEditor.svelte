<script lang="ts">
  import type { Rule, Condition, Action } from '../../types/rules';
  import type { ResponseTemplate } from '../../types/templates';
  import { detectRuleConflicts } from '../../lib/utils/rule-conflicts';
  import { t } from '../../lib/i18n';
  import type { Translations } from '../../lib/i18n/types';
  import { onDestroy } from 'svelte';
  import Modal from '../../lib/components/Modal.svelte';
  import Button from '../../lib/components/Button.svelte';
  import ConditionRow from './ConditionRow.svelte';
  import ActionRow from './ActionRow.svelte';

  declare const browser: any;

  interface Props {
    show: boolean;
    rule: Rule | null;
    folders: any[];
    tags: any[];
    templates: ResponseTemplate[];
    existingRules?: Rule[];
    onsave: (rule: Rule) => void;
    onclose: () => void;
  }

  let { show, rule, folders, tags, templates, existingRules = [], onsave, onclose }: Props = $props();

  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);
  const unsubT = t.subscribe((fn) => (T = fn));
  onDestroy(() => unsubT());

  let name = $state('');
  let conditions = $state<Condition[]>([]);
  let conditionLogic = $state<'all' | 'any'>('all');
  let actions = $state<Action[]>([]);
  let stopProcessing = $state(false);

  // Test/preview state
  let testing = $state(false);
  let testResult = $state<{ processed: number; matched: number; details: Array<{ subject: string; from: string }> } | null>(null);
  let showTestResults = $state(false);

  // Reset test results when conditions change
  $effect(() => {
    // Read conditions and conditionLogic to trigger reactivity
    void conditions.length;
    void conditionLogic;
    showTestResults = false;
    testResult = null;
  });

  // Conflict warnings for current rule against others
  let editorConflicts = $derived(() => {
    if (existingRules.length === 0 || conditions.length === 0 || actions.length === 0) return [];
    const tempRule: Rule = {
      id: rule?.id || '__temp__',
      name: name || 'Temp',
      enabled: true,
      conditions,
      conditionLogic,
      actions,
      stopProcessing,
      createdAt: 0,
      updatedAt: 0,
    };
    const others = existingRules.filter((r) => r.id !== tempRule.id && r.enabled);
    const allRules = [tempRule, ...others];
    return detectRuleConflicts(allRules).filter(
      (c) => c.ruleA.id === tempRule.id || c.ruleB.id === tempRule.id,
    );
  });

  async function testCurrentRule() {
    if (conditions.length === 0) return;
    testing = true;
    testResult = null;
    showTestResults = true;

    try {
      const tempRule: Rule = {
        id: rule?.id || crypto.randomUUID(),
        name: name || 'Test',
        enabled: true,
        conditions,
        conditionLogic,
        actions,
        stopProcessing,
        createdAt: 0,
        updatedAt: 0,
      };
      const result = await browser.runtime.sendMessage({
        type: 'TEST_SINGLE_RULE',
        rule: JSON.parse(JSON.stringify(tempRule)),
        limit: 50,
      });
      testResult = result;
    } catch {
      testResult = { processed: 0, matched: 0, details: [] };
    } finally {
      testing = false;
    }
  }

  $effect(() => {
    if (rule) {
      name = rule.name;
      conditions = [...rule.conditions];
      conditionLogic = rule.conditionLogic;
      actions = [...rule.actions];
      stopProcessing = rule.stopProcessing;
    } else {
      name = '';
      conditions = [{ field: 'from', operator: 'contains', value: '', caseSensitive: false }];
      conditionLogic = 'all';
      actions = [{ type: 'moveToFolder', folderId: '' }];
      stopProcessing = false;
    }
  });

  function addCondition() {
    conditions = [...conditions, { field: 'from', operator: 'contains', value: '', caseSensitive: false }];
  }

  function updateCondition(index: number, updated: Condition) {
    conditions = conditions.map((c, i) => (i === index ? updated : c));
  }

  function removeCondition(index: number) {
    conditions = conditions.filter((_, i) => i !== index);
  }

  function addAction() {
    actions = [...actions, { type: 'markRead' }];
  }

  function updateAction(index: number, updated: Action) {
    actions = actions.map((a, i) => (i === index ? updated : a));
  }

  function removeAction(index: number) {
    actions = actions.filter((_, i) => i !== index);
  }

  let validationErrors = $state<string[]>([]);

  function validateRule(): string[] {
    const errs: string[] = [];

    if (!name.trim()) errs.push(T('editor_name_required'));
    if (conditions.length === 0) errs.push(T('editor_min_condition'));
    if (actions.length === 0) errs.push(T('editor_min_action'));

    // Validate conditions
    for (let i = 0; i < conditions.length; i++) {
      const c = conditions[i];
      if (c.field !== 'hasAttachments') {
        if (!c.value.trim()) {
          errs.push(T('editor_condition_empty', { n: i + 1 }));
        }
        if (c.operator === 'matches') {
          try {
            new RegExp(c.value);
          } catch {
            errs.push(T('editor_regex_invalid', { n: i + 1, value: c.value }));
          }
        }
      }
    }

    // Validate actions
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      if (a.type === 'moveToFolder' && !a.folderId) {
        errs.push(T('editor_action_select_folder', { n: i + 1 }));
      }
      if (a.type === 'addTag' && !a.tagKey) {
        errs.push(T('editor_action_select_tag', { n: i + 1 }));
      }
      if (a.type === 'autoRespond' && !a.templateId) {
        errs.push(T('editor_action_select_template', { n: i + 1 }));
      }
    }

    return errs;
  }

  function handleSave() {
    validationErrors = validateRule();
    if (validationErrors.length > 0) return;

    const now = Date.now();
    const saved: Rule = {
      id: rule?.id || crypto.randomUUID(),
      name: name.trim(),
      enabled: rule?.enabled ?? true,
      conditions,
      conditionLogic,
      actions,
      stopProcessing,
      createdAt: rule?.createdAt || now,
      updatedAt: now,
    };
    onsave(saved);
  }
</script>

<Modal title={rule ? T('editor_edit_rule') : T('editor_new_rule')} {show} {onclose}>
  <div class="form">
    <div class="field">
      <label for="rule-name">{T('editor_rule_name')}</label>
      <input id="rule-name" type="text" bind:value={name} placeholder={T('editor_rule_name_placeholder')} />
    </div>

    <div class="section">
      <div class="section-header">
        <h3>{T('editor_conditions')}</h3>
        <div class="logic-toggle">
          <label>
            <input type="radio" bind:group={conditionLogic} value="all" /> {T('editor_all_and')}
          </label>
          <label>
            <input type="radio" bind:group={conditionLogic} value="any" /> {T('editor_any_or')}
          </label>
        </div>
      </div>

      {#each conditions as condition, i}
        <ConditionRow
          {condition}
          onchange={(c) => updateCondition(i, c)}
          onremove={() => removeCondition(i)}
        />
      {/each}
      <Button size="sm" onclick={addCondition}>{T('editor_add_condition')}</Button>
    </div>

    <div class="section">
      <h3>{T('editor_actions')}</h3>
      {#each actions as action, i}
        <ActionRow
          {action}
          {folders}
          {tags}
          {templates}
          onchange={(a) => updateAction(i, a)}
          onremove={() => removeAction(i)}
        />
      {/each}
      <Button size="sm" onclick={addAction}>{T('editor_add_action')}</Button>
    </div>

    <div class="field">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={stopProcessing} />
        {T('editor_stop_processing')}
      </label>
    </div>

    <!-- Test/preview section -->
    <div class="test-section">
      <div class="test-header">
        <Button size="sm" onclick={testCurrentRule} disabled={testing || conditions.length === 0}>
          {testing ? T('editor_testing') : T('editor_test_rule')}
        </Button>
        <span class="test-hint">{T('editor_test_hint')}</span>
      </div>

      {#if showTestResults}
        {#if testing}
          <div class="test-loading">
            <div class="spinner"></div>
            <span>{T('editor_test_analyzing')}</span>
          </div>
        {:else if testResult}
          <div class="test-results-inline">
            <div class="test-stats-row">
              <span class="test-stat-item">{T('editor_test_analyzed', { n: testResult.processed })}</span>
              <span class="test-stat-item match">{T('editor_test_matches', { n: testResult.matched })}</span>
            </div>
            {#if testResult.details.length > 0}
              <div class="test-match-list">
                {#each testResult.details.slice(0, 10) as d}
                  <div class="test-match-item">
                    <span class="test-match-subject">{d.subject || T('editor_no_subject')}</span>
                    <span class="test-match-from">{d.from}</span>
                  </div>
                {/each}
                {#if testResult.details.length > 10}
                  <div class="test-match-more">{T('editor_test_more', { n: testResult.details.length - 10 })}</div>
                {/if}
              </div>
            {:else}
              <p class="test-no-match">{T('editor_test_no_match')}</p>
            {/if}
          </div>
        {/if}
      {/if}
    </div>

    <!-- Conflict warnings -->
    {#if editorConflicts().length > 0}
      <div class="editor-conflicts">
        <span class="editor-conflicts-icon">⚠</span>
        <div class="editor-conflicts-list">
          {#each editorConflicts() as conflict}
            <span class="editor-conflict-text">
              Conflicto con "{conflict.ruleA.id === (rule?.id || '__temp__') ? conflict.ruleB.name : conflict.ruleA.name}": {conflict.description}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    {#if validationErrors.length > 0}
      <div class="validation-errors">
        {#each validationErrors as err}
          <p class="validation-error">{err}</p>
        {/each}
      </div>
    {/if}

    <div class="form-actions">
      <Button variant="secondary" onclick={onclose}>{T('common_cancel')}</Button>
      <Button variant="primary" onclick={handleSave}>
        {T('common_save')}
      </Button>
    </div>
  </div>
</Modal>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .field label {
    display: block;
    margin-bottom: 4px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary, #555);
  }
  .field input[type="text"] {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    box-sizing: border-box;
  }
  .section {
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 6px;
    padding: 12px;
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .section h3 {
    margin: 0 0 10px 0;
    font-size: 14px;
    font-weight: 600;
  }
  .section-header h3 {
    margin-bottom: 0;
  }
  .logic-toggle {
    display: flex;
    gap: 12px;
    font-size: 12px;
  }
  .logic-toggle label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }
  .checkbox-label {
    display: flex !important;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 13px;
  }
  .validation-errors {
    background: #ffeef0;
    border: 1px solid #ffa4a2;
    border-radius: 6px;
    padding: 8px 12px;
  }
  .validation-error {
    margin: 2px 0;
    font-size: 12px;
    color: #c62828;
  }
  /* Test/preview */
  .test-section {
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 6px;
    padding: 10px 12px;
  }
  .test-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .test-hint {
    font-size: 11px;
    color: var(--text-secondary, #999);
    font-style: italic;
  }
  .test-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-secondary, #666);
  }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border-color, #e0e0e6);
    border-top-color: var(--primary-color, #0060df);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .test-results-inline {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .test-stats-row {
    display: flex;
    gap: 16px;
    font-size: 12px;
    font-weight: 600;
  }
  .test-stat-item.match {
    color: #2e7d32;
  }
  .test-match-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-height: 180px;
    overflow-y: auto;
  }
  .test-match-item {
    display: flex;
    gap: 8px;
    font-size: 11px;
    padding: 3px 6px;
    background: var(--bg-secondary, #f0f0f4);
    border-radius: 3px;
  }
  .test-match-subject {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .test-match-from {
    flex-shrink: 0;
    color: var(--text-secondary, #666);
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .test-match-more {
    font-size: 11px;
    color: var(--text-secondary, #999);
    font-style: italic;
    padding: 2px 6px;
  }
  .test-no-match {
    font-size: 12px;
    color: var(--text-secondary, #999);
    font-style: italic;
    margin: 4px 0 0;
  }

  /* Editor conflict warnings */
  .editor-conflicts {
    display: flex;
    gap: 8px;
    padding: 8px 10px;
    background: #fff8e1;
    border: 1px solid #ffcc80;
    border-radius: 6px;
    font-size: 12px;
  }
  .editor-conflicts-icon {
    font-size: 16px;
    flex-shrink: 0;
  }
  .editor-conflicts-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .editor-conflict-text {
    color: #e65100;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color, #e0e0e6);
  }

  @media (prefers-color-scheme: dark) {
    .test-stat-item.match { color: #66bb6a; }
    .test-match-item { background: var(--bg-secondary, #2b2a33); }
    .editor-conflicts { background: #332d00; border-color: #8d6e00; }
    .editor-conflict-text { color: #ffb74d; }
  }
</style>
