# Stores

Los stores son objetos reactivos de Svelte sincronizados con `browser.storage.local`. Se ubican en `src/lib/stores/`.

## synced-store (Factory base)

`src/lib/stores/synced-store.ts`

Factory que crea stores Svelte con auto-sincronización:

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

**Comportamiento:**

1. Inicializa con `defaultValue`
2. Carga valor de `browser.storage.local.get(storageKey)` al crear
3. Escucha `browser.storage.onChanged` para sincronización cross-context
4. `persist()` serializa con `JSON.parse(JSON.stringify())` para evitar problemas con Proxies de Svelte 5

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

| Método | Descripción |
|--------|-------------|
| `addRule` | Añade una regla al final del array |
| `updateRule` | Actualiza campos de una regla por ID (auto-actualiza `updatedAt`) |
| `deleteRule` | Elimina una regla por ID |
| `reorderRules` | Reordena las reglas según un array de IDs |
| `setRules` | Reemplaza todas las reglas |
| `toggleRule` | Invierte `enabled` de una regla |

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

!!! note "Proxy de Svelte 5"
    `save()` crea un objeto plano explícito para evitar que `structuredClone` falle con los Proxies `$state` de Svelte 5.

---

## activity

`src/lib/stores/activity.ts` — Storage key: `smm_activity_log`

```typescript
const activity: {
  subscribe: Writable<ActivityEntry[]>['subscribe'];
  clear(): Promise<void>;
}
```

Límite: 500 entradas con rotación automática. Limpieza periódica cada 6 horas según `logRetentionDays`.

---

## chatStore

`src/lib/stores/chat.ts` — Storage key: `smm_chat_history`

```typescript
const chatStore: {
  subscribe: Writable<ChatStoreState>['subscribe'];
  // Gestión de conversaciones
  newConversation(): void;
  switchConversation(id: string): void;
  deleteConversation(id: string): void;
  renameConversation(id: string, title: string): void;
  // Folder map
  setFolderMapping(key: string, folderId: string): void;
  removeFolderMapping(key: string): void;
  // Mensajes
  addUserMessage(content: string): void;
  addAssistantMessage(content: string, ...proposals): void;
  // Aceptar/deshacer propuestas
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

**Stores derivados:**

```typescript
const activeConversation: Readable<ChatConversation>;
const allConversations: Readable<ChatConversation[]>;  // Ordenadas por fecha desc
const storeReady: Writable<boolean>;  // true cuando la carga inicial termina
```

Límite: 50 conversaciones. Las más antiguas se eliminan automáticamente.

---

## badges

`src/lib/stores/badges.ts` — Storage key: `smm_unread_classifications`

```typescript
const unreadClassifications: {
  subscribe: Writable<number>['subscribe'];
  reset(): Promise<void>;
}
```
