# Smart Mail Manager

Extension for **Thunderbird 128+** that automatically classifies emails and generates responses based on configurable rules, templates, and an AI assistant.

---

## Key features

<div class="grid cards" markdown>

-   **Automatic classification**

    Rules with combinable conditions (AND/OR) on sender, subject, body, and attachments. Actions: move, tag, set priority, mark read, auto-respond.

    [:octicons-arrow-right-24: Rules](guia/reglas.md)

-   **Response templates**

    Dynamic variables (`{{sender_name}}`, `{{subject}}`...), send modes (draft, send now, send later) and real-time preview.

    [:octicons-arrow-right-24: Templates](guia/plantillas.md)

-   **AI Assistant**

    Conversational chat with full mailbox context. Smart proposals for rules, templates, folders, and consolidation.

    [:octicons-arrow-right-24: AI Assistant](guia/asistente-ia.md)

-   **Control panel**

    Dashboard with statistics, activity log with filters and CSV export, global search (Ctrl+K).

    [:octicons-arrow-right-24: Panel](guia/panel.md)

</div>

## Supported AI providers

| Provider | Notable models |
|----------|---------------|
| **OpenRouter** | GPT-4o, Claude Sonnet/Opus, Gemini, Llama 4, DeepSeek, Qwen 3 |
| **OpenAI** | GPT-4o, GPT-4.1, GPT-4.1 Nano, o4-mini |
| **Anthropic** | Claude 3.5 Haiku/Sonnet, Claude Sonnet 4, Claude Opus 4 |
| **Google Gemini** | Gemini 2.0/2.5 Flash, Gemini 2.5 Pro |
| **Custom** | Ollama, LM Studio, vLLM, any OpenAI-compatible API |

## Tech stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Svelte | 5.x | UI with runes (`$state`, `$derived`, `$effect`) |
| TypeScript | 6.x | Strict typing throughout the project |
| Vite | 8.x | Programmatic build with 4 IIFE entry points |
| Vitest | 4.x | ~480 unit tests |
| Zod | 4.x | Runtime validation of AI responses |
| Thunderbird | 128+ | `messenger.*` APIs (Manifest V2) |

## License

This project is licensed under the [Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/).

Copyright &copy; 2025 Ricard Penin Honrubia
