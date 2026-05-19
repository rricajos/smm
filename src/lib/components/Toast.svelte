<script lang="ts">
  interface Props {
    message: string;
    type?: 'success' | 'error' | 'info';
    show: boolean;
    actionLabel?: string;
    onaction?: () => void;
    duration?: number;
  }

  let { message, type = 'info', show, actionLabel, onaction, duration }: Props = $props();
</script>

{#if show}
  <div class="toast toast-{type}" role="alert">
    <span class="toast-message">{message}</span>
    {#if actionLabel && onaction}
      <button class="toast-action" onclick={onaction}>{actionLabel}</button>
    {/if}
    {#if duration}
      <div class="toast-progress" style="--toast-duration: {duration}ms"></div>
    {/if}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    font-size: 13px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    z-index: 2000;
    animation: slideIn 0.3s ease-out;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  }
  .toast-success {
    background: #2ac3a2;
    color: white;
  }
  .toast-error {
    background: #e22850;
    color: white;
  }
  .toast-info {
    background: #0060df;
    color: white;
  }
  .toast-message {
    flex: 1;
  }
  .toast-action {
    padding: 3px 10px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 4px;
    background: transparent;
    color: white;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    white-space: nowrap;
  }
  .toast-action:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.4);
    border-radius: 0 0 6px 6px;
    animation: shrink var(--toast-duration, 10000ms) linear forwards;
  }
  @keyframes slideIn {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  @keyframes shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
</style>
