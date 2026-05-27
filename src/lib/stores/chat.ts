/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { writable, derived } from 'svelte/store';
import type { FolderProposal, MoveProposal, RuleProposal, TemplateProposal, RuleConsolidationProposal, ChatMessage } from '../services/openai';
import { STORAGE_KEYS } from '../utils/constants';

/// <reference path="../utils/messenger.d.ts" />

const MAX_CONVERSATIONS = 50;

export interface StoredDisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  folderProposals?: FolderProposal[];
  moveProposals?: MoveProposal[];
  ruleProposals?: RuleProposal[];
  templateProposals?: TemplateProposal[];
  ruleConsolidationProposals?: RuleConsolidationProposal[];
  acceptedFolders?: number[];
  acceptedMoves?: number[];
  acceptedRules?: number[];
  acceptedTemplates?: number[];
  acceptedConsolidations?: number[];
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: number;
  displayMessages: StoredDisplayMessage[];
  apiHistory: ChatMessage[];
  createdFolderMap?: Record<string, string>;
}

interface ChatStoreState {
  conversations: ChatConversation[];
  activeId: string;
}

function generateId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyConversation(): ChatConversation {
  return {
    id: generateId(),
    title: 'New conversation',
    createdAt: Date.now(),
    displayMessages: [],
    apiHistory: [],
    createdFolderMap: {},
  };
}

// Tracks whether the store has finished loading from browser.storage.local
export const storeReady = writable(false);

function createChatStore() {
  const initial = createEmptyConversation();
  const { subscribe, set, update } = writable<ChatStoreState>({
    conversations: [initial],
    activeId: initial.id,
  });

  let loaded = false;

  // Load from storage (backward compatible with old single-conversation format)
  try {
    if (typeof browser !== 'undefined' && browser?.storage?.local) {
      browser.storage.local.get(STORAGE_KEYS.CHAT_HISTORY).then((result: Record<string, unknown>) => {
        const saved = result[STORAGE_KEYS.CHAT_HISTORY] as any;
        if (saved) {
          if (saved.conversations && saved.activeId) {
            // Ensure createdFolderMap exists on each conversation
            for (const conv of saved.conversations) {
              if (!conv.createdFolderMap) conv.createdFolderMap = {};
            }
            set(saved);
          } else if (saved.displayMessages || saved.apiHistory) {
            // Old single-conversation format — migrate
            const migrated = createEmptyConversation();
            migrated.displayMessages = saved.displayMessages || [];
            migrated.apiHistory = saved.apiHistory || [];
            if (migrated.displayMessages.length > 0) {
              const first = migrated.displayMessages.find(m => m.role === 'user');
              if (first) migrated.title = first.content.substring(0, 50) + (first.content.length > 50 ? '...' : '');
            }
            set({ conversations: [migrated], activeId: migrated.id });
          }
        }
        loaded = true;
        storeReady.set(true);
      });
    } else {
      loaded = true;
      storeReady.set(true);
    }
  } catch (e) {
    console.error('[SMM] chat store load error:', e);
    loaded = true;
    storeReady.set(true);
  }

  function persist(state: ChatStoreState) {
    if (!loaded) return; // Don't overwrite storage before initial load completes
    try {
      browser.storage.local.set({
        [STORAGE_KEYS.CHAT_HISTORY]: JSON.parse(JSON.stringify(state)),
      });
    } catch { /* ignore */ }
  }

  function getActive(state: ChatStoreState): ChatConversation | undefined {
    return state.conversations.find(c => c.id === state.activeId);
  }

  function updateActive(state: ChatStoreState, fn: (conv: ChatConversation) => void) {
    const conv = getActive(state);
    if (conv) fn(conv);
    state.conversations = [...state.conversations];
    persist(state);
    return state;
  }

  return {
    subscribe,

    // --- Conversation management ---

    newConversation() {
      update(state => {
        const conv = createEmptyConversation();
        state.conversations = [...state.conversations, conv];
        // Prune oldest conversations when limit is exceeded
        if (state.conversations.length > MAX_CONVERSATIONS) {
          const sorted = [...state.conversations].sort((a, b) => a.createdAt - b.createdAt);
          const toRemove = new Set(sorted.slice(0, state.conversations.length - MAX_CONVERSATIONS).map(c => c.id));
          state.conversations = state.conversations.filter(c => !toRemove.has(c.id));
        }
        state.activeId = conv.id;
        persist(state);
        return state;
      });
    },

    switchConversation(id: string) {
      update(state => {
        if (state.conversations.some(c => c.id === id)) {
          state.activeId = id;
          persist(state);
        }
        return state;
      });
    },

    deleteConversation(id: string) {
      update(state => {
        state.conversations = state.conversations.filter(c => c.id !== id);
        if (state.conversations.length === 0) {
          const fresh = createEmptyConversation();
          state.conversations = [fresh];
          state.activeId = fresh.id;
        } else if (state.activeId === id) {
          state.activeId = state.conversations[state.conversations.length - 1].id;
        }
        persist(state);
        return state;
      });
    },

    renameConversation(id: string, title: string) {
      update(state => {
        const conv = state.conversations.find(c => c.id === id);
        if (conv) conv.title = title;
        state.conversations = [...state.conversations];
        persist(state);
        return state;
      });
    },

    // --- Folder map methods (operate on active conversation) ---

    setFolderMapping(key: string, folderId: string) {
      update(state => {
        return updateActive(state, conv => {
          if (!conv.createdFolderMap) conv.createdFolderMap = {};
          conv.createdFolderMap = { ...conv.createdFolderMap, [key]: folderId };
        });
      });
    },

    removeFolderMapping(key: string) {
      update(state => {
        return updateActive(state, conv => {
          if (conv.createdFolderMap) {
            const { [key]: _, ...rest } = conv.createdFolderMap;
            conv.createdFolderMap = rest;
          }
        });
      });
    },

    // --- Message methods (operate on active conversation) ---

    addUserMessage(content: string) {
      update(state => {
        return updateActive(state, conv => {
          conv.displayMessages = [...conv.displayMessages, { role: 'user' as const, content }];
          conv.apiHistory = [...conv.apiHistory, { role: 'user' as const, content }];
          // Auto-title from first user message
          if (conv.displayMessages.filter(m => m.role === 'user').length === 1) {
            conv.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
          }
        });
      });
    },

    addAssistantMessage(
      content: string,
      folderProposals?: FolderProposal[],
      ruleProposals?: RuleProposal[],
      moveProposals?: MoveProposal[],
      templateProposals?: TemplateProposal[],
      ruleConsolidationProposals?: RuleConsolidationProposal[],
    ) {
      update(state => {
        return updateActive(state, conv => {
          conv.displayMessages = [...conv.displayMessages, {
            role: 'assistant' as const,
            content,
            folderProposals,
            moveProposals,
            ruleProposals,
            templateProposals,
            ruleConsolidationProposals,
            acceptedFolders: [],
            acceptedMoves: [],
            acceptedRules: [],
            acceptedTemplates: [],
            acceptedConsolidations: [],
          }];
          conv.apiHistory = [...conv.apiHistory, { role: 'assistant' as const, content }];
        });
      });
    },

    markFolderAccepted(msgIdx: number, proposalIdx: number) {
      update(state => {
        return updateActive(state, conv => {
          const msg = conv.displayMessages[msgIdx];
          if (msg && msg.acceptedFolders && !msg.acceptedFolders.includes(proposalIdx)) {
            msg.acceptedFolders = [...msg.acceptedFolders, proposalIdx];
            conv.displayMessages = [...conv.displayMessages];
          }
        });
      });
    },

    markRuleAccepted(msgIdx: number, proposalIdx: number) {
      update(state => {
        return updateActive(state, conv => {
          const msg = conv.displayMessages[msgIdx];
          if (msg && msg.acceptedRules && !msg.acceptedRules.includes(proposalIdx)) {
            msg.acceptedRules = [...msg.acceptedRules, proposalIdx];
            conv.displayMessages = [...conv.displayMessages];
          }
        });
      });
    },

    markMoveAccepted(msgIdx: number, proposalIdx: number) {
      update(state => {
        return updateActive(state, conv => {
          const msg = conv.displayMessages[msgIdx];
          if (msg && msg.acceptedMoves && !msg.acceptedMoves.includes(proposalIdx)) {
            msg.acceptedMoves = [...msg.acceptedMoves, proposalIdx];
            conv.displayMessages = [...conv.displayMessages];
          }
        });
      });
    },

    unmarkMoveAccepted(msgIdx: number, proposalIdx: number) {
      update(state => {
        return updateActive(state, conv => {
          const msg = conv.displayMessages[msgIdx];
          if (msg && msg.acceptedMoves) {
            msg.acceptedMoves = msg.acceptedMoves.filter(i => i !== proposalIdx);
            conv.displayMessages = [...conv.displayMessages];
          }
        });
      });
    },

    unmarkFolderAccepted(msgIdx: number, proposalIdx: number) {
      update(state => {
        return updateActive(state, conv => {
          const msg = conv.displayMessages[msgIdx];
          if (msg && msg.acceptedFolders) {
            msg.acceptedFolders = msg.acceptedFolders.filter(i => i !== proposalIdx);
            conv.displayMessages = [...conv.displayMessages];
          }
        });
      });
    },

    unmarkRuleAccepted(msgIdx: number, proposalIdx: number) {
      update(state => {
        return updateActive(state, conv => {
          const msg = conv.displayMessages[msgIdx];
          if (msg && msg.acceptedRules) {
            msg.acceptedRules = msg.acceptedRules.filter(i => i !== proposalIdx);
            conv.displayMessages = [...conv.displayMessages];
          }
        });
      });
    },

    markTemplateAccepted(msgIdx: number, proposalIdx: number) {
      update(state => {
        return updateActive(state, conv => {
          const msg = conv.displayMessages[msgIdx];
          if (msg && msg.acceptedTemplates && !msg.acceptedTemplates.includes(proposalIdx)) {
            msg.acceptedTemplates = [...msg.acceptedTemplates, proposalIdx];
            conv.displayMessages = [...conv.displayMessages];
          }
        });
      });
    },

    unmarkTemplateAccepted(msgIdx: number, proposalIdx: number) {
      update(state => {
        return updateActive(state, conv => {
          const msg = conv.displayMessages[msgIdx];
          if (msg && msg.acceptedTemplates) {
            msg.acceptedTemplates = msg.acceptedTemplates.filter(i => i !== proposalIdx);
            conv.displayMessages = [...conv.displayMessages];
          }
        });
      });
    },

    markConsolidationAccepted(msgIdx: number, proposalIdx: number) {
      update(state => {
        return updateActive(state, conv => {
          const msg = conv.displayMessages[msgIdx];
          if (msg && msg.acceptedConsolidations && !msg.acceptedConsolidations.includes(proposalIdx)) {
            msg.acceptedConsolidations = [...msg.acceptedConsolidations, proposalIdx];
            conv.displayMessages = [...conv.displayMessages];
          }
        });
      });
    },

    unmarkConsolidationAccepted(msgIdx: number, proposalIdx: number) {
      update(state => {
        return updateActive(state, conv => {
          const msg = conv.displayMessages[msgIdx];
          if (msg && msg.acceptedConsolidations) {
            msg.acceptedConsolidations = msg.acceptedConsolidations.filter(i => i !== proposalIdx);
            conv.displayMessages = [...conv.displayMessages];
          }
        });
      });
    },

    clear() {
      update(state => {
        return updateActive(state, conv => {
          conv.displayMessages = [];
          conv.apiHistory = [];
          conv.title = 'New conversation';
          conv.createdFolderMap = {};
        });
      });
    },
  };
}

export const chatStore = createChatStore();

// Derived stores for easy access
export const activeConversation = derived(chatStore, $state => {
  return $state.conversations.find(c => c.id === $state.activeId) || $state.conversations[0];
});

export const allConversations = derived(chatStore, $state => {
  return [...$state.conversations].sort((a, b) => b.createdAt - a.createdAt);
});
