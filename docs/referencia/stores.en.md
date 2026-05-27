# Stores

Stores are reactive Svelte objects synchronized with `browser.storage.local`. Located in `src/lib/stores/`.

## synced-store (Base factory)

`src/lib/stores/synced-store.ts`

Factory that creates Svelte stores with auto-synchronization:

```typescript
interface SyncedStore<T> {
  subscribe: Writable<T>['subscribe'];
  set: Writable<T>['set'];
  update: Writable<T>['update'];
  persist(value: T): Promise<void>;
}

function createSyncedStore<T>(
  storageKey: string,
  defaultValue: T,
  name: string
): SyncedStore<T>
```

**Behavior:**

1. Initializes with `defaultValue`
2. Loads value from `browser.storage.local.get(storageKey)` on creation
3. Listens to `browser.storage.onChanged` for cross-context sync
4. `persist()` serializes with `JSON.parse(JSON.stringify())` to avoid issues with Svelte 5 Proxies

---

## rules

`src/lib/stores/rules.ts` — Storage key: `smm_rules`

```typescript
const rules: {
  subscribe: Writable<Rule[]>['subscribe'];
  addRule(rule: Rule): Promise<void>;
  updateRule(id: string, partial: Partial<Rule>): Promise<void>;
  deleteRule(id: string): Promise<void>;
  reorderRules(ids: string[]): Promise<void>;
  setRules(newRules: Rule[]): Promise<void>;
  toggleRule(id: string): Promise<void>;
}
```

| Method | Description |
|--------|-------------|
| `addRule` | Appends a rule to the array |
| `updateRule` | Updates rule fields by ID (auto-updates `updatedAt`) |
| `deleteRule` | Removes a rule by ID |
| `reorderRules` | Reorders rules according to an array of IDs |
| `setRules` | Replaces all rules |
| `toggleRule` | Toggles `enabled` on a rule |

---

## templates

`src/lib/stores/templates.ts` — Storage key: `smm_templates`

```typescript
const templates: {
  subscribe: Writable<ResponseTemplate[]>['subscribe'];
  addTemplate(template: ResponseTemplate): Promise<void>;
  updateTemplate(id: string, partial: Partial<ResponseTemplate>): Promise<void>;
  deleteTemplate(id: string): Promise<void>;
  setTemplates(newTemplates: ResponseTemplate[]): Promise<void>;
}
```

---

## settings

`src/lib/stores/settings.ts` — Storage key: `smm_settings`

```typescript
const settings: {
  subscribe: Writable<Settings>['subscribe'];
  save(newSettings: Settings): Promise<void>;
  update(partial: Partial<Settings>): Promise<void>;
}
```

!!! note "Svelte 5 Proxy"
    `save()` creates an explicit plain object to prevent `structuredClone` from failing with Svelte 5's `$state` Proxies.

---

## activity

`src/lib/stores/activity.ts` — Storage key: `smm_activity_log`

```typescript
const activity: {
  subscribe: Writable<ActivityEntry[]>['subscribe'];
  clear(): Promise<void>;
}
```

Limit: 500 entries with automatic rotation. Periodic cleanup every 6 hours based on `logRetentionDays`.

---

## chatStore

`src/lib/stores/chat.ts` — Storage key: `smm_chat_history`

```typescript
const chatStore: {
  subscribe: Writable<ChatStoreState>['subscribe'];
  // Conversation management
  newConversation(): void;
  switchConversation(id: string): void;
  deleteConversation(id: string): void;
  renameConversation(id: string, title: string): void;
  // Folder map
  setFolderMapping(key: string, folderId: string): void;
  removeFolderMapping(key: string): void;
  // Messages
  addUserMessage(content: string): void;
  addAssistantMessage(content: string, ...proposals): void;
  // Accept/undo proposals
  markFolderAccepted(msgIdx: number, proposalIdx: number): void;
  unmarkFolderAccepted(msgIdx: number, proposalIdx: number): void;
  markRuleAccepted(msgIdx: number, proposalIdx: number): void;
  unmarkRuleAccepted(msgIdx: number, proposalIdx: number): void;
  markMoveAccepted(msgIdx: number, proposalIdx: number): void;
  unmarkMoveAccepted(msgIdx: number, proposalIdx: number): void;
  markTemplateAccepted(msgIdx: number, proposalIdx: number): void;
  unmarkTemplateAccepted(msgIdx: number, proposalIdx: number): void;
  markConsolidationAccepted(msgIdx: number, proposalIdx: number): void;
  unmarkConsolidationAccepted(msgIdx: number, proposalIdx: number): void;
  clear(): void;
}
```

**Derived stores:**

```typescript
const activeConversation: Readable<ChatConversation>;
const allConversations: Readable<ChatConversation[]>;  // Sorted by date desc
const storeReady: Writable<boolean>;  // true when initial load completes
```

Limit: 50 conversations. Oldest ones are automatically removed.

---

## badges

`src/lib/stores/badges.ts` — Storage key: `smm_unread_classifications`

```typescript
const unreadClassifications: {
  subscribe: Writable<number>['subscribe'];
  reset(): Promise<void>;
}
```
