# Instalación

## Requisitos previos

- **Node.js 20+** para compilar la extensión
- **Thunderbird 128+** instalado
- Clave API de algún proveedor de IA (OpenRouter, OpenAI, Anthropic, Google, o servidor local)

## Instalación desde código fuente

```bash
git clone https://github.com/rricajos/smm.git
cd smm
npm install
```

### Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run build` | Build de producción en `dist/` |
| `npm run watch` | Build + watch de cambios en `src/` |
| `npm run dev` | Build + watch + `web-ext run` con Thunderbird |
| `npm test` | Ejecuta tests unitarios con Vitest |
| `npm run test:watch` | Tests en modo watch |
| `npm run package` | Build + empaquetado como `smart-mail-manager.xpi` |

### Instalar en Thunderbird

**Producción:**

```bash
npm run package
```

Luego en Thunderbird: **Herramientas** > **Complementos** > :material-cog: > **Instalar desde archivo** > seleccionar `smart-mail-manager.xpi`.

**Desarrollo:**

```bash
npm run dev
```

Abre Thunderbird con la extensión cargada y hot-reload automático.

!!! note "Rutas de Thunderbird"
    Ajusta las rutas de Thunderbird y perfil en `package.json` si tu instalación difiere de la predeterminada.

## Configuración inicial

1. **Abrir opciones**: clic derecho en el icono de la extensión > **Opciones**.
2. **Seleccionar proveedor de IA**: elige entre OpenRouter, OpenAI, Anthropic, Google Gemini o un servidor custom.
3. **Introducir clave API**: pega tu clave API del proveedor seleccionado.
4. **Elegir modelo**: selecciona el modelo de IA que deseas usar.
5. **Aceptar consentimiento de IA**: confirma que entiendes que se enviarán datos de correo al proveedor.
6. **Guardar**: los cambios se aplican inmediatamente.

### Configuración del proveedor

| Proveedor | Endpoint | Clave API |
|-----------|----------|-----------|
| **OpenRouter** | `openrouter.ai/api/v1` | Empieza por `sk-or-...` |
| **OpenAI** | `api.openai.com/v1` | Empieza por `sk-...` |
| **Anthropic** | `api.anthropic.com/v1` | Empieza por `sk-ant-...` |
| **Google Gemini** | `generativelanguage.googleapis.com` | Empieza por `AIza...` |
| **Custom** | URL configurable | Depende del servidor |

!!! tip "OpenRouter como opción por defecto"
    OpenRouter permite acceder a modelos de múltiples proveedores con una sola clave API. Es la opción más flexible si no tienes preferencia por un proveedor específico.

## Almacenamiento

Todos los datos se persisten localmente en `browser.storage.local`:

| Clave | Contenido |
|-------|-----------|
| `smm_rules` | Reglas de clasificación |
| `smm_templates` | Plantillas de respuesta |
| `smm_settings` | Configuración general |
| `smm_activity_log` | Log de actividad (máx. 500 entradas) |
| `smm_chat_history` | Historial de conversaciones con IA |
| `smm_locale` | Idioma seleccionado |

## Idiomas

Smart Mail Manager soporta:

- **Español** (es) — idioma principal
- **English** (en)

Cambia el idioma desde **Opciones** sin necesidad de reiniciar.
