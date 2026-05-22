<script lang="ts">
  import { t } from '../../lib/i18n';
  import type { Translations } from '../../lib/i18n/types';
  import Button from '../../lib/components/Button.svelte';
  import ConfirmDialog from '../../lib/components/ConfirmDialog.svelte';

  declare const browser: any;

  let T = $state<(key: keyof Translations, params?: Record<string, string | number>) => string>((k) => k);
  t.subscribe((fn) => (T = fn));

  interface FolderNode {
    id: string;
    name: string;
    path: string;
    type: string;
    totalMessages: number;
    unreadMessages: number;
    children: FolderNode[];
  }

  interface AccountTree {
    accountName: string;
    accountId: string;
    folders: FolderNode[];
  }

  interface Props {
    onfolderselect?: (folderId: string, folderName: string, folderPath: string) => void;
    selectedFolderId?: string;
  }

  let { onfolderselect, selectedFolderId }: Props = $props();

  const SYSTEM_FOLDER_TYPES = ['inbox', 'sent', 'drafts', 'trash', 'junk', 'outbox'];

  let trees = $state<AccountTree[]>([]);
  let loading = $state(false);
  let error = $state('');
  let expandedIds = $state<Set<string>>(new Set());
  let hasLoaded = $state(false);

  // Context menu state
  let contextMenu = $state<{ show: boolean; x: number; y: number; node: FolderNode | null; accountId: string }>({
    show: false, x: 0, y: 0, node: null, accountId: '',
  });

  // Inline editing state
  let creatingIn = $state<{ parentId: string; name: string } | null>(null);
  let renamingId = $state<string | null>(null);
  let renameValue = $state('');
  let actionError = $state('');
  let actionSuccess = $state('');
  let confirmDeleteNode = $state<{ show: boolean; node: FolderNode | null }>({ show: false, node: null });

  export async function loadTree() {
    if (loading) return;
    loading = true;
    error = '';
    try {
      trees = await browser.runtime.sendMessage({ type: 'GET_FOLDER_TREE' });
      const newExpanded = new Set(expandedIds);
      for (const account of trees) {
        for (const f of account.folders) {
          if (f.children.length > 0) {
            newExpanded.add(f.id);
          }
        }
      }
      expandedIds = newExpanded;
      hasLoaded = true;
    } catch (err: any) {
      error = err?.message || T('folder_tree_load_error');
    } finally {
      loading = false;
    }
  }

  function toggleExpand(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    expandedIds = next;
  }

  function getAllIds(nodes: FolderNode[]): string[] {
    const ids: string[] = [];
    for (const n of nodes) {
      if (n.children.length > 0) {
        ids.push(n.id);
        ids.push(...getAllIds(n.children));
      }
    }
    return ids;
  }

  function expandAll() {
    const allIds: string[] = [];
    for (const account of trees) {
      allIds.push(...getAllIds(account.folders));
    }
    expandedIds = new Set(allIds);
  }

  function collapseAll() {
    expandedIds = new Set();
  }

  function folderIcon(type: string): string {
    switch (type) {
      case 'inbox': return '\u{1F4E5}';
      case 'sent': return '\u{1F4E4}';
      case 'drafts': return '\u{1F4DD}';
      case 'trash': return '\u{1F5D1}';
      case 'junk': return '\u26A0';
      case 'archives': return '\u{1F4E6}';
      default: return '\u{1F4C1}';
    }
  }

  function subtreeTotal(node: FolderNode): number {
    let total = node.totalMessages;
    for (const child of node.children) {
      total += subtreeTotal(child);
    }
    return total;
  }

  function subtreeUnread(node: FolderNode): number {
    let total = node.unreadMessages;
    for (const child of node.children) {
      total += subtreeUnread(child);
    }
    return total;
  }

  let totalMessages = $derived(
    trees.reduce((sum, acc) => sum + acc.folders.reduce((s, f) => s + subtreeTotal(f), 0), 0)
  );
  let totalUnread = $derived(
    trees.reduce((sum, acc) => sum + acc.folders.reduce((s, f) => s + subtreeUnread(f), 0), 0)
  );

  // --- Context menu handlers ---

  function handleContextMenu(e: MouseEvent, node: FolderNode, accountId: string) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { show: true, x: e.clientX, y: e.clientY, node, accountId };
  }

  function closeContextMenu() {
    contextMenu = { show: false, x: 0, y: 0, node: null, accountId: '' };
  }

  function handleWindowClick() {
    if (contextMenu.show) closeContextMenu();
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (contextMenu.show) closeContextMenu();
      if (creatingIn) creatingIn = null;
      if (renamingId) { renamingId = null; renameValue = ''; }
    }
  }

  function startCreateSubfolder() {
    if (!contextMenu.node) return;
    const parentId = contextMenu.node.id;
    // Expand the parent so the input is visible
    const next = new Set(expandedIds);
    next.add(parentId);
    expandedIds = next;
    creatingIn = { parentId, name: '' };
    closeContextMenu();
  }

  function startRename() {
    if (!contextMenu.node) return;
    renamingId = contextMenu.node.id;
    renameValue = contextMenu.node.name;
    closeContextMenu();
  }

  function handleDelete() {
    if (!contextMenu.node) return;
    const node = contextMenu.node;
    closeContextMenu();
    confirmDeleteNode = { show: true, node };
  }

  async function confirmDeleteNodeAction() {
    const node = confirmDeleteNode.node;
    confirmDeleteNode = { show: false, node: null };
    if (!node) return;
    actionError = '';
    try {
      const result = await browser.runtime.sendMessage({ type: 'DELETE_FOLDER', folderId: node.id });
      if (result.success) {
        actionSuccess = T('folder_tree_deleted', { name: node.name });
        setTimeout(() => (actionSuccess = ''), 3000);
        await loadTree();
      } else {
        actionError = result.error || T('folder_tree_delete_error');
      }
    } catch (err: any) {
      actionError = err.message || T('folder_tree_delete_error');
    }
  }

  async function confirmCreate() {
    if (!creatingIn || !creatingIn.name.trim()) return;
    actionError = '';
    try {
      const result = await browser.runtime.sendMessage({
        type: 'CREATE_FOLDER', parentFolderId: creatingIn.parentId, folderName: creatingIn.name.trim(),
      });
      if (result.success) {
        actionSuccess = T('folder_tree_created', { name: creatingIn.name.trim() });
        setTimeout(() => (actionSuccess = ''), 3000);
        creatingIn = null;
        await loadTree();
      } else {
        actionError = result.error || T('folder_tree_create_error');
      }
    } catch (err: any) {
      actionError = err.message || T('folder_tree_create_error');
    }
  }

  async function confirmRename() {
    if (!renamingId || !renameValue.trim()) return;
    actionError = '';
    try {
      const result = await browser.runtime.sendMessage({
        type: 'RENAME_FOLDER', folderId: renamingId, newName: renameValue.trim(),
      });
      if (result.success) {
        actionSuccess = T('folder_tree_renamed', { name: renameValue.trim() });
        setTimeout(() => (actionSuccess = ''), 3000);
        renamingId = null;
        renameValue = '';
        await loadTree();
      } else {
        actionError = result.error || T('folder_tree_rename_error');
      }
    } catch (err: any) {
      actionError = err.message || T('folder_tree_rename_error');
    }
  }

  function handleCreateKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') confirmCreate();
    else if (e.key === 'Escape') creatingIn = null;
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') confirmRename();
    else if (e.key === 'Escape') { renamingId = null; renameValue = ''; }
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div class="folder-tree">
  <div class="tree-header">
    <span class="tree-title">
      {T('folder_tree_title')}
      {#if hasLoaded}
        <span class="tree-summary">
          {totalMessages.toLocaleString()} {T('folder_tree_msgs')}
          {#if totalUnread > 0}
            <span class="tree-summary-unread">{totalUnread}</span>
          {/if}
        </span>
      {/if}
    </span>
    <div class="tree-actions">
      {#if hasLoaded && trees.length > 0}
        <Button size="xs" onclick={expandAll} title={T('folder_tree_expand_all')}>+</Button>
        <Button size="xs" onclick={collapseAll} title={T('folder_tree_collapse_all')}>&minus;</Button>
      {/if}
      <Button size="xs" onclick={loadTree} disabled={loading} title={T('folder_tree_refresh')}>
        {loading ? '...' : '\u21BB'}
      </Button>
    </div>
  </div>

  {#if actionError}<div class="tree-msg error">{actionError}</div>{/if}
  {#if actionSuccess}<div class="tree-msg success">{actionSuccess}</div>{/if}

  {#if error}
    <div class="tree-error">{error}</div>
  {:else if loading && !hasLoaded}
    <div class="tree-loading">{T('folder_tree_loading')}</div>
  {:else if !hasLoaded}
    <div class="tree-loading tree-empty">{T('folder_tree_click_refresh')}</div>
  {:else}
    {#each trees as account}
      <div class="account-section">
        <div class="account-name">{account.accountName}</div>
        {#each account.folders as folder}
          {@render folderRow(folder, 0, account.accountId)}
        {/each}
      </div>
    {/each}
  {/if}
</div>

{#if contextMenu.show && contextMenu.node}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="context-menu" role="menu" tabindex="-1" style="left: {contextMenu.x}px; top: {contextMenu.y}px" onclick={(e) => e.stopPropagation()}>
    <button onclick={startCreateSubfolder}>{T('folder_tree_create_subfolder')}</button>
    {#if !SYSTEM_FOLDER_TYPES.includes(contextMenu.node.type)}
      <button onclick={startRename}>{T('folder_tree_rename')}</button>
      <div class="context-separator"></div>
      <button class="danger" onclick={handleDelete}>{T('folder_tree_delete')}</button>
    {/if}
  </div>
{/if}

<ConfirmDialog
  show={confirmDeleteNode.show}
  title={T('confirm_delete_folder_title')}
  message={T('folder_tree_confirm_delete', { name: confirmDeleteNode.node?.name || '' })}
  onconfirm={confirmDeleteNodeAction}
  oncancel={() => (confirmDeleteNode = { show: false, node: null })}
/>

{#snippet folderRow(node: FolderNode, depth: number, accountId: string)}
  {@const hasChildren = node.children.length > 0}
  {@const childTotal = hasChildren ? subtreeTotal(node) : node.totalMessages}
  {@const childUnread = hasChildren ? subtreeUnread(node) : node.unreadMessages}
  {@const isEmpty = childTotal === 0}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="folder-row"
    class:folder-empty={isEmpty}
    class:folder-selected={selectedFolderId === node.id}
    style="padding-left: {12 + depth * 16}px"
    role="button"
    tabindex="0"
    onclick={() => onfolderselect?.(node.id, node.name, node.path)}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onfolderselect?.(node.id, node.name, node.path); } }}
    oncontextmenu={(e) => handleContextMenu(e, node, accountId)}
  >
    {#if hasChildren}
      <button class="expand-btn" onclick={() => toggleExpand(node.id)}>
        {expandedIds.has(node.id) ? '\u25BC' : '\u25B6'}
      </button>
    {:else}
      <span class="expand-spacer"></span>
    {/if}
    <span class="folder-icon">{folderIcon(node.type)}</span>
    {#if renamingId === node.id}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="inline-input"
        bind:value={renameValue}
        onkeydown={handleRenameKeydown}
        autofocus
      />
      <Button size="xs" onclick={confirmRename}>OK</Button>
      <Button size="xs" onclick={() => { renamingId = null; renameValue = ''; }}>X</Button>
    {:else}
      <span class="folder-name">{node.name}</span>
      <span class="folder-counts">
        {#if hasChildren && expandedIds.has(node.id)}
          <span class="msg-count" title={T('folder_tree_title_folder_msgs')}>{node.totalMessages}</span>
        {:else if hasChildren}
          <span class="msg-count" title={T('folder_tree_title_subtree_total')}>{childTotal}</span>
        {:else}
          <span class="msg-count" title={T('folder_tree_title_total_msgs')}>{node.totalMessages}</span>
        {/if}
        {#if childUnread > 0}
          <span class="unread-count" title={T('folder_tree_title_unread')}>{childUnread}</span>
        {/if}
      </span>
    {/if}
  </div>
  {#if hasChildren && expandedIds.has(node.id)}
    {#if creatingIn && creatingIn.parentId === node.id}
      <div class="folder-row create-row" style="padding-left: {12 + (depth + 1) * 16}px">
        <span class="expand-spacer"></span>
        <span class="folder-icon">{'\u{1F4C1}'}</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="inline-input"
          bind:value={creatingIn.name}
          onkeydown={handleCreateKeydown}
          placeholder={T('folder_tree_name_placeholder')}
          autofocus
        />
        <Button size="xs" onclick={confirmCreate}>OK</Button>
        <Button size="xs" onclick={() => (creatingIn = null)}>X</Button>
      </div>
    {/if}
    {#each node.children as child}
      {@render folderRow(child, depth + 1, accountId)}
    {/each}
  {/if}
{/snippet}

<style>
  .folder-tree {
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 6px;
    background: var(--bg-primary, white);
    overflow: hidden;
    font-size: 12px;
    position: relative;
  }
  .tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    background: var(--bg-secondary, #f0f0f4);
    border-bottom: 1px solid var(--border-color, #e0e0e6);
    gap: 8px;
  }
  .tree-title {
    font-weight: 600;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .tree-summary {
    font-weight: 400;
    font-size: 11px;
    color: var(--text-secondary, #666);
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .tree-summary-unread {
    font-size: 10px;
    font-weight: 600;
    background: var(--primary-color, #0060df);
    color: white;
    padding: 0 5px;
    border-radius: 8px;
    min-width: 14px;
    text-align: center;
    line-height: 16px;
  }
  .tree-actions {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }
  .tree-actions :global(.btn) {
    line-height: 1;
  }
  .tree-msg {
    padding: 4px 10px;
    font-size: 11px;
  }
  .tree-msg.error { color: #c62828; background: #ffeef0; }
  .tree-msg.success { color: #2e7d32; background: #e8f5e9; }
  .tree-error {
    padding: 12px;
    color: #c62828;
    font-size: 12px;
  }
  .tree-loading {
    padding: 16px;
    text-align: center;
    color: var(--text-secondary, #666);
  }
  .tree-empty {
    font-style: italic;
    padding: 12px;
  }
  .account-section {
    padding: 4px 0;
  }
  .account-name {
    padding: 6px 12px 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--text-secondary, #666);
  }
  .folder-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 12px;
    min-height: 24px;
    transition: background 0.1s;
    cursor: pointer;
  }
  .folder-row:hover {
    background: var(--bg-hover, #f0f0f4);
  }
  .folder-row.folder-selected {
    background: color-mix(in srgb, var(--primary-color, #0060df) 12%, transparent);
    border-right: 3px solid var(--primary-color, #0060df);
  }
  .folder-row.folder-selected .folder-name {
    font-weight: 600;
    color: var(--primary-color, #0060df);
  }
  .folder-row.folder-empty {
    opacity: 0.5;
  }
  .folder-row.folder-empty:hover {
    opacity: 0.8;
  }
  .create-row {
    background: var(--bg-secondary, #f9f9fb);
  }
  .expand-btn {
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 8px;
    color: var(--text-secondary, #999);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .expand-btn:hover { color: var(--text-color, #15141a); }
  .expand-spacer {
    width: 16px;
    flex-shrink: 0;
  }
  .folder-icon {
    font-size: 13px;
    flex-shrink: 0;
    width: 18px;
    text-align: center;
  }
  .folder-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-color, #15141a);
  }
  .folder-counts {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
    align-items: center;
  }
  .msg-count {
    font-size: 11px;
    color: var(--text-secondary, #999);
    min-width: 20px;
    text-align: right;
  }
  .unread-count {
    font-size: 10px;
    font-weight: 600;
    background: var(--primary-color, #0060df);
    color: white;
    padding: 0 5px;
    border-radius: 8px;
    min-width: 14px;
    text-align: center;
    line-height: 16px;
  }

  /* Inline edit inputs */
  .inline-input {
    flex: 1;
    padding: 2px 5px;
    border: 1px solid var(--primary-color, #0060df);
    border-radius: 4px;
    font-size: 11px;
    font-family: inherit;
    background: var(--bg-primary, white);
    color: inherit;
    min-width: 0;
  }
  .folder-row :global(.btn) {
    flex-shrink: 0;
  }

  /* Context menu */
  .context-menu {
    position: fixed;
    z-index: 200;
    background: var(--bg-primary, white);
    border: 1px solid var(--border-color, #e0e0e6);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    padding: 4px 0;
    min-width: 160px;
  }
  .context-menu button {
    display: block;
    width: 100%;
    padding: 6px 14px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font-size: 12px;
    font-family: inherit;
    color: var(--text-color, #15141a);
  }
  .context-menu button:hover { background: var(--bg-hover, #e0e0e6); }
  .context-menu button.danger { color: var(--text-color, #15141a); }
  .context-menu button.danger:hover { background: #fce4ec; color: #c62828; }
  .context-separator {
    height: 1px;
    background: var(--border-color, #e0e0e6);
    margin: 4px 0;
  }

  @media (prefers-color-scheme: dark) {
    .folder-row:hover { background: #38374a; }
    .context-menu { background: #2b2a33; border-color: #4a4a5a; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
    .context-menu button { color: #fbfbfe; }
    .context-menu button:hover { background: #38374a; }
    .context-menu button.danger:hover { background: #4a1c1c; color: #ef9a9a; }
    .tree-msg.error { background: #4a1c1c; color: #ef9a9a; }
    .tree-msg.success { background: #1b3320; color: #81c784; }
    .inline-input { background: #1c1b22; border-color: #45a1ff; }
  }
</style>
