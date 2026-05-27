# Servicios AI

Módulos de integración con proveedores de inteligencia artificial, ubicados en `src/lib/services/`.

## openai.ts

Servicio principal de IA. Gestiona las llamadas a todos los proveedores soportados.

### Interfaces públicas

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

### Funciones exportadas

#### `sanitizeEmailContent(text: string): string`

Limpia contenido de email para enviar al AI. Trunca a `MAX_SANITIZED_CONTENT_LENGTH` (500 caracteres).

#### `extractJSON(text: string, loc?: SupportedLocale): unknown`

Extrae JSON robusto de respuestas AI. Maneja JSON envuelto en bloques de código markdown o rodeado de texto.

#### `buildSystemPrompt(folders, tags, existingRules, loc?): string`

Construye el system prompt con el contexto completo del buzón.

#### `parseRuleSuggestions(data: unknown, loc?): RuleSuggestion[]`

Parsea respuesta AI y devuelve sugerencias de reglas validadas con Zod.

#### `generateRulesFromEmails(emails, folders, tags, existingRules, apiKey, model, provider?, customBaseUrl?): Promise<RuleSuggestion[]>`

Analiza correos y genera sugerencias de reglas.

#### `generateRuleFromDescription(description, folders, tags, existingRules, apiKey, model, provider?, customBaseUrl?): Promise<RuleSuggestion[]>`

Genera regla a partir de una descripción en lenguaje natural.

#### `chatWithAssistant(messages, folders, tags, existingRules, emails, apiKey, model, provider?, customBaseUrl?, existingTemplates?): Promise<AssistantResponse>`

Chat conversacional con contexto completo. Devuelve mensaje + propuestas.

#### `testConnection(apiKey, model, provider?, customBaseUrl?): Promise<boolean>`

Verifica que la clave API y modelo funcionan.

### Proveedores

El servicio soporta dos formatos de API:

| Formato | Proveedores | Endpoint |
|---------|-------------|----------|
| **OpenAI-compatible** | OpenRouter, OpenAI, Google Gemini, Custom | `/chat/completions` |
| **Anthropic** | Anthropic | `/v1/messages` |

La función interna `callAI()` selecciona automáticamente el formato correcto según el provider configurado.

---

## ai-schemas.ts

Schemas Zod para validación runtime de respuestas AI.

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

Parsea datos contra un schema Zod de forma segura:

1. Intenta `safeParse(data)`
2. Si tiene éxito, devuelve datos validados con defaults aplicados
3. Si falla, logea warning y devuelve `schema.parse({})` (objeto con todos los defaults)

!!! info "`.catch()` vs `.default()`"
    Los schemas usan `.catch()` en lugar de `.default()`. La diferencia es que `.catch()` maneja tanto valores faltantes como errores de tipo (por ejemplo, cuando el AI envía `confidence: "high"` en vez de `0.8`), mientras que `.default()` solo maneja valores `undefined`.
