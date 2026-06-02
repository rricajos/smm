# FAQ / Troubleshooting

## Installation

??? question "Thunderbird says the extension is incompatible"
    Smart Mail Manager requires Thunderbird 128 or later. Check your version in Help > About Thunderbird. If you need to update, download the latest version from [thunderbird.net](https://www.thunderbird.net/).

??? question "`npm run dev` does not open Thunderbird"
    The Thunderbird binary and profile paths in `package.json` must match your installation. Edit the `--firefox` and `--firefox-profile` arguments in the `dev` script. On Windows, the typical path is `C:\Program Files\Mozilla Thunderbird\thunderbird.exe`.

??? question "Build fails with TypeScript errors"
    Make sure you have Node.js 20+ and run `npm install` to update dependencies. If the error persists, try deleting `node_modules` and reinstalling:
    ```bash
    rm -rf node_modules
    npm install
    npm run build
    ```

## AI Assistant

??? question "'API key invalid' or '401 Unauthorized' error"
    Verify that your API key is entered correctly in Options with no extra spaces. Each provider has a different format:

    - **OpenRouter:** starts with `sk-or-...`
    - **OpenAI:** starts with `sk-...`
    - **Anthropic:** starts with `sk-ant-...`
    - **Google Gemini:** starts with `AIza...`

??? question "The AI does not respond or times out"
    - Check your internet connection
    - Verify the provider status (e.g., [status.openai.com](https://status.openai.com))
    - If using a reasoning model (DeepSeek R1, o4-mini), these can take longer
    - Try a faster model (GPT-4o Mini, Claude 3.5 Haiku, Gemini Flash)

??? question "Can I use a local model (Ollama, LM Studio)?"
    Yes. Select **Custom** as the provider and enter your local server URL, for example:

    - Ollama: `http://localhost:11434/v1/chat/completions`
    - LM Studio: `http://localhost:1234/v1/chat/completions`

    The extension will ask for permission to connect to local URLs the first time.

??? question "AI proposals do not show as accept/reject buttons"
    The AI must generate specific JSON blocks (`RULE_PROPOSAL`, `TEMPLATE_PROPOSAL`, etc.) for interactive proposals to appear. If you only see text, the chosen model may not follow the prompt instructions well. Try GPT-4o, Claude Sonnet 4, or Gemini 2.5 Pro.

## Rules and Classification

??? question "Rules are not being applied to new emails"
    1. Verify that classification is enabled in Options
    2. Check that your rules are enabled (toggle switch visible on each rule)
    3. Review the activity log in the panel for errors
    4. Rules only apply to new emails that arrive after they are activated

??? question "How do I test a rule against existing emails?"
    Use the **"Process existing emails"** button on the Dashboard. This will evaluate all enabled rules against your current inbox emails.

??? question "Regular expressions do not work"
    - Make sure to select the **"matches regex"** operator in the condition
    - Do not use delimiters (`/pattern/`), write only the pattern: `newsletter|promo`
    - Regex with nested quantifiers (`(a+)+`) are rejected for security reasons (ReDoS)

??? question "The conflicts panel shows conflicts that are not real"
    The conflict detector is conservative: it flags rules with overlapping conditions even if they do not cause problems in practice. You can ignore the conflicts or use "Merge redundant rules" to simplify.

## Import / Export

??? question "Import shows conflicts for all my rules"
    Conflicts are detected by ID and by name. If you exported and re-imported the same configuration, all items will show as conflicts because they already exist. Select "Skip" to keep existing items or "Replace" to overwrite.

??? question "Is the export format compatible between versions?"
    Yes. The JSON format includes schema validation. Fields added in newer versions are automatically filled with default values.

## Templates

??? question "The {{}} variables are not replaced in the response"
    Verify that you use the correct syntax with double braces: `{{sender_name}}`, not `{sender_name}`. See the full list of variables in [Templates](plantillas.md#available-variables).

??? question "Can I send HTML responses?"
    Yes. Uncheck the "Plain text" option in the template editor. The body will be interpreted as HTML.

## Privacy and Security

??? question "Does the extension send my emails to external servers?"
    Only when you explicitly use AI features (chat assistant, email analysis, rule suggestions). In that case, content is limited to 500 characters per email and sent only to the AI provider you configured. Rule-based classification and templates work entirely locally with no external connections.

??? question "Where are API keys stored?"
    In `browser.storage.local`, the browser's local storage accessible only by the extension. They are never transmitted to third-party servers or appear in any log. If you uninstall the extension, all data is automatically deleted along with the extension profile.

??? question "What data does the activity log record?"
    The log records local events: applied classifications, sent responses, rule errors, and folder operations. All this information is stored in `browser.storage.local` and never leaves your device. You can export it as CSV or clear it from the panel.

## Performance

??? question "Classification slows down with a large inbox"
    Rules are evaluated in order for each incoming email. To improve performance:

    - Disable rules you no longer use
    - Place more specific rules first (they prevent subsequent rules from being evaluated)
    - Avoid complex regex conditions in high-frequency rules

??? question "The Quick Panel takes a long time to analyze emails"
    The Quick Panel analyzes emails in batches of 25 with a pause between each batch to avoid overwhelming the API. If the provider imposes rate limits, batches are processed more slowly. You can cancel the analysis at any time and accept the partial proposals that have already appeared.

## Dashboard

??? question "What do the weekly statistics show?"
    The dashboard displays: classifications per day of the current week, a ranking of the most active rules, and the senders that generate the most activity. Data is calculated from the local activity log, so it only reflects activity recorded since you installed the extension.

??? question "The activity log is empty"
    The log records events from the first time classification is activated. If you just installed the extension or just enabled classification, the log will be empty until the first email arrives and a rule is applied. Verify that classification is enabled in Options.
