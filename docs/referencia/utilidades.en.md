# Utilities

Utility modules located in `src/lib/utils/`.

## template-engine.ts

Variable substitution engine for response templates.

```typescript
/** Replaces {{variable}} with values from the map. Unfound variables are kept. */
function renderTemplate(template: string, variables: Record<string, string>): string

/** Extracts the name from an address like "Juan García <juan@example.com>" */
function extractName(address: string): string

/** Extracts the email from an address like "Juan García <juan@example.com>" */
function extractEmail(address: string): string
```

## rule-conflicts.ts

Conflict detection between enabled rules.

```typescript
interface RuleConflict {
  ruleA: { id: string; name: string };
  ruleB: { id: string; name: string };
  type: 'contradictory_move' | 'redundant' | 'contradictory_priority';
  description: string;
  params?: Record<string, string>;
  severity: 'warning' | 'info';
}

/** Detects conflicts between all enabled rules. */
function detectRuleConflicts(rules: Rule[]): RuleConflict[]
```

**Algorithm:** Compares each pair of enabled rules. Two rules are considered overlapping if they share at least one condition on the same field with the same operator and contained values (case-insensitive substring match).

## rule-validation.ts

Rule validation extracted from the rule editor.

```typescript
/** Validates rule fields, conditions, and actions. Returns array of errors (empty = valid). */
function validateRule(
  name: string,
  conditions: Condition[],
  actions: Action[],
  t: (key: string, params?: Record<string, string | number>) => string
): string[]
```

**Validations:**

- Non-empty name
- At least one condition
- At least one action
- Conditions with non-empty value (except `hasAttachments`)
- Valid regex if operator is `matches`
- `moveToFolder` requires `folderId`
- `addTag` requires `tagKey`
- `autoRespond` requires `templateId`

## config-io.ts

Configuration import and export.

```typescript
interface ExportData {
  version: 1;
  exportedAt: string;
  rules: Rule[];
  templates: ResponseTemplate[];
  settings: Settings;
}

interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  data: ExportData | null;
  conflicts: {
    rules: ConflictItem<Rule>[];
    templates: ConflictItem<ResponseTemplate>[];
  };
  newItems: {
    rules: Rule[];
    templates: ResponseTemplate[];
  };
}

/** Exports complete configuration (without API key). */
function exportConfiguration(rules, templates, settings): ExportData

/** Validates the structure of imported JSON. */
function validateImportData(raw: unknown): { valid: boolean; errors: string[]; data: ExportData | null }

/** Detects conflicts by ID and name between imported and existing data. */
function detectConflicts(data, existingRules, existingTemplates): ImportValidationResult
```

## markdown.ts

Markdown to HTML rendering for the AI chat.

```typescript
/** Converts markdown to safe HTML. Escapes HTML before processing. */
function renderMarkdown(text: string): string
```

**Supports:** headers (`#`, `##`, `###`), **bold**, *italic*, `` `inline code` ``, code blocks, bullet lists with `-`/`*` and numbered lists, line breaks.

**Security:** HTML is escaped before markdown processing, preventing XSS.

## search.ts

Global search across rules, templates, and log.

```typescript
interface SearchResult {
  type: 'rule' | 'template' | 'log';
  id: string;
  title: string;
  subtitle: string;
  tabId: string;
}

function searchRules(query: string, rules: Rule[], labels: SearchLabels, max?: number): SearchResult[]
function searchTemplates(query: string, templates: ResponseTemplate[], max?: number): SearchResult[]
function searchActivity(query: string, entries: ActivityEntry[], labels: SearchLabels, max?: number): SearchResult[]
```

## csv-export.ts

Activity log CSV export.

```typescript
/** Converts entries to CSV with UTF-8 BOM for Excel compatibility. */
function activityToCSV(entries: ActivityEntry[], headers?: string[]): string

/** Filters and sorts entries by type, search query, and column. */
function filterAndSortActivity(entries: ActivityEntry[], opts: {
  filterType: 'all' | 'classification' | 'autoResponse' | 'error';
  searchQuery: string;
  sortColumn: 'timestamp' | 'type' | 'ruleName' | 'subject' | 'from';
  sortDir: 'asc' | 'desc';
}): ActivityEntry[]
```

## analytics.ts

Statistics and chart data.

```typescript
/** Activity data for the last 7 days (dayIndex 0 = 6 days ago). */
function computeWeeklyData(log: ActivityEntry[], now?: number): WeeklyDataPoint[]

/** Top rules by match count. */
function computeRuleStats(entries: ActivityEntry[], limit?: number): RuleStat[]

/** Top senders by classification count. */
function computeTopSenders(entries: ActivityEntry[], limit?: number): SenderStat[]

/** Filters entries by time range (7d, 30d, all). */
function filterByTimeRange(entries: ActivityEntry[], range: '7d' | '30d' | 'all', now?: number): ActivityEntry[]
```

## constants.ts

Project constants.

| Constant | Value | Description |
|----------|-------|-------------|
| `STORAGE_KEYS` | Object | `browser.storage.local` keys |
| `DEFAULT_SETTINGS` | Object | Settings default values |
| `OPENAI_MODELS` | Array | Models available via OpenRouter |
| `OPENAI_DIRECT_MODELS` | Array | Models for direct OpenAI API |
| `ANTHROPIC_DIRECT_MODELS` | Array | Models for direct Anthropic API |
| `GOOGLE_DIRECT_MODELS` | Array | Models for direct Google API |
| `AI_PROVIDERS` | Object | Endpoint configurations per provider |
| `TEMPLATE_VARIABLES` | Array | Variables available in templates |
| `MAX_ACTIVITY_LOG_ENTRIES` | 500 | Activity log entry limit |
| `MAX_EMAIL_SNIPPET_LENGTH` | 150 | Max email snippet length |
| `MAX_SANITIZED_CONTENT_LENGTH` | 500 | Max sanitized content length |
| `MAX_CHAT_EMAILS` | 30 | Max emails in chat context |
| `REGEX_MAX_INPUT_LENGTH` | 10000 | Max length for regex evaluation |

## error.ts

```typescript
/** Extracts a human-readable message from an unknown error. */
function getErrorMessage(err: unknown): string
```

Handles `Error`, `string`, and other types.
