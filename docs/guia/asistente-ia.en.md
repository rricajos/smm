# AI Assistant

The AI assistant is a conversational interface that analyzes your mailbox and proposes smart improvements for email organization.

## Conversational chat

The chat includes full mailbox context in every message:

- Current rules (names, conditions, actions)
- Existing response templates
- Folder and tag structure
- Recent emails (up to 30 snippets)
- Account information

This context allows the AI to make proposals that integrate directly with your existing configuration.

### Conversations

- **Multiple sessions**: up to 50 stored conversations
- **Persistent history**: conversations are saved in `browser.storage.local`
- **Auto-title**: the user's first question is used as the title
- **Rename/delete**: manage your conversations from the side panel

## Proposal types

The AI can generate five types of proposals, each with **accept/reject** buttons:

### 1. Rule proposals

The AI analyzes patterns in your emails and suggests classification rules with:

- Descriptive name
- Configured conditions
- Recommended actions
- Confidence level (0-1)
- Reasoning explanation

### 2. Template proposals

Suggests response templates adapted to your communication patterns.

### 3. Folder proposals

Proposes new folder structure based on your mailbox analysis.

### 4. Move proposals

Suggests moving emails from one folder to another, with the option to delete the source folder.

### 5. Consolidation proposals

Detects duplicate or overlapping rules and proposes merging them into a single optimized rule. Includes:

- Resulting merged rule
- IDs and names of the original rules
- Description of the change

!!! info "Cross-references"
    When the AI proposes new rules and their consolidation in the same response, `NEW_RULE:RuleName` references are automatically resolved to the generated UUIDs.

## Quick Panel

In addition to the chat, the quick panel offers direct actions:

| Action | Description |
|--------|-------------|
| **Analyze recent emails** | Detects patterns in recent emails and suggests rules |
| **Describe a rule** | Write in natural language what you want to filter and the AI generates the rule |
| **Batch analysis** | Analyzes up to 64 emails per batch to generate rules in bulk |

## Supported providers

| Provider | Endpoint | Format |
|----------|----------|--------|
| **OpenRouter** | `openrouter.ai/api/v1/chat/completions` | OpenAI-compatible |
| **OpenAI** | `api.openai.com/v1/chat/completions` | OpenAI |
| **Anthropic** | `api.anthropic.com/v1/messages` | Anthropic |
| **Google Gemini** | `generativelanguage.googleapis.com/v1beta/openai/chat/completions` | OpenAI-compatible |
| **Custom** | Configurable | OpenAI-compatible |

### Available models by provider

=== "OpenRouter"

    | Model | Provider |
    |-------|----------|
    | GPT-4o Mini | OpenAI |
    | GPT-4o | OpenAI |
    | GPT-4.1 Nano | OpenAI |
    | GPT-4.1 Mini | OpenAI |
    | GPT-4.1 | OpenAI |
    | o4-mini | OpenAI |
    | Claude 3.5 Sonnet | Anthropic |
    | Claude 3.5 Haiku | Anthropic |
    | Claude Sonnet 4 | Anthropic |
    | Claude Opus 4 | Anthropic |
    | Gemini 2.0 Flash | Google |
    | Gemini 2.5 Flash Preview | Google |
    | Gemini 2.5 Pro Preview | Google |
    | Llama 4 Maverick | Meta |
    | Llama 4 Scout | Meta |
    | DeepSeek V3 | DeepSeek |
    | DeepSeek R1 | DeepSeek |
    | Mistral Small 3.1 | Mistral |
    | Qwen3 235B | Qwen |
    | Qwen3 30B | Qwen |

=== "OpenAI direct"

    | Model |
    |-------|
    | GPT-4o Mini |
    | GPT-4o |
    | GPT-4.1 Nano |
    | GPT-4.1 Mini |
    | GPT-4.1 |
    | o4-mini |

=== "Anthropic direct"

    | Model |
    |-------|
    | Claude 3.5 Haiku |
    | Claude 3.5 Sonnet |
    | Claude Sonnet 4 |
    | Claude Opus 4 |

=== "Google Gemini direct"

    | Model |
    |-------|
    | Gemini 2.0 Flash |
    | Gemini 2.5 Flash Preview |
    | Gemini 2.5 Pro Preview |

## Response validation

AI responses are validated with **Zod** schemas to ensure that malformed fields don't crash the extension. If a field has an incorrect type (e.g., `confidence: "high"` instead of `0.8`), a default value is automatically applied.
