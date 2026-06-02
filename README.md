# Smart Mail Manager

[![CI](https://github.com/rricajos/smm/actions/workflows/ci.yml/badge.svg)](https://github.com/rricajos/smm/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-97%25-brightgreen)](https://github.com/rricajos/smm)
[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-blue.svg)](https://mozilla.org/MPL/2.0/)
[![Thunderbird 128+](https://img.shields.io/badge/Thunderbird-128%2B-blue?logo=thunderbird)](https://www.thunderbird.net/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5-orange?logo=svelte)](https://svelte.dev/)

> [Leer en español](README.es.md)

Thunderbird extension that automatically classifies emails and generates responses using configurable rules, templates, and an AI assistant.

## Key Features

- **Rule-based classification** — combinable conditions (AND/OR) with actions: move to folder, tag, set priority, mark read, auto-respond
- **Response templates** — dynamic `{{variables}}`, send modes (draft / send now / send later), real-time preview
- **AI assistant** — conversational chat with full mailbox context; proposes rules, templates, folders, and rule consolidation
- **5 AI providers** — OpenRouter, OpenAI, Anthropic, Google Gemini, and any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM)
- **Control panel** — dashboard with statistics, activity log with filters and CSV export, global search (Ctrl+K), configuration import/export
- **Bilingual** — full Spanish and English UI with 540+ translation keys

## Quick Start

1. **Clone and install**
   ```bash
   git clone https://github.com/rricajos/smm.git
   cd smm && npm install
   ```
2. **Development mode** (opens Thunderbird with hot-reload)
   ```bash
   npm run dev
   ```
3. **Production install**
   ```bash
   npm run package
   ```
   Then in Thunderbird: Tools > Add-ons > gear icon > Install from file > select `smart-mail-manager.xpi`.
4. **Configure** — open the extension options, select your AI provider, and enter your API key.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Svelte | 5.x | UI with runes (`$state`, `$derived`, `$effect`) |
| TypeScript | 6.x | Strict typing throughout |
| Vite | 8.x | Programmatic build with 4 IIFE entry points |
| Vitest | 4.x | 917 tests, 97% statement coverage |
| Zod | 4.x | Runtime validation of AI responses |

## Project Structure

```
src/
  background/    # Service worker: classifier, autoresponder, folder ops
  lib/
    components/  # Shared Svelte 5 components
    i18n/        # Internationalization (540+ keys, es/en)
    services/    # AI provider integration + Zod schemas
    stores/      # Reactive stores synced with browser.storage
    utils/       # Template engine, conflict detection, search, CSV export
  space/         # Main panel (dashboard, rules, templates, AI chat, log)
  popup/         # Extension popup
  options/       # Settings page
  types/         # TypeScript type definitions
```

> Full architecture documentation with data flows and entry point descriptions is available in the [architecture docs](https://rricajos.github.io/smm/en/desarrollo/arquitectura/).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Production build to `dist/` |
| `npm run dev` | Build + watch + Thunderbird dev server |
| `npm test` | Run 917 unit tests |
| `npm run test:coverage` | Coverage report (thresholds: 93/87/95/94) |
| `npm run lint` | ESLint check |
| `npm run format:check` | Prettier check |
| `npm run package` | Build + package as `.xpi` |

## Documentation

Full documentation is available at **[rricajos.github.io/smm](https://rricajos.github.io/smm/en/)** — including installation guides, rule and template configuration, AI assistant usage, developer architecture, and API reference.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, testing requirements, and the PR process.

## License

[Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/) — see [LICENSE](LICENSE) for details.

Copyright (c) 2026 Ricard Penin Honrubia

## Privacy

Smart Mail Manager processes email content locally and sends data to external AI services **only** when you explicitly use AI features. No data is stored on external servers. API keys are managed locally by the user. See the [full privacy notice](https://rricajos.github.io/smm/en/privacidad/).
