<script lang="ts">
  /* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */
  import Dashboard from './pages/Dashboard.svelte';
  import Rules from './pages/Rules.svelte';
  import Templates from './pages/Templates.svelte';
  import AI from './pages/AI.svelte';
  import Log from './pages/Log.svelte';
  import GlobalSearch from './components/GlobalSearch.svelte';
  import FolderTree from './components/FolderTree.svelte';
  import { unreadClassifications } from '../lib/stores/badges';
  import { rules } from '../lib/stores/rules';
  import { templates } from '../lib/stores/templates';
  import { activity } from '../lib/stores/activity';
  import { t } from '../lib/i18n';

  let activeTab = $state('dashboard');
  let pendingAiPrompt = $state('');
  let searchFilter = $state('');
  let showFolderTree = $state(false);
  let folderTreeRef: FolderTree | undefined = $state(undefined);
  let selectedFolder = $state<{ id: string; name: string; path: string } | null>(null);

  // Lazy-load folder tree when panel opens
  $effect(() => {
    if (showFolderTree && folderTreeRef) {
      folderTreeRef.loadTree();
    }
  });

  function handleFolderSelect(folderId: string, folderName: string, folderPath: string) {
    if (selectedFolder?.id === folderId) {
      selectedFolder = null;
    } else {
      selectedFolder = { id: folderId, name: folderName, path: folderPath };
    }
  }

  function handleSearchNavigate(tabId: string, searchQuery: string) {
    activeTab = tabId;
    searchFilter = searchQuery || '';
    // Reset after a tick so the child component picks it up
    setTimeout(() => (searchFilter = ''), 100);
  }

  function handleRequestAI(prompt: string) {
    pendingAiPrompt = prompt;
    activeTab = 'ai';
  }

  let searchComponent: GlobalSearch | undefined = $state(undefined);
  let showShortcuts = $state(false);

  $effect(() => {
    if (activeTab === 'dashboard') {
      unreadClassifications.reset();
    }
  });

  let tabs = $derived([
    { id: 'dashboard', label: $t('tab_dashboard'), icon: 'dashboard' },
    { id: 'rules', label: $t('tab_rules'), icon: 'rules' },
    { id: 'templates', label: $t('tab_templates'), icon: 'templates' },
    { id: 'ai', label: $t('tab_ai'), icon: 'ai' },
    { id: 'log', label: $t('tab_log'), icon: 'log' },
  ]);
</script>

<svelte:window onkeydown={(e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    searchComponent?.focus();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    showShortcuts = !showShortcuts;
    return;
  }
  if (e.key === 'Escape' && showShortcuts) {
    showShortcuts = false;
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    const tabKeys: Record<string, string> = { '1': 'dashboard', '2': 'rules', '3': 'templates', '4': 'ai', '5': 'log' };
    if (tabKeys[e.key]) {
      e.preventDefault();
      activeTab = tabKeys[e.key];
    }
  }
}} />

<div class="app">
  <nav class="tabs">
    <div class="tab-title">Smart Mail Manager</div>
    <GlobalSearch
      bind:this={searchComponent}
      rules={$rules}
      templates={$templates}
      activity={$activity}
      onnavigate={handleSearchNavigate}
    />
    <div class="tab-buttons" role="tablist">
      {#each tabs as tab}
        <button
          class="tab-btn"
          class:active={activeTab === tab.id}
          onclick={() => (activeTab = tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          id="tab-{tab.id}"
          aria-controls="panel-{tab.id}"
        >
          <span class="tab-icon">
            {#if tab.icon === 'dashboard'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            {:else if tab.icon === 'rules'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            {:else if tab.icon === 'templates'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {:else if tab.icon === 'ai'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 2 2 3 2 6H14c0-3 2-4 2-6a4 4 0 0 0-4-4z"/><line x1="10" y1="16" x2="14" y2="16"/><line x1="10" y1="19" x2="14" y2="19"/><line x1="11" y1="22" x2="13" y2="22"/></svg>
            {:else if tab.icon === 'log'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {/if}
          </span>
          {tab.label}
          {#if tab.id === 'dashboard' && $unreadClassifications > 0}
            <span class="badge-dot">{$unreadClassifications > 99 ? '99+' : $unreadClassifications}</span>
          {/if}
        </button>
      {/each}
    </div>
    <button
      class="folder-toggle-btn"
      class:active={showFolderTree}
      onclick={() => { showFolderTree = !showFolderTree; }}
      title={$t('ai_view_folders')}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    </button>
  </nav>

  <div class="content">
    {#if showFolderTree}
      <div class="folder-sidebar">
        <FolderTree bind:this={folderTreeRef} onfolderselect={handleFolderSelect} selectedFolderId={selectedFolder?.id} />
      </div>
    {/if}
    <div class="tab-panels">
      <div class="tab-panel" class:active-panel={activeTab === 'dashboard'} role="tabpanel" id="panel-dashboard" aria-labelledby="tab-dashboard">
        <Dashboard />
      </div>
      <div class="tab-panel" class:active-panel={activeTab === 'rules'} role="tabpanel" id="panel-rules" aria-labelledby="tab-rules">
        <Rules onrequestai={handleRequestAI} />
      </div>
      <div class="tab-panel" class:active-panel={activeTab === 'templates'} role="tabpanel" id="panel-templates" aria-labelledby="tab-templates">
        <Templates onrequestai={handleRequestAI} />
      </div>
      <div class="tab-panel" class:active-panel={activeTab === 'ai'} role="tabpanel" id="panel-ai" aria-labelledby="tab-ai">
        <AI pendingPrompt={pendingAiPrompt} onconsumeprompt={() => (pendingAiPrompt = '')} selectedFolder={selectedFolder} onclearfolder={() => (selectedFolder = null)} />
      </div>
      <div class="tab-panel" class:active-panel={activeTab === 'log'} role="tabpanel" id="panel-log" aria-labelledby="tab-log">
        <Log initialSearch={searchFilter} />
      </div>
    </div>
  </div>
</div>

{#if showShortcuts}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="shortcuts-overlay" onclick={() => (showShortcuts = false)} onkeydown={() => {}}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="shortcuts-modal" onclick={(e) => e.stopPropagation()}>
      <div class="shortcuts-header">
        <h3>{$t('shortcuts_title')}</h3>
        <button class="shortcuts-close" aria-label={$t('shortcuts_close')} onclick={() => (showShortcuts = false)}>&times;</button>
      </div>
      <div class="shortcuts-body">
        <div class="shortcut-group">
          <h4>{$t('shortcuts_global')}</h4>
          <div class="shortcut-row"><kbd>Ctrl</kbd> + <kbd>K</kbd><span>{$t('shortcuts_search')}</span></div>
          <div class="shortcut-row"><kbd>Ctrl</kbd> + <kbd>1</kbd>-<kbd>5</kbd><span>{$t('shortcuts_tabs', { n: '1-5' })}</span></div>
          <div class="shortcut-row"><kbd>Ctrl</kbd> + <kbd>/</kbd><span>{$t('shortcuts_help')}</span></div>
          <div class="shortcut-row"><kbd>Esc</kbd><span>{$t('shortcuts_close')}</span></div>
        </div>
        <div class="shortcut-group">
          <h4>{$t('shortcuts_rules')}</h4>
          <div class="shortcut-row"><kbd>Alt</kbd> + <kbd>&uarr;</kbd><span>{$t('shortcuts_move_up')}</span></div>
          <div class="shortcut-row"><kbd>Alt</kbd> + <kbd>&darr;</kbd><span>{$t('shortcuts_move_down')}</span></div>
        </div>
        <div class="shortcut-group">
          <h4>{$t('shortcuts_chat')}</h4>
          <div class="shortcut-row"><kbd>Enter</kbd><span>{$t('shortcuts_send')}</span></div>
          <div class="shortcut-row"><kbd>Shift</kbd> + <kbd>Enter</kbd><span>{$t('shortcuts_newline')}</span></div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: var(--text-color, #15141a);
    background: var(--bg-primary, #ffffff);
    --primary-color: #0060df;
    --primary-hover: #003eaa;
    --bg-primary: #ffffff;
    --bg-secondary: #f9f9fb;
    --bg-hover: #e0e0e6;
    --border-color: #e0e0e6;
    --text-color: #15141a;
    --text-secondary: #5b5b66;
  }

  @media (prefers-color-scheme: dark) {
    :global(body) {
      --primary-color: #45a1ff;
      --primary-hover: #73b6ff;
      --bg-primary: #1c1b22;
      --bg-secondary: #2b2a33;
      --bg-hover: #3a3944;
      --border-color: #4a4a5a;
      --text-color: #fbfbfe;
      --text-secondary: #b1b1bd;
    }
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .tabs {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 20px;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
    flex-shrink: 0;
  }
  .tab-title {
    font-weight: 700;
    font-size: 15px;
    padding: 12px 0;
    color: var(--primary-color);
    white-space: nowrap;
  }
  .tab-buttons {
    display: flex;
    gap: 0;
  }
  .tab-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 12px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-secondary);
    transition: color 0.15s, border-color 0.15s;
  }
  .tab-icon {
    display: inline-flex;
    align-items: center;
    opacity: 0.7;
  }
  .tab-btn.active .tab-icon {
    opacity: 1;
  }
  .badge-dot {
    position: absolute;
    top: 6px;
    right: 2px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: #e22850;
    color: white;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
  .tab-btn:hover {
    color: var(--text-color);
  }
  .tab-btn.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
    font-weight: 600;
  }
  .content {
    flex: 1;
    display: flex;
    flex-direction: row;
    overflow: hidden;
    min-height: 0;
  }
  .folder-sidebar {
    width: 260px;
    min-width: 200px;
    max-width: 320px;
    border-right: 1px solid var(--border-color, #e0e0e6);
    overflow-y: auto;
    flex-shrink: 0;
    animation: slideIn 0.15s ease-out;
  }
  @keyframes slideIn {
    from { opacity: 0; width: 0; }
    to { opacity: 1; width: 260px; }
  }
  .tab-panels {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .tab-panel {
    display: none;
    flex: 1;
    min-height: 0;
  }
  .tab-panel.active-panel {
    display: flex;
    flex-direction: column;
  }
  .folder-toggle-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 8px;
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 4px;
    background: var(--bg-primary, white);
    cursor: pointer;
    color: var(--text-secondary, #666);
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .folder-toggle-btn:hover {
    background: var(--bg-hover, #e0e0e6);
    color: var(--text-color, #15141a);
  }
  .folder-toggle-btn.active {
    background: var(--primary-color, #0060df);
    border-color: var(--primary-color, #0060df);
    color: white;
  }

  /* Shortcuts help modal */
  .shortcuts-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.1s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .shortcuts-modal {
    background: var(--bg-primary, white);
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 10px;
    width: 420px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  }
  .shortcuts-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border-color, #e0e0e6);
  }
  .shortcuts-header h3 {
    margin: 0;
    font-size: 15px;
  }
  .shortcuts-close {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: var(--text-secondary, #666);
    padding: 0 4px;
    line-height: 1;
  }
  .shortcuts-close:hover {
    color: var(--text-color, #15141a);
  }
  .shortcuts-body {
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .shortcut-group h4 {
    margin: 0 0 8px 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary, #666);
  }
  .shortcut-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 0;
    font-size: 13px;
  }
  .shortcut-row span {
    margin-left: auto;
    color: var(--text-secondary, #666);
    font-size: 12px;
  }
  kbd {
    display: inline-block;
    padding: 2px 6px;
    font-size: 11px;
    font-family: inherit;
    background: var(--bg-secondary, #f0f0f4);
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    box-shadow: 0 1px 0 var(--border-color, #ccc);
    min-width: 20px;
    text-align: center;
  }
</style>
