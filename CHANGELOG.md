# Changelog

All notable changes to Smart Mail Manager are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

> **Note:** Patch version numbers (e.g. 1.5.103) are auto-incremented on each build. This changelog groups changes by meaningful release milestones.

## [1.5.0] - 2026-05-28

### Added

- **AI assistant** — conversational chat with full mailbox context (rules, templates, folders, tags, recent emails)
- **5 AI providers** — OpenRouter, OpenAI (direct), Anthropic (direct), Google Gemini (direct), and custom OpenAI-compatible endpoints (Ollama, LM Studio, vLLM)
- **Smart proposals** — AI-generated rules, response templates, folder suggestions, email moves, and rule consolidation with individual accept/reject
- **Cross-reference resolution** — `NEW_RULE:Name` references in AI responses auto-resolve to generated UUIDs
- **Zod schema validation** — runtime validation of all AI responses with automatic defaults
- **Rule conflict detection** — contradictory moves, incompatible priorities, redundancy, and condition overlap
- **Automatic rule merging** from the conflicts panel
- **"Resolve with AI" button** in rule conflicts panel
- **Rule preset gallery** — common rules for newsletters, social media, finance, shopping, etc.
- **Broken reference detection** — warns about deleted folders, tags, or templates referenced in rules
- **Quick Panel** — batch email analysis and natural language rule generation
- **Global search** (Ctrl+K) across rules, templates, and activity log
- **Configuration import/export** (JSON) with conflict resolution by ID and name
- **Activity log** with type filters, pagination, and CSV export
- **Dashboard** with weekly statistics, rule ranking, and top senders
- **Folder management** — create, rename, delete, move content via AI or manually
- **Unread classification badges** on the extension icon and navigation
- **Response templates** with 11 dynamic variables (`{{sender_name}}`, `{{subject}}`, `{{date}}`, etc.) and real-time preview
- **Send modes** for templates: draft, send now, send later
- **Rate limiting** for auto-responses (configurable per hour)
- **Bilingual UI** — full Spanish and English with 540+ translation keys
- **Dynamic language switching** without restart
- **ConfirmDialog component** replacing native `confirm()` calls
- **Keyboard shortcuts modal** accessible from the panel
- **MkDocs documentation site** with bilingual content deployed to GitHub Pages
- **CI pipeline** — ESLint, Prettier, TypeScript check, 917 tests, coverage, build
- **Coverage thresholds** enforced at 93% statements, 87% branches, 95% functions, 94% lines
- **Dependabot** with weekly npm dependency updates
- **Security policy** (SECURITY.md) with responsible disclosure process

### Changed

- Upgraded to TypeScript 6.0 strict mode
- Upgraded to Svelte 5 with runes (`$state`, `$derived`, `$effect`, `$props`)
- Migrated AI response parsing from manual interfaces to Zod schemas
- Refactored stores to use synced-store factory with automatic `browser.storage` sync
- Normalized button components and standardized styles across all pages
- Replaced `confirm()` with accessible ConfirmDialog component
- Switched to SVG icons for proper display in Thunderbird
- Eliminated all `as any` casts from source code (test files excluded)
- Added logging to all previously silent catch blocks

### Fixed

- Non-deprecated tags API usage for Thunderbird 128+ compatibility
- Robust JSON parsing for AI responses (code blocks, raw JSON, malformed input)
- i18n accent handling in Spanish translations
- Subscription cleanup to prevent memory leaks in Svelte components
- Provider-aware model selector reflecting correct models per provider

### Security

- Content Security Policy restricts scripts to `'self'` only
- Email content sanitized before sending to AI providers (500 character limit)
- HTML escaped before markdown rendering to prevent XSS
- Prompt injection protection with 11 filtered patterns
- API keys stored locally via `browser.storage.local`, never transmitted to third parties
- `npm audit` runs on every CI execution

## [1.0.0] - 2026-05-19

### Added

- Initial release with rule-based email classification
- Conditions: from, to, subject, body, hasAttachments
- Operators: contains, equals, startsWith, endsWith, matches (regex), is (boolean)
- Actions: moveToFolder, addTag, setPriority, markRead, autoRespond
- Response templates with variable substitution
- Background service worker for Thunderbird 128+ (Manifest V2)
- Popup, options page, and main panel (space)
- Basic activity logging
- `browser.storage.local` persistence
- Mozilla Public License 2.0
