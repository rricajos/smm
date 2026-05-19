<script lang="ts">
  import type { Settings } from '../types/settings';
  import { settings } from '../lib/stores/settings';
  import { rules } from '../lib/stores/rules';
  import { templates } from '../lib/stores/templates';
  import { OPENAI_MODELS } from '../lib/utils/constants';
  import { t, locale, setLocale, type SupportedLocale } from '../lib/i18n';
  import type { Translations } from '../lib/i18n/types';
  const providers = [...new Set(OPENAI_MODELS.map(m => m.provider))];
  import { testConnection } from '../lib/services/openai';
  import Button from '../lib/components/Button.svelte';
  import Toast from '../lib/components/Toast.svelte';

  declare const browser: any;

  let currentSettings = $state<Settings>({
    classificationEnabled: true,
    autoResponseEnabled: true,
    processExistingOnStartup: false,
    maxAutoResponsesPerHour: 10,
    logRetentionDays: 30,
    notifyOnClassification: true,
    notifyOnAutoResponse: true,
    openaiApiKey: '',
    openaiModel: 'openai/gpt-4o-mini',
  });

  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);
  let currentLocale = $state<SupportedLocale>('es');
  t.subscribe((fn) => (T = fn));
  locale.subscribe((v) => (currentLocale = v));

  let showApiKey = $state(false);
  let testingConnection = $state(false);
  let currentRules = $state<any[]>([]);
  let currentTemplates = $state<any[]>([]);
  let toastMessage = $state('');
  let toastType = $state<'success' | 'error' | 'info'>('success');
  let showToast = $state(false);

  settings.subscribe((v) => (currentSettings = { ...v }));
  rules.subscribe((v) => (currentRules = v));
  templates.subscribe((v) => (currentTemplates = v));

  function showNotification(message: string, type: 'success' | 'error' | 'info' = 'success') {
    toastMessage = message;
    toastType = type;
    showToast = true;
    setTimeout(() => (showToast = false), 3000);
  }

  async function saveSettings() {
    await settings.save(currentSettings);
    showNotification(T('options_saved'));
  }

  function exportData() {
    const data = {
      rules: currentRules,
      templates: currentTemplates,
      settings: currentSettings,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smart-mail-manager-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    showNotification(T('options_exported'));
  }

  async function handleTestConnection() {
    if (!currentSettings.openaiApiKey) {
      showNotification(T('options_enter_key_first'), 'error');
      return;
    }
    testingConnection = true;
    try {
      await testConnection(currentSettings.openaiApiKey, currentSettings.openaiModel);
      showNotification(T('options_connection_ok'));
    } catch (err: any) {
      showNotification(T('options_connection_error', { msg: err.message }), 'error');
    } finally {
      testingConnection = false;
    }
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.rules) {
          await browser.storage.local.set({ smm_rules: data.rules });
        }
        if (data.templates) {
          await browser.storage.local.set({ smm_templates: data.templates });
        }
        if (data.settings) {
          await browser.storage.local.set({ smm_settings: data.settings });
        }
        showNotification(T('options_imported'));
      } catch {
        showNotification(T('options_import_error'), 'error');
      }
    };
    input.click();
  }
</script>

<div class="options">
  <h1>{T('options_title')}</h1>

  <section>
    <h2>{T('options_general')}</h2>
    <div class="field">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={currentSettings.classificationEnabled} />
        {T('options_enable_classification')}
      </label>
    </div>
    <div class="field">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={currentSettings.autoResponseEnabled} />
        {T('options_enable_auto_response')}
      </label>
    </div>
    <div class="field">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={currentSettings.processExistingOnStartup} />
        {T('options_process_on_startup')}
      </label>
    </div>
  </section>

  <section>
    <h2>{T('options_limits')}</h2>
    <div class="field">
      <label for="max-responses">{T('options_max_responses')}</label>
      <input id="max-responses" type="number" min="1" max="100" bind:value={currentSettings.maxAutoResponsesPerHour} />
    </div>
    <div class="field">
      <label for="log-retention">{T('options_log_retention')}</label>
      <input id="log-retention" type="number" min="1" max="365" bind:value={currentSettings.logRetentionDays} />
      <span class="field-hint">{T('options_log_retention_hint')}</span>
    </div>
  </section>

  <section>
    <h2>{T('options_notifications')}</h2>
    <div class="field">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={currentSettings.notifyOnClassification} />
        {T('options_notify_classification')}
      </label>
    </div>
    <div class="field">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={currentSettings.notifyOnAutoResponse} />
        {T('options_notify_auto_response')}
      </label>
    </div>
  </section>

  <section>
    <h2>{T('options_openrouter')}</h2>
    <p class="info">{T('options_openrouter_desc')}</p>
    <div class="field">
      <label for="api-key">{T('options_api_key')}</label>
      <div class="api-key-row">
        <input
          id="api-key"
          type={showApiKey ? 'text' : 'password'}
          bind:value={currentSettings.openaiApiKey}
          placeholder="sk-or-..."
          class="api-key-input"
        />
        <button class="toggle-btn" onclick={() => (showApiKey = !showApiKey)}>
          {showApiKey ? T('common_hide') : T('common_show')}
        </button>
      </div>
    </div>
    <div class="field">
      <label for="ai-model">{T('options_model')}</label>
      <select id="ai-model" bind:value={currentSettings.openaiModel}>
        {#each providers as provider}
          <optgroup label={provider}>
            {#each OPENAI_MODELS.filter(m => m.provider === provider) as model}
              <option value={model.id}>{model.label}</option>
            {/each}
          </optgroup>
        {/each}
      </select>
    </div>
    <div class="field">
      <Button onclick={handleTestConnection} disabled={testingConnection || !currentSettings.openaiApiKey}>
        {testingConnection ? T('options_testing') : T('options_test_connection')}
      </Button>
    </div>
  </section>

  <div class="actions">
    <Button variant="primary" onclick={saveSettings}>{T('common_save')}</Button>
  </div>

  <section>
    <h2>{T('options_language')}</h2>
    <div class="field">
      <select
        value={currentLocale}
        onchange={(e) => setLocale((e.target as HTMLSelectElement).value as SupportedLocale)}
      >
        <option value="es">Espanol</option>
        <option value="en">English</option>
      </select>
    </div>
  </section>

  <section>
    <h2>{T('options_data')}</h2>
    <p class="info">{T('options_data_desc')}</p>
    <div class="data-actions">
      <Button onclick={exportData}>{T('options_export_data')}</Button>
      <Button onclick={importData}>{T('options_import_data')}</Button>
    </div>
  </section>

  <Toast message={toastMessage} type={toastType} show={showToast} />
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: #15141a;
    background: #f9f9fb;
    --primary-color: #0060df;
    --primary-hover: #003eaa;
    --border-color: #e0e0e6;
    --bg-secondary: #f0f0f4;
    --bg-hover: #e0e0e6;
  }

  @media (prefers-color-scheme: dark) {
    :global(body) {
      color: #fbfbfe;
      background: #1c1b22;
      --primary-color: #45a1ff;
      --primary-hover: #73b6ff;
      --border-color: #4a4a5a;
      --bg-secondary: #2b2a33;
      --bg-hover: #3a3944;
    }
    section { background: #2b2a33; }
    .field label { color: #b1b1bd; }
    .checkbox-label { color: #fbfbfe !important; }
    .info { color: #b1b1bd; }
    .field input[type="number"],
    .field select,
    .api-key-input { background: #1c1b22; color: #fbfbfe; border-color: #4a4a5a; }
    .toggle-btn { color: #fbfbfe; }
  }

  .options {
    max-width: 600px;
    margin: 0 auto;
    padding: 24px;
  }
  h1 {
    font-size: 20px;
    margin: 0 0 24px 0;
    color: var(--primary-color);
  }
  section {
    background: white;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 16px;
  }
  h2 {
    font-size: 15px;
    margin: 0 0 12px 0;
  }
  .field {
    margin-bottom: 10px;
  }
  .field label {
    display: block;
    margin-bottom: 4px;
    font-size: 13px;
    color: #5b5b66;
  }
  .field input[type="number"] {
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    width: 100px;
  }
  .checkbox-label {
    display: flex !important;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: #15141a !important;
  }
  .actions {
    margin-bottom: 16px;
  }
  .info {
    font-size: 13px;
    color: #5b5b66;
    margin: 0 0 12px 0;
  }
  .data-actions {
    display: flex;
    gap: 8px;
  }
  .api-key-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .api-key-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 13px;
    font-family: monospace;
  }
  .toggle-btn {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    white-space: nowrap;
  }
  .field-hint {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    color: #5b5b66;
  }
  .toggle-btn:hover {
    background: var(--bg-hover);
  }
  .field select {
    padding: 6px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
  }
</style>
