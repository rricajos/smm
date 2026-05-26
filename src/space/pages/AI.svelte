<script lang="ts">
  import type { Rule } from '../../types/rules';
  import type { ResponseTemplate } from '../../types/templates';
  import { rules } from '../../lib/stores/rules';
  import { templates } from '../../lib/stores/templates';
  import { settings } from '../../lib/stores/settings';
  import {
    generateRulesFromEmails,
    generateRuleFromDescription,
    chatWithAssistant,
    testConnection,
  } from '../../lib/services/openai';
  import type {
    RuleSuggestion,
    FolderInfo,
    TagInfo,
    EmailSummary,
    FolderProposal,
    MoveProposal,
    RuleProposal,
    TemplateProposal,
    RuleConsolidationProposal,
  } from '../../lib/services/openai';
  import { OPENAI_MODELS, OPENAI_DIRECT_MODELS, ANTHROPIC_DIRECT_MODELS, GOOGLE_DIRECT_MODELS } from '../../lib/utils/constants';
  import type { AiProvider } from '../../types/settings';
  import { t, locale } from '../../lib/i18n';
  import { chatStore, activeConversation, allConversations, storeReady, type ChatConversation } from '../../lib/stores/chat';
  import Toast from '../../lib/components/Toast.svelte';
  import Button from '../../lib/components/Button.svelte';
  import RuleEditor from '../components/RuleEditor.svelte';
  import ChatPanel from '../components/ChatPanel.svelte';
  import QuickPanel from '../components/QuickPanel.svelte';

  const openrouterProviders = [...new Set(OPENAI_MODELS.map(m => m.provider))];

  function getDirectModels(provider: AiProvider) {
    switch (provider) {
      case 'openai': return OPENAI_DIRECT_MODELS;
      case 'anthropic': return ANTHROPIC_DIRECT_MODELS;
      case 'google': return GOOGLE_DIRECT_MODELS;
      default: return [];
    }
  }

  interface Props {
    pendingPrompt?: string;
    onconsumeprompt?: () => void;
    selectedFolder?: { id: string; name: string; path: string } | null;
    onclearfolder?: () => void;
  }

  let { pendingPrompt = '', onconsumeprompt, selectedFolder = null, onclearfolder }: Props = $props();

  declare const browser: any;

  // --- Chat store subscriptions ---
  let currentConversation = $state<ChatConversation>({ id: '', title: '', createdAt: 0, displayMessages: [], apiHistory: [] });
  let conversations = $state<ChatConversation[]>([]);
  activeConversation.subscribe((v) => (currentConversation = v));
  allConversations.subscribe((v) => (conversations = v));

  // --- Shared UI state ---
  let loading = $state(false);
  let error = $state('');
  let successMessage = $state('');
  let activeMode = $state<'chat' | 'quick'>('chat');

  // --- API health ---
  let apiHealth = $state<'unknown' | 'checking' | 'ok' | 'error'>('unknown');

  async function checkApiHealth() {
    if (!$settings.openaiApiKey) { apiHealth = 'error'; return; }
    apiHealth = 'checking';
    try {
      const ok = await testConnection($settings.openaiApiKey, $settings.openaiModel || 'openai/gpt-4o-mini', $settings.aiProvider || 'openrouter', $settings.customBaseUrl);
      apiHealth = ok ? 'ok' : 'error';
    } catch { apiHealth = 'error'; }
  }

  $effect(() => {
    const key = $settings.openaiApiKey;
    if (key) checkApiHealth();
    else apiHealth = 'unknown';
  });

  // --- Metadata & emails ---
  let folderInfos = $state<FolderInfo[]>([]);
  let tagInfos = $state<TagInfo[]>([]);
  let folders = $state<any[]>([]);
  let tags = $state<any[]>([]);
  let cachedEmails = $state<EmailSummary[]>([]);

  async function loadMetadata() {
    try {
      const data = await browser.runtime.sendMessage({ type: 'GET_FOLDERS_AND_TAGS' });
      folderInfos = data.folders || [];
      tagInfos = data.tags || [];
      folders = await browser.runtime.sendMessage({ type: 'GET_FOLDERS' });
      tags = await browser.runtime.sendMessage({ type: 'GET_TAGS' });
    } catch { folderInfos = []; tagInfos = []; folders = []; tags = []; }
  }

  async function loadEmails() {
    if (cachedEmails.length > 0) return cachedEmails;
    try {
      const emails = await browser.runtime.sendMessage({ type: 'GET_RECENT_EMAILS' });
      cachedEmails = emails || [];
      return cachedEmails;
    } catch { return []; }
  }

  loadMetadata();

  let chatLoading = $state(false);
  let createdFolderMap = $derived(currentConversation.createdFolderMap || {});
  let createdTemplateMap: Record<string, string> = {};

  // --- Rule editor ---
  let showEditor = $state(false);
  let editingRule = $state<Rule | null>(null);

  // --- Quick state ---
  let suggestions = $state<RuleSuggestion[]>([]);
  let batchLoading = $state(false);
  let batchCancelled = $state(false);
  let batchProgress = $state<{ current: number; total: number; processed: number } | null>(null);
  let accountList = $state<Array<{ id: string; name: string; email: string }>>([]);

  // --- Undo system ---
  let undoToast = $state<{
    show: boolean; message: string;
    undoFn: (() => Promise<void>) | null;
    timerId: ReturnType<typeof setTimeout> | null;
  }>({ show: false, message: '', undoFn: null, timerId: null });

  const UNDO_DURATION = 10000;

  function showUndoToast(message: string, undoFn: () => Promise<void>) {
    if (undoToast.timerId) clearTimeout(undoToast.timerId);
    const timerId = setTimeout(() => {
      undoToast = { show: false, message: '', undoFn: null, timerId: null };
    }, UNDO_DURATION);
    undoToast = { show: true, message, undoFn, timerId };
  }

  async function handleUndo() {
    if (undoToast.timerId) clearTimeout(undoToast.timerId);
    if (undoToast.undoFn) {
      try { await undoToast.undoFn(); }
      catch (err: any) { error = $t('ai_error_undo', { msg: err.message }); }
    }
    undoToast = { show: false, message: '', undoFn: null, timerId: null };
  }

  // --- Helpers ---
  function clearMessages() { error = ''; successMessage = ''; }
  function checkApiKey(): boolean {
    if (!$settings.openaiApiKey) { error = $t('ai_error_no_api_key'); return false; }
    return true;
  }
  function showSuccess(msg: string) {
    successMessage = msg;
    setTimeout(() => (successMessage = ''), 3000);
  }

  // --- Handle pending prompt ---
  $effect(() => {
    if (pendingPrompt) {
      activeMode = 'chat';
      newConversation();
      setTimeout(() => {
        sendChatMessage(pendingPrompt);
        onconsumeprompt?.();
      }, 100);
    }
  });

  // Load accounts
  (async () => {
    try {
      const accounts = await browser.runtime.sendMessage({ type: 'GET_ACCOUNT_INFO' });
      accountList = accounts || [];
    } catch { /* ignore */ }
  })();

  // --- Chat functions ---

  function newConversation() {
    chatStore.newConversation();
    cachedEmails = [];
  }

  async function sendChatMessage(text?: string) {
    let msg = text || '';
    if (!msg) return;
    if (!checkApiKey()) return;

    if (selectedFolder) {
      msg = `[${$t('ai_folder_context')}: ${selectedFolder.name} (${selectedFolder.path})]\n${msg}`;
    }

    clearMessages();
    chatStore.addUserMessage(msg);
    chatLoading = true;

    try {
      const emails = await loadEmails();
      await loadMetadata();
      const response = await chatWithAssistant(
        currentConversation.apiHistory, folderInfos, tagInfos, $rules, emails,
        $settings.openaiApiKey,
        $settings.openaiModel || 'openai/gpt-4o-mini',
        $settings.aiProvider || 'openrouter',
        $settings.customBaseUrl,
        $templates,
      );
      chatStore.addAssistantMessage(
        response.message, response.folderProposals, response.ruleProposals,
        response.moveProposals, response.templateProposals, response.ruleConsolidationProposals,
      );
    } catch (err: any) {
      error = $t('ai_error_generic', { msg: err.message || $t('ai_error_openrouter') });
    } finally { chatLoading = false; }
  }

  // --- Proposal handlers ---

  function resolveParentFolderId(parentId: string): string {
    if (parentId.startsWith('NEW:') && createdFolderMap[parentId]) return createdFolderMap[parentId];
    return parentId;
  }

  function resolveActionRefs(actions: Rule['actions']) {
    return actions.map(a => {
      let resolved = { ...a };
      if (resolved.folderId?.startsWith('NEW:') && createdFolderMap[resolved.folderId]) resolved.folderId = createdFolderMap[resolved.folderId];
      if (resolved.templateId?.startsWith('NEW_TPL:') && createdTemplateMap[resolved.templateId]) resolved.templateId = createdTemplateMap[resolved.templateId];
      return resolved;
    });
  }

  async function acceptFolderProposal(msgIdx: number, proposalIdx: number, proposal: FolderProposal) {
    try {
      const resolvedParentId = resolveParentFolderId(proposal.parentFolderId);
      if (resolvedParentId.startsWith('NEW:')) {
        error = $t('ai_error_parent_folder', { parent: resolvedParentId.replace('NEW:', ''), name: proposal.name });
        return;
      }
      const result = await browser.runtime.sendMessage({
        type: 'CREATE_FOLDER', parentFolderId: resolvedParentId, folderName: proposal.name,
      });
      if (result.success) {
        const folderId = result.folder.id;
        chatStore.setFolderMapping(`NEW:${proposal.name}`, folderId);
        chatStore.markFolderAccepted(msgIdx, proposalIdx);
        await loadMetadata();
        showUndoToast($t('ai_success_folder_created', { name: proposal.name }), async () => {
          await browser.runtime.sendMessage({ type: 'DELETE_FOLDER', folderId });
          chatStore.unmarkFolderAccepted(msgIdx, proposalIdx);
          chatStore.removeFolderMapping(`NEW:${proposal.name}`);
          await loadMetadata();
          showSuccess($t('ai_success_folder_undo', { name: proposal.name }));
        });
      } else {
        const errMsg: string = result.error || '';
        if (errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('ya existe')) {
          await loadMetadata();
          const existing = folderInfos.find(f => f.name === proposal.name && f.path.includes(proposal.name));
          if (existing) {
            chatStore.setFolderMapping(`NEW:${proposal.name}`, existing.id);
            chatStore.markFolderAccepted(msgIdx, proposalIdx);
            showSuccess($t('ai_success_folder_existed', { name: proposal.name }));
          } else { error = $t('ai_error_folder_id', { name: proposal.name }); }
        } else { error = $t('ai_error_folder_create', { msg: errMsg }); }
      }
    } catch (err: any) { error = $t('ai_error_generic', { msg: err.message }); }
  }

  function acceptRuleProposal(msgIdx: number, proposalIdx: number, proposal: RuleProposal) {
    const rule = { ...proposal.rule, actions: resolveActionRefs(proposal.rule.actions) };
    rules.addRule(rule);
    chatStore.markRuleAccepted(msgIdx, proposalIdx);
    const ruleId = rule.id;
    const ruleName = rule.name;
    showUndoToast($t('ai_success_rule_saved', { name: ruleName }), async () => {
      rules.deleteRule(ruleId);
      chatStore.unmarkRuleAccepted(msgIdx, proposalIdx);
      showSuccess($t('ai_success_rule_undo', { name: ruleName }));
    });
  }

  function editRuleProposal(proposal: RuleProposal) {
    editingRule = { ...proposal.rule, actions: resolveActionRefs(proposal.rule.actions) };
    showEditor = true;
  }

  async function acceptAllFolders(msgIdx: number, proposals: FolderProposal[]) {
    const msgs = currentConversation.displayMessages;
    for (let i = 0; i < proposals.length; i++) {
      if (!msgs[msgIdx]?.acceptedFolders?.includes(i)) await acceptFolderProposal(msgIdx, i, proposals[i]);
    }
  }

  function acceptAllRules(msgIdx: number, proposals: RuleProposal[]) {
    const msgs = currentConversation.displayMessages;
    proposals.forEach((p, i) => { if (!msgs[msgIdx]?.acceptedRules?.includes(i)) acceptRuleProposal(msgIdx, i, p); });
  }

  async function acceptMoveProposal(msgIdx: number, proposalIdx: number, proposal: MoveProposal) {
    try {
      const result = await browser.runtime.sendMessage({
        type: 'MOVE_FOLDER_CONTENTS',
        sourceFolderId: proposal.sourceFolderId, destFolderId: proposal.destFolderId, deleteSource: proposal.deleteSource,
      });
      if (result.success) {
        chatStore.markMoveAccepted(msgIdx, proposalIdx);
        await loadMetadata();
        const movedCount = result.movedCount || 0;
        const srcName = proposal.sourceFolderPath.split('/').pop() || proposal.sourceFolderPath;
        const destName = proposal.destFolderPath.split('/').pop() || proposal.destFolderPath;
        showUndoToast($t('ai_success_move_done', { count: movedCount, source: srcName, dest: destName }), async () => {
          if (!proposal.deleteSource) {
            await browser.runtime.sendMessage({
              type: 'MOVE_FOLDER_CONTENTS', sourceFolderId: proposal.destFolderId, destFolderId: proposal.sourceFolderId, deleteSource: false,
            });
          }
          chatStore.unmarkMoveAccepted(msgIdx, proposalIdx);
          await loadMetadata();
          showSuccess($t('ai_success_move_undo'));
        });
      } else { error = $t('ai_error_move', { msg: result.error || '' }); }
    } catch (err: any) { error = $t('ai_error_move', { msg: err.message }); }
  }

  async function acceptAllMoves(msgIdx: number, proposals: MoveProposal[]) {
    const msgs = currentConversation.displayMessages;
    for (let i = 0; i < proposals.length; i++) {
      if (!msgs[msgIdx]?.acceptedMoves?.includes(i)) await acceptMoveProposal(msgIdx, i, proposals[i]);
    }
  }

  function acceptTemplateProposal(msgIdx: number, proposalIdx: number, proposal: TemplateProposal) {
    try {
      templates.addTemplate(proposal.template);
      const tplId = proposal.template.id;
      const tplName = proposal.template.name;
      createdTemplateMap[`NEW_TPL:${tplName}`] = tplId;
      chatStore.markTemplateAccepted(msgIdx, proposalIdx);
      showUndoToast($t('ai_success_template_created', { name: tplName }), async () => {
        templates.deleteTemplate(tplId);
        delete createdTemplateMap[`NEW_TPL:${tplName}`];
        chatStore.unmarkTemplateAccepted(msgIdx, proposalIdx);
        showSuccess($t('ai_success_template_undo', { name: tplName }));
      });
    } catch (err: any) { error = $t('ai_error_template', { msg: err.message }); }
  }

  function acceptAllTemplates(msgIdx: number, proposals: TemplateProposal[]) {
    const msgs = currentConversation.displayMessages;
    proposals.forEach((p, i) => { if (!msgs[msgIdx]?.acceptedTemplates?.includes(i)) acceptTemplateProposal(msgIdx, i, p); });
  }

  function acceptConsolidationProposal(msgIdx: number, proposalIdx: number, proposal: RuleConsolidationProposal) {
    try {
      const resolvedIds: string[] = [];
      for (let i = 0; i < proposal.sourceRuleIds.length; i++) {
        const idOrRef = proposal.sourceRuleIds[i];
        const name = proposal.sourceRuleNames[i];
        const byId = $rules.find(r => r.id === idOrRef);
        if (byId) { resolvedIds.push(byId.id); continue; }
        if (idOrRef.startsWith('NEW_RULE:')) {
          const refName = idOrRef.slice(9).toLowerCase();
          const byName = $rules.find(r => r.name.toLowerCase() === refName);
          if (byName) { resolvedIds.push(byName.id); continue; }
        }
        if (name) {
          const byName = $rules.find(r => r.name.toLowerCase() === name.toLowerCase());
          if (byName) { resolvedIds.push(byName.id); continue; }
        }
        const byRawName = $rules.find(r => r.name.toLowerCase() === idOrRef.toLowerCase());
        if (byRawName) { resolvedIds.push(byRawName.id); continue; }
      }

      const originalRules = resolvedIds.map(id => $rules.find(r => r.id === id)).filter(Boolean) as Rule[];
      resolvedIds.forEach(id => rules.deleteRule(id));

      const mergedRule = { ...proposal.mergedRule, actions: resolveActionRefs(proposal.mergedRule.actions) };
      rules.addRule(mergedRule);
      chatStore.markConsolidationAccepted(msgIdx, proposalIdx);

      const mergedId = mergedRule.id;
      const mergedName = mergedRule.name;
      showUndoToast($t('ai_success_rules_consolidated', { name: mergedName }), async () => {
        rules.deleteRule(mergedId);
        originalRules.forEach(r => rules.addRule(r));
        chatStore.unmarkConsolidationAccepted(msgIdx, proposalIdx);
        showSuccess($t('ai_success_rules_consolidated_undo', { name: mergedName }));
      });
    } catch (err: any) { error = $t('ai_error_consolidation', { msg: err.message }); }
  }

  function acceptAllConsolidations(msgIdx: number, proposals: RuleConsolidationProposal[]) {
    const msgs = currentConversation.displayMessages;
    proposals.forEach((p, i) => { if (!msgs[msgIdx]?.acceptedConsolidations?.includes(i)) acceptConsolidationProposal(msgIdx, i, p); });
  }

  // --- Quick panel handlers ---

  async function analyzeEmails() {
    clearMessages();
    if (!checkApiKey()) return;
    loading = true;
    suggestions = [];
    try {
      const emails = await browser.runtime.sendMessage({ type: 'GET_RECENT_EMAILS' });
      if (!emails || emails.length === 0) { error = $t('ai_error_no_emails'); loading = false; return; }
      suggestions = await generateRulesFromEmails(emails, folderInfos, tagInfos, $rules, $settings.openaiApiKey, $settings.openaiModel || 'openai/gpt-4o-mini', $settings.aiProvider || 'openrouter', $settings.customBaseUrl);
      if (suggestions.length === 0) error = $t('ai_error_no_patterns');
    } catch (err: any) { error = $t('ai_error_generic', { msg: err.message || $t('ai_error_openrouter') }); }
    finally { loading = false; }
  }

  async function analyzeAllEmails(accountId: string, limit: number, skipAnalyzed: boolean) {
    clearMessages();
    if (!checkApiKey()) return;
    batchLoading = true;
    batchCancelled = false;
    batchProgress = null;
    suggestions = [];

    try {
      const result = await browser.runtime.sendMessage({
        type: 'GET_ALL_EMAILS_HEADERS',
        accountId: accountId || undefined,
        limit: limit > 0 ? limit : undefined,
        skipAnalyzed,
      });
      const allEmails = result?.emails || [];
      if (result?.skippedAnalyzed > 0) showSuccess($t('ai_batch_skipped_count', { count: result.skippedAnalyzed }));
      if (allEmails.length === 0) { error = $t('ai_batch_no_emails'); batchLoading = false; return; }

      const BATCH_SIZE = 64;
      const totalBatches = Math.ceil(allEmails.length / BATCH_SIZE);
      const allSuggestions: RuleSuggestion[] = [];

      for (let i = 0; i < totalBatches; i++) {
        if (batchCancelled) break;
        const batch = allEmails.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        batchProgress = { current: i + 1, total: totalBatches, processed: i * BATCH_SIZE };
        try {
          const batchSuggestions = await generateRulesFromEmails(
            batch, folderInfos, tagInfos, $rules, $settings.openaiApiKey,
            $settings.openaiModel || 'openai/gpt-4o-mini', $settings.aiProvider || 'openrouter', $settings.customBaseUrl,
          );
          for (const s of batchSuggestions) {
            if (!allSuggestions.some(existing => existing.rule.name.toLowerCase() === s.rule.name.toLowerCase())) allSuggestions.push(s);
          }
        } catch (err: any) { console.error(`[SMM] Batch ${i + 1} error:`, err); }
      }

      suggestions = allSuggestions;
      const processed = batchCancelled ? (batchProgress?.current || 0) * BATCH_SIZE : allEmails.length;

      const analyzedIds = allEmails.slice(0, processed).map((e: any) => e.id).filter(Boolean);
      if (analyzedIds.length > 0) {
        batchProgress = { current: 0, total: 0, processed: 0 };
        await browser.runtime.sendMessage({ type: 'MARK_EMAILS_ANALYZED', messageIds: analyzedIds });
      }

      batchLoading = false;
      batchProgress = null;
      activeMode = 'chat';
      newConversation();

      chatStore.addUserMessage($t('ai_batch_chat_user', { count: processed }));
      if (allSuggestions.length > 0) {
        const ruleProposals: RuleProposal[] = allSuggestions.map(s => ({ rule: s.rule, description: s.explanation }));
        chatStore.addAssistantMessage($t('ai_batch_chat_result', {
          total: processed, batches: batchCancelled ? (batchProgress?.current || totalBatches) : totalBatches, rules: allSuggestions.length,
        }), [], ruleProposals);
      } else {
        chatStore.addAssistantMessage($t('ai_batch_chat_no_results', { total: processed }), [], []);
      }
    } catch (err: any) { error = $t('ai_error_generic', { msg: err.message || $t('ai_error_openrouter') }); }
    finally { batchLoading = false; batchProgress = null; }
  }

  async function generateFromDescription(desc: string) {
    clearMessages();
    if (!checkApiKey()) return;
    if (!desc) { error = $t('ai_error_description_empty'); return; }
    loading = true;
    suggestions = [];
    try {
      suggestions = await generateRuleFromDescription(desc, folderInfos, tagInfos, $rules, $settings.openaiApiKey, $settings.openaiModel || 'openai/gpt-4o-mini', $settings.aiProvider || 'openrouter', $settings.customBaseUrl);
      if (suggestions.length === 0) error = $t('ai_error_no_rule');
    } catch (err: any) { error = $t('ai_error_generic', { msg: err.message || $t('ai_error_openrouter') }); }
    finally { loading = false; }
  }

  function acceptSuggestion(suggestion: RuleSuggestion) {
    rules.addRule(suggestion.rule);
    suggestions = suggestions.filter(s => s !== suggestion);
    showSuccess($t('ai_success_accepted', { name: suggestion.rule.name }));
  }

  function editSuggestion(suggestion: RuleSuggestion) {
    editingRule = { ...suggestion.rule };
    showEditor = true;
  }

  function discardSuggestion(suggestion: RuleSuggestion) {
    suggestions = suggestions.filter(s => s !== suggestion);
  }

  function handleEditorSave(rule: Rule) {
    rules.addRule(rule);
    showEditor = false;
    editingRule = null;
    suggestions = suggestions.filter(s => s.rule.id !== rule.id);
    showSuccess($t('ai_success_accepted', { name: rule.name }));
  }
</script>

<div class="ai-page">
  <div class="header">
    <h3>{$t('ai_title')}</h3>
    <div class="model-selector">
      <label for="ai-model-select">{$t('ai_model_label')}</label>
      {#if $settings.aiProvider === 'openrouter' || !$settings.aiProvider}
        <select
          id="ai-model-select"
          value={$settings.openaiModel || 'openai/gpt-4o-mini'}
          onchange={(e) => settings.update({ openaiModel: (e.target as HTMLSelectElement).value })}
        >
          {#each openrouterProviders as provider}
            <optgroup label={provider}>
              {#each OPENAI_MODELS.filter(m => m.provider === provider) as model}
                <option value={model.id}>{model.label}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      {:else if $settings.aiProvider === 'custom'}
        <input
          id="ai-model-select"
          type="text"
          value={$settings.openaiModel || ''}
          onchange={(e) => settings.update({ openaiModel: (e.target as HTMLInputElement).value })}
          placeholder="llama3, mistral, etc."
          class="model-input"
        />
      {:else}
        <select
          id="ai-model-select"
          value={$settings.openaiModel || ''}
          onchange={(e) => settings.update({ openaiModel: (e.target as HTMLSelectElement).value })}
        >
          {#each getDirectModels($settings.aiProvider) as model}
            <option value={model.id}>{model.label}</option>
          {/each}
        </select>
      {/if}
      <button
        class="health-dot health-{apiHealth}"
        onclick={checkApiHealth}
        title={apiHealth === 'ok' ? $t('ai_health_ok') : apiHealth === 'error' ? $t('ai_health_error') : apiHealth === 'checking' ? $t('ai_health_checking') : $t('ai_health_unknown')}
        aria-label={apiHealth === 'ok' ? $t('ai_health_ok') : apiHealth === 'error' ? $t('ai_health_error') : apiHealth === 'checking' ? $t('ai_health_checking') : $t('ai_health_unknown')}
      ></button>
    </div>
    {#if !$settings.openaiApiKey}
      <p class="warning">{$t('ai_no_api_key')}</p>
    {/if}
  </div>

  <div class="mode-tabs">
    <button class="mode-tab" class:active={activeMode === 'chat'} onclick={() => (activeMode = 'chat')}>{$t('ai_tab_chat')}</button>
    <button class="mode-tab" class:active={activeMode === 'quick'} onclick={() => (activeMode = 'quick')}>{$t('ai_tab_quick')}</button>
  </div>

  {#if error}<div class="message error">{error}</div>{/if}
  {#if successMessage}<div class="message success">{successMessage}</div>{/if}

  {#if activeMode === 'chat'}
    <ChatPanel
      {currentConversation}
      {conversations}
      {chatLoading}
      {selectedFolder}
      onsend={sendChatMessage}
      onnewconversation={newConversation}
      onswitchconversation={(id) => { chatStore.switchConversation(id); cachedEmails = []; }}
      ondeleteconversation={(id) => chatStore.deleteConversation(id)}
      onclearfolder={onclearfolder}
      onacceptfolder={acceptFolderProposal}
      onacceptallfolder={acceptAllFolders}
      onacceptmove={acceptMoveProposal}
      onacceptallmoves={acceptAllMoves}
      onacceptrule={acceptRuleProposal}
      oneditrule={editRuleProposal}
      onacceptallrules={acceptAllRules}
      onaccepttemplate={acceptTemplateProposal}
      onacceptalltemplates={acceptAllTemplates}
      onacceptconsolidation={acceptConsolidationProposal}
      onacceptallconsolidations={acceptAllConsolidations}
    />
  {:else}
    <QuickPanel
      {loading}
      {batchLoading}
      {batchProgress}
      {accountList}
      {suggestions}
      onanalyze={analyzeEmails}
      onanalyzeall={analyzeAllEmails}
      ongeneratefromdescription={generateFromDescription}
      onaccept={acceptSuggestion}
      onedit={editSuggestion}
      ondiscard={discardSuggestion}
      onbatchcancel={() => { batchCancelled = true; }}
    />
  {/if}

  <RuleEditor
    show={showEditor}
    rule={editingRule}
    {folders}
    {tags}
    templates={$templates}
    onsave={handleEditorSave}
    onclose={() => { showEditor = false; editingRule = null; }}
  />

  <Toast
    message={undoToast.message}
    type="success"
    show={undoToast.show}
    actionLabel={$t('ai_undo_label')}
    onaction={handleUndo}
    ondismiss={() => { if (undoToast.timerId) clearTimeout(undoToast.timerId); undoToast = { show: false, message: '', undoFn: null, timerId: null }; }}
    duration={UNDO_DURATION}
  />
</div>

<style>
  .ai-page { display: flex; flex-direction: column; gap: 12px; height: 100%; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .header h3 { margin: 0; font-size: 15px; }
  .model-selector {
    display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary, #666);
  }
  .model-selector label { white-space: nowrap; }
  .model-selector select, .model-selector .model-input {
    padding: 4px 8px; border: 1px solid var(--border-color, #ccc); border-radius: 4px;
    font-size: 12px; font-family: inherit; background: var(--bg-secondary, #f0f0f4); color: inherit;
  }
  .model-input { width: 160px; }
  .health-dot {
    width: 10px; height: 10px; border-radius: 50%; border: none; cursor: pointer;
    flex-shrink: 0; padding: 0;
  }
  .health-unknown { background: #bbb; }
  .health-checking { background: #ffc107; animation: pulse-dot 1s infinite; }
  .health-ok { background: #4caf50; }
  .health-error { background: #f44336; }
  @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .warning {
    margin: 4px 0 0 0; font-size: 12px; color: #cd411d;
    background: #fff3e0; padding: 8px 12px; border-radius: 6px; border: 1px solid #ffcc80;
  }

  .mode-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border-color, #e0e0e6); }
  .mode-tab {
    padding: 8px 16px; background: none; border: none; border-bottom: 2px solid transparent;
    cursor: pointer; font-size: 13px; font-family: inherit; color: var(--text-secondary, #666);
    transition: color 0.15s, border-color 0.15s;
  }
  .mode-tab:hover { color: var(--text-color, #15141a); }
  .mode-tab.active { color: var(--primary-color, #0060df); border-bottom-color: var(--primary-color, #0060df); font-weight: 600; }

  .message { padding: 10px 14px; border-radius: 6px; font-size: 13px; }
  .message.error { background: #ffeef0; border: 1px solid #ffa4a2; color: #c62828; }
  .message.success { background: #e8f5e9; border: 1px solid #a5d6a7; color: #2e7d32; }

  @media (prefers-color-scheme: dark) {
    .warning { background: #332d00; border-color: #8d6e00; color: #ffb74d; }
    .message.error { background: #4a1c1c; border-color: #7f2020; color: #ef9a9a; }
    .message.success { background: #1b3320; border-color: #2e5e3e; color: #81c784; }
    .model-selector select { background: #1c1b22; border-color: #4a4a5a; }
  }
</style>
