import { writable, derived } from 'svelte/store';
import type { FolderProposal, MoveProposal, RuleProposal, ChatMessage } from '../services/openai';
import { STORAGE_KEYS } from '../utils/constants';

declare const browser: any;

export interface StoredDisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  folderProposals?: FolderProposal[];
  moveProposals?: MoveProposal[];
  ruleProposals?: RuleProposal[];
  acceptedFolders?: number[];
  acceptedMoves?: number[];
  acceptedRules?: number[];
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: number;
  displayMessages: StoredDisplayMessage[];
  apiHistory: ChatMessage[];
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
    title: 'Nueva conversacion',
    createdAt: Date.now(),
    displayMessages: [],
    apiHistory: [],
  };
}

function createChatStore() {
  const initial = createEmptyConversation();
  const { subscribe, set, update } = writable<ChatStoreState>({
    conversations: [initial],
    activeId: initial.id,
  });

  // Load from storage (backward compatible with old single-conversation format)
  try {
    if (typeof browser !== 'undefined' && browser?.storage?.local) {
      browser.storage.local.get(STORAGE_KEYS.CHAT_HISTORY).then((result: any) => {
        const saved = result[STORAGE_KEYS.CHAT_HISTORY];
        if (saved) {
          if (saved.conversations && saved.activeId) {
            // New multi-conversation format
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
      });
    }
  } catch { /* ignore */ }

  function persist(state: ChatStoreState) {
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
    ) {
      update(state => {
        return updateActive(state, conv => {
          conv.displayMessages = [...conv.displayMessages, {
            role: 'assistant' as const,
            content,
            folderProposals,
            moveProposals,
            ruleProposals,
            acceptedFolders: [],
            acceptedMoves: [],
            acceptedRules: [],
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

    clear() {
      update(state => {
        return updateActive(state, conv => {
          conv.displayMessages = [];
          conv.apiHistory = [];
          conv.title = 'Nueva conversacion';
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
