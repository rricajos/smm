<script lang="ts">
  import { settings } from '../lib/stores/settings';
  import { activity } from '../lib/stores/activity';
  import { t } from '../lib/i18n';
  import type { Translations } from '../lib/i18n/types';
  import Button from '../lib/components/Button.svelte';

  declare const browser: any;

  let currentSettings = $state<any>({});
  let currentActivity = $state<any[]>([]);
  let classifyStatus = $state('');

  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);
  t.subscribe((fn) => (T = fn));
  settings.subscribe((v) => (currentSettings = v));
  activity.subscribe((v) => (currentActivity = v));

  let recentActivity = $derived(currentActivity.slice(0, 5));

  function toggleClassification() {
    settings.update({ classificationEnabled: !currentSettings.classificationEnabled });
  }

  function toggleAutoResponse() {
    settings.update({ autoResponseEnabled: !currentSettings.autoResponseEnabled });
  }

  async function classifyCurrentMessage() {
    classifyStatus = T('popup_classifying');
    try {
      const msg = await browser.runtime.sendMessage({ type: 'GET_DISPLAYED_MESSAGE' });
      if (!msg) {
        classifyStatus = T('popup_no_message');
        return;
      }
      await browser.runtime.sendMessage({ type: 'CLASSIFY_MESSAGE', messageId: msg.id });
      classifyStatus = T('popup_classified_ok');
    } catch (err) {
      classifyStatus = T('popup_classify_error');
    }
    setTimeout(() => (classifyStatus = ''), 3000);
  }

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
</script>

<div class="popup">
  <h2>Smart Mail Manager</h2>

  <div class="toggles">
    <button class="toggle" class:on={currentSettings.classificationEnabled} onclick={toggleClassification}>
      <span class="dot"></span>
      {T('popup_classification')}
    </button>
    <button class="toggle" class:on={currentSettings.autoResponseEnabled} onclick={toggleAutoResponse}>
      <span class="dot"></span>
      {T('popup_auto_response')}
    </button>
  </div>

  <Button variant="primary" onclick={classifyCurrentMessage}>
    {T('popup_classify_current')}
  </Button>

  {#if classifyStatus}
    <div class="status">{classifyStatus}</div>
  {/if}

  <div class="recent">
    <h4>{T('popup_recent_activity')}</h4>
    {#if recentActivity.length === 0}
      <p class="empty">{T('popup_no_activity')}</p>
    {:else}
      {#each recentActivity as entry}
        <div class="entry">
          <span class="time">{formatTime(entry.timestamp)}</span>
          <span class="text">{entry.subject}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    color: #15141a;
    background: #ffffff;
    --primary-color: #0060df;
    --bg-secondary: #f9f9fb;
    --border-color: #e0e0e6;
    --text-secondary: #5b5b66;
  }

  @media (prefers-color-scheme: dark) {
    :global(body) {
      color: #fbfbfe;
      background: #1c1b22;
      --primary-color: #45a1ff;
      --bg-secondary: #2b2a33;
      --border-color: #4a4a5a;
      --text-secondary: #b1b1bd;
    }
    .toggle { background: var(--bg-secondary); border-color: var(--border-color); color: #fbfbfe; }
    .toggle.on { background: #1a3a5c; border-color: var(--primary-color); }
    .dot { background: #666; }
    .entry { border-bottom-color: var(--border-color); }
  }
  .popup {
    width: 300px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 15px;
    color: var(--primary-color);
  }
  .toggles {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid #e0e0e6;
    border-radius: 6px;
    background: #f9f9fb;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
  }
  .toggle.on {
    background: #e7f0fd;
    border-color: var(--primary-color);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ccc;
  }
  .toggle.on .dot {
    background: #2ac3a2;
  }
  .status {
    font-size: 12px;
    color: var(--primary-color);
    text-align: center;
  }
  .recent h4 {
    margin: 0 0 6px 0;
    font-size: 12px;
    color: #5b5b66;
  }
  .empty {
    font-size: 12px;
    color: #999;
    margin: 0;
  }
  .entry {
    display: flex;
    gap: 8px;
    font-size: 11px;
    padding: 3px 0;
    border-bottom: 1px solid #f0f0f4;
  }
  .time {
    color: #999;
    flex-shrink: 0;
  }
  .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
