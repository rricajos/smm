<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../i18n';
  import Button from './Button.svelte';

  interface Props {
    title: string;
    show: boolean;
    onclose: () => void;
    children?: Snippet;
  }

  let { title, show, onclose, children }: Props = $props();
  let modalEl: HTMLDivElement | undefined = $state(undefined);
  let previouslyFocused: Element | null = null;

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!show) return;
    if (e.key === 'Escape') onclose();

    // Focus trap: keep Tab within modal
    if (e.key === 'Tab' && modalEl) {
      const focusable = modalEl.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
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
    if (show && modalEl) {
      previouslyFocused = document.activeElement;
      // Focus first focusable element inside modal
      const firstFocusable = modalEl.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 10);
      }
    }
    if (!show && previouslyFocused && previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus();
      previouslyFocused = null;
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={handleBackdropClick} role="presentation">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" bind:this={modalEl}>
      <div class="modal-header">
        <h2 id="modal-title">{title}</h2>
        <Button size="sm" onclick={onclose} aria-label={$t('common_close')}>&#10005;</Button>
      </div>
      <div class="modal-body">
        {#if children}{@render children()}{/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal {
    background: var(--bg-primary, white);
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
    max-width: 700px;
    width: 90%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #e0e0e6);
  }
  .modal-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
  .modal-body {
    padding: 20px;
    overflow-y: auto;
  }
</style>
