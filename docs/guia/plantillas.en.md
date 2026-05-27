# Response templates

Templates allow you to define automatic responses that are sent when a rule with an `autoRespond` action matches an email.

## Template structure

| Field | Description |
|-------|-------------|
| `name` | Identifying name |
| `subject` | Response subject (supports variables) |
| `body` | Response body (supports variables) |
| `isPlainText` | `true` = plain text, `false` = HTML |
| `sendMode` | Send mode |
| `replyType` | Reply type |

### Send modes

| Mode | Description |
|------|-------------|
| `draft` | Creates a draft for manual review |
| `sendNow` | Sends immediately |
| `sendLater` | Schedules sending in the outbox |

### Reply types

| Type | Description |
|------|-------------|
| `replyToSender` | Replies only to the sender |
| `replyToAll` | Replies to all recipients |

## Dynamic variables

Templates support variables with the `{{variable_name}}` syntax that are replaced with data from the original email:

| Variable | Example | Description |
|----------|---------|-------------|
| `{{sender_name}}` | Juan García | Sender's name |
| `{{sender_email}}` | juan@example.com | Sender's email |
| `{{to}}` | ricard@conexiatec.com | Recipient |
| `{{subject}}` | Re: Budget | Original subject |
| `{{date}}` | 05/18/2026 | Current date |
| `{{time}}` | 14:30 | Current time |
| `{{day_of_week}}` | Monday | Day of the week |
| `{{original_body}}` | *(full text)* | Complete body of the original email |
| `{{original_body_snippet}}` | *(first lines)* | First lines of the body |
| `{{my_name}}` | Ricard Penin | User's name (from account) |
| `{{my_email}}` | ricard@conexiatec.com | User's email (from account) |

!!! note "Legacy variables"
    The variables `{{senderName}}`, `{{senderEmail}}`, `{{originalSubject}}` are also supported for backward compatibility.

### Template example

**Subject:**
```
Re: {{subject}}
```

**Body:**
```
Hello {{sender_name}},

Thank you for your email. I have received your message about
"{{subject}}" and will get back to you as soon as possible.

Best regards,
{{my_name}}
```

## Preview

The template editor includes a real-time preview that shows how the response will look with example values.

## Rate limiting

Automatic responses are limited by the `maxAutoResponsesPerHour` setting. By default, 10 automatic responses per hour are allowed to prevent loops.

## Auto-response flow

```
autoRespond action triggered
  → Check rate limit (maxAutoResponsesPerHour)
  → Load template by templateId
  → Replace {{variables}} with message data
  → Based on sendMode:
    - draft → create draft
    - sendNow → send immediately
    - sendLater → schedule sending
```
