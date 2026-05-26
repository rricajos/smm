<script lang="ts">
  /* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */
  import { t } from '../i18n';
  import Button from './Button.svelte';

  interface Props {
    show: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
    onconfirm: () => void;
    oncancel: () => void;
  }

  let { show, title, message, confirmLabel, cancelLabel, variant = 'danger', onconfirm, oncancel }: Props = $props();

  let dialogEl: HTMLDivElement | undefined = $state(undefined);

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) oncancel();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!show) return;
    if (e.key === 'Escape') oncancel();
    if (e.key === 'Tab' && dialogEl) {
      const focusable = dialogEl.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  $effect(() => {
    if (show && dialogEl) {
      const btn = dialogEl.querySelector<HTMLElement>('button');
      if (btn) setTimeout(() => btn.focus(), 10);
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="confirm-backdrop" onclick={handleBackdrop} role="presentation">
    <div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg" bind:this={dialogEl}>
      <h3 id="confirm-title">{title}</h3>
      <p id="confirm-msg">{message}</p>
      <div class="confirm-actions">
        <Button onclick={oncancel}>{cancelLabel || $t('common_cancel')}</Button>
        <Button variant={variant} onclick={onconfirm}>{confirmLabel || $t('common_delete')}</Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .confirm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    animation: fadeIn 0.1s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .confirm-dialog {
    background: var(--bg-primary, white);
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 10px;
    padding: 20px 24px;
    width: 380px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }
  .confirm-dialog h3 {
    margin: 0 0 8px 0;
    font-size: 15px;
  }
  .confirm-dialog p {
    margin: 0 0 16px 0;
    font-size: 13px;
    color: var(--text-secondary, #5b5b66);
    line-height: 1.5;
  }
  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
