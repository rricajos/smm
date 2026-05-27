# Arquitectura

## Estructura del proyecto

```
src/
├── background/              # Service worker (Manifest V2 background page)
│   ├── index.ts             # Punto de entrada: listeners, polling, limpieza
│   ├── classifier.ts        # Motor de clasificación: evalúa reglas contra mensajes
│   ├── autoresponder.ts     # Genera y envía respuestas usando plantillas
│   ├── message-utils.ts     # Utilidades para headers y cuerpo de mensajes
│   ├── email-queries.ts     # Consultas de correos recientes y headers
│   ├── folder-ops.ts        # Operaciones de carpetas (crear, renombrar, mover)
│   └── rule-testing.ts      # Test de reglas contra correos existentes
│
├── lib/
│   ├── components/          # Componentes Svelte 5 compartidos
│   │   ├── Button.svelte
│   │   ├── Modal.svelte
│   │   ├── Toast.svelte
│   │   └── ConfirmDialog.svelte
│   │
│   ├── i18n/                # Sistema de internacionalización
│   │   ├── index.ts         # Store reactivo: t, locale, setLocale(), translate()
│   │   ├── types.ts         # Interfaz Translations (~650 claves)
│   │   └── locales/
│   │       ├── es.ts
│   │       └── en.ts
│   │
│   ├── services/
│   │   ├── openai.ts        # Servicio AI: clasificación, chat, propuestas
│   │   └── ai-schemas.ts    # Schemas Zod para validación de respuestas AI
│   │
│   ├── stores/              # Stores reactivos (writable + browser.storage)
│   │   ├── synced-store.ts  # Factory base: auto-sync con browser.storage.local
│   │   ├── settings.ts      # Configuración general
│   │   ├── rules.ts         # Reglas de clasificación
│   │   ├── templates.ts     # Plantillas de respuesta
│   │   ├── activity.ts      # Log de actividad (máx. 500)
│   │   ├── chat.ts          # Historial de conversaciones IA
│   │   └── badges.ts        # Contador de clasificaciones no leídas
│   │
│   └── utils/
│       ├── constants.ts     # Modelos AI, providers, defaults, variables de plantilla
│       ├── config-io.ts     # Validación y merge de importación/exportación
│       ├── rule-conflicts.ts # Detección de conflictos entre reglas
│       ├── rule-presets.ts  # Galería de presets
│       ├── rule-validation.ts # Validación de reglas (extraído de RuleEditor)
│       ├── template-engine.ts # Sustitución de variables {{}}
│       ├── markdown.ts      # Renderizado de markdown para el chat
│       ├── search.ts        # Búsqueda global
│       ├── csv-export.ts    # Exportación CSV del log
│       ├── analytics.ts     # Estadísticas y gráficos
│       ├── storage.ts       # Wrapper sobre browser.storage.local
│       ├── error.ts         # Utilidad getErrorMessage
│       ├── validators.ts    # Validadores de datos
│       ├── logger.ts        # Logger unificado
│       └── messenger.d.ts   # Tipos para Thunderbird messenger.* APIs
│
├── space/                   # Panel principal (Thunderbird tab space)
│   ├── main.ts
│   ├── App.svelte           # Router de navegación por pestañas
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
├── popup/                   # Popup del botón de la extensión
│   ├── main.ts
│   └── App.svelte
│
├── options/                 # Página de opciones
│   ├── main.ts
│   └── App.svelte
│
└── types/
    ├── rules.ts
    ├── templates.ts
    └── settings.ts
```

## Flujos de datos

### Clasificación automática

```
Correo nuevo
  → background/index.ts (listener onNewMailReceived)
    → classifier.ts: evalúa cada regla habilitada contra el mensaje
      → Compara condiciones (from, to, subject, body, hasAttachments)
      → Lógica AND (all) / OR (any)
      → Coincidencia encontrada:
        → Ejecuta acciones secuencialmente:
          - moveToFolder → messenger.messages.move()
          - addTag → messenger.messages.update({ tags })
          - setPriority → cambio de cabecera X-Priority
          - markRead → messenger.messages.update({ read: true })
          - autoRespond → autoresponder.ts
        → Registra en activity log
        → Notificación (si habilitada)
        → Si stopProcessing → detener
```

### Auto-respuesta

```
Acción autoRespond activada
  → autoresponder.ts: verifica rate limit
    → Carga plantilla por templateId
    → template-engine.ts: sustituye {{variables}}
    → Según sendMode:
      - draft → messenger.compose.beginReply() + saveMessage()
      - sendNow → messenger.compose.beginReply() + sendMessage()
      - sendLater → sendMessage({ mode: "sendLater" })
```

### Chat con IA

```
Usuario escribe mensaje → AI.svelte
  → openai.ts: chatWithAssistant()
    → Construye contexto: reglas, plantillas, carpetas, etiquetas, correos
    → Envía al proveedor AI configurado
    → Recibe respuesta con texto + JSON de propuestas
    → ai-schemas.ts: valida con Zod (safeParseAI)
    → Parsea propuestas: FOLDER, RULE, TEMPLATE, MOVE, CONSOLIDATION
    → Resuelve referencias cruzadas (NEW_RULE:Nombre → UUID)
  → ProposalBlock.svelte: renderiza cada propuesta
    → Aceptar → aplica cambio
    → Rechazar → descarta
```

## Entry points

La extensión tiene 4 entry points compilados como IIFE autocontenidos:

| Entry point | Svelte | Output | Descripción |
|-------------|--------|--------|-------------|
| `popup` | Si | `dist/popup.{html,js,css}` | Popup del botón de extensión |
| `space` | Si | `dist/space.{html,js,css}` | Panel principal |
| `options` | Si | `dist/options.{html,js,css}` | Página de opciones |
| `background` | No | `dist/background.js` | Service worker |

## Comunicación background ↔ UI

La UI se comunica con el background script via `messenger.runtime.sendMessage()` con una **discriminated union** tipada:

```typescript
type BackgroundMessage =
  | { type: 'CLASSIFY_MESSAGE'; messageId: number }
  | { type: 'GET_FOLDERS' }
  | { type: 'GET_TAGS' }
  | { type: 'CREATE_FOLDER'; parentFolderId: string; folderName: string }
  | { type: 'DELETE_FOLDER'; folderId: string }
  // ... 18 tipos en total
```

El handler en `background/index.ts` usa un `switch` sobre `message.type` con narrowing automático de TypeScript.
