<script lang="ts">
  import type { Rule } from '../../types/rules';
  import { RULE_PRESETS, PRESET_CATEGORIES, type RulePreset, type PresetCategory } from '../../lib/utils/rule-presets';
  import { t } from '../../lib/i18n';
  import type { Translations } from '../../lib/i18n/types';
  import Modal from '../../lib/components/Modal.svelte';
  import Button from '../../lib/components/Button.svelte';

  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);
  t.subscribe((fn) => (T = fn));

  let {
    folders = [],
    tags = [],
    show = false,
    oninstall,
    onclose,
  }: {
    folders: any[];
    tags: any[];
    show: boolean;
    oninstall: (rule: Rule) => void;
    onclose: () => void;
  } = $props();

  let selectedCategory = $state<PresetCategory | 'all'>('all');
  let selectedPreset = $state<RulePreset | null>(null);
  let configFolderId = $state('');
  let configTagKey = $state('');
  let installError = $state('');

  let filteredPresets = $derived(
    selectedCategory === 'all'
      ? RULE_PRESETS
      : RULE_PRESETS.filter((p) => p.category === selectedCategory),
  );

  function selectPreset(preset: RulePreset) {
    selectedPreset = preset;
    configFolderId = '';
    configTagKey = '';
    installError = '';
  }

  function goBack() {
    selectedPreset = null;
    installError = '';
  }

  function installPreset() {
    if (!selectedPreset) return;

    if (selectedPreset.requiresFolderSelection && !configFolderId) {
      installError = T('preset_error_folder');
      return;
    }
    if (selectedPreset.requiresTagSelection && !configTagKey) {
      installError = T('preset_error_tag');
      return;
    }

    const actions = selectedPreset.actions.map((a) => {
      if (a.type === 'moveToFolder' && selectedPreset!.requiresFolderSelection) {
        return { ...a, folderId: configFolderId };
      }
      if (a.type === 'addTag' && selectedPreset!.requiresTagSelection) {
        return { ...a, tagKey: configTagKey };
      }
      return { ...a };
    });

    const rule: Rule = {
      id: crypto.randomUUID(),
      name: selectedPreset.name,
      enabled: true,
      conditions: JSON.parse(JSON.stringify(selectedPreset.conditions)),
      conditionLogic: selectedPreset.conditionLogic,
      actions,
      stopProcessing: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    oninstall(rule);
    selectedPreset = null;
    installError = '';
    onclose();
  }

  function handleClose() {
    selectedPreset = null;
    installError = '';
    onclose();
  }
</script>

<Modal title={selectedPreset ? selectedPreset.name : T('preset_gallery_title')} {show} onclose={handleClose}>
  {#if !selectedPreset}
    <div class="preset-gallery">
      <div class="category-tabs">
        <button class="cat-tab" class:active={selectedCategory === 'all'} onclick={() => (selectedCategory = 'all')}>
          {T('preset_all')}
        </button>
        {#each PRESET_CATEGORIES as cat}
          <button class="cat-tab" class:active={selectedCategory === cat.key} onclick={() => (selectedCategory = cat.key)}>
            {cat.label}
          </button>
        {/each}
      </div>

      <div class="preset-grid">
        {#each filteredPresets as preset}
          <button class="preset-card" onclick={() => selectPreset(preset)}>
            <span class="preset-icon">{preset.icon}</span>
            <span class="preset-name">{preset.name}</span>
            <span class="preset-desc">{preset.description}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <div class="preset-config">
      <p class="preset-config-desc">{selectedPreset.description}</p>

      <div class="preset-conditions">
        <h4>{T('preset_conditions')}</h4>
        {#each selectedPreset.conditions as cond}
          <div class="cond-preview">
            <span class="cond-field">{cond.field}</span>
            <span class="cond-op">{cond.operator}</span>
            <code class="cond-value">{cond.value}</code>
          </div>
        {/each}
        <span class="cond-logic">{selectedPreset.conditionLogic === 'all' ? T('preset_logic_all') : T('preset_logic_any')}</span>
      </div>

      <div class="preset-actions-preview">
        <h4>{T('preset_actions')}</h4>
        <ul>
          {#each selectedPreset.actions as action}
            <li>
              {#if action.type === 'moveToFolder'}{T('preset_move_to_folder')}{/if}
              {#if action.type === 'addTag'}{T('preset_add_tag')}{/if}
              {#if action.type === 'setPriority'}{T('preset_set_priority', { value: action.priority || '' })}{/if}
              {#if action.type === 'markRead'}{T('preset_mark_read')}{/if}
              {#if action.type === 'autoRespond'}{T('preset_auto_respond')}{/if}
            </li>
          {/each}
        </ul>
      </div>

      {#if selectedPreset.requiresFolderSelection}
        <div class="config-field">
          <label for="preset-folder">{T('preset_select_folder')}</label>
          <select id="preset-folder" bind:value={configFolderId}>
            <option value="">{T('preset_select_folder_option')}</option>
            {#each folders as f}
              <option value={f.id}>{f.path || f.name}</option>
            {/each}
          </select>
        </div>
      {/if}

      {#if selectedPreset.requiresTagSelection}
        <div class="config-field">
          <label for="preset-tag">{T('preset_select_tag')}</label>
          <select id="preset-tag" bind:value={configTagKey}>
            <option value="">{T('preset_select_tag_option')}</option>
            {#each tags as t}
              <option value={t.key}>{t.tag}</option>
            {/each}
          </select>
        </div>
      {/if}

      {#if installError}
        <div class="install-error">{installError}</div>
      {/if}

      <div class="config-buttons">
        <Button size="sm" onclick={goBack}>&larr; {T('common_back')}</Button>
        <Button variant="primary" onclick={installPreset}>{T('preset_install')}</Button>
      </div>
    </div>
  {/if}
</Modal>

<style>
  .preset-gallery {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .category-tabs {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .cat-tab {
    padding: 4px 10px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 12px;
    background: var(--bg-secondary, #f0f0f4);
    color: var(--text-color, #15141a);
    font-size: 11px;
    cursor: pointer;
    font-family: inherit;
  }
  .cat-tab.active {
    background: var(--primary-color, #0060df);
    color: white;
    border-color: var(--primary-color, #0060df);
  }
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
  }
  .preset-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 12px;
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 8px;
    background: var(--bg-primary, white);
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    font-family: inherit;
    text-align: center;
    color: var(--text-color, #15141a);
  }
  .preset-card:hover {
    border-color: var(--primary-color, #0060df);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
  .preset-icon {
    font-size: 28px;
    line-height: 1;
  }
  .preset-name {
    font-weight: 600;
    font-size: 13px;
  }
  .preset-desc {
    font-size: 11px;
    color: var(--text-secondary, #666);
    line-height: 1.3;
  }

  /* Config view */
  .preset-config {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .preset-config-desc {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary, #666);
  }
  .preset-conditions, .preset-actions-preview {
    font-size: 12px;
  }
  .preset-conditions h4, .preset-actions-preview h4 {
    margin: 0 0 6px 0;
    font-size: 12px;
    font-weight: 600;
  }
  .cond-preview {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .cond-field {
    font-weight: 600;
    color: var(--primary-color, #0060df);
  }
  .cond-op {
    color: var(--text-secondary, #666);
  }
  .cond-value {
    font-size: 11px;
    background: var(--bg-secondary, #f0f0f4);
    padding: 1px 6px;
    border-radius: 3px;
    word-break: break-all;
  }
  .cond-logic {
    font-size: 11px;
    color: var(--text-secondary, #999);
    font-style: italic;
  }
  .preset-actions-preview ul {
    margin: 0;
    padding-left: 20px;
  }
  .preset-actions-preview li {
    margin-bottom: 2px;
  }
  .config-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .config-field label {
    font-size: 12px;
    font-weight: 600;
  }
  .config-field select {
    padding: 6px 8px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    background: var(--bg-primary, white);
    color: var(--text-color, #15141a);
  }
  .install-error {
    padding: 6px 10px;
    background: #fce4ec;
    color: #c62828;
    border-radius: 4px;
    font-size: 12px;
  }
  .config-buttons {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
  }

  @media (prefers-color-scheme: dark) {
    .cat-tab { background: var(--bg-secondary, #2b2a33); border-color: var(--border-color, #52525e); }
    .cat-tab.active { background: var(--primary-color, #0060df); border-color: var(--primary-color, #0060df); }
    .preset-card { background: var(--bg-secondary, #2b2a33); }
    .preset-card:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25); }
    .cond-value { background: var(--bg-secondary, #2b2a33); }
    .config-field select { background: var(--bg-secondary, #2b2a33); color: var(--text-color, #fbfbfe); }
    .install-error { background: #4a1c1c; color: #ef9a9a; }
  }
</style>
