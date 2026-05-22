<script lang="ts">
  import Dashboard from './pages/Dashboard.svelte';
  import Rules from './pages/Rules.svelte';
  import Templates from './pages/Templates.svelte';
  import AI from './pages/AI.svelte';
  import Log from './pages/Log.svelte';
  import GlobalSearch from './components/GlobalSearch.svelte';
  import { unreadClassifications } from '../lib/stores/badges';
  import { rules } from '../lib/stores/rules';
  import { templates } from '../lib/stores/templates';
  import { activity } from '../lib/stores/activity';
  import { t } from '../lib/i18n';
  import type { Translations } from '../lib/i18n/types';

  let activeTab = $state('dashboard');
  let pendingAiPrompt = $state('');
  let unreadCount = $state(0);
  let currentRules = $state<any[]>([]);
  let currentTemplates = $state<any[]>([]);
  let currentActivity = $state<any[]>([]);
  let searchFilter = $state('');
  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);

  t.subscribe((fn) => (T = fn));
  unreadClassifications.subscribe(v => (unreadCount = v));
  rules.subscribe(v => (currentRules = v));
  templates.subscribe(v => (currentTemplates = v));
  activity.subscribe(v => (currentActivity = v));

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

  $effect(() => {
    if (activeTab === 'dashboard') {
      unreadClassifications.reset();
    }
  });

  let tabs = $derived([
    { id: 'dashboard', label: T('tab_dashboard'), icon: 'dashboard' },
    { id: 'rules', label: T('tab_rules'), icon: 'rules' },
    { id: 'templates', label: T('tab_templates'), icon: 'templates' },
    { id: 'ai', label: T('tab_ai'), icon: 'ai' },
    { id: 'log', label: T('tab_log'), icon: 'log' },
  ]);
</script>

<svelte:window onkeydown={(e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    searchComponent?.focus();
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
      rules={currentRules}
      templates={currentTemplates}
      activity={currentActivity}
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
          {#if tab.id === 'dashboard' && unreadCount > 0}
            <span class="badge-dot">{unreadCount > 99 ? '99+' : unreadCount}</span>
          {/if}
        </button>
      {/each}
    </div>
  </nav>

  <div class="content">
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
      <AI pendingPrompt={pendingAiPrompt} onconsumeprompt={() => (pendingAiPrompt = '')} />
    </div>
    <div class="tab-panel" class:active-panel={activeTab === 'log'} role="tabpanel" id="panel-log" aria-labelledby="tab-log">
      <Log initialSearch={searchFilter} />
    </div>
  </div>
</div>

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
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
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
</style>
