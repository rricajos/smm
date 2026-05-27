# Types

TypeScript definitions for the project's main types, located in `src/types/`.

## Rule

`src/types/rules.ts`

```typescript
interface Rule {
  id: string;                    // UUID
  name: string;
  enabled: boolean;
  conditions: Condition[];
  conditionLogic: 'all' | 'any'; // AND / OR
  actions: Action[];
  stopProcessing: boolean;       // Stop evaluation after match
  createdAt: number;             // Timestamp
  updatedAt: number;             // Timestamp
}
```

## Condition

```typescript
interface Condition {
  field: 'from' | 'to' | 'subject' | 'body' | 'hasAttachments';
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'matches' | 'is';
  value: string;
  boolValue?: boolean;           // For hasAttachments
  caseSensitive: boolean;
}
```

### Fields and operators

| Field | Type | Compatible operators |
|-------|------|---------------------|
| `from` | string | contains, equals, startsWith, endsWith, matches |
| `to` | string | contains, equals, startsWith, endsWith, matches |
| `subject` | string | contains, equals, startsWith, endsWith, matches |
| `body` | string | contains, equals, startsWith, endsWith, matches |
| `hasAttachments` | boolean | is |

## Action

```typescript
interface Action {
  type: 'moveToFolder' | 'addTag' | 'setPriority' | 'markRead' | 'autoRespond';
  folderId?: string;
  tagKey?: string;
  priority?: 'highest' | 'high' | 'normal' | 'low' | 'lowest';
  templateId?: string;           // Reference to ResponseTemplate
}
```

### Required fields by type

| Type | Required fields |
|------|----------------|
| `moveToFolder` | `folderId` |
| `addTag` | `tagKey` |
| `setPriority` | `priority` |
| `markRead` | — |
| `autoRespond` | `templateId` |

## ResponseTemplate

`src/types/templates.ts`

```typescript
interface ResponseTemplate {
  id: string;
  name: string;
  subject: string;               // Supports {{variables}}
  body: string;                  // Supports {{variables}}
  isPlainText: boolean;
  sendMode: 'draft' | 'sendNow' | 'sendLater';
  replyType: 'replyToSender' | 'replyToAll';
}
```

## Settings

`src/types/settings.ts`

```typescript
type AiProvider = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'custom';

interface Settings {
  classificationEnabled: boolean;
  autoResponseEnabled: boolean;
  processExistingOnStartup: boolean;
  maxAutoResponsesPerHour: number;
  logRetentionDays: number;
  notifyOnClassification: boolean;
  notifyOnAutoResponse: boolean;
  aiProvider: AiProvider;
  openaiApiKey: string;
  openaiModel: string;
  customBaseUrl: string;
  aiConsentAccepted: boolean;
}
```

### Default values

```typescript
const DEFAULT_SETTINGS: Settings = {
  classificationEnabled: true,
  autoResponseEnabled: true,
  processExistingOnStartup: false,
  maxAutoResponsesPerHour: 10,
  logRetentionDays: 30,
  notifyOnClassification: true,
  notifyOnAutoResponse: true,
  aiProvider: 'openrouter',
  openaiApiKey: '',
  openaiModel: 'openai/gpt-4o-mini',
  customBaseUrl: '',
  aiConsentAccepted: false,
};
```

## ActivityEntry

```typescript
interface ActivityEntry {
  timestamp: number;
  ruleId: string;
  ruleName: string;
  messageId: number;
  subject: string;
  from: string;
  actions: string[];
  type: 'classification' | 'autoResponse' | 'error';
  details?: string;
  accountId?: string;
}
```

## Zod inferred types

`src/lib/services/ai-schemas.ts` defines inferred types that replace manual interfaces for AI responses:

```typescript
type ValidatedCondition = z.infer<typeof conditionSchema>;
type ValidatedAction = z.infer<typeof actionSchema>;
type ValidatedRuleData = z.infer<typeof ruleDataSchema>;
type ValidatedRulesResponse = z.infer<typeof rulesResponseSchema>;
type ValidatedConsultantResponse = z.infer<typeof consultantResponseSchema>;
```

These types include automatic defaults that are applied during parsing, making all fields non-optional.
