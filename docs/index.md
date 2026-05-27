# Smart Mail Manager

Extensión para **Thunderbird 128+** que clasifica correos automáticamente y genera respuestas basadas en reglas configurables, plantillas y asistente de IA.

---

## Características principales

<div class="grid cards" markdown>

-   **Clasificación automática**

    Reglas con condiciones combinables (AND/OR) sobre remitente, asunto, cuerpo y adjuntos. Acciones: mover, etiquetar, cambiar prioridad, marcar leído, auto-responder.

    [:octicons-arrow-right-24: Reglas](guia/reglas.md)

-   **Plantillas de respuesta**

    Variables dinámicas (`{{sender_name}}`, `{{subject}}`...), modos de envío (borrador, enviar ahora, enviar después) y vista previa en tiempo real.

    [:octicons-arrow-right-24: Plantillas](guia/plantillas.md)

-   **Asistente de IA**

    Chat conversacional con contexto completo del buzón. Propuestas inteligentes de reglas, plantillas, carpetas y consolidación.

    [:octicons-arrow-right-24: Asistente IA](guia/asistente-ia.md)

-   **Panel de control**

    Dashboard con estadísticas, log de actividad con filtros y exportación CSV, búsqueda global (Ctrl+K).

    [:octicons-arrow-right-24: Panel](guia/panel.md)

</div>

## Proveedores de IA soportados

| Proveedor | Modelos destacados |
|-----------|-------------------|
| **OpenRouter** | GPT-4o, Claude Sonnet/Opus, Gemini, Llama 4, DeepSeek, Qwen 3 |
| **OpenAI** | GPT-4o, GPT-4.1, GPT-4.1 Nano, o4-mini |
| **Anthropic** | Claude 3.5 Haiku/Sonnet, Claude Sonnet 4, Claude Opus 4 |
| **Google Gemini** | Gemini 2.0/2.5 Flash, Gemini 2.5 Pro |
| **Custom** | Ollama, LM Studio, vLLM, cualquier API compatible con OpenAI |

## Stack técnico

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Svelte | 5.x | UI con runes (`$state`, `$derived`, `$effect`) |
| TypeScript | 6.x | Tipado estricto en todo el proyecto |
| Vite | 8.x | Build programático con 4 entry points IIFE |
| Vitest | 4.x | ~480 tests unitarios |
| Zod | 4.x | Validación runtime de respuestas AI |
| Thunderbird | 128+ | APIs `messenger.*` (Manifest V2) |

## Licencia

Este proyecto está licenciado bajo la [Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/).

Copyright &copy; 2025 Ricard Penin Honrubia
