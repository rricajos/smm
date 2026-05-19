# Smart Mail Manager

Extensi&oacute;n para **Thunderbird 128+** que automatiza la clasificaci&oacute;n de correos electr&oacute;nicos y las respuestas autom&aacute;ticas mediante reglas configurables y un asistente de inteligencia artificial.

## Caracter&iacute;sticas

- **Clasificaci&oacute;n autom&aacute;tica**: Reglas basadas en condiciones (remitente, asunto, cuerpo, adjuntos) con acciones como mover a carpeta, etiquetar, cambiar prioridad o marcar como le&iacute;do.
- **Respuestas autom&aacute;ticas**: Plantillas con variables din&aacute;micas (nombre del remitente, asunto, fecha, etc.) que se env&iacute;an o guardan como borrador.
- **Asistente IA**: Genera reglas a partir del an&aacute;lisis de correos o descripciones en lenguaje natural. Chat interactivo que propone carpetas y reglas con un clic.
- **Gesti&oacute;n de carpetas**: &Aacute;rbol de carpetas interactivo con men&uacute; contextual (crear, renombrar, eliminar subcarpetas).
- **Presets de reglas**: Galer&iacute;a de plantillas predefinidas para patrones comunes (newsletters, redes sociales, bancos, compras, etc.).
- **Detecci&oacute;n de conflictos**: Aviso autom&aacute;tico cuando dos reglas tienen condiciones similares con acciones contradictorias.
- **Multi-cuenta**: Procesa correos de todas las cuentas configuradas en Thunderbird, no solo la primera.
- **Internacionalizaci&oacute;n**: Interfaz disponible en espa&ntilde;ol e ingl&eacute;s, con cambio din&aacute;mico desde Opciones.
- **B&uacute;squeda global**: Busca reglas, plantillas y entradas del registro desde cualquier pesta&ntilde;a (Ctrl+K).
- **Registro de actividad**: Log con filtros, paginaci&oacute;n, exportaci&oacute;n CSV y rotaci&oacute;n autom&aacute;tica por antig&uuml;edad.

## Requisitos

- **Thunderbird** 128 o superior
- **Node.js** 18+ (para compilar)
- **API Key de OpenRouter** (opcional, solo para funciones de IA)

## Instalaci&oacute;n

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd thunderbird-mail-manager

# Instalar dependencias
npm install

# Compilar
npm run build
```

La extensi&oacute;n compilada se genera en `dist/`. Para instalarla en Thunderbird:

1. Abrir Thunderbird > Herramientas > Complementos
2. Clic en el engranaje > Instalar complemento desde archivo
3. Seleccionar el archivo `smart-mail-manager.xpi` o cargar la carpeta `dist/` como extensi&oacute;n temporal

## Desarrollo

```bash
# Modo desarrollo (watch + Thunderbird con web-ext)
npm run dev

# Solo compilar con watch
npm run watch

# Empaquetar como .xpi
npm run package
```

El comando `npm run dev` ejecuta `web-ext run` apuntando al ejecutable de Thunderbird y al perfil configurado en `package.json`. Ajusta las rutas si tu instalaci&oacute;n es diferente.

## Arquitectura

```
src/
├── background/              # Scripts de fondo (sin UI)
│   ├── index.ts             # Entry point: event handlers, IPC, timers
│   ├── classifier.ts        # Motor de clasificaci&oacute;n (matching de reglas)
│   ├── autoresponder.ts     # Motor de respuestas autom&aacute;ticas
│   └── message-utils.ts     # Utilidades para procesar mensajes
│
├── lib/                     # C&oacute;digo compartido entre todas las UIs
│   ├── components/          # Componentes Svelte reutilizables
│   │   ├── Button.svelte
│   │   ├── Modal.svelte
│   │   └── Toast.svelte
│   ├── i18n/                # Sistema de internacionalizaci&oacute;n
│   │   ├── index.ts         # Stores reactivos (locale, t)
│   │   ├── types.ts         # Interface Translations con todas las claves
│   │   └── locales/         # Diccionarios ES y EN
│   ├── services/
│   │   └── openai.ts        # Integraci&oacute;n con OpenRouter API
│   ├── stores/              # Svelte stores con persistencia
│   │   ├── rules.ts         # CRUD de reglas
│   │   ├── templates.ts     # CRUD de plantillas
│   │   ├── settings.ts      # Configuraci&oacute;n global
│   │   ├── activity.ts      # Registro de actividad
│   │   ├── chat.ts          # Historial de conversaciones IA
│   │   └── badges.ts        # Contadores para badges
│   └── utils/               # Utilidades
│       ├── constants.ts     # Claves de storage, modelos IA, defaults
│       ├── storage.ts       # Wrapper de browser.storage
│       ├── config-io.ts     # Import/export de configuraci&oacute;n
│       ├── rule-presets.ts   # Presets de reglas predefinidas
│       ├── rule-conflicts.ts # Detecci&oacute;n de conflictos entre reglas
│       ├── template-engine.ts # Motor de variables de plantilla
│       ├── markdown.ts      # Renderizado de Markdown
│       └── messenger.d.ts   # Tipos de la API de Thunderbird
│
├── types/                   # Definiciones de tipos TypeScript
│   ├── rules.ts             # Rule, Condition, Action
│   ├── settings.ts          # Settings, ActivityEntry
│   └── templates.ts         # ResponseTemplate
│
├── space/                   # UI principal (panel lateral / pesta&ntilde;a)
│   ├── App.svelte           # Layout con pesta&ntilde;as
│   ├── pages/               # P&aacute;ginas principales
│   │   ├── Dashboard.svelte # Panel de control y estad&iacute;sticas
│   │   ├── Rules.svelte     # Gesti&oacute;n de reglas
│   │   ├── Templates.svelte # Gesti&oacute;n de plantillas
│   │   ├── AI.svelte        # Asistente IA y generador
│   │   └── Log.svelte       # Registro de actividad
│   └── components/          # Componentes espec&iacute;ficos
│       ├── RuleEditor.svelte
│       ├── ConditionRow.svelte
│       ├── ActionRow.svelte
│       ├── TemplateEditor.svelte
│       ├── FolderTree.svelte
│       ├── PresetGallery.svelte
│       ├── GlobalSearch.svelte
│       ├── ChatWelcome.svelte
│       ├── ProposalBlock.svelte
│       └── ImportModal.svelte
│
├── popup/                   # Popup de la toolbar
│   ├── App.svelte
│   └── main.ts
│
└── options/                 # P&aacute;gina de configuraci&oacute;n
    ├── App.svelte
    └── main.ts
```

## Sistema de build

El proyecto usa un script personalizado (`build.ts`) que invoca Vite program&aacute;ticamente para compilar 4 entry points independientes en formato IIFE:

| Entry point | Svelte | Output |
|-------------|--------|--------|
| `popup` | S&iacute; | `dist/popup.{html,js,css}` |
| `space` | S&iacute; | `dist/space.{html,js,css}` |
| `options` | S&iacute; | `dist/options.{html,js,css}` |
| `background` | No | `dist/background.js` |

Cada build genera un bundle autocontenido sin imports din&aacute;micos (requisito de Thunderbird MailExtensions). La versi&oacute;n en `manifest.json` se incrementa autom&aacute;ticamente en cada build.

## Permisos

| Permiso | Uso |
|---------|-----|
| `messagesRead` | Leer contenido de correos para clasificaci&oacute;n |
| `messagesMove` | Mover correos a carpetas seg&uacute;n reglas |
| `messagesUpdate` | Cambiar prioridad, marcar como le&iacute;do |
| `messagesTags` | A&ntilde;adir/quitar etiquetas |
| `accountsRead` | Obtener info de cuentas (multi-cuenta) |
| `accountsFolders` | Crear/renombrar/eliminar carpetas |
| `compose`, `compose.send`, `compose.save` | Respuestas autom&aacute;ticas |
| `storage` | Persistir configuraci&oacute;n, reglas, logs |
| `notifications` | Notificaciones de clasificaci&oacute;n/respuesta |
| `https://openrouter.ai/*` | Llamadas a la API de IA |

## Tecnolog&iacute;as

- **Svelte 5** (runes: `$state`, `$derived`, `$effect`, `$props`)
- **TypeScript** (strict mode)
- **Vite 8** (build program&aacute;tico)
- **WebExtension API** (Manifest V2 para Thunderbird)
- **OpenRouter** (API de IA multi-modelo)

## Autor

Ricard Penin - [smart-mail-manager@conexiatec.com](mailto:smart-mail-manager@conexiatec.com)

## Licencia

Pendiente de definir.
