# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Smart Mail Manager, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email the maintainer with:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive an acknowledgment within 48 hours.
4. A fix will be developed and released as quickly as possible.

## Scope

This policy covers the Smart Mail Manager Thunderbird MailExtension source code.
It does not cover third-party dependencies (report those to their respective maintainers).

## Security Measures

- All dependencies are monitored via Dependabot with weekly update checks.
- `npm audit` runs on every CI pipeline execution.
- User data is stored locally via the Thunderbird `browser.storage.local` API and is never transmitted to external servers (except when explicitly configured to use AI provider APIs).
- Content Security Policy restricts scripts to `'self'` only.
- Email content is sanitized before being sent to AI providers.
