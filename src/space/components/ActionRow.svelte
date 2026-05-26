<script lang="ts">
  import type { Action } from '../../types/rules';
  import type { ResponseTemplate } from '../../types/templates';
  import { t } from '../../lib/i18n';
  import Button from '../../lib/components/Button.svelte';

  interface Props {
    action: Action;
    folders: { id: string; name: string; path: string; accountName: string }[];
    tags: { key: string; tag: string; color: string }[];
    templates: ResponseTemplate[];
    onchange: (action: Action) => void;
    onremove: () => void;
  }

  let { action, folders, tags, templates, onchange, onremove }: Props = $props();


  let actionTypes = $derived([
    { value: 'moveToFolder', label: $t('action_move_to_folder') },
    { value: 'addTag', label: $t('action_add_tag') },
    { value: 'setPriority', label: $t('action_set_priority') },
    { value: 'markRead', label: $t('action_mark_read') },
    { value: 'autoRespond', label: $t('action_auto_respond') },
  ]);

  let priorities = $derived([
    { value: 'highest', label: $t('action_priority_highest') },
    { value: 'high', label: $t('action_priority_high') },
    { value: 'normal', label: $t('action_priority_normal') },
    { value: 'low', label: $t('action_priority_low') },
    { value: 'lowest', label: $t('action_priority_lowest') },
  ]);

  function updateType(type: string) {
    const base: Action = { type: type as Action['type'] };
    switch (type) {
      case 'moveToFolder':
        base.folderId = folders[0]?.id || '';
        break;
      case 'addTag':
        base.tagKey = tags[0]?.key || '';
        break;
      case 'setPriority':
        base.priority = 'high';
        break;
      case 'autoRespond':
        base.templateId = templates[0]?.id || '';
        break;
    }
    onchange(base);
  }
</script>

<div class="action-row">
  <select
    value={action.type}
    onchange={(e) => updateType((e.target as HTMLSelectElement).value)}
  >
    {#each actionTypes as at}
      <option value={at.value}>{at.label}</option>
    {/each}
  </select>

  {#if action.type === 'moveToFolder'}
    <select
      value={action.folderId || ''}
      onchange={(e) => onchange({ ...action, folderId: (e.target as HTMLSelectElement).value })}
    >
      {#each folders as folder}
        <option value={folder.id}>{folder.accountName} / {folder.path}</option>
      {/each}
      {#if folders.length === 0}
        <option value="">{$t('action_no_folders')}</option>
      {/if}
    </select>
  {:else if action.type === 'addTag'}
    <select
      value={action.tagKey || ''}
      onchange={(e) => onchange({ ...action, tagKey: (e.target as HTMLSelectElement).value })}
    >
      {#each tags as tag}
        <option value={tag.key}>{tag.tag}</option>
      {/each}
    </select>
  {:else if action.type === 'setPriority'}
    <select
      value={action.priority || 'high'}
      onchange={(e) => onchange({ ...action, priority: (e.target as HTMLSelectElement).value as Action['priority'] })}
    >
      {#each priorities as p}
        <option value={p.value}>{p.label}</option>
      {/each}
    </select>
  {:else if action.type === 'autoRespond'}
    <select
      value={action.templateId || ''}
      onchange={(e) => onchange({ ...action, templateId: (e.target as HTMLSelectElement).value })}
    >
      {#each templates as tmpl}
        <option value={tmpl.id}>{tmpl.name}</option>
      {/each}
      {#if templates.length === 0}
        <option value="">{$t('action_create_template_first')}</option>
      {/if}
    </select>
  {/if}

  <Button size="sm" variant="danger" onclick={onremove} aria-label={$t('a11y_remove_action')}>x</Button>
</div>

<style>
  .action-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }
  select {
    padding: 5px 8px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    flex: 1;
  }
</style>
