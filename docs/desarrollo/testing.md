# Testing

## Configuración

Smart Mail Manager usa [Vitest](https://vitest.dev/) 4.x para tests unitarios.

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

## Ejecutar tests

```bash
npm test           # Ejecutar una vez
npm run test:watch # Modo watch
```

## Cobertura por módulo

### Background (~8 archivos de test)

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `classifier.test.ts` | Evaluación de condiciones, lógica AND/OR, operadores |
| `classifier.integration.test.ts` | Flujo completo de clasificación |
| `autoresponder.test.ts` | Generación de respuestas, rate limiting, modos de envío |
| `message-utils.test.ts` | Parsing de headers, extracción de cuerpo |
| `message-utils.integration.test.ts` | Lectura de mensajes MIME completos |
| `email-queries.test.ts` | Consultas de correos, snippets, etiquetado |
| `folder-ops.test.ts` | Creación, renombrado, eliminación de carpetas |
| `rule-testing.test.ts` | Test de reglas contra correos existentes |

### Servicios (~4 archivos de test)

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `openai.test.ts` | Sanitización, extractJSON, buildSystemPrompt |
| `openai.api.test.ts` | Llamadas a API, parseo de respuestas |
| `openai.extended.test.ts` | Chat, propuestas, consolidación |
| `ai-schemas.test.ts` | Schemas Zod, defaults, safeParseAI, validación |

### Stores (~7 archivos de test)

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `rules.test.ts` | CRUD, reorder, toggle |
| `templates.test.ts` | CRUD, setTemplates |
| `settings.test.ts` | Save, update, defaults |
| `activity.test.ts` | Clear, persistencia |
| `chat.test.ts` | Conversaciones, mensajes, proposals, undo |
| `badges.test.ts` | Reset, sincronización |
| `synced-store.test.ts` | Factory, sync, onChanged |

### Utilidades (~11 archivos de test)

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `rule-conflicts.test.ts` | Movimientos contradictorios, redundancia, prioridades |
| `rule-validation.test.ts` | Validación de nombre, condiciones, acciones, regex |
| `config-io.test.ts` | Export, import, conflictos por ID/nombre |
| `template-engine.test.ts` | Variables `{{}}`, extractName, extractEmail |
| `markdown.test.ts` | Headers, bold, code, listas, XSS |
| `storage.test.ts` | Wrapper browser.storage |
| `search.test.ts` | Búsqueda en reglas, plantillas, log |
| `csv-export.test.ts` | CSV con BOM, filtrado, ordenamiento |
| `validators.test.ts` | Validación de campos |
| `analytics.test.ts` | Datos semanales, stats por regla, top senders |
| `error.test.ts` | getErrorMessage con Error, string, unknown |

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
