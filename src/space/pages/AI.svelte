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
    ChatMessage,
    FolderProposal,
    MoveProposal,
    RuleProposal,
  } from '../../lib/services/openai';
  import { OPENAI_MODELS, OPENAI_DIRECT_MODELS, ANTHROPIC_DIRECT_MODELS, GOOGLE_DIRECT_MODELS } from '../../lib/utils/constants';
  import type { AiProvider } from '../../types/settings';
  import { t, locale } from '../../lib/i18n';
  import type { Translations } from '../../lib/i18n/types';
  const openrouterProviders = [...new Set(OPENAI_MODELS.map(m => m.provider))];

  function getDirectModels(provider: AiProvider) {
    switch (provider) {
      case 'openai': return OPENAI_DIRECT_MODELS;
      case 'anthropic': return ANTHROPIC_DIRECT_MODELS;
      case 'google': return GOOGLE_DIRECT_MODELS;
      default: return [];
    }
  }
  import { renderMarkdown } from '../../lib/utils/markdown';
  import { chatStore, activeConversation, allConversations, type StoredDisplayMessage, type ChatConversation } from '../../lib/stores/chat';

  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);
  t.subscribe((fn) => (T = fn));
  let currentLocale = $state('es');
  locale.subscribe((l) => (currentLocale = l));
  import Toast from '../../lib/components/Toast.svelte';
  import Button from '../../lib/components/Button.svelte';
  import RuleEditor from '../components/RuleEditor.svelte';
  import ChatWelcome from '../components/ChatWelcome.svelte';
  import ProposalBlock from '../components/ProposalBlock.svelte';
  import FolderTree from '../components/FolderTree.svelte';

  declare const browser: any;

  let currentSettings = $state<any>({});
  let currentRules = $state<Rule[]>([]);
  let currentTemplates = $state<ResponseTemplate[]>([]);

  settings.subscribe((v) => (currentSettings = v));
  rules.subscribe((v) => (currentRules = v));
  templates.subscribe((v) => (currentTemplates = v));

  // Shared state
  let loading = $state(false);
  let error = $state('');
  let successMessage = $state('');

  // API health check
  let apiHealth = $state<'unknown' | 'checking' | 'ok' | 'error'>('unknown');

  async function checkApiHealth() {
    if (!currentSettings.openaiApiKey) {
      apiHealth = 'error';
      return;
    }
    apiHealth = 'checking';
    try {
      const ok = await testConnection(currentSettings.openaiApiKey, currentSettings.openaiModel || 'openai/gpt-4o-mini', currentSettings.aiProvider || 'openrouter', currentSettings.customBaseUrl);
      apiHealth = ok ? 'ok' : 'error';
    } catch {
      apiHealth = 'error';
    }
  }

  // Check health on mount and when API key/model changes
  $effect(() => {
    const key = currentSettings.openaiApiKey;
    const model = currentSettings.openaiModel;
    if (key) {
      checkApiHealth();
    } else {
      apiHealth = 'unknown';
    }
  });

  // Lazy-load folder tree when panel opens
  $effect(() => {
    if (showFolderTree && folderTreeRef) {
      folderTreeRef.loadTree();
    }
  });

  // Rule editor state
  let showEditor = $state(false);
  let editingRule = $state<Rule | null>(null);
  let folders = $state<any[]>([]);
  let tags = $state<any[]>([]);
  let folderInfos = $state<FolderInfo[]>([]);
  let tagInfos = $state<TagInfo[]>([]);
  let cachedEmails = $state<EmailSummary[]>([]);

  // Chat state (persisted via chatStore)
  let currentConversation = $state<ChatConversation>({ id: '', title: '', createdAt: 0, displayMessages: [], apiHistory: [] });
  let conversations = $state<ChatConversation[]>([]);
  activeConversation.subscribe((v) => (currentConversation = v));
  allConversations.subscribe((v) => (conversations = v));

  let chatMessages = $derived(currentConversation.displayMessages);
  let chatHistory = $derived(currentConversation.apiHistory);
  let chatInput = $state('');
  let chatLoading = $state(false);
  let chatContainerEl: HTMLDivElement | undefined = $state(undefined);
  let showConversationList = $state(false);
  let showFolderTree = $state(false);
  let folderTreeRef: FolderTree | undefined = $state(undefined);
  let selectedFolder = $state<{ id: string; name: string; path: string } | null>(null);

  // Quick generate state
  let description = $state('');
  let suggestions = $state<RuleSuggestion[]>([]);

  // Batch analysis state
  let batchLoading = $state(false);
  let batchCancelled = $state(false);
  let batchProgress = $state<{ current: number; total: number; processed: number } | null>(null);
  let accountList = $state<Array<{ id: string; name: string; email: string }>>([]);
  let selectedAccountId = $state<string>('');
  let batchLimit = $state(500);
  let skipAnalyzed = $state(true);

  // Active tab
  let activeMode = $state<'chat' | 'quick'>('chat');

  // Map of NEW:FolderName -> real folder ID after creation
  let createdFolderMap = $state<Record<string, string>>({});

  // Undo state
  let undoToast = $state<{
    show: boolean;
    message: string;
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
      try {
        await undoToast.undoFn();
      } catch (err: any) {
        error = T('ai_error_undo', { msg: err.message });
      }
    }
    undoToast = { show: false, message: '', undoFn: null, timerId: null };
  }

  async function loadMetadata() {
    try {
      const data = await browser.runtime.sendMessage({ type: 'GET_FOLDERS_AND_TAGS' });
      folderInfos = data.folders || [];
      tagInfos = data.tags || [];
      folders = await browser.runtime.sendMessage({ type: 'GET_FOLDERS' });
      tags = await browser.runtime.sendMessage({ type: 'GET_TAGS' });
    } catch {
      folderInfos = []; tagInfos = []; folders = []; tags = [];
    }
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

  // Load account list for batch selector
  (async () => {
    try {
      const accounts = await browser.runtime.sendMessage({ type: 'GET_ACCOUNT_INFO' });
      accountList = accounts || [];
      if (accountList.length > 0) selectedAccountId = accountList[0].id;
    } catch { /* ignore */ }
  })();

  function clearMessages() { error = ''; successMessage = ''; }

  function checkApiKey(): boolean {
    if (!currentSettings.openaiApiKey) {
      error = T('ai_error_no_api_key');
      return false;
    }
    return true;
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (chatContainerEl) chatContainerEl.scrollTop = chatContainerEl.scrollHeight;
    }, 50);
  }

  function showSuccess(msg: string) {
    successMessage = msg;
    setTimeout(() => (successMessage = ''), 3000);
  }

  function handleFolderSelect(folderId: string, folderName: string, folderPath: string) {
    if (selectedFolder?.id === folderId) {
      selectedFolder = null; // deselect if already selected
    } else {
      selectedFolder = { id: folderId, name: folderName, path: folderPath };
    }
  }

  // --- Chat functions ---

  async function sendChatMessage(text?: string) {
    let msg = text || chatInput.trim();
    if (!msg) return;
    if (!checkApiKey()) return;

    // Prepend folder context if a folder is selected
    if (selectedFolder) {
      msg = `[${T('ai_folder_context')}: ${selectedFolder.name} (${selectedFolder.path})]\n${msg}`;
    }

    chatInput = '';
    clearMessages();

    chatStore.addUserMessage(msg);
    scrollToBottom();

    chatLoading = true;

    try {
      const emails = await loadEmails();
      await loadMetadata();

      // Use updated apiHistory from store (includes the user message we just added)
      const response = await chatWithAssistant(
        currentConversation.apiHistory, folderInfos, tagInfos, currentRules, emails,
        currentSettings.openaiApiKey,
        currentSettings.openaiModel || 'openai/gpt-4o-mini',
        currentSettings.aiProvider || 'openrouter',
        currentSettings.customBaseUrl,
      );

      chatStore.addAssistantMessage(
        response.message,
        response.folderProposals,
        response.ruleProposals,
        response.moveProposals,
      );
      scrollToBottom();
    } catch (err: any) {
      error = T('ai_error_generic', { msg: err.message || T('ai_error_openrouter') });
    } finally {
      chatLoading = false;
    }
  }

  function handleChatKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  }

  // --- Folder/Rule proposal handlers ---

  function resolveParentFolderId(parentId: string): string {
    if (parentId.startsWith('NEW:') && createdFolderMap[parentId]) {
      return createdFolderMap[parentId];
    }
    return parentId;
  }

  async function acceptFolderProposal(msgIdx: number, proposalIdx: number, proposal: FolderProposal) {
    try {
      const resolvedParentId = resolveParentFolderId(proposal.parentFolderId);
      if (resolvedParentId.startsWith('NEW:')) {
        error = T('ai_error_parent_folder', { parent: resolvedParentId.replace('NEW:', ''), name: proposal.name });
        return;
      }

      const result = await browser.runtime.sendMessage({
        type: 'CREATE_FOLDER', parentFolderId: resolvedParentId, folderName: proposal.name,
      });

      if (result.success) {
        const folderId = result.folder.id;
        createdFolderMap[`NEW:${proposal.name}`] = folderId;
        createdFolderMap = { ...createdFolderMap };
        chatStore.markFolderAccepted(msgIdx, proposalIdx);
        await loadMetadata();
        showUndoToast(T('ai_success_folder_created', { name: proposal.name }), async () => {
          await browser.runtime.sendMessage({ type: 'DELETE_FOLDER', folderId });
          chatStore.unmarkFolderAccepted(msgIdx, proposalIdx);
          delete createdFolderMap[`NEW:${proposal.name}`];
          createdFolderMap = { ...createdFolderMap };
          await loadMetadata();
          showSuccess(T('ai_success_folder_undo', { name: proposal.name }));
        });
      } else {
        const errMsg: string = result.error || '';
        if (errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('ya existe')) {
          await loadMetadata();
          const existing = folderInfos.find(f => f.name === proposal.name && f.path.includes(proposal.name));
          if (existing) {
            createdFolderMap[`NEW:${proposal.name}`] = existing.id;
            createdFolderMap = { ...createdFolderMap };
            chatStore.markFolderAccepted(msgIdx, proposalIdx);
            showSuccess(T('ai_success_folder_existed', { name: proposal.name }));
          } else {
            error = T('ai_error_folder_id', { name: proposal.name });
          }
        } else {
          error = T('ai_error_folder_create', { msg: errMsg });
        }
      }
    } catch (err: any) { error = T('ai_error_generic', { msg: err.message }); }
  }

  function acceptRuleProposal(msgIdx: number, proposalIdx: number, proposal: RuleProposal) {
    const rule = { ...proposal.rule };
    rule.actions = rule.actions.map(a => {
      if (a.folderId && a.folderId.startsWith('NEW:') && createdFolderMap[a.folderId]) {
        return { ...a, folderId: createdFolderMap[a.folderId] };
      }
      return a;
    });
    rules.addRule(rule);
    chatStore.markRuleAccepted(msgIdx, proposalIdx);
    const ruleId = rule.id;
    const ruleName = rule.name;
    showUndoToast(T('ai_success_rule_saved', { name: ruleName }), async () => {
      rules.deleteRule(ruleId);
      chatStore.unmarkRuleAccepted(msgIdx, proposalIdx);
      showSuccess(T('ai_success_rule_undo', { name: ruleName }));
    });
  }

  function editRuleProposal(proposal: RuleProposal) {
    const rule = { ...proposal.rule };
    rule.actions = rule.actions.map(a => {
      if (a.folderId && a.folderId.startsWith('NEW:') && createdFolderMap[a.folderId]) {
        return { ...a, folderId: createdFolderMap[a.folderId] };
      }
      return a;
    });
    editingRule = rule;
    showEditor = true;
  }

  async function acceptAllFolders(msgIdx: number, proposals: FolderProposal[]) {
    for (let i = 0; i < proposals.length; i++) {
      const msg = chatMessages[msgIdx];
      if (!msg.acceptedFolders?.includes(i)) {
        await acceptFolderProposal(msgIdx, i, proposals[i]);
      }
    }
  }

  function acceptAllRules(msgIdx: number, proposals: RuleProposal[]) {
    proposals.forEach((p, i) => {
      const msg = chatMessages[msgIdx];
      if (!msg.acceptedRules?.includes(i)) acceptRuleProposal(msgIdx, i, p);
    });
  }

  async function acceptMoveProposal(msgIdx: number, proposalIdx: number, proposal: MoveProposal) {
    try {
      const result = await browser.runtime.sendMessage({
        type: 'MOVE_FOLDER_CONTENTS',
        sourceFolderId: proposal.sourceFolderId,
        destFolderId: proposal.destFolderId,
        deleteSource: proposal.deleteSource,
      });

      if (result.success) {
        chatStore.markMoveAccepted(msgIdx, proposalIdx);
        await loadMetadata();
        const movedCount = result.movedCount || 0;
        const srcName = proposal.sourceFolderPath.split('/').pop() || proposal.sourceFolderPath;
        const destName = proposal.destFolderPath.split('/').pop() || proposal.destFolderPath;
        showUndoToast(
          T('ai_success_move_done', { count: movedCount, source: srcName, dest: destName }),
          async () => {
            // Undo: move emails back (dest → source)
            // If source was deleted, we can't easily undo — just unmark
            if (!proposal.deleteSource) {
              await browser.runtime.sendMessage({
                type: 'MOVE_FOLDER_CONTENTS',
                sourceFolderId: proposal.destFolderId,
                destFolderId: proposal.sourceFolderId,
                deleteSource: false,
              });
            }
            chatStore.unmarkMoveAccepted(msgIdx, proposalIdx);
            await loadMetadata();
            showSuccess(T('ai_success_move_undo'));
          },
        );
      } else {
        error = T('ai_error_move', { msg: result.error || '' });
      }
    } catch (err: any) {
      error = T('ai_error_move', { msg: err.message });
    }
  }

  async function acceptAllMoves(msgIdx: number, proposals: MoveProposal[]) {
    for (let i = 0; i < proposals.length; i++) {
      const msg = chatMessages[msgIdx];
      if (!msg.acceptedMoves?.includes(i)) {
        await acceptMoveProposal(msgIdx, i, proposals[i]);
      }
    }
  }

  function clearChat() {
    chatStore.clear();
    createdFolderMap = {};
    cachedEmails = [];
  }

  function newConversation() {
    chatStore.newConversation();
    createdFolderMap = {};
    cachedEmails = [];
    showConversationList = false;
  }

  function switchConversation(id: string) {
    chatStore.switchConversation(id);
    createdFolderMap = {};
    cachedEmails = [];
    showConversationList = false;
  }

  function deleteConversation(id: string) {
    if (!confirm(T('ai_delete_conversation_confirm'))) return;
    chatStore.deleteConversation(id);
    createdFolderMap = {};
  }

  function formatDate(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleDateString(currentLocale === 'en' ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  // --- Quick generate functions ---

  async function analyzeEmails() {
    clearMessages();
    if (!checkApiKey()) return;
    loading = true;
    suggestions = [];
    try {
      const emails = await browser.runtime.sendMessage({ type: 'GET_RECENT_EMAILS' });
      if (!emails || emails.length === 0) { error = T('ai_error_no_emails'); loading = false; return; }
      suggestions = await generateRulesFromEmails(emails, folderInfos, tagInfos, currentRules, currentSettings.openaiApiKey, currentSettings.openaiModel || 'openai/gpt-4o-mini', currentSettings.aiProvider || 'openrouter', currentSettings.customBaseUrl);
      if (suggestions.length === 0) error = T('ai_error_no_patterns');
    } catch (err: any) { error = T('ai_error_generic', { msg: err.message || T('ai_error_openrouter') }); }
    finally { loading = false; }
  }

  async function analyzeAllEmails() {
    clearMessages();
    if (!checkApiKey()) return;
    batchLoading = true;
    batchCancelled = false;
    batchProgress = null;
    suggestions = [];

    try {
      // Fetch email headers for selected account (fast, no body), newest first
      const result = await browser.runtime.sendMessage({
        type: 'GET_ALL_EMAILS_HEADERS',
        accountId: selectedAccountId || undefined,
        limit: batchLimit > 0 ? batchLimit : undefined,
        skipAnalyzed,
      });
      const allEmails = result?.emails || [];
      if (result?.skippedAnalyzed > 0) {
        showSuccess(T('ai_batch_skipped_count', { count: result.skippedAnalyzed }));
      }
      if (allEmails.length === 0) { error = T('ai_batch_no_emails'); batchLoading = false; return; }

      const BATCH_SIZE = 64;
      const totalBatches = Math.ceil(allEmails.length / BATCH_SIZE);
      const allSuggestions: RuleSuggestion[] = [];

      for (let i = 0; i < totalBatches; i++) {
        if (batchCancelled) break;

        const batch = allEmails.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        batchProgress = { current: i + 1, total: totalBatches, processed: i * BATCH_SIZE };

        try {
          const batchSuggestions = await generateRulesFromEmails(
            batch, folderInfos, tagInfos, currentRules,
            currentSettings.openaiApiKey,
            currentSettings.openaiModel || 'openai/gpt-4o-mini',
            currentSettings.aiProvider || 'openrouter',
            currentSettings.customBaseUrl,
          );
          // Deduplicate: skip suggestions with same name as existing ones
          for (const s of batchSuggestions) {
            const isDuplicate = allSuggestions.some(existing =>
              existing.rule.name.toLowerCase() === s.rule.name.toLowerCase()
            );
            if (!isDuplicate) allSuggestions.push(s);
          }
        } catch (err: any) {
          // Log batch error but continue with next batch
          console.error(`[SMM] Batch ${i + 1} error:`, err);
        }
      }

      suggestions = allSuggestions;
      const processed = batchCancelled
        ? (batchProgress?.current || 0) * BATCH_SIZE
        : allEmails.length;

      // Mark analyzed emails with tag so they can be skipped next time
      const analyzedIds = allEmails.slice(0, processed).map((e: any) => e.id).filter(Boolean);
      if (analyzedIds.length > 0) {
        batchProgress = { current: 0, total: 0, processed: 0 }; // show marking state
        await browser.runtime.sendMessage({
          type: 'MARK_EMAILS_ANALYZED',
          messageIds: analyzedIds,
        });
      }

      // Switch to chat mode with results as a conversation
      batchLoading = false;
      batchProgress = null;
      activeMode = 'chat';
      newConversation();

      const userMsg = T('ai_batch_chat_user', { count: processed });
      chatStore.addUserMessage(userMsg);

      if (allSuggestions.length > 0) {
        const ruleProposals: RuleProposal[] = allSuggestions.map(s => ({
          rule: s.rule,
          description: s.explanation,
        }));
        const assistantMsg = T('ai_batch_chat_result', {
          total: processed,
          batches: batchCancelled ? (batchProgress?.current || totalBatches) : totalBatches,
          rules: allSuggestions.length,
        });
        chatStore.addAssistantMessage(assistantMsg, [], ruleProposals);
      } else {
        chatStore.addAssistantMessage(T('ai_batch_chat_no_results', { total: processed }), [], []);
      }
      scrollToBottom();
    } catch (err: any) {
      error = T('ai_error_generic', { msg: err.message || T('ai_error_openrouter') });
    } finally {
      batchLoading = false;
      batchProgress = null;
    }
  }

  async function generateFromDescription() {
    clearMessages();
    if (!checkApiKey()) return;
    if (!description.trim()) { error = T('ai_error_description_empty'); return; }
    loading = true;
    suggestions = [];
    try {
      suggestions = await generateRuleFromDescription(description.trim(), folderInfos, tagInfos, currentRules, currentSettings.openaiApiKey, currentSettings.openaiModel || 'openai/gpt-4o-mini', currentSettings.aiProvider || 'openrouter', currentSettings.customBaseUrl);
      if (suggestions.length === 0) error = T('ai_error_no_rule');
    } catch (err: any) { error = T('ai_error_generic', { msg: err.message || T('ai_error_openrouter') }); }
    finally { loading = false; }
  }

  function acceptSuggestion(suggestion: RuleSuggestion) {
    rules.addRule(suggestion.rule);
    suggestions = suggestions.filter((s) => s !== suggestion);
    showSuccess(T('ai_success_accepted', { name: suggestion.rule.name }));
  }

  function editSuggestion(suggestion: RuleSuggestion) {
    editingRule = { ...suggestion.rule };
    showEditor = true;
  }

  function discardSuggestion(suggestion: RuleSuggestion) {
    suggestions = suggestions.filter((s) => s !== suggestion);
  }

  function handleEditorSave(rule: Rule) {
    rules.addRule(rule);
    showEditor = false;
    editingRule = null;
    suggestions = suggestions.filter((s) => s.rule.id !== rule.id);
    showSuccess(T('ai_success_accepted', { name: rule.name }));
  }

  function confidenceLabel(c: number): string { return c >= 0.8 ? T('ai_confidence_high') : c >= 0.5 ? T('ai_confidence_medium') : T('ai_confidence_low'); }
  function confidenceClass(c: number): string { return c >= 0.8 ? 'high' : c >= 0.5 ? 'medium' : 'low'; }
</script>

<div class="ai-page">
  <div class="header">
    <h3>{T('ai_title')}</h3>
    <div class="model-selector">
      <label for="ai-model-select">{T('ai_model_label')}</label>
      {#if currentSettings.aiProvider === 'openrouter' || !currentSettings.aiProvider}
        <select
          id="ai-model-select"
          value={currentSettings.openaiModel || 'openai/gpt-4o-mini'}
          onchange={(e) => {
            const val = (e.target as HTMLSelectElement).value;
            settings.update({ openaiModel: val });
          }}
        >
          {#each openrouterProviders as provider}
            <optgroup label={provider}>
              {#each OPENAI_MODELS.filter(m => m.provider === provider) as model}
                <option value={model.id}>{model.label}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
      {:else if currentSettings.aiProvider === 'custom'}
        <input
          id="ai-model-select"
          type="text"
          value={currentSettings.openaiModel || ''}
          onchange={(e) => {
            const val = (e.target as HTMLInputElement).value;
            settings.update({ openaiModel: val });
          }}
          placeholder="llama3, mistral, etc."
          class="model-input"
        />
      {:else}
        <select
          id="ai-model-select"
          value={currentSettings.openaiModel || ''}
          onchange={(e) => {
            const val = (e.target as HTMLSelectElement).value;
            settings.update({ openaiModel: val });
          }}
        >
          {#each getDirectModels(currentSettings.aiProvider) as model}
            <option value={model.id}>{model.label}</option>
          {/each}
        </select>
      {/if}
      <button
        class="health-dot health-{apiHealth}"
        onclick={checkApiHealth}
        title={apiHealth === 'ok' ? T('ai_health_ok') : apiHealth === 'error' ? T('ai_health_error') : apiHealth === 'checking' ? T('ai_health_checking') : T('ai_health_unknown')}
      ></button>
    </div>
    {#if !currentSettings.openaiApiKey}
      <p class="warning">{T('ai_no_api_key')}</p>
    {/if}
  </div>

  <div class="mode-tabs">
    <button class="mode-tab" class:active={activeMode === 'chat'} onclick={() => (activeMode = 'chat')}>{T('ai_tab_chat')}</button>
    <button class="mode-tab" class:active={activeMode === 'quick'} onclick={() => (activeMode = 'quick')}>{T('ai_tab_quick')}</button>
  </div>

  {#if error}<div class="message error">{error}</div>{/if}
  {#if successMessage}<div class="message success">{successMessage}</div>{/if}

  {#if activeMode === 'chat'}
    <div class="conversation-bar">
      <div class="conversation-current">
        <button class="conv-toggle" onclick={() => { showConversationList = !showConversationList; }} title={T('ai_view_conversations')}>
          <span class="conv-title">{currentConversation.title}</span>
          <span class="conv-arrow">{showConversationList ? '\u25B2' : '\u25BC'}</span>
        </button>
        <button class="conv-action-btn" onclick={newConversation} title={T('ai_new_conversation')}>+</button>
        <button class="conv-tree-btn" class:active={showFolderTree} onclick={() => { showFolderTree = !showFolderTree; }} title={T('ai_view_folders')}>{'\u229E'}</button>
      </div>
      {#if showConversationList}
        <div class="conversation-list">
          {#each conversations as conv}
            <div class="conv-item" class:active={conv.id === currentConversation.id}>
              <button class="conv-item-btn" onclick={() => switchConversation(conv.id)}>
                <span class="conv-item-title">{conv.title}</span>
                <span class="conv-item-date">{formatDate(conv.createdAt)}</span>
                <span class="conv-item-count">{conv.displayMessages.length} msgs</span>
              </button>
              {#if conversations.length > 1}
                <button class="conv-delete-btn" onclick={() => deleteConversation(conv.id)} title={T('ai_delete_conversation_title')}>&times;</button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="chat-layout" class:with-sidebar={showFolderTree}>
      {#if showFolderTree}
        <div class="folder-sidebar">
          <FolderTree bind:this={folderTreeRef} onfolderselect={handleFolderSelect} selectedFolderId={selectedFolder?.id} />
        </div>
      {/if}

      <div class="chat-section">
        {#if chatMessages.length === 0}
          <ChatWelcome onaction={sendChatMessage} />
        {:else}
          <div class="chat-messages" bind:this={chatContainerEl}>
            {#each chatMessages as msg, msgIdx}
              <div class="chat-bubble {msg.role}">
                <div class="bubble-label">{msg.role === 'assistant' ? T('ai_bubble_assistant') : T('ai_bubble_user')}</div>
                <div class="bubble-content markdown-content">
                  {@html renderMarkdown(msg.content)}
                </div>

                {#if msg.folderProposals && msg.folderProposals.length > 0}
                  <ProposalBlock
                    type="folders"
                    folderProposals={msg.folderProposals}
                    acceptedSet={new Set(msg.acceptedFolders || [])}
                    onacceptfolder={(idx, fp) => acceptFolderProposal(msgIdx, idx, fp)}
                    onacceptall={() => acceptAllFolders(msgIdx, msg.folderProposals || [])}
                  />
                {/if}

                {#if msg.moveProposals && msg.moveProposals.length > 0}
                  <ProposalBlock
                    type="moves"
                    moveProposals={msg.moveProposals}
                    acceptedSet={new Set(msg.acceptedMoves || [])}
                    onacceptmove={(idx, mp) => acceptMoveProposal(msgIdx, idx, mp)}
                    onacceptall={() => acceptAllMoves(msgIdx, msg.moveProposals || [])}
                  />
                {/if}

                {#if msg.ruleProposals && msg.ruleProposals.length > 0}
                  <ProposalBlock
                    type="rules"
                    ruleProposals={msg.ruleProposals}
                    acceptedSet={new Set(msg.acceptedRules || [])}
                    onacceptrule={(idx, rp) => acceptRuleProposal(msgIdx, idx, rp)}
                    oneditrule={editRuleProposal}
                    onacceptall={() => acceptAllRules(msgIdx, msg.ruleProposals || [])}
                  />
                {/if}
              </div>
            {/each}

            {#if chatLoading}
              <div class="chat-bubble assistant">
                <div class="bubble-label">{T('ai_bubble_assistant')}</div>
                <div class="typing-indicator"><span></span><span></span><span></span></div>
              </div>
            {/if}
          </div>

          {#if selectedFolder}
            <div class="folder-context-bar">
              <span class="folder-context-label">{T('ai_folder_context_label')}</span>
              <span class="folder-context-name">&#128193; {selectedFolder.name}</span>
              <button class="folder-context-clear" onclick={() => (selectedFolder = null)} title={T('ai_folder_context_clear')}>&times;</button>
            </div>
          {/if}

          <div class="chat-input-area">
            <button class="clear-chat-btn" onclick={newConversation} title={T('ai_new_conversation')}>&#10227;</button>
            <textarea
              class="chat-input"
              bind:value={chatInput}
              placeholder={T('ai_chat_placeholder')}
              rows="2"
              disabled={chatLoading}
              onkeydown={handleChatKeydown}
            ></textarea>
            <Button variant="primary" onclick={() => sendChatMessage()} disabled={chatLoading || !chatInput.trim()}>{T('common_send')}</Button>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Quick Generate Mode -->
    <section class="section">
      <h4>{T('ai_quick_analyze_title')}</h4>
      <p class="description">{T('ai_quick_analyze_desc')}</p>
      <Button variant="primary" onclick={analyzeEmails} disabled={loading}>
        {loading ? T('ai_quick_analyzing') : T('ai_quick_analyze_btn')}
      </Button>
    </section>

    <section class="section batch-section">
      <h4>{T('ai_batch_title')}</h4>
      <p class="description">{T('ai_batch_desc')}</p>
      <div class="batch-options">
        {#if accountList.length > 0}
          <div class="batch-account-selector">
            <label for="batch-account-select">{T('ai_batch_account')}</label>
            <select
              id="batch-account-select"
              bind:value={selectedAccountId}
              disabled={batchLoading}
            >
              {#each accountList as acc}
                <option value={acc.id}>{acc.name || acc.email}</option>
              {/each}
            </select>
          </div>
        {/if}
        <div class="batch-limit-selector">
          <label for="batch-limit-input">{T('ai_batch_limit')}</label>
          <input
            id="batch-limit-input"
            type="number"
            min="10"
            max="10000"
            step="50"
            bind:value={batchLimit}
            disabled={batchLoading}
          />
          <span class="batch-limit-hint">{T('ai_batch_limit_hint')}</span>
        </div>
        <label class="batch-checkbox">
          <input type="checkbox" bind:checked={skipAnalyzed} disabled={batchLoading} />
          <span>{T('ai_batch_skip_analyzed')}</span>
          <span class="batch-limit-hint">{T('ai_batch_skip_analyzed_hint')}</span>
        </label>
      </div>
      {#if batchProgress}
        <div class="batch-progress">
          <div class="batch-progress-bar">
            <div class="batch-progress-fill" style="width: {Math.round((batchProgress.current / batchProgress.total) * 100)}%"></div>
          </div>
          <span class="batch-progress-text">{T('ai_batch_progress', { current: batchProgress.current, total: batchProgress.total, processed: batchProgress.processed })}</span>
        </div>
      {/if}
      <div class="batch-actions">
        <Button variant="primary" onclick={analyzeAllEmails} disabled={loading || batchLoading}>
          {batchLoading ? (batchProgress ? T('ai_batch_progress', { current: batchProgress.current, total: batchProgress.total, processed: batchProgress.processed }) : T('ai_batch_fetching')) : T('ai_batch_btn')}
        </Button>
        {#if batchLoading}
          <Button variant="danger" onclick={() => { batchCancelled = true; }}>{T('ai_batch_cancel')}</Button>
        {/if}
      </div>
    </section>

    <section class="section">
      <h4>{T('ai_quick_describe_title')}</h4>
      <p class="description">{T('ai_quick_describe_desc')}</p>
      <div class="input-row">
        <textarea bind:value={description} placeholder={T('ai_quick_describe_placeholder')} rows="3" disabled={loading}></textarea>
        <Button variant="primary" onclick={generateFromDescription} disabled={loading || !description.trim()}>
          {loading ? T('ai_quick_generating') : T('ai_quick_generate_btn')}
        </Button>
      </div>
    </section>

    {#if loading}
      <div class="loading"><div class="spinner"></div><span>{T('ai_quick_consulting')}</span></div>
    {/if}

    {#if suggestions.length > 0}
      <section class="section suggestions-section">
        <h4>{T('ai_suggestions_title')} ({suggestions.length})</h4>
        <div class="suggestion-list">
          {#each suggestions as suggestion}
            <div class="suggestion-card">
              <div class="suggestion-header">
                <span class="suggestion-name">{suggestion.rule.name}</span>
                <span class="confidence {confidenceClass(suggestion.confidence)}">
                  {T('ai_confidence_label', { level: confidenceLabel(suggestion.confidence), pct: Math.round(suggestion.confidence * 100) })}
                </span>
              </div>
              <p class="suggestion-explanation">{suggestion.explanation}</p>
              <div class="suggestion-details">
                <span class="detail-label">{T('ai_conditions_label')}</span>
                {#each suggestion.rule.conditions as cond}
                  <span class="detail-chip">{cond.field} {cond.operator} "{cond.value || (cond.boolValue ? T('common_yes') : T('common_no'))}"</span>
                {/each}
              </div>
              <div class="suggestion-details">
                <span class="detail-label">{T('ai_actions_label')}</span>
                {#each suggestion.rule.actions as act}
                  <span class="detail-chip">{act.type}{act.folderId ? ` -> ${act.folderId}` : ''}{act.tagKey ? ` -> ${act.tagKey}` : ''}</span>
                {/each}
              </div>
              <div class="suggestion-actions">
                <Button variant="primary" size="sm" onclick={() => acceptSuggestion(suggestion)}>{T('common_accept')}</Button>
                <Button size="sm" onclick={() => editSuggestion(suggestion)}>{T('common_edit')}</Button>
                <Button variant="danger" size="sm" onclick={() => discardSuggestion(suggestion)}>{T('common_discard')}</Button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  {/if}

  <RuleEditor
    show={showEditor}
    rule={editingRule}
    {folders}
    {tags}
    templates={currentTemplates}
    onsave={handleEditorSave}
    onclose={() => { showEditor = false; editingRule = null; }}
  />

  <Toast
    message={undoToast.message}
    type="success"
    show={undoToast.show}
    actionLabel={T('ai_undo_label')}
    onaction={handleUndo}
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

  /* Conversation bar */
  .conversation-bar { position: relative; }
  .conversation-current {
    display: flex; align-items: center; gap: 6px;
  }
  .conv-toggle {
    flex: 1; display: flex; align-items: center; justify-content: space-between;
    padding: 6px 10px; border: 1px solid var(--border-color, #e0e0e6); border-radius: 4px;
    background: var(--bg-secondary, #f0f0f4); cursor: pointer;
    font-size: 12px; font-family: inherit; color: var(--text-color, #15141a);
    text-align: left; min-width: 0;
  }
  .conv-toggle:hover { background: var(--bg-hover, #e0e0e6); }
  .conv-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .conv-arrow { font-size: 9px; flex-shrink: 0; margin-left: 6px; }
  .conv-action-btn {
    padding: 4px 10px; border: 1px solid var(--border-color, #e0e0e6); border-radius: 4px;
    background: var(--primary-color, #0060df); color: white; cursor: pointer;
    font-size: 14px; font-weight: 600; font-family: inherit; line-height: 1; flex-shrink: 0;
  }
  .conv-action-btn:hover { opacity: 0.9; }
  .conv-tree-btn {
    padding: 4px 8px; border: 1px solid var(--border-color, #e0e0e6); border-radius: 4px;
    background: var(--bg-secondary, #f0f0f4); cursor: pointer;
    font-size: 14px; font-weight: 700; line-height: 1; flex-shrink: 0;
    font-family: inherit; color: var(--text-secondary, #666);
    transition: background 0.15s, color 0.15s;
  }
  .conv-tree-btn:hover { background: var(--bg-hover, #e0e0e6); color: var(--text-color, #15141a); }
  .conv-tree-btn.active { background: var(--primary-color, #0060df); border-color: var(--primary-color, #0060df); color: white; }

  /* Chat + Folder sidebar layout */
  .chat-layout { display: flex; flex: 1; min-height: 0; gap: 0; }
  .chat-layout.with-sidebar { gap: 0; }
  .folder-sidebar {
    width: 260px; min-width: 200px; max-width: 320px;
    border-right: 1px solid var(--border-color, #e0e0e6);
    overflow-y: auto; flex-shrink: 0;
    animation: slideIn 0.15s ease-out;
  }
  @keyframes slideIn {
    from { opacity: 0; width: 0; }
    to { opacity: 1; width: 260px; }
  }

  /* Folder context bar above input */
  .folder-context-bar {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 10px; font-size: 11px;
    background: color-mix(in srgb, var(--primary-color, #0060df) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--primary-color, #0060df) 20%, transparent);
    border-radius: 4px;
  }
  .folder-context-label { color: var(--text-secondary, #666); font-weight: 500; }
  .folder-context-name { color: var(--primary-color, #0060df); font-weight: 600; }
  .folder-context-clear {
    margin-left: auto; border: none; background: none; cursor: pointer;
    font-size: 14px; color: var(--text-secondary, #999); padding: 0 2px; line-height: 1;
  }
  .folder-context-clear:hover { color: #c62828; }
  .conversation-list {
    position: absolute; top: 100%; left: 0; right: 0; z-index: 50;
    margin-top: 4px; background: var(--bg-primary, white);
    border: 1px solid var(--border-color, #e0e0e6); border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12); max-height: 260px; overflow-y: auto;
  }
  .conv-item {
    display: flex; align-items: center; border-bottom: 1px solid var(--border-color, #e0e0e6);
  }
  .conv-item:last-child { border-bottom: none; }
  .conv-item.active { background: var(--bg-hover, #e8e8ee); }
  .conv-item-btn {
    flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 8px 12px;
    border: none; background: none; cursor: pointer; text-align: left;
    font-family: inherit; color: var(--text-color, #15141a); min-width: 0;
  }
  .conv-item-btn:hover { background: var(--bg-hover, #e0e0e6); }
  .conv-item-title {
    font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .conv-item-date { font-size: 10px; color: var(--text-secondary, #666); }
  .conv-item-count { font-size: 10px; color: var(--text-secondary, #999); }
  .conv-delete-btn {
    padding: 4px 10px; border: none; background: none; cursor: pointer;
    font-size: 16px; color: var(--text-secondary, #999); flex-shrink: 0;
  }
  .conv-delete-btn:hover { color: #c62828; }

  .chat-section { flex: 1; display: flex; flex-direction: column; min-height: 0; }

  .chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 12px 0; min-height: 0; }
  .chat-bubble { max-width: 90%; padding: 10px 14px; border-radius: 10px; font-size: 13px; line-height: 1.5; }
  .chat-bubble.user { align-self: flex-end; background: var(--primary-color, #0060df); color: white; border-bottom-right-radius: 4px; }
  .chat-bubble.assistant { align-self: flex-start; background: var(--bg-secondary, #f9f9fb); border: 1px solid var(--border-color, #e0e0e6); border-bottom-left-radius: 4px; max-width: 95%; }
  .bubble-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; opacity: 0.7; }
  .chat-bubble.user .bubble-label { color: rgba(255,255,255,0.8); }
  .bubble-content { display: flex; flex-direction: column; gap: 2px; }
  .markdown-content :global(h3) { margin: 10px 0 4px 0; font-size: 14px; font-weight: 700; }
  .markdown-content :global(h4) { margin: 8px 0 4px 0; font-size: 13px; font-weight: 700; }
  .markdown-content :global(p) { margin: 2px 0; }
  .markdown-content :global(br) { display: block; content: ''; margin: 4px 0; }
  .markdown-content :global(ul), .markdown-content :global(ol) { margin: 4px 0; padding-left: 20px; }
  .markdown-content :global(li) { margin: 2px 0; }
  .markdown-content :global(code) { background: rgba(0,0,0,0.07); padding: 1px 5px; border-radius: 3px; font-size: 12px; font-family: monospace; }
  .markdown-content :global(pre) { background: rgba(0,0,0,0.06); padding: 8px 10px; border-radius: 6px; overflow-x: auto; margin: 6px 0; }
  .markdown-content :global(pre code) { background: none; padding: 0; }
  .markdown-content :global(strong) { font-weight: 700; }
  .markdown-content :global(em) { font-style: italic; }
  .chat-bubble.user .markdown-content :global(code) { background: rgba(255,255,255,0.2); }
  .chat-bubble.user .markdown-content :global(pre) { background: rgba(255,255,255,0.15); }

  .typing-indicator { display: flex; gap: 4px; padding: 4px 0; }
  .typing-indicator span { width: 8px; height: 8px; border-radius: 50%; background: var(--text-secondary, #666); animation: typing 1.2s infinite; }
  .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typing {
    0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
    30% { opacity: 1; transform: scale(1); }
  }

  .chat-input-area { display: flex; gap: 8px; align-items: flex-end; padding: 12px 0 0 0; border-top: 1px solid var(--border-color, #e0e0e6); }
  .clear-chat-btn {
    padding: 6px 8px; border: 1px solid var(--border-color, #e0e0e6); border-radius: 4px;
    background: var(--bg-primary, white); cursor: pointer; font-size: 16px; color: var(--text-secondary, #666);
    flex-shrink: 0; font-family: inherit; height: 36px; display: flex; align-items: center;
  }
  .clear-chat-btn:hover { background: var(--bg-hover, #e0e0e6); }
  .chat-input {
    flex: 1; padding: 8px 10px; border: 1px solid var(--border-color, #ccc); border-radius: 6px;
    font-size: 13px; font-family: inherit; resize: none; box-sizing: border-box;
  }
  .chat-input:focus { outline: none; border-color: var(--primary-color, #0060df); }

  .section { border: 1px solid var(--border-color, #e0e0e6); border-radius: 8px; padding: 16px; background: var(--bg-primary, white); }
  .section h4 { margin: 0 0 6px 0; font-size: 14px; font-weight: 600; }
  .description { margin: 0 0 12px 0; font-size: 12px; color: var(--text-secondary, #666); }
  .input-row { display: flex; flex-direction: column; gap: 8px; }
  .input-row textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border-color, #ccc); border-radius: 4px; font-size: 13px; font-family: inherit; box-sizing: border-box; resize: vertical; }
  .message { padding: 10px 14px; border-radius: 6px; font-size: 13px; }
  .message.error { background: #ffeef0; border: 1px solid #ffa4a2; color: #c62828; }
  .message.success { background: #e8f5e9; border: 1px solid #a5d6a7; color: #2e7d32; }
  .loading { display: flex; align-items: center; gap: 10px; padding: 16px; justify-content: center; color: var(--text-secondary, #666); font-size: 13px; }
  .spinner { width: 20px; height: 20px; border: 2px solid var(--border-color, #e0e0e6); border-top-color: var(--primary-color, #0060df); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .suggestions-section h4 { margin-bottom: 12px; }
  .suggestion-list { display: flex; flex-direction: column; gap: 10px; }
  .suggestion-card { border: 1px solid var(--border-color, #e0e0e6); border-radius: 6px; padding: 12px; background: var(--bg-secondary, #f9f9fb); }
  .suggestion-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .suggestion-name { font-weight: 600; font-size: 13px; }
  .confidence { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
  .confidence.high { background: #e8f5e9; color: #2e7d32; }
  .confidence.medium { background: #fff3e0; color: #e65100; }
  .confidence.low { background: #ffeef0; color: #c62828; }
  .suggestion-explanation { margin: 0 0 8px 0; font-size: 12px; color: var(--text-secondary, #666); }
  .suggestion-details { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-bottom: 6px; font-size: 11px; }
  .detail-label { font-weight: 500; color: var(--text-secondary, #666); }
  .detail-chip { background: var(--bg-hover, #e0e0e6); padding: 2px 8px; border-radius: 10px; font-size: 11px; }
  .suggestion-actions { display: flex; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-color, #e0e0e6); }

  /* Batch analysis */
  .batch-section { border-color: var(--primary-color, #0060df); border-style: dashed; }
  .batch-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
  .batch-account-selector {
    display: flex; align-items: center; gap: 6px; font-size: 12px;
  }
  .batch-account-selector label { white-space: nowrap; font-weight: 500; color: var(--text-secondary, #666); }
  .batch-account-selector select {
    flex: 1; padding: 4px 8px; border: 1px solid var(--border-color, #ccc); border-radius: 4px;
    font-size: 12px; font-family: inherit; background: var(--bg-secondary, #f0f0f4); color: inherit;
  }
  .batch-limit-selector {
    display: flex; align-items: center; gap: 6px; font-size: 12px;
  }
  .batch-limit-selector label { white-space: nowrap; font-weight: 500; color: var(--text-secondary, #666); }
  .batch-limit-selector input {
    width: 90px; padding: 4px 8px; border: 1px solid var(--border-color, #ccc); border-radius: 4px;
    font-size: 12px; font-family: inherit; background: var(--bg-secondary, #f0f0f4); color: inherit;
    text-align: center;
  }
  .batch-limit-hint { font-size: 11px; color: var(--text-secondary, #999); font-style: italic; }
  .batch-checkbox {
    display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;
  }
  .batch-checkbox input { margin: 0; cursor: pointer; }
  .batch-checkbox span { color: var(--text-secondary, #666); }
  .batch-progress { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
  .batch-progress-bar {
    width: 100%; height: 6px; background: var(--bg-hover, #e0e0e6);
    border-radius: 3px; overflow: hidden;
  }
  .batch-progress-fill {
    height: 100%; background: var(--primary-color, #0060df);
    border-radius: 3px; transition: width 0.3s ease;
  }
  .batch-progress-text { font-size: 11px; color: var(--text-secondary, #666); }
  .batch-actions { display: flex; gap: 8px; align-items: center; }

  @media (prefers-color-scheme: dark) {
    .warning { background: #332d00; border-color: #8d6e00; color: #ffb74d; }
    .message.error { background: #4a1c1c; border-color: #7f2020; color: #ef9a9a; }
    .message.success { background: #1b3320; border-color: #2e5e3e; color: #81c784; }
    .confidence.high { background: #1b4332; color: #95d5b2; }
    .confidence.medium { background: #332d00; color: #ffb74d; }
    .confidence.low { background: #4a1c1c; color: #ef9a9a; }
    .chat-input { background: var(--bg-secondary, #2b2a33); color: var(--text-color, #fbfbfe); }
    .model-selector select { background: #1c1b22; border-color: #4a4a5a; }
    .conv-toggle { background: #2b2a33; border-color: #4a4a5a; color: #fbfbfe; }
    .conv-toggle:hover { background: #38374a; }
    .conversation-list { background: #2b2a33; border-color: #4a4a5a; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
    .conv-item.active { background: #38374a; }
    .conv-item-btn:hover { background: #38374a; }
    .conv-item-btn { color: #fbfbfe; }
    .markdown-content :global(code) { background: rgba(255,255,255,0.1); }
    .markdown-content :global(pre) { background: rgba(255,255,255,0.08); }
  }
</style>
