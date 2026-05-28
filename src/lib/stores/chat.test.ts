/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

let mockStorage: Record<string, unknown> = {};

vi.stubGlobal('browser', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => (key in mockStorage ? { [key]: mockStorage[key] } : {})),
      set: vi.fn(async (data: Record<string, unknown>) => Object.assign(mockStorage, data)),
    },
    onChanged: { addListener: vi.fn() },
  },
});

// Must mock openai to avoid its side-effect imports
vi.mock('../services/openai', () => ({}));

import { chatStore, activeConversation, allConversations, storeReady } from './chat';

beforeEach(async () => {
  vi.clearAllMocks();
  mockStorage = {};
  // Wait for async load to complete
  await vi.waitFor(() => expect(get(storeReady)).toBe(true));
  // Full reset: delete all conversations except one, then clear messages
  const state = get(chatStore);
  const ids = state.conversations.map((c) => c.id);
  // Delete all except the last one (which creates a fresh one)
  for (const id of ids) {
    chatStore.deleteConversation(id);
  }
  // Now we have exactly one fresh conversation — clear it
  chatStore.clear();
});

function getState() {
  return get(chatStore);
}

function getActive() {
  return get(activeConversation);
}

// --- Conversation management ---

describe('conversation management', () => {
  it('starts with one empty conversation', () => {
    const state = getState();
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0].displayMessages).toEqual([]);
  });

  it('newConversation() adds a conversation and makes it active', () => {
    const oldId = getState().activeId;
    chatStore.newConversation();
    const state = getState();
    expect(state.conversations.length).toBeGreaterThanOrEqual(2);
    expect(state.activeId).not.toBe(oldId);
  });

  it('switchConversation() changes activeId', () => {
    chatStore.newConversation();
    const state = getState();
    const firstId = state.conversations[0].id;
    chatStore.switchConversation(firstId);
    expect(getState().activeId).toBe(firstId);
  });

  it('switchConversation() is a no-op for unknown id', () => {
    const before = getState().activeId;
    chatStore.switchConversation('nonexistent');
    expect(getState().activeId).toBe(before);
  });

  it('deleteConversation() removes conversation', () => {
    chatStore.newConversation();
    const state = getState();
    const toDelete = state.conversations[0].id;
    const countBefore = state.conversations.length;
    chatStore.deleteConversation(toDelete);
    expect(getState().conversations.length).toBe(countBefore - 1);
  });

  it('deleteConversation() creates fresh when deleting last', () => {
    const onlyId = getState().conversations[0].id;
    chatStore.deleteConversation(onlyId);
    const state = getState();
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0].id).not.toBe(onlyId);
  });

  it('deleteConversation() switches active to last when active is deleted', () => {
    chatStore.newConversation();
    const state = getState();
    const activeId = state.activeId;
    chatStore.deleteConversation(activeId);
    const after = getState();
    expect(after.activeId).toBe(after.conversations[after.conversations.length - 1].id);
  });

  it('renameConversation() updates title', () => {
    const id = getState().conversations[0].id;
    chatStore.renameConversation(id, 'Custom Title');
    expect(getActive().title).toBe('Custom Title');
  });
});

// --- Message methods ---

describe('message methods', () => {
  it('addUserMessage() appends to displayMessages and apiHistory', () => {
    chatStore.addUserMessage('Hello');
    const conv = getActive();
    expect(conv.displayMessages).toHaveLength(1);
    expect(conv.displayMessages[0].role).toBe('user');
    expect(conv.displayMessages[0].content).toBe('Hello');
    expect(conv.apiHistory).toHaveLength(1);
  });

  it('addUserMessage() auto-titles from first user message', () => {
    chatStore.addUserMessage('Analyze my inbox please');
    expect(getActive().title).toBe('Analyze my inbox please');
  });

  it('addUserMessage() truncates long titles to 50 chars', () => {
    const long = 'A'.repeat(80);
    chatStore.addUserMessage(long);
    expect(getActive().title).toBe('A'.repeat(50) + '...');
  });

  it('addUserMessage() does not re-title on second message', () => {
    chatStore.addUserMessage('First message');
    chatStore.addUserMessage('Second message');
    expect(getActive().title).toBe('First message');
  });

  it('addAssistantMessage() appends with empty accepted arrays', () => {
    chatStore.addAssistantMessage('Response', [
      { name: 'Folder', parentFolderId: 'f1', parentPath: 'Inbox', description: 'test' },
    ]);
    const msg = getActive().displayMessages[0];
    expect(msg.role).toBe('assistant');
    expect(msg.folderProposals).toHaveLength(1);
    expect(msg.acceptedFolders).toEqual([]);
    expect(msg.acceptedRules).toEqual([]);
  });

  it('addAssistantMessage() also appends to apiHistory', () => {
    chatStore.addAssistantMessage('AI says hi');
    expect(getActive().apiHistory).toHaveLength(1);
    expect(getActive().apiHistory[0].content).toBe('AI says hi');
  });
});

// --- Mark/unmark acceptance ---

describe('mark/unmark acceptance', () => {
  beforeEach(() => {
    // Add an assistant message with proposals
    chatStore.addAssistantMessage(
      'Suggestions',
      [{ name: 'F1', parentFolderId: 'p', parentPath: 'P', description: 'd' }],
      [{ rule: {} as any, description: 'r' }],
      [
        {
          sourceFolderId: 's',
          sourceFolderPath: 'sp',
          destFolderId: 'd',
          destFolderPath: 'dp',
          deleteSource: false,
          description: 'm',
        },
      ],
      [{ template: {} as any, description: 't' }],
      [{ mergedRule: {} as any, sourceRuleIds: [], sourceRuleNames: [], description: 'c' }],
    );
  });

  it('markFolderAccepted() adds index to acceptedFolders', () => {
    chatStore.markFolderAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedFolders).toContain(0);
  });

  it('markFolderAccepted() does not duplicate', () => {
    chatStore.markFolderAccepted(0, 0);
    chatStore.markFolderAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedFolders).toEqual([0]);
  });

  it('unmarkFolderAccepted() removes index', () => {
    chatStore.markFolderAccepted(0, 0);
    chatStore.unmarkFolderAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedFolders).not.toContain(0);
  });

  it('markRuleAccepted() and unmarkRuleAccepted()', () => {
    chatStore.markRuleAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedRules).toContain(0);
    chatStore.unmarkRuleAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedRules).not.toContain(0);
  });

  it('markMoveAccepted() and unmarkMoveAccepted()', () => {
    chatStore.markMoveAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedMoves).toContain(0);
    chatStore.unmarkMoveAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedMoves).not.toContain(0);
  });

  it('markTemplateAccepted() and unmarkTemplateAccepted()', () => {
    chatStore.markTemplateAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedTemplates).toContain(0);
    chatStore.unmarkTemplateAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedTemplates).not.toContain(0);
  });

  it('markConsolidationAccepted() and unmarkConsolidationAccepted()', () => {
    chatStore.markConsolidationAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedConsolidations).toContain(0);
    chatStore.unmarkConsolidationAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedConsolidations).not.toContain(0);
  });
});

// --- Folder map ---

describe('folder map', () => {
  it('setFolderMapping() adds key-value to createdFolderMap', () => {
    chatStore.setFolderMapping('NEW:Newsletters', 'real-folder-id');
    expect(getActive().createdFolderMap).toEqual({ 'NEW:Newsletters': 'real-folder-id' });
  });

  it('removeFolderMapping() removes key', () => {
    chatStore.setFolderMapping('k1', 'v1');
    chatStore.setFolderMapping('k2', 'v2');
    chatStore.removeFolderMapping('k1');
    expect(getActive().createdFolderMap).toEqual({ k2: 'v2' });
  });
});

// --- clear ---

describe('clear', () => {
  it('resets active conversation messages and title', () => {
    chatStore.addUserMessage('Test message');
    chatStore.addAssistantMessage('Response');
    chatStore.clear();
    const conv = getActive();
    expect(conv.displayMessages).toEqual([]);
    expect(conv.apiHistory).toEqual([]);
    expect(conv.title).toBe('New conversation');
  });
});

// --- Derived stores ---

describe('derived stores', () => {
  it('activeConversation returns active conversation', () => {
    chatStore.addUserMessage('Hello');
    const active = get(activeConversation);
    expect(active.displayMessages).toHaveLength(1);
  });

  it('allConversations returns sorted newest-first', () => {
    chatStore.newConversation();
    chatStore.newConversation();
    const all = get(allConversations);
    expect(all.length).toBeGreaterThanOrEqual(2);
    // Each subsequent createdAt should be <= previous
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].createdAt).toBeGreaterThanOrEqual(all[i].createdAt);
    }
  });
});

// --- Storage migration ---

describe('storage migration', () => {
  it('loads multi-conversation format from storage', async () => {
    const conv = {
      id: 'saved-conv',
      title: 'Saved',
      createdAt: 1000,
      displayMessages: [{ role: 'user', content: 'hello' }],
      apiHistory: [{ role: 'user', content: 'hello' }],
      createdFolderMap: {},
    };
    mockStorage['smm_chat_history'] = { conversations: [conv], activeId: 'saved-conv' };

    // Re-import to trigger load from storage
    vi.resetModules();
    const { chatStore: freshStore, storeReady: freshReady } = await import('./chat');
    await vi.waitFor(() => expect(get(freshReady)).toBe(true));

    const state = get(freshStore);
    expect(state.conversations.some((c) => c.id === 'saved-conv')).toBe(true);
    expect(state.activeId).toBe('saved-conv');
  });

  it('migrates old single-conversation format', async () => {
    mockStorage['smm_chat_history'] = {
      displayMessages: [
        { role: 'user', content: 'Old message from before migration' },
        { role: 'assistant', content: 'Response' },
      ],
      apiHistory: [
        { role: 'user', content: 'Old message from before migration' },
        { role: 'assistant', content: 'Response' },
      ],
    };

    vi.resetModules();
    const { chatStore: freshStore, storeReady: freshReady } = await import('./chat');
    await vi.waitFor(() => expect(get(freshReady)).toBe(true));

    const state = get(freshStore);
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0].displayMessages).toHaveLength(2);
    // Title should be derived from first user message, truncated to 50 chars
    expect(state.conversations[0].title).toBe('Old message from before migration');
  });

  it('initializes createdFolderMap on conversations missing it', async () => {
    const conv = {
      id: 'no-map',
      title: 'No Map',
      createdAt: 1000,
      displayMessages: [],
      apiHistory: [],
      // no createdFolderMap property
    };
    mockStorage['smm_chat_history'] = { conversations: [conv], activeId: 'no-map' };

    vi.resetModules();
    const { chatStore: freshStore, storeReady: freshReady } = await import('./chat');
    await vi.waitFor(() => expect(get(freshReady)).toBe(true));

    const state = get(freshStore);
    expect(state.conversations[0].createdFolderMap).toEqual({});
  });
});

// --- Pruning ---

describe('pruning', () => {
  it('prunes oldest conversations when exceeding MAX_CONVERSATIONS (50)', () => {
    // Create 50 additional conversations (already have 1)
    for (let i = 0; i < 51; i++) {
      chatStore.newConversation();
    }
    const state = getState();
    // Should be capped at 50
    expect(state.conversations.length).toBeLessThanOrEqual(50);
  });
});

// --- Branch coverage: conversation management ---

describe('conversation management branches', () => {
  it('switchConversation() with non-existent ID should NOT change activeId', () => {
    const before = getState().activeId;
    chatStore.switchConversation('does-not-exist-xyz');
    expect(getState().activeId).toBe(before);
  });

  it('deleteConversation() of the last remaining conversation should create a fresh one', () => {
    const state = getState();
    expect(state.conversations).toHaveLength(1);
    const onlyId = state.conversations[0].id;
    chatStore.deleteConversation(onlyId);
    const after = getState();
    expect(after.conversations).toHaveLength(1);
    expect(after.conversations[0].id).not.toBe(onlyId);
    expect(after.activeId).toBe(after.conversations[0].id);
    expect(after.conversations[0].title).toBe('New conversation');
    expect(after.conversations[0].displayMessages).toEqual([]);
  });

  it('deleteConversation() of the active conversation when others exist should switch to last', () => {
    chatStore.newConversation();
    chatStore.newConversation();
    const state = getState();
    expect(state.conversations.length).toBe(3);
    const activeId = state.activeId;
    // The active conversation is the last one created
    chatStore.deleteConversation(activeId);
    const after = getState();
    expect(after.conversations.length).toBe(2);
    expect(after.activeId).not.toBe(activeId);
    expect(after.activeId).toBe(after.conversations[after.conversations.length - 1].id);
  });

  it('renameConversation() with non-existent ID should not crash', () => {
    const before = getState();
    const titleBefore = before.conversations[0].title;
    chatStore.renameConversation('non-existent-id', 'Ghost Title');
    const after = getState();
    // The existing conversation title should be unchanged
    expect(after.conversations[0].title).toBe(titleBefore);
    // No conversation should have the ghost title
    expect(after.conversations.every((c) => c.title !== 'Ghost Title')).toBe(true);
  });

  it('setFolderMapping() and removeFolderMapping() basic flow', () => {
    chatStore.setFolderMapping('key-a', 'folder-1');
    chatStore.setFolderMapping('key-b', 'folder-2');
    expect(getActive().createdFolderMap).toEqual({ 'key-a': 'folder-1', 'key-b': 'folder-2' });
    chatStore.removeFolderMapping('key-a');
    expect(getActive().createdFolderMap).toEqual({ 'key-b': 'folder-2' });
    chatStore.removeFolderMapping('key-b');
    expect(getActive().createdFolderMap).toEqual({});
  });

  it('clear() should reset the active conversation completely', () => {
    chatStore.addUserMessage('Some user input');
    chatStore.addAssistantMessage('Some response');
    chatStore.setFolderMapping('map-key', 'map-val');
    const before = getActive();
    expect(before.displayMessages.length).toBe(2);
    expect(before.createdFolderMap).toEqual({ 'map-key': 'map-val' });
    chatStore.clear();
    const after = getActive();
    expect(after.displayMessages).toEqual([]);
    expect(after.apiHistory).toEqual([]);
    expect(after.title).toBe('New conversation');
    expect(after.createdFolderMap).toEqual({});
  });
});

// --- Branch coverage: mark/unmark proposal branches ---

describe('mark/unmark proposal branches', () => {
  beforeEach(() => {
    // Add an assistant message with proposals of each type
    chatStore.addAssistantMessage(
      'Branch coverage suggestions',
      [{ name: 'F1', parentFolderId: 'p', parentPath: 'P', description: 'd' }],
      [{ rule: {} as any, description: 'r' }],
      [
        {
          sourceFolderId: 's',
          sourceFolderPath: 'sp',
          destFolderId: 'd',
          destFolderPath: 'dp',
          deleteSource: false,
          description: 'm',
        },
      ],
      [{ template: {} as any, description: 't' }],
      [{ mergedRule: {} as any, sourceRuleIds: [], sourceRuleNames: [], description: 'c' }],
    );
  });

  it('markFolderAccepted() with invalid msgIdx (999) should not crash', () => {
    expect(() => chatStore.markFolderAccepted(999, 0)).not.toThrow();
    // The existing message should be unaffected
    expect(getActive().displayMessages[0].acceptedFolders).toEqual([]);
  });

  it('unmarkFolderAccepted() with invalid msgIdx (999) should not crash', () => {
    chatStore.markFolderAccepted(0, 0);
    expect(() => chatStore.unmarkFolderAccepted(999, 0)).not.toThrow();
    // The existing accepted folder should remain
    expect(getActive().displayMessages[0].acceptedFolders).toContain(0);
  });

  it('markRuleAccepted() with duplicate proposalIdx should not add duplicate', () => {
    chatStore.markRuleAccepted(0, 0);
    chatStore.markRuleAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedRules).toEqual([0]);
  });

  it('markTemplateAccepted() and unmarkTemplateAccepted() basic flow', () => {
    expect(getActive().displayMessages[0].acceptedTemplates).toEqual([]);
    chatStore.markTemplateAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedTemplates).toEqual([0]);
    // Marking duplicate should not add
    chatStore.markTemplateAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedTemplates).toEqual([0]);
    chatStore.unmarkTemplateAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedTemplates).toEqual([]);
  });

  it('markConsolidationAccepted() and unmarkConsolidationAccepted() basic flow', () => {
    expect(getActive().displayMessages[0].acceptedConsolidations).toEqual([]);
    chatStore.markConsolidationAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedConsolidations).toEqual([0]);
    // Marking duplicate should not add
    chatStore.markConsolidationAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedConsolidations).toEqual([0]);
    chatStore.unmarkConsolidationAccepted(0, 0);
    expect(getActive().displayMessages[0].acceptedConsolidations).toEqual([]);
  });

  it('markMoveAccepted() with invalid msgIdx should not crash', () => {
    expect(() => chatStore.markMoveAccepted(999, 0)).not.toThrow();
    expect(getActive().displayMessages[0].acceptedMoves).toEqual([]);
  });

  it('unmarkRuleAccepted() with invalid msgIdx should not crash', () => {
    chatStore.markRuleAccepted(0, 0);
    expect(() => chatStore.unmarkRuleAccepted(999, 0)).not.toThrow();
    expect(getActive().displayMessages[0].acceptedRules).toContain(0);
  });

  it('markTemplateAccepted() with invalid msgIdx should not crash', () => {
    expect(() => chatStore.markTemplateAccepted(999, 0)).not.toThrow();
    expect(getActive().displayMessages[0].acceptedTemplates).toEqual([]);
  });

  it('markConsolidationAccepted() with invalid msgIdx should not crash', () => {
    expect(() => chatStore.markConsolidationAccepted(999, 0)).not.toThrow();
    expect(getActive().displayMessages[0].acceptedConsolidations).toEqual([]);
  });
});
