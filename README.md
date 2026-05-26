# Smart Mail Manager

Extensión para **Thunderbird 128+** que clasifica correos automáticamente y genera respuestas basadas en reglas configurables, plantillas y asistente de IA.

## Características

### Clasificación automática
- Reglas con condiciones combinables (AND/OR) sobre remitente, destinatario, asunto, cuerpo y adjuntos
- Operadores: contiene, igual, empieza por, termina en, coincide con regex
- Acciones: mover a carpeta, etiquetar, cambiar prioridad, marcar como leído, auto-responder
- `stopProcessing` opcional para detener la evaluación de reglas tras una coincidencia
- Detección de conflictos entre reglas (movimientos contradictorios, prioridades incompatibles, redundancias)
- Fusión automática de reglas redundantes desde el panel de conflictos
- Galería de presets para crear reglas comunes rápidamente (newsletters, redes sociales, bancos, etc.)
- Detección de referencias rotas (carpetas, etiquetas o plantillas eliminadas)

### Plantillas de respuesta
- Variables dinámicas: `{{sender_name}}`, `{{subject}}`, `{{date}}`, `{{my_name}}`, y más
- Modos de envío: borrador, enviar ahora, enviar después
- Tipos de respuesta: responder al remitente o responder a todos
- Vista previa en tiempo real con valores de ejemplo
- Texto plano o HTML

### Asistente de IA
- Chat conversacional con contexto completo del buzón (reglas, plantillas, carpetas, etiquetas, correos recientes)
- Propuestas inteligentes con aceptar/rechazar individual:
  - **Reglas nuevas** — el AI sugiere reglas basadas en el análisis del correo
  - **Plantillas** — propone plantillas de respuesta adaptadas
  - **Mover correos** — sugiere mover mensajes a carpetas específicas
  - **Crear carpetas** — propone nueva organización de carpetas
  - **Consolidar reglas** — detecta reglas duplicadas/solapadas y propone fusiones
- Sistema de referencias cruzadas: cuando el AI propone reglas nuevas y su consolidación en la misma respuesta, las referencias `NEW_RULE:NombreRegla` se resuelven automáticamente
- Historial de conversaciones persistente con múltiples sesiones

### Proveedores de IA soportados

| Proveedor | Endpoint | Modelos destacados |
|-----------|----------|--------------------|
| **OpenRouter** | `openrouter.ai/api/v1` | GPT-4o, Claude Sonnet/Opus, Gemini, Llama 4, DeepSeek, Qwen 3 |
| **OpenAI** (directo) | `api.openai.com/v1` | GPT-4o, GPT-4.1, GPT-4.1 Nano, o4-mini |
| **Anthropic** (directo) | `api.anthropic.com/v1` | Claude 3.5 Haiku/Sonnet, Claude Sonnet 4, Claude Opus 4 |
| **Google Gemini** (directo) | `generativelanguage.googleapis.com` | Gemini 2.0/2.5 Flash, Gemini 2.5 Pro |
| **Custom** (OpenAI-compatible) | Configurable | Ollama, LM Studio, vLLM, etc. |

### Panel de control
- Dashboard con estadísticas de clasificaciones y respuestas
- Log de actividad con filtros por tipo (clasificación, respuesta, error), paginación y exportación CSV
- Búsqueda global de reglas, plantillas y logs (Ctrl+K)
- Importación/exportación de configuración completa (JSON) con resolución de conflictos
- Badges de clasificaciones no leídas en la navegación

### Internacionalización
- Español (es) — idioma principal
- English (en)
- Cambio de idioma dinámico sin reinicio desde opciones
- Más de 200 claves de traducción

## Arquitectura

```
src/
├── background/              # Service worker (Manifest V2 background page)
│   ├── index.ts             # Punto de entrada: listeners, polling, limpieza de logs
│   ├── classifier.ts        # Motor de clasificación: evalúa reglas contra mensajes
│   ├── autoresponder.ts     # Genera y envía respuestas usando plantillas
│   └── message-utils.ts     # Utilidades para leer headers y cuerpo de mensajes
│
├── lib/
│   ├── components/          # Componentes Svelte 5 compartidos
│   │   ├── Button.svelte    # Botón con variantes (primary, secondary, danger)
│   │   ├── Modal.svelte     # Modal genérico con título y slot
│   │   └── Toast.svelte     # Notificación toast temporal
│   │
│   ├── i18n/                # Sistema de internacionalización
│   │   ├── index.ts         # Store reactivo `t`, `locale`, `setLocale()`, `translate()`
│   │   ├── types.ts         # Interfaz Translations (~200 claves)
│   │   └── locales/
│   │       ├── es.ts        # Traducciones español
│   │       └── en.ts        # Traducciones inglés
│   │
│   ├── services/
│   │   └── openai.ts        # Servicio AI: clasificación, respuestas, chat con propuestas
│   │
│   ├── stores/              # Stores reactivos (writable + browser.storage, consumidos via $store)
│   │   ├── settings.ts      # Configuración general
│   │   ├── rules.ts         # Reglas de clasificación
│   │   ├── templates.ts     # Plantillas de respuesta
│   │   ├── activity.ts      # Log de actividad (máx. 500 entradas, rotación automática)
│   │   ├── chat.ts          # Historial de conversaciones con IA (múltiples sesiones)
│   │   └── badges.ts        # Contador de clasificaciones no leídas
│   │
│   └── utils/
│       ├── constants.ts     # Modelos AI, providers, variables de plantilla, defaults
│       ├── config-io.ts     # Validación y merge de importación/exportación
│       ├── rule-conflicts.ts # Detección de conflictos entre reglas
│       ├── rule-presets.ts  # Galería de presets de reglas comunes
│       ├── template-engine.ts # Motor de sustitución de variables en plantillas
│       ├── markdown.ts      # Renderizado de markdown para el chat
│       ├── storage.ts       # Wrapper sobre browser.storage.local
│       └── messenger.d.ts   # Tipos TypeScript para Thunderbird messenger.* APIs
│
├── space/                   # Panel principal (Thunderbird tab space)
│   ├── main.ts
│   ├── App.svelte           # Router de navegación por pestañas
│   ├── pages/
│   │   ├── Dashboard.svelte # Estadísticas y actividad reciente
│   │   ├── Rules.svelte     # Gestión de reglas + conflictos + presets + importación
│   │   ├── Templates.svelte # Gestión de plantillas
│   │   ├── AI.svelte        # Chat con IA + propuestas (reglas, plantillas, carpetas, consolidación)
│   │   └── Log.svelte       # Log de actividad con filtros y exportación CSV
│   └── components/
│       ├── RuleEditor.svelte       # Editor modal de reglas (condiciones + acciones)
│       ├── ConditionRow.svelte     # Fila de condición en el editor
│       ├── ActionRow.svelte        # Fila de acción en el editor
│       ├── TemplateEditor.svelte   # Editor modal de plantillas con preview
│       ├── ImportModal.svelte      # Modal de importación con resolución de conflictos
│       ├── ProposalBlock.svelte    # Bloque de propuesta AI (aceptar/rechazar)
│       ├── ChatPanel.svelte        # Panel de chat (conversaciones, mensajes, propuestas)
│       ├── QuickPanel.svelte      # Panel de generación rápida (análisis, batch, descripción)
│       ├── ChatWelcome.svelte     # Pantalla de bienvenida del chat
│       ├── FolderTree.svelte       # Selector de carpeta en árbol jerárquico
│       ├── GlobalSearch.svelte     # Búsqueda global (Ctrl+K)
│       └── PresetGallery.svelte    # Galería de presets de reglas
│
├── popup/                   # Popup del botón de la extensión
│   ├── main.ts
│   └── App.svelte           # Resumen rápido + enlace al panel principal
│
├── options/                 # Página de opciones (pestaña independiente)
│   ├── main.ts
│   └── App.svelte           # Configuración: AI, notificaciones, idioma, import/export
│
└── types/
    ├── rules.ts             # Rule, Condition, Action
    ├── templates.ts         # ResponseTemplate
    └── settings.ts          # Settings, ActivityEntry, AiProvider
```

## Stack técnico

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Svelte | 5.x | UI con runes (`$state`, `$derived`, `$effect`, `$props`) + `$store` auto-subscription |
| Vitest | 4.x | Tests unitarios para utilidades y lógica de negocio |
| TypeScript | 6.x | Tipado estricto en todo el proyecto |
| Vite | 8.x | Build programático con 4 entry points IIFE |
| Thunderbird | 128+ | APIs: `messenger.*` (Manifest V2) |
| web-ext | 10.x | Dev server y empaquetado .xpi |

## Desarrollo

### Requisitos previos
- Node.js 20+
- Thunderbird 128+ instalado
- Clave API de algún proveedor de IA (OpenRouter, OpenAI, Anthropic, Google, o servidor local)

### Instalación

```bash
git clone <repo-url>
cd smm
npm install
```

### Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run build` | Build de producción → `dist/` |
| `npm run watch` | Build + watch de cambios en `src/` |
| `npm run dev` | Build + watch + `web-ext run` con Thunderbird |
| `npm test` | Ejecuta tests unitarios con Vitest |
| `npm run test:watch` | Tests en modo watch |
| `npm run package` | Build + empaquetado como `smart-mail-manager.xpi` |

### Sistema de build

El build usa un script custom (`build.ts`) que:
1. Auto-incrementa la versión patch en `manifest.json` en cada build
2. Compila 4 entry points como IIFE autocontenidos (requisito de MailExtensions):

| Entry point | Svelte | Output |
|-------------|--------|--------|
| `popup` | Sí | `dist/popup.{html,js,css}` |
| `space` | Sí | `dist/space.{html,js,css}` |
| `options` | Sí | `dist/options.{html,js,css}` |
| `background` | No | `dist/background.js` |

3. Genera HTML para cada UI entry point
4. Copia archivos estáticos de `public/` a `dist/`
5. En modo watch, recompila al detectar cambios en `src/` (sin re-bump de versión)

### Tests

Tests unitarios con [Vitest](https://vitest.dev/):

```bash
npm test           # Ejecutar una vez
npm run test:watch # Modo watch
```

Cobertura de tests:
- `rule-conflicts.ts` — Detección de conflictos entre reglas (movimientos contradictorios, prioridades incompatibles, redundancia, solapamiento de condiciones)
- `config-io.ts` — Exportación, validación de importación, detección de conflictos por ID y nombre
- `template-engine.ts` — Renderizado de variables `{{}}`, extracción de nombre y email de direcciones
- `markdown.ts` — Renderizado de markdown a HTML con protección XSS

### Instalación en Thunderbird

**Producción:**
```bash
npm run package
# Thunderbird → Herramientas → Complementos → ⚙️ → Instalar desde archivo → smart-mail-manager.xpi
```

**Desarrollo:**
```bash
npm run dev
# Abre Thunderbird con la extensión cargada y hot-reload
```

> **Nota:** Ajusta las rutas de Thunderbird y perfil en `package.json` si tu instalación difiere.

## Almacenamiento

Todos los datos se persisten en `browser.storage.local`:

| Clave | Contenido |
|-------|-----------|
| `smm_rules` | Array de reglas de clasificación |
| `smm_templates` | Array de plantillas de respuesta |
| `smm_settings` | Configuración general (provider, modelo, API key, límites, notificaciones) |
| `smm_activity_log` | Log de actividad (máx. 500 entradas, rotación automática) |
| `smm_auto_response_count` | Contador horario de auto-respuestas (rate limiting) |
| `smm_chat_history` | Historial de conversaciones con IA (múltiples sesiones) |
| `smm_unread_classifications` | Contador de clasificaciones no leídas (badges) |
| `smm_locale` | Idioma seleccionado (`es` / `en`) |

## Permisos de la extensión

| Permiso | Uso |
|---------|-----|
| `messagesRead` | Leer contenido de correos para clasificar |
| `messagesMove` | Mover correos a carpetas según reglas |
| `messagesUpdate` | Cambiar prioridad y marcar como leído |
| `messagesTags` | Añadir etiquetas a correos |
| `accountsRead` | Listar cuentas y carpetas del usuario |
| `accountsFolders` | Crear carpetas nuevas (propuestas del AI) |
| `compose` / `compose.send` / `compose.save` | Crear borradores y enviar respuestas automáticas |
| `storage` | Persistir configuración, reglas, plantillas y logs |
| `notifications` | Notificar clasificaciones y respuestas |
| `https://openrouter.ai/*` | Llamadas a OpenRouter API |
| `https://api.openai.com/*` | Llamadas directas a OpenAI |
| `https://api.anthropic.com/*` | Llamadas directas a Anthropic |
| `https://generativelanguage.googleapis.com/*` | Llamadas directas a Google Gemini |
| `http://*/*`, `https://*/*` | Endpoints custom (Ollama, etc.) |

## Flujo de datos

### Clasificación automática

```
Correo nuevo → background/index.ts (listener onNewMailReceived)
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
      → Si stopProcessing = true, detiene evaluación de más reglas
```

### Auto-respuesta

```
Acción autoRespond activada
  → autoresponder.ts: verifica rate limit (maxAutoResponsesPerHour)
    → Carga plantilla por templateId
    → template-engine.ts: sustituye {{variables}} con datos del mensaje
    → Según sendMode:
      - draft → messenger.compose.beginReply() + compose.saveMessage()
      - sendNow → messenger.compose.beginReply() + compose.sendMessage()
      - sendLater → messenger.compose.beginReply() + compose.sendMessage({ mode: "sendLater" })
```

### Chat con IA

```
Usuario escribe mensaje → AI.svelte
  → openai.ts: chatWithAssistant()
    → Construye contexto: reglas actuales, plantillas, carpetas, etiquetas, correos recientes
    → Envía al proveedor AI configurado (OpenRouter/OpenAI/Anthropic/Google/Custom)
    → Recibe respuesta con texto markdown + bloques JSON de propuestas
    → Parsea propuestas: FOLDER_PROPOSAL, RULE_PROPOSAL, TEMPLATE_PROPOSAL,
      MOVE_PROPOSAL, RULE_CONSOLIDATION_PROPOSAL
    → Resuelve referencias cruzadas (NEW_RULE:Nombre → UUID generado)
  → ProposalBlock.svelte: renderiza cada propuesta
    → Aceptar → aplica cambio (guarda regla, crea carpeta, mueve correo, etc.)
    → Rechazar → descarta
```

## Tipos principales

### Rule
```typescript
interface Rule {
  id: string;                    // UUID
  name: string;
  enabled: boolean;
  conditions: Condition[];       // from, to, subject, body, hasAttachments
  conditionLogic: 'all' | 'any'; // AND / OR
  actions: Action[];             // moveToFolder, addTag, setPriority, markRead, autoRespond
  stopProcessing: boolean;       // Detener evaluación tras coincidencia
  createdAt: number;             // Timestamp
  updatedAt: number;             // Timestamp
}

interface Condition {
  field: 'from' | 'to' | 'subject' | 'body' | 'hasAttachments';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'matches' | 'is';
  value: string;
  boolValue?: boolean;           // Para hasAttachments
  caseSensitive: boolean;
}

interface Action {
  type: 'moveToFolder' | 'addTag' | 'setPriority' | 'markRead' | 'autoRespond';
  folderId?: string;
  tagKey?: string;
  priority?: 'highest' | 'high' | 'normal' | 'low' | 'lowest';
  templateId?: string;           // Referencia a ResponseTemplate
}
```

### ResponseTemplate
```typescript
interface ResponseTemplate {
  id: string;
  name: string;
  subject: string;               // Soporta {{variables}}
  body: string;                  // Soporta {{variables}}
  isPlainText: boolean;
  sendMode: 'draft' | 'sendNow' | 'sendLater';
  replyType: 'replyToSender' | 'replyToAll';
}
```

### Settings
```typescript
type AiProvider = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'custom';

interface Settings {
  classificationEnabled: boolean;
  autoResponseEnabled: boolean;
  processExistingOnStartup: boolean; // Procesar correos existentes al iniciar
  maxAutoResponsesPerHour: number;   // Rate limit
  logRetentionDays: number;          // Rotación automática del log
  notifyOnClassification: boolean;
  notifyOnAutoResponse: boolean;
  aiProvider: AiProvider;
  openaiApiKey: string;
  openaiModel: string;               // ID del modelo según el provider
  customBaseUrl: string;             // Solo para provider 'custom'
}
```

## Variables de plantilla

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `{{sender_name}}` | Juan García | Nombre del remitente |
| `{{sender_email}}` | juan@example.com | Email del remitente |
| `{{to}}` | ricard@conexiatec.com | Destinatario |
| `{{subject}}` | Re: Presupuesto | Asunto original |
| `{{date}}` | 18/05/2026 | Fecha actual |
| `{{time}}` | 14:30 | Hora actual |
| `{{day_of_week}}` | Lunes | Día de la semana |
| `{{original_body}}` | *(texto completo)* | Cuerpo completo del correo original |
| `{{original_body_snippet}}` | *(primeras líneas)* | Primeras líneas del cuerpo |
| `{{my_name}}` | Ricard Penin | Nombre del usuario (de la cuenta) |
| `{{my_email}}` | ricard@conexiatec.com | Email del usuario (de la cuenta) |

> También se soportan las variables legacy `{{senderName}}`, `{{senderEmail}}`, `{{originalSubject}}` por retrocompatibilidad.

## Autor

Ricard Penin Honrubia — [ricard.penin.honrubia@gmail.com](mailto:ricard.penin.honrubia@gmail.com)

## Licencia

Este proyecto está licenciado bajo la [Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/).
Consulta el archivo [LICENSE](LICENSE) para más detalles.

Copyright © 2025 Ricard Penin Honrubia

## Aviso de privacidad

Smart Mail Manager procesa contenido de correos electrónicos (remitente, asunto, fragmentos del cuerpo) y lo envía a servicios externos de inteligencia artificial (OpenRouter, OpenAI, Anthropic, Google) cuando el usuario utiliza las funcionalidades de IA. Esta comunicación se realiza exclusivamente bajo demanda del usuario y nunca de forma automática en segundo plano sin su consentimiento.

- Los datos se transmiten únicamente al proveedor de IA configurado por el usuario.
- No se almacenan datos en servidores propios; toda la persistencia es local (`browser.storage.local`).
- Las claves API son proporcionadas y gestionadas por el usuario.
- El usuario es responsable de revisar las políticas de privacidad del proveedor de IA que elija.

## Descargo de responsabilidad

Este software se proporciona "tal cual", sin garantías de ningún tipo, expresas o implícitas. En ningún caso el autor será responsable de daños derivados del uso de este software, incluyendo pero no limitado a:

- Pérdida o clasificación incorrecta de correos electrónicos.
- Envío de respuestas automáticas no deseadas.
- Costes derivados del uso de APIs de terceros (OpenRouter, OpenAI, Anthropic, Google).
- Pérdida de datos o interrupciones del servicio.

El usuario asume la totalidad del riesgo en cuanto a la calidad y rendimiento del software.
