<script lang="ts">
  /* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'xs' | 'sm' | 'md';
    disabled?: boolean;
    onclick?: () => void;
    children?: Snippet;
  }

  let { variant = 'secondary', size = 'md', disabled = false, onclick, children, ...rest }: Props & Record<string, any> = $props();
</script>

<button
  class="btn btn-{variant} btn-{size}"
  {disabled}
  {onclick}
  {...rest}
>
  {#if children}{@render children()}{/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.2;
    white-space: nowrap;
    transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  /* Sizes */
  .btn-xs {
    padding: 2px 6px;
    font-size: 11px;
  }
  .btn-sm {
    padding: 4px 8px;
    font-size: 12px;
  }
  .btn-md {
    padding: 6px 12px;
  }
  /* Variants */
  .btn-primary {
    background: var(--primary-color, #0060df);
    color: white;
    border-color: var(--primary-color, #0060df);
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover, #003eaa);
  }
  .btn-secondary {
    background: var(--bg-secondary, #f0f0f4);
    color: var(--text-color, #15141a);
  }
  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-hover, #e0e0e6);
  }
  .btn-danger {
    background: #e22850;
    color: white;
    border-color: #e22850;
  }
  .btn-danger:hover:not(:disabled) {
    background: #c50042;
  }
  .btn-ghost {
    background: transparent;
    color: var(--primary-color, #0060df);
    border-color: var(--primary-color, #0060df);
  }
  .btn-ghost:hover:not(:disabled) {
    background: var(--primary-color, #0060df);
    color: white;
  }
</style>
