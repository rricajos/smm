<script lang="ts">
  import type { Condition } from '../../types/rules';
  import { t } from '../../lib/i18n';
  import type { Translations } from '../../lib/i18n/types';
  import Button from '../../lib/components/Button.svelte';

  interface Props {
    condition: Condition;
    onchange: (condition: Condition) => void;
    onremove: () => void;
  }

  let { condition, onchange, onremove }: Props = $props();

  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);
  t.subscribe((fn) => (T = fn));

  let fieldOptions = $derived([
    { value: 'from', label: T('cond_from') },
    { value: 'to', label: T('cond_to') },
    { value: 'subject', label: T('cond_subject') },
    { value: 'body', label: T('cond_body') },
    { value: 'hasAttachments', label: T('cond_attachments') },
  ]);

  let textOperators = $derived([
    { value: 'contains', label: T('cond_contains') },
    { value: 'equals', label: T('cond_equals') },
    { value: 'startsWith', label: T('cond_starts_with') },
    { value: 'endsWith', label: T('cond_ends_with') },
    { value: 'matches', label: T('cond_matches_regex') },
  ]);

  let isBoolean = $derived(condition.field === 'hasAttachments');

  function updateField(field: string) {
    if (field === 'hasAttachments') {
      onchange({ ...condition, field: field as Condition['field'], operator: 'is', boolValue: true, value: '' });
    } else {
      onchange({ ...condition, field: field as Condition['field'], operator: 'contains' });
    }
  }
</script>

<div class="condition-row">
  <select
    value={condition.field}
    onchange={(e) => updateField((e.target as HTMLSelectElement).value)}
  >
    {#each fieldOptions as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>

  {#if isBoolean}
    <select
      value={condition.boolValue ? 'true' : 'false'}
      onchange={(e) => onchange({ ...condition, boolValue: (e.target as HTMLSelectElement).value === 'true' })}
    >
      <option value="true">{T('cond_has_attachments')}</option>
      <option value="false">{T('cond_no_attachments')}</option>
    </select>
  {:else}
    <select
      value={condition.operator}
      onchange={(e) => onchange({ ...condition, operator: (e.target as HTMLSelectElement).value as Condition['operator'] })}
    >
      {#each textOperators as op}
        <option value={op.value}>{op.label}</option>
      {/each}
    </select>

    <input
      type="text"
      value={condition.value}
      placeholder={T('cond_value_placeholder')}
      oninput={(e) => onchange({ ...condition, value: (e.target as HTMLInputElement).value })}
    />

    <label class="case-toggle">
      <input
        type="checkbox"
        checked={condition.caseSensitive}
        onchange={(e) => onchange({ ...condition, caseSensitive: (e.target as HTMLInputElement).checked })}
      />
      Aa
    </label>
  {/if}

  <Button size="sm" variant="danger" onclick={onremove}>x</Button>
</div>

<style>
  .condition-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }
  select, input[type="text"] {
    padding: 5px 8px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
  }
  input[type="text"] {
    flex: 1;
  }
  .case-toggle {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    color: var(--text-secondary, #666);
    cursor: pointer;
    white-space: nowrap;
  }
  .case-toggle input {
    margin: 0;
  }
</style>
