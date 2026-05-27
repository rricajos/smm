# Tipos

Definiciones TypeScript de los tipos principales del proyecto, ubicados en `src/types/`.

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
  stopProcessing: boolean;       // Detener evaluación tras coincidencia
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
  boolValue?: boolean;           // Para hasAttachments
  caseSensitive: boolean;
}
```

### Campos y operadores

| Campo | Tipo | Operadores compatibles |
|-------|------|----------------------|
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
  templateId?: string;           // Referencia a ResponseTemplate
}
```

### Campos requeridos por tipo

| Tipo | Campos requeridos |
|------|------------------|
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
  subject: string;               // Soporta {{variables}}
  body: string;                  // Soporta {{variables}}
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

### Valores por defecto

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

## Tipos inferidos de Zod

`src/lib/services/ai-schemas.ts` define tipos inferidos que reemplazan las interfaces manuales para respuestas AI:

```typescript
type ValidatedCondition = z.infer<typeof conditionSchema>;
type ValidatedAction = z.infer<typeof actionSchema>;
type ValidatedRuleData = z.infer<typeof ruleDataSchema>;
type ValidatedRulesResponse = z.infer<typeof rulesResponseSchema>;
type ValidatedConsultantResponse = z.infer<typeof consultantResponseSchema>;
```

Estos tipos incluyen defaults automáticos que se aplican durante el parsing, haciendo que todos los campos sean non-optional.
