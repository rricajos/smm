/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { z } from 'zod';
import { logger } from '../utils/logger';

// Using .catch() instead of .default() — .catch() handles BOTH missing values
// AND type errors (e.g. AI sends a number where string is expected), making
// parsing resilient to malformed AI responses without failing the entire object.

// --- Shared sub-schemas ---

export const conditionSchema = z.object({
  field: z.string().catch('subject'),
  operator: z.string().catch('contains'),
  value: z.string().catch(''),
  boolValue: z.boolean().optional(),
  caseSensitive: z.boolean().catch(false),
});

export const actionSchema = z.object({
  type: z.string().catch('markRead'),
  folderId: z.string().optional(),
  tagKey: z.string().optional(),
  priority: z.string().optional(),
  templateId: z.string().optional(),
});

export const ruleDataSchema = z.object({
  name: z.string().catch(''),
  explanation: z.string().catch(''),
  confidence: z.number().min(0).max(1).catch(0.5),
  conditionLogic: z.string().catch('all'),
  conditions: z.array(conditionSchema).catch([]),
  actions: z.array(actionSchema).catch([]),
  description: z.string().catch(''),
});

// --- Top-level response schemas ---

export const rulesResponseSchema = z.object({
  rules: z.array(ruleDataSchema).catch([]),
});

export const consultantResponseSchema = z.object({
  message: z.string().catch(''),
  folder_proposals: z.array(z.object({
    name: z.string().catch(''),
    parentFolderId: z.string().catch(''),
    parentPath: z.string().catch(''),
    description: z.string().catch(''),
  })).catch([]),
  move_proposals: z.array(z.object({
    sourceFolderId: z.string().catch(''),
    sourceFolderPath: z.string().catch(''),
    destFolderId: z.string().catch(''),
    destFolderPath: z.string().catch(''),
    deleteSource: z.boolean().catch(true),
    description: z.string().catch(''),
  })).catch([]),
  rule_proposals: z.array(ruleDataSchema).catch([]),
  template_proposals: z.array(z.object({
    name: z.string().catch(''),
    subject: z.string().catch(''),
    body: z.string().catch(''),
    isPlainText: z.boolean().catch(true),
    sendMode: z.string().catch('draft'),
    replyType: z.string().catch('replyToSender'),
    description: z.string().catch(''),
  })).catch([]),
  rule_consolidation_proposals: z.array(z.object({
    mergedRule: ruleDataSchema.optional(),
    sourceRuleIds: z.array(z.string()).catch([]),
    sourceRuleNames: z.array(z.string()).catch([]),
    description: z.string().catch(''),
  })).catch([]),
});

// --- Inferred types (replace Raw* interfaces in openai.ts) ---

export type ValidatedCondition = z.infer<typeof conditionSchema>;
export type ValidatedAction = z.infer<typeof actionSchema>;
export type ValidatedRuleData = z.infer<typeof ruleDataSchema>;
export type ValidatedRulesResponse = z.infer<typeof rulesResponseSchema>;
export type ValidatedConsultantResponse = z.infer<typeof consultantResponseSchema>;

// --- Safe parser with fallback ---

/**
 * Parse AI response data against a zod schema.
 * On success returns validated data with defaults applied.
 * On failure logs a warning and returns the schema's default (empty) object.
 */
export function safeParseAI<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  logger.warn(`AI response validation failed (${label}):`, result.error.issues);
  // Return with all defaults applied
  return schema.parse({});
}
