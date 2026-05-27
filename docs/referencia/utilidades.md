# Utilidades

Módulos utilitarios ubicados en `src/lib/utils/`.

## template-engine.ts

Motor de sustitución de variables para plantillas de respuesta.

```typescript
/** Reemplaza {{variable}} con valores del mapa. Variables no encontradas se mantienen. */
function renderTemplate(template: string, variables: Record<string, string>): string

/** Extrae el nombre de una dirección tipo "Juan García <juan@example.com>" */
function extractName(address: string): string

/** Extrae el email de una dirección tipo "Juan García <juan@example.com>" */
function extractEmail(address: string): string
```

## rule-conflicts.ts

Detección de conflictos entre reglas habilitadas.

```typescript
interface RuleConflict {
  ruleA: { id: string; name: string };
  ruleB: { id: string; name: string };
  type: 'contradictory_move' | 'redundant' | 'contradictory_priority';
  description: string;
  params?: Record<string, string>;
  severity: 'warning' | 'info';
}

/** Detecta conflictos entre todas las reglas habilitadas. */
function detectRuleConflicts(rules: Rule[]): RuleConflict[]
```

**Algoritmo:** Compara cada par de reglas habilitadas. Dos reglas se consideran solapadas si comparten al menos una condición en el mismo campo con el mismo operador y valores contenidos (substring match case-insensitive).

## rule-validation.ts

Validación de reglas extraída del editor de reglas.

```typescript
/** Valida campos, condiciones y acciones de una regla. Devuelve array de errores (vacío = válido). */
function validateRule(
  name: string,
  conditions: Condition[],
  actions: Action[],
  t: (key: string, params?: Record<string, string | number>) => string
): string[]
```

**Validaciones:**

- Nombre no vacío
- Al menos una condición
- Al menos una acción
- Condiciones con valor no vacío (excepto `hasAttachments`)
- Regex válida si operador es `matches`
- `moveToFolder` requiere `folderId`
- `addTag` requiere `tagKey`
- `autoRespond` requiere `templateId`

## config-io.ts

Importación y exportación de configuración.

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

/** Exporta configuración completa (sin API key). */
function exportConfiguration(rules, templates, settings): ExportData

/** Valida estructura del JSON importado. */
function validateImportData(raw: unknown): { valid: boolean; errors: string[]; data: ExportData | null }

/** Detecta conflictos por ID y nombre entre datos importados y existentes. */
function detectConflicts(data, existingRules, existingTemplates): ImportValidationResult
```

## markdown.ts

Renderizado de markdown a HTML para el chat de IA.

```typescript
/** Convierte markdown a HTML seguro. Escapa HTML antes de procesar. */
function renderMarkdown(text: string): string
```

**Soporta:** headers (`#`, `##`, `###`), **bold**, *italic*, `` `inline code` ``, bloques de código, listas con `-`/`*` y numeradas, saltos de línea.

**Seguridad:** HTML se escapa antes del procesamiento de markdown, previniendo XSS.

## search.ts

Búsqueda global en reglas, plantillas y log.

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

Exportación del log de actividad a CSV.

```typescript
/** Convierte entradas a CSV con BOM UTF-8 para compatibilidad con Excel. */
function activityToCSV(entries: ActivityEntry[], headers?: string[]): string

/** Filtra y ordena entradas por tipo, búsqueda y columna. */
function filterAndSortActivity(entries: ActivityEntry[], opts: {
  filterType: 'all' | 'classification' | 'autoResponse' | 'error';
  searchQuery: string;
  sortColumn: 'timestamp' | 'type' | 'ruleName' | 'subject' | 'from';
  sortDir: 'asc' | 'desc';
}): ActivityEntry[]
```

## analytics.ts

Estadísticas y datos para gráficos.

```typescript
/** Datos de actividad de los últimos 7 días (dayIndex 0 = hace 6 días). */
function computeWeeklyData(log: ActivityEntry[], now?: number): WeeklyDataPoint[]

/** Top reglas por número de coincidencias. */
function computeRuleStats(entries: ActivityEntry[], limit?: number): RuleStat[]

/** Top remitentes por número de clasificaciones. */
function computeTopSenders(entries: ActivityEntry[], limit?: number): SenderStat[]

/** Filtra entradas por rango temporal (7d, 30d, all). */
function filterByTimeRange(entries: ActivityEntry[], range: '7d' | '30d' | 'all', now?: number): ActivityEntry[]
```

## constants.ts

Constantes del proyecto.

| Constante | Valor | Descripción |
|-----------|-------|-------------|
| `STORAGE_KEYS` | Objeto | Claves de `browser.storage.local` |
| `DEFAULT_SETTINGS` | Objeto | Valores por defecto de Settings |
| `OPENAI_MODELS` | Array | Modelos disponibles via OpenRouter |
| `OPENAI_DIRECT_MODELS` | Array | Modelos para API directa de OpenAI |
| `ANTHROPIC_DIRECT_MODELS` | Array | Modelos para API directa de Anthropic |
| `GOOGLE_DIRECT_MODELS` | Array | Modelos para API directa de Google |
| `AI_PROVIDERS` | Objeto | Configuraciones de endpoints por proveedor |
| `TEMPLATE_VARIABLES` | Array | Variables disponibles en plantillas |
| `MAX_ACTIVITY_LOG_ENTRIES` | 500 | Límite de entradas en el log |
| `MAX_EMAIL_SNIPPET_LENGTH` | 150 | Longitud máxima de snippets de email |
| `MAX_SANITIZED_CONTENT_LENGTH` | 500 | Longitud máxima de contenido sanitizado |
| `MAX_CHAT_EMAILS` | 30 | Máximo de correos en contexto del chat |
| `REGEX_MAX_INPUT_LENGTH` | 10000 | Longitud máxima para evaluación de regex |

## error.ts

```typescript
/** Extrae mensaje legible de un error desconocido. */
function getErrorMessage(err: unknown): string
```

Maneja `Error`, `string` y otros tipos.
