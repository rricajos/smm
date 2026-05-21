<script lang="ts">
  import type { ResponseTemplate } from '../../types/templates';
  import { templates } from '../../lib/stores/templates';
  import { t } from '../../lib/i18n';
  import type { Translations } from '../../lib/i18n/types';
  import Button from '../../lib/components/Button.svelte';
  import TemplateEditor from '../components/TemplateEditor.svelte';

  let currentTemplates = $state<ResponseTemplate[]>([]);
  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);
  t.subscribe((fn) => (T = fn));
  let showEditor = $state(false);
  let editingTemplate = $state<ResponseTemplate | null>(null);
  let filterQuery = $state('');

  templates.subscribe((v) => (currentTemplates = v));

  let filteredTemplates = $derived(
    filterQuery.trim()
      ? currentTemplates.filter(t => {
          const q = filterQuery.toLowerCase().trim();
          return t.name.toLowerCase().includes(q) ||
            t.subject.toLowerCase().includes(q) ||
            t.body.toLowerCase().includes(q);
        })
      : currentTemplates,
  );

  function openNewTemplate() {
    editingTemplate = null;
    showEditor = true;
  }

  function openEditTemplate(tmpl: ResponseTemplate) {
    editingTemplate = tmpl;
    showEditor = true;
  }

  function handleSave(tmpl: ResponseTemplate) {
    if (editingTemplate) {
      templates.updateTemplate(tmpl.id, tmpl);
    } else {
      templates.addTemplate(tmpl);
    }
    showEditor = false;
    editingTemplate = null;
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(T('templates_confirm_delete', { name }))) return;
    templates.deleteTemplate(id);
  }

  function duplicateTemplate(tmpl: ResponseTemplate) {
    const dup: ResponseTemplate = {
      ...JSON.parse(JSON.stringify(tmpl)),
      id: crypto.randomUUID(),
      name: `${tmpl.name} ${T('templates_copy_suffix')}`,
    };
    templates.addTemplate(dup);
  }

  let sendModeLabels = $derived<Record<string, string>>({
    draft: T('templates_draft'),
    sendNow: T('templates_send_now'),
    sendLater: T('templates_send_later'),
  });

  let replyTypeLabels = $derived<Record<string, string>>({
    replyToSender: T('templates_reply'),
    replyToAll: T('templates_reply_all'),
  });
</script>

<div class="templates-page">
  <div class="header">
    <h3>{T('templates_title')}</h3>
    <Button variant="primary" onclick={openNewTemplate}>{T('templates_new')}</Button>
  </div>

  {#if currentTemplates.length > 3}
    <input
      type="text"
      class="filter-input"
      placeholder={T('templates_filter')}
      bind:value={filterQuery}
    />
  {/if}

  {#if currentTemplates.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <p class="empty-title">{T('empty_templates_title')}</p>
      <p class="empty-desc">{T('empty_templates_desc')}</p>
      <Button variant="primary" onclick={openNewTemplate}>{T('empty_templates_cta')}</Button>
    </div>
  {:else}
    <div class="template-list">
      {#each filteredTemplates as tmpl}
        <div class="template-item">
          <div class="template-info">
            <div class="template-name">{tmpl.name}</div>
            <div class="template-details">
              <span class="tag">{sendModeLabels[tmpl.sendMode]}</span>
              <span class="tag">{replyTypeLabels[tmpl.replyType]}</span>
              <span class="tag">{tmpl.isPlainText ? T('templates_plain_text') : T('templates_html')}</span>
            </div>
            <div class="template-preview">{tmpl.subject}</div>
          </div>
          <div class="template-actions">
            <Button size="sm" onclick={() => duplicateTemplate(tmpl)}>{T('common_duplicate')}</Button>
            <Button size="sm" onclick={() => openEditTemplate(tmpl)}>{T('common_edit')}</Button>
            <Button size="sm" variant="danger" onclick={() => handleDelete(tmpl.id, tmpl.name)}>{T('common_delete')}</Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <TemplateEditor
    show={showEditor}
    template={editingTemplate}
    onsave={handleSave}
    onclose={() => { showEditor = false; editingTemplate = null; }}
  />
</div>

<style>
  .templates-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header h3 {
    margin: 0;
    font-size: 15px;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px;
    text-align: center;
  }
  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--bg-secondary, #f0f0f4);
    color: var(--text-secondary, #999);
    margin-bottom: 16px;
  }
  .empty-title {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 6px 0;
    color: var(--text-color, #15141a);
  }
  .empty-desc {
    font-size: 13px;
    color: var(--text-secondary, #666);
    margin: 0 0 20px 0;
    max-width: 360px;
    line-height: 1.5;
  }
  .template-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .template-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 6px;
    background: var(--bg-primary, white);
  }
  .template-info {
    flex: 1;
    min-width: 0;
  }
  .template-name {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 4px;
  }
  .template-details {
    display: flex;
    gap: 6px;
    margin-bottom: 4px;
  }
  .tag {
    padding: 1px 8px;
    font-size: 11px;
    border-radius: 10px;
    background: var(--bg-secondary, #f0f0f4);
    color: var(--text-secondary, #555);
  }
  .template-preview {
    font-size: 12px;
    color: var(--text-secondary, #666);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .template-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .filter-input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    box-sizing: border-box;
    background: var(--bg-primary, white);
    color: var(--text-color, #15141a);
  }
  .filter-input:focus {
    outline: 2px solid var(--primary-color, #0060df);
    outline-offset: -1px;
  }

  @media (prefers-color-scheme: dark) {
    .filter-input { background: var(--bg-secondary, #2b2a33); color: var(--text-color, #fbfbfe); }
  }
</style>
