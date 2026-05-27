# Testing

## Configuration

Smart Mail Manager uses [Vitest](https://vitest.dev/) 4.x for unit testing.

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '$lib': '/src/lib',
      '$types': '/src/types',
    },
  },
});
```

## Running tests

```bash
npm test           # Run once
npm run test:watch # Watch mode
```

## Coverage by module

### Background (~8 test files)

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

### Services (~4 test files)

| File | Coverage |
|------|----------|
| `openai.test.ts` | Sanitization, extractJSON, buildSystemPrompt |
| `openai.api.test.ts` | API calls, response parsing |
| `openai.extended.test.ts` | Chat, proposals, consolidation |
| `ai-schemas.test.ts` | Zod schemas, defaults, safeParseAI, validation |

### Stores (~7 test files)

| File | Coverage |
|------|----------|
| `rules.test.ts` | CRUD, reorder, toggle |
| `templates.test.ts` | CRUD, setTemplates |
| `settings.test.ts` | Save, update, defaults |
| `activity.test.ts` | Clear, persistence |
| `chat.test.ts` | Conversations, messages, proposals, undo |
| `badges.test.ts` | Reset, sync |
| `synced-store.test.ts` | Factory, sync, onChanged |

### Utilities (~11 test files)

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
| `validators.test.ts` | Field validation |
| `analytics.test.ts` | Weekly data, per-rule stats, top senders |
| `error.test.ts` | getErrorMessage with Error, string, unknown |

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
