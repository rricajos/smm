# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.5.x   | ✅        |
| < 1.5   | ❌        |

## Reporting a Vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Report security issues privately via one of the following channels:

- **Email:** ricard.penin.honrubia@gmail.com
- **GitHub Security Advisories:** [Report a vulnerability](https://github.com/rricajos/smm/security/advisories/new)

Include the following information in your report:

- Description of the vulnerability and its potential impact
- Steps to reproduce the issue
- Affected version(s)
- Any suggested mitigations (optional)

You will receive an acknowledgement within **48 hours** and a status update within **7 days**.

## Security Model

Smart Mail Manager operates with the following security constraints:

- **Local processing** — email classification and template rendering happen entirely on-device
- **Explicit AI requests only** — email content is sent to AI providers only when the user explicitly invokes AI features; content is truncated to 500 characters per email
- **Local key storage** — API keys are stored in `browser.storage.local`, accessible only by the extension, and never transmitted to third parties
- **Content Security Policy** — scripts are restricted to `'self'` only
- **HTML escaping** — user-provided content is escaped before markdown rendering to prevent XSS
- **ReDoS protection** — regex conditions with catastrophic backtracking patterns are rejected at input time
- **Prompt injection filtering** — 11 patterns are filtered from AI-bound content
- **`npm audit`** runs on every CI execution

## Scope

The following are **in scope** for security reports:

- Leakage of API keys or email content to unintended parties
- XSS or code injection via crafted email content
- Privilege escalation through the extension's `messenger.*` API usage
- ReDoS via crafted rule conditions

The following are **out of scope**:

- Vulnerabilities in third-party AI providers (OpenAI, Anthropic, Google, OpenRouter)
- Issues requiring physical access to the device
- Social engineering attacks
