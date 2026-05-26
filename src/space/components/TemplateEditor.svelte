<script lang="ts">
  /* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */
  import type { ResponseTemplate } from '../../types/templates';
  import { TEMPLATE_VARIABLES } from '../../lib/utils/constants';
  import { t } from '../../lib/i18n';
  import type { Translations } from '../../lib/i18n/types';
  import Modal from '../../lib/components/Modal.svelte';
  import Button from '../../lib/components/Button.svelte';


  interface Props {
    show: boolean;
    template: ResponseTemplate | null;
    onsave: (template: ResponseTemplate) => void;
    onclose: () => void;
  }

  let { show, template, onsave, onclose }: Props = $props();

  let name = $state('');
  let subject = $state('');
  let body = $state('');
  let isPlainText = $state(true);
  let sendMode = $state<'draft' | 'sendNow' | 'sendLater'>('draft');
  let replyType = $state<'replyToSender' | 'replyToAll'>('replyToSender');

  const variableKeys: Record<string, keyof Translations> = {
    sender_name: 'tpl_var_sender_name',
    sender_email: 'tpl_var_sender_email',
    to: 'tpl_var_to',
    subject: 'tpl_var_subject',
    date: 'tpl_var_date',
    time: 'tpl_var_time',
    day_of_week: 'tpl_var_day_of_week',
    original_body: 'tpl_var_original_body',
    original_body_snippet: 'tpl_var_original_body_snippet',
    my_name: 'tpl_var_my_name',
    my_email: 'tpl_var_my_email',
  };
  let variables = $derived(TEMPLATE_VARIABLES.map(v => ({ key: v.key, label: variableKeys[v.key] ? $t(variableKeys[v.key]) : v.label })));

  // Build example variables for preview
  const exampleVars: Record<string, string> = {};
  for (const v of TEMPLATE_VARIABLES) {
    exampleVars[v.key] = v.example;
  }
  // Legacy keys (dynamically set via i18n $effect below)
  exampleVars['senderName'] = '';
  exampleVars['senderEmail'] = 'juan@example.com';
  exampleVars['originalSubject'] = '';

  let subjectEl = $state<HTMLInputElement | null>(null);
  let bodyEl = $state<HTMLTextAreaElement | null>(null);

  let showPreview = $state(false);

  let previewSubject = $derived(
    subject.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => exampleVars[key] || `{{${key}}}`)
  );
  let previewBody = $derived(
    body.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => exampleVars[key] || `{{${key}}}`)
  );

  // Keep legacy example vars updated with i18n
  $effect(() => {
    exampleVars['senderName'] = $t('tmpl_example_sender_name');
    exampleVars['originalSubject'] = $t('tmpl_example_original_subject');
  });

  $effect(() => {
    if (template) {
      name = template.name;
      subject = template.subject;
      body = template.body;
      isPlainText = template.isPlainText;
      sendMode = template.sendMode;
      replyType = template.replyType;
    } else {
      name = '';
      subject = $t('tmpl_default_subject');
      body = $t('tmpl_default_body');
      isPlainText = true;
      sendMode = 'draft';
      replyType = 'replyToSender';
    }
  });

  function insertVariable(key: string, target: 'subject' | 'body') {
    const tag = `{{${key}}}`;
    const el = target === 'subject' ? subjectEl : bodyEl;
    if (el) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      const newValue = before + tag + after;
      if (target === 'subject') { subject = newValue; } else { body = newValue; }
      const cursorPos = start + tag.length;
      setTimeout(() => { el.focus(); el.setSelectionRange(cursorPos, cursorPos); }, 0);
    } else {
      if (target === 'subject') { subject += tag; } else { body += tag; }
    }
  }

  function handleSave() {
    if (!name.trim() || !subject.trim() || !body.trim()) return;

    const saved: ResponseTemplate = {
      id: template?.id || crypto.randomUUID(),
      name: name.trim(),
      subject,
      body,
      isPlainText,
      sendMode,
      replyType,
    };
    onsave(saved);
  }
</script>

<Modal title={template ? $t('tmpl_edit_title') : $t('tmpl_new_title')} {show} {onclose}>
  <div class="form">
    <div class="field">
      <label for="tmpl-name">{$t('tmpl_name_label')}</label>
      <input id="tmpl-name" type="text" bind:value={name} placeholder={$t('tmpl_name_placeholder')} />
    </div>

    <div class="field">
      <label for="tmpl-subject">{$t('tmpl_subject_label')}</label>
      <input id="tmpl-subject" type="text" bind:value={subject} bind:this={subjectEl} />
      <div class="var-buttons">
        {#each variables as v}
          <button class="var-btn" onclick={() => insertVariable(v.key, 'subject')}>
            {v.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="field">
      <label for="tmpl-body">{$t('tmpl_body_label')}</label>
      <textarea id="tmpl-body" bind:value={body} bind:this={bodyEl} rows="8"></textarea>
      <div class="var-buttons">
        {#each variables as v}
          <button class="var-btn" onclick={() => insertVariable(v.key, 'body')}>
            {v.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="send-mode">{$t('tmpl_send_mode')}</label>
        <select id="send-mode" bind:value={sendMode}>
          <option value="draft">{$t('tmpl_send_draft')}</option>
          <option value="sendNow">{$t('tmpl_send_now')}</option>
          <option value="sendLater">{$t('tmpl_send_later')}</option>
        </select>
      </div>

      <div class="field">
        <label for="reply-type">{$t('tmpl_reply_type')}</label>
        <select id="reply-type" bind:value={replyType}>
          <option value="replyToSender">{$t('tmpl_reply_sender')}</option>
          <option value="replyToAll">{$t('tmpl_reply_all')}</option>
        </select>
      </div>
    </div>

    <div class="field">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={isPlainText} />
        {$t('tmpl_plain_text')}
      </label>
    </div>

    <!-- Preview -->
    <div class="preview-toggle">
      <button class="preview-btn" onclick={() => (showPreview = !showPreview)}>
        {showPreview ? $t('tmpl_hide_preview') : $t('tmpl_show_preview')}
      </button>
    </div>

    {#if showPreview}
      <div class="preview-box">
        <div class="preview-label">{$t('tmpl_preview_label')}</div>
        <div class="preview-subject"><strong>{$t('tmpl_preview_subject')}</strong> {previewSubject}</div>
        <div class="preview-body">{#each previewBody.split('\n') as line}<p class="preview-line">{line}</p>{/each}</div>
      </div>
    {/if}

    <div class="form-actions">
      <Button variant="secondary" onclick={onclose}>{$t('common_cancel')}</Button>
      <Button
        variant="primary"
        onclick={handleSave}
        disabled={!name.trim() || !subject.trim() || !body.trim()}
      >
        {$t('common_save')}
      </Button>
    </div>
  </div>
</Modal>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .field label {
    display: block;
    margin-bottom: 4px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary, #555);
  }
  .field input[type="text"],
  .field textarea,
  .field select {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    box-sizing: border-box;
  }
  .field textarea {
    resize: vertical;
  }
  .field-row {
    display: flex;
    gap: 12px;
  }
  .field-row .field {
    flex: 1;
  }
  .var-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .var-btn {
    padding: 2px 8px;
    font-size: 11px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 12px;
    background: var(--bg-secondary, #f0f0f4);
    cursor: pointer;
    font-family: inherit;
  }
  .var-btn:hover {
    background: var(--bg-hover, #e0e0e6);
  }
  .checkbox-label {
    display: flex !important;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 13px;
  }
  .preview-toggle {
    display: flex;
  }
  .preview-btn {
    padding: 4px 10px;
    font-size: 12px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    background: var(--bg-secondary, #f0f0f4);
    cursor: pointer;
    font-family: inherit;
    color: var(--primary-color, #0060df);
  }
  .preview-btn:hover {
    background: var(--bg-hover, #e0e0e6);
  }
  .preview-box {
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 6px;
    padding: 12px;
    background: #fafafa;
  }
  .preview-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary, #666);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .preview-subject {
    font-size: 13px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color, #e0e0e6);
  }
  .preview-body {
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-color, #15141a);
  }
  .preview-line {
    margin: 0;
  }
  .preview-line:empty {
    height: 12px;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color, #e0e0e6);
  }

  @media (prefers-color-scheme: dark) {
    .preview-box { background: #2b2a33; }
    .field input[type="text"],
    .field textarea,
    .field select { background: var(--bg-primary, #1c1b22); color: var(--text-color, #fbfbfe); }
    .var-btn { color: var(--text-color, #fbfbfe); }
  }
</style>
