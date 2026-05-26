<script lang="ts">
  /* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */
  import { rules } from '../../lib/stores/rules';
  import { activity } from '../../lib/stores/activity';
  import { settings } from '../../lib/stores/settings';
  import { t } from '../../lib/i18n';
  import type { Translations } from '../../lib/i18n/types';
  import Button from '../../lib/components/Button.svelte';
  import Modal from '../../lib/components/Modal.svelte';
  import ConfirmDialog from '../../lib/components/ConfirmDialog.svelte';

  declare const browser: any;


  let activeRules = $derived($rules.filter((r) => r.enabled).length);
  let todayStart = $derived(new Date().setHours(0, 0, 0, 0));
  let todayClassifications = $derived(
    $activity.filter((a) => a.type === 'classification' && a.timestamp >= todayStart).length,
  );
  let todayAutoResponses = $derived(
    $activity.filter((a) => a.type === 'autoResponse' && a.timestamp >= todayStart).length,
  );
  let recentActivity = $derived($activity.slice(0, 20));

  // 7-day activity chart
  let weeklyData = $derived(() => {
    const days: { label: string; classifications: number; responses: number }[] = [];
    const dayKeys: Array<keyof Translations> = ['day_abbr_sun', 'day_abbr_mon', 'day_abbr_tue', 'day_abbr_wed', 'day_abbr_thu', 'day_abbr_fri', 'day_abbr_sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d).setHours(0, 0, 0, 0);
      const end = new Date(d).setHours(23, 59, 59, 999);
      days.push({
        label: $t(dayKeys[d.getDay()]),
        classifications: $activity.filter(a => a.type === 'classification' && a.timestamp >= start && a.timestamp <= end).length,
        responses: $activity.filter(a => a.type === 'autoResponse' && a.timestamp >= start && a.timestamp <= end).length,
      });
    }
    return days;
  });
  let weeklyMax = $derived(Math.max(1, ...weeklyData().map(d => d.classifications + d.responses)));

  // Stats time range
  let statsRange = $state<'7d' | '30d' | 'all'>('30d');
  let statsStart = $derived(
    statsRange === '7d' ? Date.now() - 7 * 86400000
    : statsRange === '30d' ? Date.now() - 30 * 86400000
    : 0
  );
  let filteredForStats = $derived(
    $activity.filter(a => a.type === 'classification' && a.timestamp >= statsStart)
  );

  // Per-rule stats
  let ruleStats = $derived(() => {
    const stats = new Map<string, { name: string; count: number }>();
    for (const entry of filteredForStats) {
      if (entry.ruleId) {
        const existing = stats.get(entry.ruleId);
        if (existing) {
          existing.count++;
        } else {
          stats.set(entry.ruleId, { name: entry.ruleName, count: 1 });
        }
      }
    }
    return [...stats.entries()]
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  // Top senders from activity
  let topSenders = $derived(() => {
    const senders = new Map<string, number>();
    for (const entry of filteredForStats) {
      if (entry.from) {
        senders.set(entry.from, (senders.get(entry.from) || 0) + 1);
      }
    }
    return [...senders.entries()]
      .map(([from, count]) => ({ from, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  // Process existing state
  let processing = $state(false);
  let processResult = $state<{
    processed: number;
    matched: number;
    errors: number;
    details: Array<{ subject: string; from: string; rules: string[] }>;
  } | null>(null);

  function toggleClassification() {
    settings.update({ classificationEnabled: !$settings.classificationEnabled });
  }

  function toggleAutoResponse() {
    settings.update({ autoResponseEnabled: !$settings.autoResponseEnabled });
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  async function processExisting() {
    processing = true;
    processResult = null;
    try {
      const result = await browser.runtime.sendMessage({
        type: 'PROCESS_EXISTING',
        limit: 100,
      });
      processResult = result;
    } catch (err: any) {
      processResult = { processed: 0, matched: 0, errors: 1, details: [] };
    } finally {
      processing = false;
    }
  }

  // Folder management
  let allFolders = $state<any[]>([]);
  let showFolders = $state(false);
  let folderError = $state('');
  let folderSuccess = $state('');
  let renamingId = $state<string | null>(null);
  let renameValue = $state('');
  let confirmDeleteFolder = $state<{ show: boolean; folder: any }>({ show: false, folder: null });

  async function loadFolders() {
    try {
      allFolders = await browser.runtime.sendMessage({ type: 'GET_FOLDERS' });
    } catch { allFolders = []; }
  }

  function toggleFolders() {
    showFolders = !showFolders;
    if (showFolders) loadFolders();
  }

  function startRename(folder: any) {
    renamingId = folder.id;
    renameValue = folder.name;
    folderError = '';
  }

  function cancelRename() {
    renamingId = null;
    renameValue = '';
  }

  async function confirmRename() {
    if (!renamingId || !renameValue.trim()) return;
    folderError = '';
    try {
      const result = await browser.runtime.sendMessage({
        type: 'RENAME_FOLDER', folderId: renamingId, newName: renameValue.trim(),
      });
      if (result.success) {
        folderSuccess = $t('dashboard_folder_renamed', { name: renameValue.trim() });
        setTimeout(() => (folderSuccess = ''), 3000);
        renamingId = null;
        renameValue = '';
        await loadFolders();
      } else {
        folderError = result.error || $t('dashboard_rename_error');
      }
    } catch (err: any) {
      folderError = err.message || $t('dashboard_rename_error');
    }
  }

  function deleteFolder(folder: any) {
    confirmDeleteFolder = { show: true, folder };
  }

  async function confirmDeleteFolderAction() {
    const folder = confirmDeleteFolder.folder;
    confirmDeleteFolder = { show: false, folder: null };
    if (!folder) return;
    folderError = '';
    try {
      const result = await browser.runtime.sendMessage({
        type: 'DELETE_FOLDER', folderId: folder.id,
      });
      if (result.success) {
        folderSuccess = $t('dashboard_folder_deleted', { name: folder.name });
        setTimeout(() => (folderSuccess = ''), 3000);
        await loadFolders();
      } else {
        folderError = result.error || $t('dashboard_delete_error');
      }
    } catch (err: any) {
      folderError = err.message || $t('dashboard_delete_error');
    }
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') confirmRename();
    else if (e.key === 'Escape') cancelRename();
  }
</script>

<div class="dashboard">
  <div class="cards">
    <div class="card card-rules">
      <div class="card-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </div>
      <div class="card-data">
        <div class="card-value">{$rules.length}</div>
        <div class="card-label">{$t('dashboard_total_rules')}</div>
      </div>
    </div>
    <div class="card card-active">
      <div class="card-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
      <div class="card-data">
        <div class="card-value">{activeRules}</div>
        <div class="card-label">{$t('dashboard_active_rules')}</div>
      </div>
    </div>
    <div class="card card-classified">
      <div class="card-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
      </div>
      <div class="card-data">
        <div class="card-value">{todayClassifications}</div>
        <div class="card-label">{$t('dashboard_classified_today')}</div>
      </div>
    </div>
    <div class="card card-responses">
      <div class="card-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div class="card-data">
        <div class="card-value">{todayAutoResponses}</div>
        <div class="card-label">{$t('dashboard_responses_today')}</div>
      </div>
    </div>
  </div>

  <div class="toggles">
    <Button
      variant={$settings.classificationEnabled ? 'primary' : 'secondary'}
      onclick={toggleClassification}
    >
      {$t('dashboard_classification')}: {$settings.classificationEnabled ? $t('common_on') : $t('common_off')}
    </Button>
    <Button
      variant={$settings.autoResponseEnabled ? 'primary' : 'secondary'}
      onclick={toggleAutoResponse}
    >
      {$t('dashboard_auto_response')}: {$settings.autoResponseEnabled ? $t('common_on') : $t('common_off')}
    </Button>
  </div>

  <!-- Weekly mini-chart -->
  {#if $activity.length > 0}
    <div class="weekly-chart">
      <h3>{$t('dashboard_weekly_activity')}</h3>
      <div class="chart-bars">
        {#each weeklyData() as day}
          <div class="chart-col">
            <div class="chart-bar-wrapper">
              {#if day.responses > 0}
                <div class="chart-bar bar-response" style="height: {Math.max(3, Math.round((day.responses / weeklyMax) * 100))}%" title="{day.responses} responses"></div>
              {/if}
              {#if day.classifications > 0}
                <div class="chart-bar bar-classification" style="height: {Math.max(3, Math.round((day.classifications / weeklyMax) * 100))}%" title="{day.classifications} classifications"></div>
              {/if}
              {#if day.classifications === 0 && day.responses === 0}
                <div class="chart-bar bar-empty"></div>
              {/if}
            </div>
            <span class="chart-label">{day.label}</span>
          </div>
        {/each}
      </div>
      <div class="chart-legend">
        <span class="legend-item"><span class="legend-dot dot-classification"></span> {$t('dashboard_classification')}</span>
        <span class="legend-item"><span class="legend-dot dot-response"></span> {$t('dashboard_auto_response')}</span>
      </div>
    </div>
  {/if}

  <!-- Rule ranking stats -->
  {#if ruleStats().length > 0}
    <div class="stats-section">
      <div class="stats-header">
        <h3>{$t('dashboard_rule_ranking')}</h3>
        <select class="stats-range" bind:value={statsRange}>
          <option value="7d">{$t('dashboard_7days')}</option>
          <option value="30d">{$t('dashboard_30days')}</option>
          <option value="all">{$t('dashboard_all')}</option>
        </select>
      </div>
      <div class="stats-list">
        {#each ruleStats() as stat, i}
          <div class="stat-row">
            <span class="stat-rank">#{i + 1}</span>
            <span class="stat-name" title={stat.name}>{stat.name}</span>
            <div class="stat-bar-container">
              <div
                class="stat-bar"
                style="width: {Math.round((stat.count / ruleStats()[0].count) * 100)}%"
              ></div>
            </div>
            <span class="stat-count">{stat.count}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Top senders -->
  {#if topSenders().length > 0}
    <div class="stats-section">
      <div class="stats-header">
        <h3>{$t('dashboard_top_senders')}</h3>
      </div>
      <div class="stats-list">
        {#each topSenders() as sender, i}
          <div class="stat-row">
            <span class="stat-rank">#{i + 1}</span>
            <span class="stat-name" title={sender.from}>{sender.from}</span>
            <div class="stat-bar-container">
              <div
                class="stat-bar stat-bar-sender"
                style="width: {Math.round((sender.count / topSenders()[0].count) * 100)}%"
              ></div>
            </div>
            <span class="stat-count">{sender.count}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Process existing emails -->
  <div class="process-section">
    <div class="process-header">
      <div>
        <h3>{$t('dashboard_process_existing')}</h3>
        <p class="process-desc">{$t('dashboard_process_existing_desc')}</p>
      </div>
      <Button variant="primary" onclick={processExisting} disabled={processing || activeRules === 0}>
        {processing ? $t('dashboard_processing') : $t('dashboard_run_rules')}
      </Button>
    </div>

    {#if processing}
      <div class="process-loading">
        <div class="spinner"></div>
        <span>{$t('dashboard_analyzing')}</span>
      </div>
    {/if}

    {#if processResult}
      <div class="process-result" class:has-matches={processResult.matched > 0}>
        <div class="result-stats">
          <div class="stat">
            <span class="stat-value">{processResult.processed}</span>
            <span class="stat-label">{$t('dashboard_analyzed')}</span>
          </div>
          <div class="stat match">
            <span class="stat-value">{processResult.matched}</span>
            <span class="stat-label">{$t('dashboard_matches')}</span>
          </div>
          <div class="stat">
            <span class="stat-value">{processResult.processed - processResult.matched}</span>
            <span class="stat-label">{$t('dashboard_no_rule')}</span>
          </div>
          {#if processResult.errors > 0}
            <div class="stat error">
              <span class="stat-value">{processResult.errors}</span>
              <span class="stat-label">{$t('dashboard_errors')}</span>
            </div>
          {/if}
        </div>

        {#if processResult.details && processResult.details.length > 0}
          <div class="result-details">
            <h4>{$t('dashboard_classified_emails')}</h4>
            <table class="result-table">
              <thead>
                <tr>
                  <th>{$t('common_subject')}</th>
                  <th>{$t('common_from')}</th>
                  <th>{$t('dashboard_rules_applied')}</th>
                </tr>
              </thead>
              <tbody>
                {#each processResult.details as d}
                  <tr>
                    <td class="truncate" title={d.subject}>{d.subject}</td>
                    <td class="truncate" title={d.from}>{d.from}</td>
                    <td>
                      {#each d.rules as r}
                        <span class="rule-badge">{r}</span>
                      {/each}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if processResult.matched === 0}
          <p class="no-matches">{$t('dashboard_no_matches_desc')}</p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Folder management -->
  <div class="folder-section">
    <div class="folder-header">
      <h3>{$t('dashboard_manage_folders')}</h3>
      <Button size="sm" onclick={toggleFolders}>{showFolders ? $t('common_hide') : $t('common_show')}</Button>
    </div>

    {#if showFolders}
      {#if folderError}<div class="folder-msg error">{folderError}</div>{/if}
      {#if folderSuccess}<div class="folder-msg success">{folderSuccess}</div>{/if}

      {#if allFolders.length === 0}
        <p class="empty">{$t('dashboard_loading_folders')}</p>
      {:else}
        <div class="folder-list">
          {#each allFolders as folder}
            <div class="folder-item">
              {#if renamingId === folder.id}
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  class="rename-input"
                  bind:value={renameValue}
                  onkeydown={handleRenameKeydown}
                  autofocus
                />
                <Button size="sm" variant="primary" onclick={confirmRename}>OK</Button>
                <Button size="sm" onclick={cancelRename}>X</Button>
              {:else}
                <span class="folder-path" title={folder.path || folder.name}>
                  {folder.path || folder.name}
                </span>
                <div class="folder-actions">
                  <Button size="xs" onclick={() => startRename(folder)} title={$t('common_edit')}>&#9998;</Button>
                  <Button size="xs" variant="danger" onclick={() => deleteFolder(folder)} title={$t('common_delete')}>&#10005;</Button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <div class="recent">
    <h3>{$t('dashboard_recent_activity')}</h3>
    {#if recentActivity.length === 0}
      <p class="empty">{$t('dashboard_no_recent_activity')}</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>{$t('dashboard_date')}</th>
            <th>{$t('dashboard_type')}</th>
            <th>{$t('dashboard_rule')}</th>
            <th>{$t('common_subject')}</th>
            <th>{$t('common_from')}</th>
          </tr>
        </thead>
        <tbody>
          {#each recentActivity as entry}
            <tr class="type-{entry.type}">
              <td>{formatTime(entry.timestamp)}</td>
              <td>
                <span class="badge badge-{entry.type}">
                  {entry.type === 'classification' ? $t('log_type_classification') : entry.type === 'autoResponse' ? $t('log_type_response') : $t('log_type_error')}
                </span>
              </td>
              <td>{entry.ruleName}</td>
              <td class="truncate" title={entry.subject}>{entry.subject}</td>
              <td class="truncate" title={entry.from}>{entry.from}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <!-- Status footer -->
  <div class="status-footer">
    <div class="status-item">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>{$t('dashboard_version')} 1.5</span>
    </div>
    <div class="status-item">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4c0 2 2 3 2 6H14c0-3 2-4 2-6a4 4 0 0 0-4-4z"/><line x1="10" y1="16" x2="14" y2="16"/><line x1="10" y1="19" x2="14" y2="19"/></svg>
      <span>{$t('dashboard_ai_status')}: {$settings.openaiApiKey ? $t('dashboard_ai_configured') : $t('dashboard_ai_not_configured')}</span>
      <span class="status-dot" class:status-ok={$settings.openaiApiKey} class:status-off={!$settings.openaiApiKey}></span>
    </div>
    <div class="status-item status-shortcuts">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      <span>{$t('dashboard_shortcuts_hint')}</span>
    </div>
  </div>

  <ConfirmDialog
    show={confirmDeleteFolder.show}
    title={$t('confirm_delete_folder_title')}
    message={$t('dashboard_confirm_delete_folder', { name: confirmDeleteFolder.folder?.name || '' })}
    onconfirm={confirmDeleteFolderAction}
    oncancel={() => (confirmDeleteFolder = { show: false, folder: null })}
  />
</div>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }
  .card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--bg-secondary, #f9f9fb);
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 10px;
    padding: 14px 16px;
    border-left: 4px solid transparent;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
  .card-rules { border-left-color: #0060df; }
  .card-active { border-left-color: #2e7d32; }
  .card-classified { border-left-color: #e65100; }
  .card-responses { border-left-color: #6a1b9a; }
  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    flex-shrink: 0;
  }
  .card-rules .card-icon { background: rgba(0, 96, 223, 0.1); color: #0060df; }
  .card-active .card-icon { background: rgba(46, 125, 50, 0.1); color: #2e7d32; }
  .card-classified .card-icon { background: rgba(230, 81, 0, 0.1); color: #e65100; }
  .card-responses .card-icon { background: rgba(106, 27, 154, 0.1); color: #6a1b9a; }
  .card-data {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .card-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-color, #15141a);
    line-height: 1.1;
  }
  .card-label {
    font-size: 11px;
    color: var(--text-secondary, #666);
    margin-top: 2px;
  }
  .toggles {
    display: flex;
    gap: 8px;
  }

  /* Weekly chart */
  .weekly-chart {
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 8px;
    padding: 16px;
    background: var(--bg-primary, white);
  }
  .weekly-chart h3 {
    margin: 0 0 12px 0;
    font-size: 15px;
  }
  .chart-bars {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 80px;
    padding-bottom: 4px;
  }
  .chart-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    height: 100%;
  }
  .chart-bar-wrapper {
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    gap: 1px;
  }
  .chart-bar {
    width: 100%;
    max-width: 32px;
    border-radius: 3px 3px 0 0;
    transition: height 0.3s ease;
  }
  .bar-classification {
    background: linear-gradient(180deg, #0060df, #0050c0);
  }
  .bar-response {
    background: linear-gradient(180deg, #6a1b9a, #5c178a);
  }
  .bar-empty {
    height: 3px;
    background: var(--border-color, #e0e0e6);
    border-radius: 3px;
  }
  .chart-label {
    font-size: 10px;
    color: var(--text-secondary, #999);
    font-weight: 600;
  }
  .chart-legend {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-secondary, #666);
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }
  .dot-classification { background: #0060df; }
  .dot-response { background: #6a1b9a; }

  /* Status footer */
  .status-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 10px 14px;
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 8px;
    background: var(--bg-secondary, #f9f9fb);
    font-size: 11px;
    color: var(--text-secondary, #666);
  }
  .status-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .status-shortcuts {
    margin-left: auto;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .status-ok { background: #2e7d32; }
  .status-off { background: #bbb; }

  /* Folder management */
  .folder-section {
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 8px;
    padding: 16px;
    background: var(--bg-primary, white);
  }
  .folder-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .folder-header h3 { margin: 0; font-size: 15px; }
  .folder-msg {
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    margin-top: 10px;
  }
  .folder-msg.error { background: #fce4ec; color: #c62828; }
  .folder-msg.success { background: #e8f5e9; color: #2e7d32; }
  .folder-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 10px;
    max-height: 300px;
    overflow-y: auto;
  }
  .folder-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 4px;
    font-size: 12px;
  }
  .folder-item:hover { background: var(--bg-secondary, #f0f0f4); }
  .folder-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .folder-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .folder-item:hover .folder-actions { opacity: 1; }
  .folder-actions :global(.btn) {
    font-size: 12px;
  }
  .rename-input {
    flex: 1;
    padding: 3px 6px;
    border: 1px solid var(--primary-color, #0060df);
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    background: var(--bg-primary, white);
    color: inherit;
  }

  /* Process existing section */
  .process-section {
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 8px;
    padding: 16px;
    background: var(--bg-primary, white);
  }
  .process-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .process-header h3 {
    margin: 0;
    font-size: 15px;
  }
  .process-desc {
    margin: 4px 0 0 0;
    font-size: 12px;
    color: var(--text-secondary, #666);
  }
  .process-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 0 0 0;
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
  .process-result {
    margin-top: 16px;
    border-top: 1px solid var(--border-color, #e0e0e6);
    padding-top: 16px;
  }
  .result-stats {
    display: flex;
    gap: 20px;
  }
  .stat {
    text-align: center;
  }
  .stat-value {
    display: block;
    font-size: 22px;
    font-weight: 700;
    color: var(--text-secondary, #666);
  }
  .stat.match .stat-value {
    color: #2e7d32;
  }
  .stat.error .stat-value {
    color: #c62828;
  }
  .stat-label {
    font-size: 11px;
    color: var(--text-secondary, #666);
  }
  .result-details {
    margin-top: 14px;
  }
  .result-details h4 {
    margin: 0 0 8px 0;
    font-size: 13px;
    font-weight: 600;
  }
  .result-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .result-table th {
    text-align: left;
    padding: 5px 8px;
    border-bottom: 2px solid var(--border-color, #e0e0e6);
    font-weight: 600;
    color: var(--text-secondary, #555);
  }
  .result-table td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--border-color, #f0f0f4);
  }
  .rule-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 8px;
    background: #d4edda;
    color: #155724;
    font-size: 11px;
    font-weight: 500;
    margin: 1px 2px;
  }
  .no-matches {
    margin: 10px 0 0 0;
    font-size: 12px;
    color: var(--text-secondary, #666);
    font-style: italic;
  }

  .recent h3 {
    margin: 0 0 10px 0;
    font-size: 15px;
  }
  .empty {
    color: var(--text-secondary, #666);
    font-size: 13px;
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
  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-color, #f0f0f4);
  }
  .truncate {
    max-width: 200px;
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
  .badge-classification {
    background: #d4edda;
    color: #155724;
  }
  .badge-autoResponse {
    background: #cce5ff;
    color: #004085;
  }
  .badge-error {
    background: #f8d7da;
    color: #721c24;
  }

  /* Stats section */
  .stats-section {
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 8px;
    padding: 16px;
    background: var(--bg-primary, white);
  }
  .stats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .stats-header h3 {
    margin: 0;
    font-size: 15px;
  }
  .stats-range {
    padding: 4px 8px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    font-size: 12px;
    font-family: inherit;
    background: var(--bg-secondary, #f0f0f4);
    color: inherit;
  }
  .stats-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .stat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .stat-rank {
    width: 24px;
    font-weight: 700;
    color: var(--text-secondary, #666);
    font-size: 12px;
    flex-shrink: 0;
  }
  .stat-name {
    width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
    flex-shrink: 0;
  }
  .stat-bar-container {
    flex: 1;
    height: 18px;
    background: var(--bg-secondary, #f0f0f4);
    border-radius: 9px;
    overflow: hidden;
  }
  .stat-bar {
    height: 100%;
    background: var(--primary-color, #0060df);
    border-radius: 9px;
    min-width: 4px;
    transition: width 0.3s ease;
  }
  .stat-count {
    width: 36px;
    text-align: right;
    font-weight: 600;
    font-size: 12px;
    color: var(--text-secondary, #666);
    flex-shrink: 0;
  }
  .stat-bar-sender {
    background: #e65100;
  }

  @media (prefers-color-scheme: dark) {
    .card:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); }
    .card-rules .card-icon { background: rgba(69, 161, 255, 0.15); color: #45a1ff; }
    .card-active .card-icon { background: rgba(102, 187, 106, 0.15); color: #66bb6a; }
    .card-classified .card-icon { background: rgba(255, 183, 77, 0.15); color: #ffb74d; }
    .card-responses .card-icon { background: rgba(186, 104, 200, 0.15); color: #ba68c8; }
    .card-rules { border-left-color: #45a1ff; }
    .card-active { border-left-color: #66bb6a; }
    .card-classified { border-left-color: #ffb74d; }
    .card-responses { border-left-color: #ba68c8; }
    .bar-classification { background: linear-gradient(180deg, #45a1ff, #3b8fe6); }
    .bar-response { background: linear-gradient(180deg, #ba68c8, #9c4dcc); }
    .dot-classification { background: #45a1ff; }
    .dot-response { background: #ba68c8; }
    .status-ok { background: #66bb6a; }
    .status-off { background: #666; }
    .badge-classification { background: #1b4332; color: #95d5b2; }
    .badge-autoResponse { background: #1a3a5c; color: #90caf9; }
    .badge-error { background: #4a1c1c; color: #ef9a9a; }
    .rule-badge { background: #1b4332; color: #95d5b2; }
    .stat.match .stat-value { color: #66bb6a; }
    .stat.error .stat-value { color: #ef5350; }
    .stat-bar-sender { background: #ffb74d; }
    .stats-range { background: #1c1b22; border-color: #4a4a5a; }
    .folder-msg.error { background: #4a1c1c; color: #ef9a9a; }
    .folder-msg.success { background: #1b3320; color: #81c784; }
    .rename-input { background: #1c1b22; border-color: #45a1ff; }
  }
</style>
