# AI Services

AI provider integration modules, located in `src/lib/services/`.

## openai.ts

Main AI service. Manages calls to all supported providers.

### Public interfaces

```typescript
interface EmailSummary {
  from: string;
  subject: string;
  snippet: string;
}

interface FolderInfo {
  id: string;
  name: string;
  path: string;
}

interface TagInfo {
  key: string;
  tag: string;
  color: string;
}

interface RuleSuggestion {
  rule: Rule;
  explanation: string;
  confidence: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantResponse {
  message: string;
  folderProposals: FolderProposal[];
  moveProposals: MoveProposal[];
  ruleProposals: RuleProposal[];
  templateProposals: TemplateProposal[];
  ruleConsolidationProposals: RuleConsolidationProposal[];
}
```

### Exported functions

#### `sanitizeEmailContent(text: string): string`

Sanitizes email content for sending to AI. Truncates to `MAX_SANITIZED_CONTENT_LENGTH` (500 characters).

#### `extractJSON(text: string, loc?: SupportedLocale): unknown`

Robustly extracts JSON from AI responses. Handles JSON wrapped in markdown code blocks or surrounded by text.

#### `buildSystemPrompt(folders, tags, existingRules, loc?): string`

Builds the system prompt with full mailbox context.

#### `parseRuleSuggestions(data: unknown, loc?): RuleSuggestion[]`

Parses AI response and returns Zod-validated rule suggestions.

#### `generateRulesFromEmails(emails, folders, tags, existingRules, apiKey, model, provider?, customBaseUrl?): Promise<RuleSuggestion[]>`

Analyzes emails and generates rule suggestions.

#### `generateRuleFromDescription(description, folders, tags, existingRules, apiKey, model, provider?, customBaseUrl?): Promise<RuleSuggestion[]>`

Generates a rule from a natural language description.

#### `chatWithAssistant(messages, folders, tags, existingRules, emails, apiKey, model, provider?, customBaseUrl?, existingTemplates?): Promise<AssistantResponse>`

Conversational chat with full context. Returns message + proposals.

#### `testConnection(apiKey, model, provider?, customBaseUrl?): Promise<boolean>`

Verifies that the API key and model work.

### Providers

The service supports two API formats:

| Format | Providers | Endpoint |
|--------|-----------|----------|
| **OpenAI-compatible** | OpenRouter, OpenAI, Google Gemini, Custom | `/chat/completions` |
| **Anthropic** | Anthropic | `/v1/messages` |

The internal `callAI()` function automatically selects the correct format based on the configured provider.

---

## ai-schemas.ts

Zod schemas for runtime validation of AI responses.

### Schemas

```typescript
const conditionSchema: z.ZodObject<{
  field: z.ZodCatch<z.ZodString>;        // default: 'subject'
  operator: z.ZodCatch<z.ZodString>;     // default: 'contains'
  value: z.ZodCatch<z.ZodString>;        // default: ''
  boolValue: z.ZodOptional<z.ZodBoolean>;
  caseSensitive: z.ZodCatch<z.ZodBoolean>; // default: false
}>;

const actionSchema: z.ZodObject<{
  type: z.ZodCatch<z.ZodString>;         // default: 'markRead'
  folderId: z.ZodOptional<z.ZodString>;
  tagKey: z.ZodOptional<z.ZodString>;
  priority: z.ZodOptional<z.ZodString>;
  templateId: z.ZodOptional<z.ZodString>;
}>;

const ruleDataSchema: z.ZodObject<{
  name: z.ZodCatch<z.ZodString>;
  explanation: z.ZodCatch<z.ZodString>;
  confidence: z.ZodCatch<z.ZodNumber>;   // 0-1, default: 0.5
  conditionLogic: z.ZodCatch<z.ZodString>;
  conditions: z.ZodCatch<z.ZodArray>;
  actions: z.ZodCatch<z.ZodArray>;
  description: z.ZodCatch<z.ZodString>;
}>;

const rulesResponseSchema: z.ZodObject<{
  rules: z.ZodCatch<z.ZodArray>;
}>;

const consultantResponseSchema: z.ZodObject<{
  message: z.ZodCatch<z.ZodString>;
  folder_proposals: z.ZodCatch<z.ZodArray>;
  move_proposals: z.ZodCatch<z.ZodArray>;
  rule_proposals: z.ZodCatch<z.ZodArray>;
  template_proposals: z.ZodCatch<z.ZodArray>;
  rule_consolidation_proposals: z.ZodCatch<z.ZodArray>;
}>;
```

### safeParseAI

```typescript
function safeParseAI<T>(
  schema: z.ZodType<T>,
  data: unknown,
  label: string
): T
```

Safely parses data against a Zod schema:

1. Attempts `safeParse(data)`
2. On success, returns validated data with defaults applied
3. On failure, logs warning and returns `schema.parse({})` (object with all defaults)

!!! info "`.catch()` vs `.default()`"
    Schemas use `.catch()` instead of `.default()`. The difference is that `.catch()` handles both missing values AND type errors (e.g., when the AI sends `confidence: "high"` instead of `0.8`), while `.default()` only handles `undefined` values.
