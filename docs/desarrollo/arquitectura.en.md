# Architecture

## Project structure

```
src/
├── background/              # Service worker (Manifest V2 background page)
│   ├── index.ts             # Entry point: listeners, polling, cleanup
│   ├── classifier.ts        # Classification engine: evaluates rules against messages
│   ├── autoresponder.ts     # Generates and sends responses using templates
│   ├── message-utils.ts     # Utilities for message headers and body
│   ├── email-queries.ts     # Recent email queries and headers
│   ├── folder-ops.ts        # Folder operations (create, rename, move)
│   └── rule-testing.ts      # Test rules against existing emails
│
├── lib/
│   ├── components/          # Shared Svelte 5 components
│   │   ├── Button.svelte
│   │   ├── Modal.svelte
│   │   ├── Toast.svelte
│   │   └── ConfirmDialog.svelte
│   │
│   ├── i18n/                # Internationalization system
│   │   ├── index.ts         # Reactive store: t, locale, setLocale(), translate()
│   │   ├── types.ts         # Translations interface (~650 keys)
│   │   └── locales/
│   │       ├── es.ts
│   │       └── en.ts
│   │
│   ├── services/
│   │   ├── openai.ts        # AI service: classification, chat, proposals
│   │   └── ai-schemas.ts    # Zod schemas for AI response validation
│   │
│   ├── stores/              # Reactive stores (writable + browser.storage)
│   │   ├── synced-store.ts  # Base factory: auto-sync with browser.storage.local
│   │   ├── settings.ts      # General settings
│   │   ├── rules.ts         # Classification rules
│   │   ├── templates.ts     # Response templates
│   │   ├── activity.ts      # Activity log (max 500)
│   │   ├── chat.ts          # AI conversation history
│   │   └── badges.ts        # Unread classifications counter
│   │
│   └── utils/
│       ├── constants.ts     # AI models, providers, defaults, template variables
│       ├── config-io.ts     # Import/export validation and merge
│       ├── rule-conflicts.ts # Rule conflict detection
│       ├── rule-presets.ts  # Preset gallery
│       ├── rule-validation.ts # Rule validation (extracted from RuleEditor)
│       ├── template-engine.ts # {{variable}} substitution
│       ├── markdown.ts      # Markdown rendering for chat
│       ├── search.ts        # Global search
│       ├── csv-export.ts    # Activity log CSV export
│       ├── analytics.ts     # Statistics and charts
│       ├── storage.ts       # browser.storage.local wrapper
│       ├── error.ts         # getErrorMessage utility
│       ├── validators.ts    # Data validators
│       ├── logger.ts        # Unified logger
│       └── messenger.d.ts   # TypeScript types for Thunderbird messenger.* APIs
│
├── space/                   # Main panel (Thunderbird tab space)
│   ├── main.ts
│   ├── App.svelte           # Tab navigation router
│   ├── pages/
│   │   ├── Dashboard.svelte
│   │   ├── Rules.svelte
│   │   ├── Templates.svelte
│   │   ├── AI.svelte
│   │   └── Log.svelte
│   └── components/
│       ├── RuleEditor.svelte
│       ├── ConditionRow.svelte
│       ├── ActionRow.svelte
│       ├── TemplateEditor.svelte
│       ├── ChatPanel.svelte
│       ├── ChatWelcome.svelte
│       ├── QuickPanel.svelte
│       ├── ProposalBlock.svelte
│       ├── FolderTree.svelte
│       ├── GlobalSearch.svelte
│       ├── PresetGallery.svelte
│       └── ImportModal.svelte
│
├── popup/                   # Extension button popup
│   ├── main.ts
│   └── App.svelte
│
├── options/                 # Options page
│   ├── main.ts
│   └── App.svelte
│
└── types/
    ├── rules.ts
    ├── templates.ts
    └── settings.ts
```

## Data flows

### Automatic classification

```
New email
  → background/index.ts (onNewMailReceived listener)
    → classifier.ts: evaluates each enabled rule against the message
      → Compares conditions (from, to, subject, body, hasAttachments)
      → AND (all) / OR (any) logic
      → Match found:
        → Executes actions sequentially:
          - moveToFolder → messenger.messages.move()
          - addTag → messenger.messages.update({ tags })
          - setPriority → X-Priority header change
          - markRead → messenger.messages.update({ read: true })
          - autoRespond → autoresponder.ts
        → Logs in activity log
        → Notification (if enabled)
        → If stopProcessing → stop
```

### Auto-response

```
autoRespond action triggered
  → autoresponder.ts: checks rate limit
    → Loads template by templateId
    → template-engine.ts: replaces {{variables}}
    → Based on sendMode:
      - draft → messenger.compose.beginReply() + saveMessage()
      - sendNow → messenger.compose.beginReply() + sendMessage()
      - sendLater → sendMessage({ mode: "sendLater" })
```

### AI chat

```
User writes message → AI.svelte
  → openai.ts: chatWithAssistant()
    → Builds context: rules, templates, folders, tags, emails
    → Sends to configured AI provider
    → Receives response with text + JSON proposals
    → ai-schemas.ts: validates with Zod (safeParseAI)
    → Parses proposals: FOLDER, RULE, TEMPLATE, MOVE, CONSOLIDATION
    → Resolves cross-references (NEW_RULE:Name → UUID)
  → ProposalBlock.svelte: renders each proposal
    → Accept → applies change
    → Reject → discards
```

## Entry points

The extension has 4 entry points compiled as self-contained IIFEs:

| Entry point | Svelte | Output | Description |
|-------------|--------|--------|-------------|
| `popup` | Yes | `dist/popup.{html,js,css}` | Extension button popup |
| `space` | Yes | `dist/space.{html,js,css}` | Main panel |
| `options` | Yes | `dist/options.{html,js,css}` | Options page |
| `background` | No | `dist/background.js` | Service worker |

## Background ↔ UI communication

The UI communicates with the background script via `messenger.runtime.sendMessage()` with a typed **discriminated union**:

```typescript
type BackgroundMessage =
  | { type: 'CLASSIFY_MESSAGE'; messageId: number }
  | { type: 'GET_FOLDERS' }
  | { type: 'GET_TAGS' }
  | { type: 'CREATE_FOLDER'; parentFolderId: string; folderName: string }
  | { type: 'DELETE_FOLDER'; folderId: string }
  // ... 18 types in total
```

The handler in `background/index.ts` uses a `switch` on `message.type` with automatic TypeScript narrowing.
