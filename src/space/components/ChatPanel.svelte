<script lang="ts">
  import { t, locale } from '../../lib/i18n';
  import type {
    FolderProposal,
    MoveProposal,
    RuleProposal,
    TemplateProposal,
    RuleConsolidationProposal,
  } from '../../lib/services/openai';
  import type { ChatConversation, StoredDisplayMessage } from '../../lib/stores/chat';
  import { renderMarkdown } from '../../lib/utils/markdown';
  import Button from '../../lib/components/Button.svelte';
  import ConfirmDialog from '../../lib/components/ConfirmDialog.svelte';
  import ChatWelcome from './ChatWelcome.svelte';
  import ProposalBlock from './ProposalBlock.svelte';

  interface Props {
    currentConversation: ChatConversation;
    conversations: ChatConversation[];
    chatLoading: boolean;
    selectedFolder: { id: string; name: string; path: string } | null;
    onsend: (text?: string) => void;
    onnewconversation: () => void;
    onswitchconversation: (id: string) => void;
    ondeleteconversation: (id: string) => void;
    onclearfolder?: () => void;
    onacceptfolder: (msgIdx: number, proposalIdx: number, proposal: FolderProposal) => void;
    onacceptallfolder: (msgIdx: number, proposals: FolderProposal[]) => void;
    onacceptmove: (msgIdx: number, proposalIdx: number, proposal: MoveProposal) => void;
    onacceptallmoves: (msgIdx: number, proposals: MoveProposal[]) => void;
    onacceptrule: (msgIdx: number, proposalIdx: number, proposal: RuleProposal) => void;
    oneditrule: (proposal: RuleProposal) => void;
    onacceptallrules: (msgIdx: number, proposals: RuleProposal[]) => void;
    onaccepttemplate: (msgIdx: number, proposalIdx: number, proposal: TemplateProposal) => void;
    onacceptalltemplates: (msgIdx: number, proposals: TemplateProposal[]) => void;
    onacceptconsolidation: (msgIdx: number, proposalIdx: number, proposal: RuleConsolidationProposal) => void;
    onacceptallconsolidations: (msgIdx: number, proposals: RuleConsolidationProposal[]) => void;
  }

  let {
    currentConversation, conversations, chatLoading, selectedFolder,
    onsend, onnewconversation, onswitchconversation, ondeleteconversation, onclearfolder,
    onacceptfolder, onacceptallfolder, onacceptmove, onacceptallmoves,
    onacceptrule, oneditrule, onacceptallrules,
    onaccepttemplate, onacceptalltemplates,
    onacceptconsolidation, onacceptallconsolidations,
  }: Props = $props();

  let chatMessages = $derived(currentConversation.displayMessages);
  let chatInput = $state('');
  let chatContainerEl: HTMLDivElement | undefined = $state(undefined);
  let showConversationList = $state(false);
  let confirmDeleteConv = $state<{ show: boolean; id: string }>({ show: false, id: '' });

  function scrollToBottom() {
    setTimeout(() => {
      if (chatContainerEl) chatContainerEl.scrollTop = chatContainerEl.scrollHeight;
    }, 50);
  }

  $effect(() => {
    // Auto-scroll when messages change
    if (chatMessages.length > 0 || chatLoading) scrollToBottom();
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const msg = chatInput.trim();
    if (!msg) return;
    chatInput = '';
    onsend(msg);
  }

  function handleNewConversation() {
    showConversationList = false;
    onnewconversation();
  }

  function handleSwitchConversation(id: string) {
    showConversationList = false;
    onswitchconversation(id);
  }

  function requestDeleteConversation(id: string) {
    confirmDeleteConv = { show: true, id };
  }

  function confirmDelete() {
    ondeleteconversation(confirmDeleteConv.id);
    confirmDeleteConv = { show: false, id: '' };
  }

  function formatDate(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleDateString($locale === 'en' ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="conversation-bar">
  <div class="conversation-current">
    <button class="conv-toggle" onclick={() => { showConversationList = !showConversationList; }} title={$t('ai_view_conversations')}>
      <span class="conv-title">{currentConversation.title}</span>
      <span class="conv-arrow">{showConversationList ? '\u25B2' : '\u25BC'}</span>
    </button>
    <button class="conv-action-btn" onclick={handleNewConversation} title={$t('ai_new_conversation')}>+</button>
  </div>
  {#if showConversationList}
    <div class="conversation-list">
      {#each conversations as conv}
        <div class="conv-item" class:active={conv.id === currentConversation.id}>
          <button class="conv-item-btn" onclick={() => handleSwitchConversation(conv.id)}>
            <span class="conv-item-title">{conv.title}</span>
            <span class="conv-item-date">{formatDate(conv.createdAt)}</span>
            <span class="conv-item-count">{$t('ai_conv_msg_count', { count: conv.displayMessages.length })}</span>
          </button>
          {#if conversations.length > 1}
            <button class="conv-delete-btn" onclick={() => requestDeleteConversation(conv.id)} title={$t('ai_delete_conversation_title')}>&times;</button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<div class="chat-layout">
  <div class="chat-section">
    {#if chatMessages.length === 0}
      <ChatWelcome onaction={(text) => onsend(text)} />
    {:else}
      <div class="chat-messages" bind:this={chatContainerEl} role="log" aria-live="polite">
        {#each chatMessages as msg, msgIdx}
          <div class="chat-bubble {msg.role}">
            <div class="bubble-label">{msg.role === 'assistant' ? $t('ai_bubble_assistant') : $t('ai_bubble_user')}</div>
            <div class="bubble-content markdown-content">
              {@html renderMarkdown(msg.content)}
            </div>

            {#if msg.folderProposals && msg.folderProposals.length > 0}
              <ProposalBlock
                type="folders"
                folderProposals={msg.folderProposals}
                acceptedSet={new Set(msg.acceptedFolders || [])}
                onacceptfolder={(idx, fp) => onacceptfolder(msgIdx, idx, fp)}
                onacceptall={() => onacceptallfolder(msgIdx, msg.folderProposals || [])}
              />
            {/if}

            {#if msg.moveProposals && msg.moveProposals.length > 0}
              <ProposalBlock
                type="moves"
                moveProposals={msg.moveProposals}
                acceptedSet={new Set(msg.acceptedMoves || [])}
                onacceptmove={(idx, mp) => onacceptmove(msgIdx, idx, mp)}
                onacceptall={() => onacceptallmoves(msgIdx, msg.moveProposals || [])}
              />
            {/if}

            {#if msg.ruleProposals && msg.ruleProposals.length > 0}
              <ProposalBlock
                type="rules"
                ruleProposals={msg.ruleProposals}
                acceptedSet={new Set(msg.acceptedRules || [])}
                onacceptrule={(idx, rp) => onacceptrule(msgIdx, idx, rp)}
                oneditrule={oneditrule}
                onacceptall={() => onacceptallrules(msgIdx, msg.ruleProposals || [])}
              />
            {/if}

            {#if msg.templateProposals && msg.templateProposals.length > 0}
              <ProposalBlock
                type="templates"
                templateProposals={msg.templateProposals}
                acceptedSet={new Set(msg.acceptedTemplates || [])}
                onaccepttemplate={(idx, tp) => onaccepttemplate(msgIdx, idx, tp)}
                onacceptall={() => onacceptalltemplates(msgIdx, msg.templateProposals || [])}
              />
            {/if}

            {#if msg.ruleConsolidationProposals && msg.ruleConsolidationProposals.length > 0}
              <ProposalBlock
                type="consolidateRules"
                ruleConsolidationProposals={msg.ruleConsolidationProposals}
                acceptedSet={new Set(msg.acceptedConsolidations || [])}
                onacceptconsolidation={(idx, rc) => onacceptconsolidation(msgIdx, idx, rc)}
                onacceptall={() => onacceptallconsolidations(msgIdx, msg.ruleConsolidationProposals || [])}
              />
            {/if}
          </div>
        {/each}

        {#if chatLoading}
          <div class="chat-bubble assistant">
            <div class="bubble-label">{$t('ai_bubble_assistant')}</div>
            <div class="typing-indicator"><span></span><span></span><span></span></div>
          </div>
        {/if}
      </div>

      {#if selectedFolder}
        <div class="folder-context-bar">
          <span class="folder-context-label">{$t('ai_folder_context_label')}</span>
          <span class="folder-context-name">&#128193; {selectedFolder.name}</span>
          <button class="folder-context-clear" onclick={() => onclearfolder?.()} title={$t('ai_folder_context_clear')}>&times;</button>
        </div>
      {/if}

      <div class="chat-input-area">
        <button class="clear-chat-btn" onclick={handleNewConversation} title={$t('ai_new_conversation')}>&#10227;</button>
        <textarea
          class="chat-input"
          bind:value={chatInput}
          placeholder={$t('ai_chat_placeholder')}
          aria-label={$t('ai_chat_placeholder')}
          rows="2"
          disabled={chatLoading}
          onkeydown={handleKeydown}
        ></textarea>
        <Button variant="primary" onclick={handleSend} disabled={chatLoading || !chatInput.trim()}>{$t('common_send')}</Button>
      </div>
    {/if}
  </div>
</div>

<ConfirmDialog
  show={confirmDeleteConv.show}
  title={$t('confirm_delete_conversation_title_dialog')}
  message={$t('confirm_delete_conversation_msg')}
  onconfirm={confirmDelete}
  oncancel={() => (confirmDeleteConv = { show: false, id: '' })}
/>

<style>
  /* Conversation bar */
  .conversation-bar { position: relative; }
  .conversation-current { display: flex; align-items: center; gap: 6px; }
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

  .conversation-list {
    position: absolute; top: 100%; left: 0; right: 0; z-index: 50;
    margin-top: 4px; background: var(--bg-primary, white);
    border: 1px solid var(--border-color, #e0e0e6); border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12); max-height: 260px; overflow-y: auto;
  }
  .conv-item { display: flex; align-items: center; border-bottom: 1px solid var(--border-color, #e0e0e6); }
  .conv-item:last-child { border-bottom: none; }
  .conv-item.active { background: var(--bg-hover, #e8e8ee); }
  .conv-item-btn {
    flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 8px 12px;
    border: none; background: none; cursor: pointer; text-align: left;
    font-family: inherit; color: var(--text-color, #15141a); min-width: 0;
  }
  .conv-item-btn:hover { background: var(--bg-hover, #e0e0e6); }
  .conv-item-title { font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .conv-item-date { font-size: 10px; color: var(--text-secondary, #666); }
  .conv-item-count { font-size: 10px; color: var(--text-secondary, #999); }
  .conv-delete-btn {
    padding: 4px 10px; border: none; background: none; cursor: pointer;
    font-size: 16px; color: var(--text-secondary, #999); flex-shrink: 0;
  }
  .conv-delete-btn:hover { color: #c62828; }

  /* Chat layout */
  .chat-layout { display: flex; flex: 1; min-height: 0; gap: 0; }
  .chat-section { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  .chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 12px 0; min-height: 0; }

  /* Chat bubbles */
  .chat-bubble { max-width: 90%; padding: 10px 14px; border-radius: 10px; font-size: 13px; line-height: 1.5; }
  .chat-bubble.user { align-self: flex-end; background: var(--primary-color, #0060df); color: white; border-bottom-right-radius: 4px; }
  .chat-bubble.assistant { align-self: flex-start; background: var(--bg-secondary, #f9f9fb); border: 1px solid var(--border-color, #e0e0e6); border-bottom-left-radius: 4px; max-width: 95%; }
  .bubble-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; opacity: 0.7; }
  .chat-bubble.user .bubble-label { color: rgba(255,255,255,0.8); }
  .bubble-content { display: flex; flex-direction: column; gap: 2px; }

  /* Markdown content */
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

  /* Typing indicator */
  .typing-indicator { display: flex; gap: 4px; padding: 4px 0; }
  .typing-indicator span { width: 8px; height: 8px; border-radius: 50%; background: var(--text-secondary, #666); animation: typing 1.2s infinite; }
  .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typing {
    0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
    30% { opacity: 1; transform: scale(1); }
  }

  /* Folder context bar */
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

  /* Chat input */
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

  @media (prefers-color-scheme: dark) {
    .conv-toggle { background: #2b2a33; border-color: #4a4a5a; color: #fbfbfe; }
    .conv-toggle:hover { background: #38374a; }
    .conversation-list { background: #2b2a33; border-color: #4a4a5a; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
    .conv-item.active { background: #38374a; }
    .conv-item-btn:hover { background: #38374a; }
    .conv-item-btn { color: #fbfbfe; }
    .markdown-content :global(code) { background: rgba(255,255,255,0.1); }
    .markdown-content :global(pre) { background: rgba(255,255,255,0.08); }
    .chat-input { background: var(--bg-secondary, #2b2a33); color: var(--text-color, #fbfbfe); }
  }
</style>
