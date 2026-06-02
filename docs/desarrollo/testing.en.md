# Testing

## Configuration

Smart Mail Manager uses [Vitest](https://vitest.dev/) 4.x for unit testing with v8 coverage.

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/lib/test-setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 93,
        branches: 87,
        functions: 95,
        lines: 94,
      },
    },
  },
});
```

## Running tests

```bash
npm test              # Run once
npm run test:watch    # Watch mode
npm run test:coverage # Full coverage report
```

## Coverage thresholds

The CI pipeline rejects any PR that does not meet the minimum thresholds:

| Metric | Threshold | Current |
|--------|-----------|---------|
| Statements | 93% | 97.33% |
| Branches | 87% | 91.26% |
| Functions | 95% | 98.79% |
| Lines | 94% | 97.95% |

**Total: 939 tests** across 47 test files.

## Coverage by module

### Background (10 test files)

| File | Coverage |
|------|----------|
| `classifier.test.ts` | Condition evaluation, AND/OR logic, operators |
| `classifier.integration.test.ts` | Full classification flow |
| `autoresponder.test.ts` | Response generation, rate limiting, send modes |
| `message-utils.test.ts` | Header parsing, body extraction |
| `message-utils.integration.test.ts` | Full MIME message reading |
| `email-queries.test.ts` | Email queries, snippets, tagging |
| `folder-ops.test.ts` | Folder creation, renaming, deletion |
| `rule-testing.test.ts` | Rule testing against existing emails |
| `index.test.ts` | Background message handlers |
| `index.startup.test.ts` | Initialization and polling |

### Services (5 test files)

| File | Coverage |
|------|----------|
| `openai.test.ts` | Sanitization, extractJSON, buildSystemPrompt |
| `openai.api.test.ts` | API calls, response parsing, consolidation |
| `openai.connection.test.ts` | Permissions, testConnection, providers |
| `openai.extended.test.ts` | Chat, proposals, parseRuleSuggestions |
| `ai-schemas.test.ts` | Zod schemas, defaults, safeParseAI, validation |

### Stores (7 test files)

| File | Coverage |
|------|----------|
| `rules.test.ts` | CRUD, reorder, toggle |
| `templates.test.ts` | CRUD, setTemplates |
| `settings.test.ts` | Save, update, defaults |
| `activity.test.ts` | Clear, persistence |
| `chat.test.ts` | Conversations, messages, proposals, undo |
| `badges.test.ts` | Reset, sync |
| `synced-store.test.ts` | Factory, sync, onChanged |

### Utilities (15 test files)

| File | Coverage |
|------|----------|
| `rule-conflicts.test.ts` | Contradictory moves, redundancy, priorities |
| `rule-validation.test.ts` | Name, conditions, actions, regex validation |
| `config-io.test.ts` | Export, import, conflicts by ID/name |
| `template-engine.test.ts` | `{{}}` variables, extractName, extractEmail |
| `markdown.test.ts` | Headers, bold, code, lists, XSS |
| `storage.test.ts` | browser.storage wrapper |
| `search.test.ts` | Search in rules, templates, log |
| `csv-export.test.ts` | CSV with BOM, filtering, sorting |
| `validators.test.ts` | Field validation and repair |
| `analytics.test.ts` | Weekly data, per-rule stats, top senders |
| `error.test.ts` | getErrorMessage with Error, string, unknown |
| `constants.test.ts` | AI models, providers, constants |
| `import-schemas.test.ts` | Import validation schemas |
| `logger.test.ts` | Log levels, output |
| `rate-limiter.test.ts` | Concurrency, rate limiting, reset |

### Components (4 test files)

| File | Coverage |
|------|----------|
| `Button.test.ts` | Variants, slots, click events |
| `Modal.test.ts` | Open, close, slots |
| `ConfirmDialog.test.ts` | Confirm, cancel |
| `Toast.test.ts` | Types, auto-dismiss |

### i18n (1 test file)

| File | Coverage |
|------|----------|
| `i18n.test.ts` | Translations, language switching, onChanged, fallbacks |

### Other (3 test files)

| File | Coverage |
|------|----------|
| `integration.test.ts` | Background service integration |
| `fetch-with-timeout.test.ts` | Timeout, retries, exponential backoff |
| `rule-presets.test.ts` | Rule preset gallery |

## Mocking

### Browser globals

Tests mock `browser` and `messenger` using `vi.stubGlobal()`:

```typescript
vi.stubGlobal('browser', {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: { addListener: vi.fn() },
  },
});
```

### Logger

The logger is mocked to suppress output during tests:

```typescript
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
```

## Adding new tests

1. Create a `*.test.ts` file alongside the module you want to test
2. Import `describe`, `it`, `expect` from `vitest`
3. Mock globals if the module uses `browser.*` or `messenger.*`
4. Run `npm run test:watch` for iterative development
5. Verify coverage with `npm run test:coverage` before opening a PR
