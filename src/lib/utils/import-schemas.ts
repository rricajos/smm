/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { z } from 'zod';
import { DEFAULT_SETTINGS } from './constants';

const conditionFieldValues = ['from', 'to', 'subject', 'body', 'hasAttachments'] as const;
const conditionOperatorValues = [
  'contains',
  'equals',
  'startsWith',
  'endsWith',
  'matches',
  'is',
] as const;
const actionTypeValues = [
  'moveToFolder',
  'addTag',
  'setPriority',
  'markRead',
  'autoRespond',
] as const;
const priorityValues = ['highest', 'high', 'normal', 'low', 'lowest'] as const;
const sendModeValues = ['draft', 'sendNow', 'sendLater'] as const;
const replyTypeValues = ['replyToSender', 'replyToAll'] as const;
const aiProviderValues = ['openrouter', 'openai', 'anthropic', 'google', 'custom'] as const;

const importConditionSchema = z.object({
  field: z.enum(conditionFieldValues).catch('subject'),
  operator: z.enum(conditionOperatorValues).catch('contains'),
  value: z.string().catch(''),
  boolValue: z.boolean().optional(),
  caseSensitive: z.boolean().catch(false),
});

const importActionSchema = z.object({
  type: z.enum(actionTypeValues).catch('markRead'),
  folderId: z.string().optional(),
  tagKey: z.string().optional(),
  priority: z.enum(priorityValues).optional(),
  templateId: z.string().optional(),
});

export const importRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().catch(true),
  conditions: z.array(importConditionSchema).min(1),
  conditionLogic: z.enum(['all', 'any']).catch('all'),
  actions: z.array(importActionSchema).min(1),
  stopProcessing: z.boolean().catch(false),
  createdAt: z.number().catch(() => Date.now()),
  updatedAt: z.number().catch(() => Date.now()),
});

export const importTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subject: z.string().catch(''),
  body: z.string().catch(''),
  isPlainText: z.boolean().catch(true),
  sendMode: z.enum(sendModeValues).catch('draft'),
  replyType: z.enum(replyTypeValues).catch('replyToSender'),
});

export const importSettingsSchema = z.object({
  classificationEnabled: z.boolean().catch(DEFAULT_SETTINGS.classificationEnabled),
  autoResponseEnabled: z.boolean().catch(DEFAULT_SETTINGS.autoResponseEnabled),
  processExistingOnStartup: z.boolean().catch(DEFAULT_SETTINGS.processExistingOnStartup),
  maxAutoResponsesPerHour: z.number().catch(DEFAULT_SETTINGS.maxAutoResponsesPerHour),
  logRetentionDays: z.number().catch(DEFAULT_SETTINGS.logRetentionDays),
  notifyOnClassification: z.boolean().catch(DEFAULT_SETTINGS.notifyOnClassification),
  notifyOnAutoResponse: z.boolean().catch(DEFAULT_SETTINGS.notifyOnAutoResponse),
  aiProvider: z.enum(aiProviderValues).catch(DEFAULT_SETTINGS.aiProvider),
  openaiApiKey: z.string().catch(''),
  openaiModel: z.string().catch(DEFAULT_SETTINGS.openaiModel),
  customBaseUrl: z.string().catch(''),
  aiConsentAccepted: z.boolean().catch(DEFAULT_SETTINGS.aiConsentAccepted),
});

export const importDataSchema = z.object({
  version: z.literal(1).catch(1 as const),
  exportedAt: z.string().catch(''),
  rules: z.array(importRuleSchema),
  templates: z.array(importTemplateSchema),
  settings: importSettingsSchema.catch(DEFAULT_SETTINGS),
});
