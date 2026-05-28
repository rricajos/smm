# Testing

## Configuración

Smart Mail Manager usa [Vitest](https://vitest.dev/) 4.x para tests unitarios con cobertura v8.

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

## Ejecutar tests

```bash
npm test              # Ejecutar una vez
npm run test:watch    # Modo watch
npm run test:coverage # Reporte de cobertura completo
```

## Umbrales de cobertura

El pipeline de CI rechaza cualquier PR que no cumpla los umbrales mínimos:

| Métrica | Umbral | Actual |
|---------|--------|--------|
| Statements | 93% | 97.33% |
| Branches | 87% | 91.26% |
| Functions | 95% | 98.79% |
| Lines | 94% | 97.95% |

**Total: 917 tests** en 45 archivos de test.

## Cobertura por módulo

### Background (10 archivos de test)

| Archivo | Cobertura |
|---------|-----------|
| `classifier.test.ts` | Evaluación de condiciones, lógica AND/OR, operadores |
| `classifier.integration.test.ts` | Flujo completo de clasificación |
| `autoresponder.test.ts` | Generación de respuestas, rate limiting, modos de envío |
| `message-utils.test.ts` | Parsing de headers, extracción de cuerpo |
| `message-utils.integration.test.ts` | Lectura de mensajes MIME completos |
| `email-queries.test.ts` | Consultas de correos, snippets, etiquetado |
| `folder-ops.test.ts` | Creación, renombrado, eliminación de carpetas |
| `rule-testing.test.ts` | Test de reglas contra correos existentes |
| `index.test.ts` | Handlers de mensajes del background |
| `index.startup.test.ts` | Inicialización y polling |

### Servicios (5 archivos de test)

| Archivo | Cobertura |
|---------|-----------|
| `openai.test.ts` | Sanitización, extractJSON, buildSystemPrompt |
| `openai.api.test.ts` | Llamadas a API, parseo de respuestas, consolidación |
| `openai.connection.test.ts` | Permisos, testConnection, providers |
| `openai.extended.test.ts` | Chat, propuestas, parseRuleSuggestions |
| `ai-schemas.test.ts` | Schemas Zod, defaults, safeParseAI, validación |

### Stores (7 archivos de test)

| Archivo | Cobertura |
|---------|-----------|
| `rules.test.ts` | CRUD, reorder, toggle |
| `templates.test.ts` | CRUD, setTemplates |
| `settings.test.ts` | Save, update, defaults |
| `activity.test.ts` | Clear, persistencia |
| `chat.test.ts` | Conversaciones, mensajes, proposals, undo |
| `badges.test.ts` | Reset, sincronización |
| `synced-store.test.ts` | Factory, sync, onChanged |

### Utilidades (15 archivos de test)

| Archivo | Cobertura |
|---------|-----------|
| `rule-conflicts.test.ts` | Movimientos contradictorios, redundancia, prioridades |
| `rule-validation.test.ts` | Validación de nombre, condiciones, acciones, regex |
| `config-io.test.ts` | Export, import, conflictos por ID/nombre |
| `template-engine.test.ts` | Variables `{{}}`, extractName, extractEmail |
| `markdown.test.ts` | Headers, bold, code, listas, XSS |
| `storage.test.ts` | Wrapper browser.storage |
| `search.test.ts` | Búsqueda en reglas, plantillas, log |
| `csv-export.test.ts` | CSV con BOM, filtrado, ordenamiento |
| `validators.test.ts` | Validación y reparación de campos |
| `analytics.test.ts` | Datos semanales, stats por regla, top senders |
| `error.test.ts` | getErrorMessage con Error, string, unknown |
| `constants.test.ts` | Modelos AI, providers, constantes |
| `import-schemas.test.ts` | Schemas de validación de importación |
| `logger.test.ts` | Niveles de log, output |
| `rate-limiter.test.ts` | Concurrencia, rate limiting, reset |

### Componentes (4 archivos de test)

| Archivo | Cobertura |
|---------|-----------|
| `Button.test.ts` | Variantes, slots, eventos click |
| `Modal.test.ts` | Apertura, cierre, slots |
| `ConfirmDialog.test.ts` | Confirmación, cancelación |
| `Toast.test.ts` | Tipos, auto-dismiss |

### i18n (1 archivo de test)

| Archivo | Cobertura |
|---------|-----------|
| `i18n.test.ts` | Traducciones, cambio de idioma, onChanged, fallbacks |

### Otros (3 archivos de test)

| Archivo | Cobertura |
|---------|-----------|
| `integration.test.ts` | Integración de servicios background |
| `fetch-with-timeout.test.ts` | Timeout, reintentos, backoff exponencial |
| `rule-presets.test.ts` | Galería de presets de reglas |

## Mocking

### Globals del navegador

Los tests mockean `browser` y `messenger` usando `vi.stubGlobal()`:

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

El logger se mockea para suprimir output durante los tests:

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

## Añadir tests nuevos

1. Crear archivo `*.test.ts` junto al módulo que se quiere testear
2. Importar `describe`, `it`, `expect` de `vitest`
3. Mockear globals si el módulo usa `browser.*` o `messenger.*`
4. Ejecutar `npm run test:watch` para desarrollo iterativo
5. Verificar cobertura con `npm run test:coverage` antes de abrir PR
