<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { Translations } from '../../lib/i18n/types';

  interface Props {
    onaction: (text: string) => void;
  }

  let { onaction }: Props = $props();

  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);
  t.subscribe((fn) => (T = fn));
</script>

<div class="chat-welcome">
  <div class="welcome-icon">&#9993;</div>
  <h4>{T('chat_welcome_title')}</h4>
  <p>{T('chat_welcome_desc')}</p>
  <div class="quick-actions">
    <button class="quick-action" onclick={() => onaction(T('chat_welcome_prompt_analyze'))}>
      <span class="qa-icon">&#128269;</span>
      <span class="qa-text">
        <strong>{T('chat_welcome_action_analyze')}</strong>
        <small>{T('chat_welcome_action_analyze_desc')}</small>
      </span>
    </button>
    <button class="quick-action" onclick={() => onaction(T('chat_welcome_prompt_folders'))}>
      <span class="qa-icon">&#128193;</span>
      <span class="qa-text">
        <strong>{T('chat_welcome_action_folders')}</strong>
        <small>{T('chat_welcome_action_folders_desc')}</small>
      </span>
    </button>
    <button class="quick-action" onclick={() => onaction(T('chat_welcome_prompt_audit'))}>
      <span class="qa-icon">&#9881;</span>
      <span class="qa-text">
        <strong>{T('chat_welcome_action_audit')}</strong>
        <small>{T('chat_welcome_action_audit_desc')}</small>
      </span>
    </button>
  </div>
</div>

<style>
  .chat-welcome {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 32px 20px;
  }
  .welcome-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }
  h4 {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
  }
  p {
    margin: 0 0 24px 0;
    font-size: 13px;
    color: var(--text-secondary, #666);
    max-width: 500px;
    line-height: 1.5;
  }
  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 460px;
  }
  .quick-action {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 8px;
    background: var(--bg-primary, white);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, box-shadow 0.15s;
    font-family: inherit;
  }
  .quick-action:hover {
    border-color: var(--primary-color, #0060df);
    box-shadow: 0 1px 4px rgba(0, 96, 223, 0.1);
  }
  .qa-icon {
    font-size: 24px;
    flex-shrink: 0;
  }
  .qa-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .qa-text strong {
    font-size: 13px;
    color: var(--text-color, #15141a);
  }
  .qa-text small {
    font-size: 11px;
    color: var(--text-secondary, #666);
  }
</style>
