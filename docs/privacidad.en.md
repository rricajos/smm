# Privacy and disclaimer

## Privacy notice

Smart Mail Manager processes email content (sender, subject, body snippets) and sends it to external AI services when the user uses AI features. This communication occurs exclusively on user demand and never automatically in the background without consent.

- Data is only transmitted to the AI provider configured by the user.
- No data is stored on external servers; all persistence is local (`browser.storage.local`).
- API keys are provided and managed by the user.
- The user is responsible for reviewing the privacy policy of their chosen AI provider.

### Providers and their policies

| Provider | Privacy policy |
|----------|---------------|
| OpenRouter | [openrouter.ai/privacy](https://openrouter.ai/privacy) |
| OpenAI | [openai.com/privacy](https://openai.com/privacy) |
| Anthropic | [anthropic.com/privacy](https://www.anthropic.com/privacy) |
| Google | [ai.google.dev/terms](https://ai.google.dev/terms) |

### Extension permissions

| Permission | Purpose |
|------------|---------|
| `messagesRead` | Read email content for classification |
| `messagesMove` | Move emails to folders based on rules |
| `messagesUpdate` | Change priority and mark as read |
| `messagesTags` | Add tags to emails |
| `accountsRead` | List user accounts and folders |
| `accountsFolders` | Create new folders (AI proposals) |
| `compose` / `compose.send` / `compose.save` | Create drafts and send auto-responses |
| `storage` | Persist configuration, rules, templates and logs |
| `notifications` | Notify on classifications and responses |

## Disclaimer

This software is provided "as is", without warranties of any kind, express or implied. In no event shall the author be liable for any damages arising from the use of this software, including but not limited to:

- Loss or incorrect classification of emails.
- Sending of unwanted automatic responses.
- Costs arising from the use of third-party APIs.
- Data loss or service interruptions.

The user assumes all risk regarding the quality and performance of the software.
