# Classification rules

Rules are Smart Mail Manager's main mechanism for automatically processing emails. Each rule combines **conditions** (which emails match) with **actions** (what to do with them).

## Rule structure

Each rule has:

- **Name** — descriptive identifier
- **Conditions** — one or more conditions evaluated against each email
- **Condition logic** — `all` (AND) or `any` (OR)
- **Actions** — one or more actions to execute when conditions are met
- **Stop processing** — if enabled, stops evaluation of subsequent rules after a match

## Conditions

### Available fields

| Field | Description |
|-------|-------------|
| `from` | Sender address |
| `to` | Recipient address |
| `subject` | Email subject |
| `body` | Message body |
| `hasAttachments` | Whether the email has attachments (boolean) |

### Operators

| Operator | Description |
|----------|-------------|
| `contains` | Field contains the value |
| `equals` | Field exactly equals the value |
| `startsWith` | Field starts with the value |
| `endsWith` | Field ends with the value |
| `matches` | Field matches a regular expression |
| `is` | Exact comparison (used with booleans) |

!!! warning "Regular expressions"
    The `matches` operator uses JavaScript regular expressions. Invalid patterns are silently ignored during classification, but the rule editor validates them when saving.

### Additional options

- **Case sensitive** — if enabled, comparison is case-sensitive
- **boolValue** — for the `hasAttachments` field, defines whether to look for `true` or `false`

## Actions

| Action | Description | Requires |
|--------|-------------|----------|
| `moveToFolder` | Move email to a folder | `folderId` |
| `addTag` | Add a tag | `tagKey` |
| `setPriority` | Change priority | `priority` (highest/high/normal/low/lowest) |
| `markRead` | Mark as read | — |
| `autoRespond` | Automatic response | `templateId` |

Actions are executed sequentially. If a rule has `stopProcessing: true`, subsequent rules are not evaluated for that email.

## Evaluation logic

```
New email → for each enabled rule (in order):
  → Evaluate conditions with all/any logic
  → If match:
    → Execute actions sequentially
    → Log in activity log
    → If stopProcessing → stop
```

## Conflict detection

The system automatically detects three types of conflicts between enabled rules:

| Type | Severity | Description |
|------|----------|-------------|
| `contradictory_move` | :material-alert: warning | Two rules move to different folders |
| `contradictory_priority` | :material-alert: warning | Two rules assign different priorities |
| `redundant` | :material-information: info | Similar conditions with identical actions |

Conflicts are detected when conditions of two rules overlap (same field and operator with contained values).

## Preset gallery

Smart Mail Manager includes predefined presets for creating common rules:

| Category | Examples |
|----------|----------|
| Newsletters | Filter emails with "unsubscribe" |
| Social media | Facebook, Twitter, LinkedIn, Instagram |
| Finance | Banks, PayPal, transfers |
| Shopping | Amazon, orders, shipping |
| Work | Jira, GitHub, Slack, Teams |
| Notifications | Security alerts, verifications |

## Import and export

Rules can be exported and imported in JSON format together with templates and configuration. The system detects conflicts by ID and name during import, offering three options:

- **Replace** — overwrite the existing rule
- **Skip** — keep the existing one
- **Duplicate** — create a copy with a new ID

!!! tip "Broken reference detection"
    If a rule references a folder, tag, or template that no longer exists, the editor shows it as a warning.
