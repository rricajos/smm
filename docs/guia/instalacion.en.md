# Installation

## Prerequisites

- **Node.js 20+** to build the extension
- **Thunderbird 128+** installed
- API key from an AI provider (OpenRouter, OpenAI, Anthropic, Google, or a local server)

## Install from source

```bash
git clone https://github.com/rricajos/smm.git
cd smm
npm install
```

### Available scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Production build to `dist/` |
| `npm run watch` | Build + watch for changes in `src/` |
| `npm run dev` | Build + watch + `web-ext run` with Thunderbird |
| `npm test` | Run unit tests with Vitest |
| `npm run test:watch` | Tests in watch mode |
| `npm run package` | Build + package as `smart-mail-manager.xpi` |

### Install in Thunderbird

**Production:**

```bash
npm run package
```

Then in Thunderbird: **Tools** > **Add-ons** > :material-cog: > **Install from file** > select `smart-mail-manager.xpi`.

**Development:**

```bash
npm run dev
```

Opens Thunderbird with the extension loaded and automatic hot-reload.

!!! note "Thunderbird paths"
    Adjust the Thunderbird and profile paths in `package.json` if your installation differs from the default.

## Initial setup

1. **Open options**: right-click the extension icon > **Options**.
2. **Select AI provider**: choose between OpenRouter, OpenAI, Anthropic, Google Gemini, or a custom server.
3. **Enter API key**: paste your API key for the selected provider.
4. **Choose model**: select the AI model you want to use.
5. **Accept AI consent**: confirm that you understand email data will be sent to the provider.
6. **Save**: changes are applied immediately.

### Provider configuration

| Provider | Endpoint | API key |
|----------|----------|---------|
| **OpenRouter** | `openrouter.ai/api/v1` | Starts with `sk-or-...` |
| **OpenAI** | `api.openai.com/v1` | Starts with `sk-...` |
| **Anthropic** | `api.anthropic.com/v1` | Starts with `sk-ant-...` |
| **Google Gemini** | `generativelanguage.googleapis.com` | Starts with `AIza...` |
| **Custom** | Configurable URL | Depends on the server |

!!! tip "OpenRouter as default option"
    OpenRouter allows access to models from multiple providers with a single API key. It's the most flexible option if you don't have a preference for a specific provider.

## Storage

All data is persisted locally in `browser.storage.local`:

| Key | Content |
|-----|---------|
| `smm_rules` | Classification rules |
| `smm_templates` | Response templates |
| `smm_settings` | General configuration |
| `smm_activity_log` | Activity log (max 500 entries) |
| `smm_chat_history` | AI conversation history |
| `smm_locale` | Selected language |

## Languages

Smart Mail Manager supports:

- **Español** (es) — primary language
- **English** (en)

Change the language from **Options** without needing to restart.
