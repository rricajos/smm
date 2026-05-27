/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import type { Condition, Action, Rule } from '../../types/rules';
import type { ResponseTemplate } from '../../types/templates';
import type { Settings, ActivityEntry } from '../../types/settings';
import { DEFAULT_SETTINGS } from './constants';

// ── Allowed values ──────────────────────────────────────────────────────

const CONDITION_FIELDS = new Set<Condition['field']>(['from', 'to', 'subject', 'body', 'hasAttachments']);
const CONDITION_OPERATORS = new Set<Condition['operator']>(['contains', 'equals', 'startsWith', 'endsWith', 'matches', 'is']);
const ACTION_TYPES = new Set<Action['type']>(['moveToFolder', 'addTag', 'setPriority', 'markRead', 'autoRespond']);
const PRIORITIES = new Set<NonNullable<Action['priority']>>(['highest', 'high', 'normal', 'low', 'lowest']);
const SEND_MODES = new Set<ResponseTemplate['sendMode']>(['draft', 'sendNow', 'sendLater']);
const REPLY_TYPES = new Set<ResponseTemplate['replyType']>(['replyToSender', 'replyToAll']);
const ACTIVITY_TYPES = new Set<ActivityEntry['type']>(['classification', 'autoResponse', 'error']);
const AI_PROVIDERS = new Set(['openrouter', 'openai', 'anthropic', 'google', 'custom']);

// ── Type guards ─────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function isValidCondition(v: unknown): v is Condition {
  if (!isObject(v)) return false;
  if (!CONDITION_FIELDS.has(v.field as Condition['field'])) return false;
  if (!CONDITION_OPERATORS.has(v.operator as Condition['operator'])) return false;
  if (typeof v.value !== 'string') return false;
  // caseSensitive may be missing in old data — repaired in sanitizeRules
  return true;
}

export function isValidAction(v: unknown): v is Action {
  if (!isObject(v)) return false;
  if (!ACTION_TYPES.has(v.type as Action['type'])) return false;
  if (v.folderId !== undefined && typeof v.folderId !== 'string') return false;
  if (v.tagKey !== undefined && typeof v.tagKey !== 'string') return false;
  if (v.priority !== undefined && !PRIORITIES.has(v.priority as NonNullable<Action['priority']>)) return false;
  if (v.templateId !== undefined && typeof v.templateId !== 'string') return false;
  return true;
}

export function isValidRule(v: unknown): v is Rule {
  if (!isObject(v)) return false;
  if (typeof v.id !== 'string' || v.id === '') return false;
  if (typeof v.name !== 'string') return false;
  if (typeof v.enabled !== 'boolean') return false;
  if (!Array.isArray(v.conditions)) return false;
  if (!Array.isArray(v.actions)) return false;
  // conditionLogic, stopProcessing, createdAt, updatedAt may be missing — repaired in sanitize
  return true;
}

export function isValidTemplate(v: unknown): v is ResponseTemplate {
  if (!isObject(v)) return false;
  if (typeof v.id !== 'string' || v.id === '') return false;
  if (typeof v.name !== 'string') return false;
  if (typeof v.subject !== 'string') return false;
  if (typeof v.body !== 'string') return false;
  // isPlainText, sendMode, replyType may be missing — repaired in sanitize
  return true;
}

export function isValidSettings(v: unknown): v is Partial<Settings> {
  return isObject(v);
}

export function isValidActivityEntry(v: unknown): v is ActivityEntry {
  if (!isObject(v)) return false;
  if (typeof v.timestamp !== 'number') return false;
  if (typeof v.messageId !== 'number') return false;
  if (!ACTIVITY_TYPES.has(v.type as ActivityEntry['type'])) return false;
  if (!Array.isArray(v.actions)) return false;
  return true;
}

// ── Sanitizers ──────────────────────────────────────────────────────────

function repairCondition(c: Record<string, unknown>): Condition {
  return {
    field: CONDITION_FIELDS.has(c.field as Condition['field']) ? (c.field as Condition['field']) : 'subject',
    operator: CONDITION_OPERATORS.has(c.operator as Condition['operator']) ? (c.operator as Condition['operator']) : 'contains',
    value: typeof c.value === 'string' ? c.value : '',
    ...(c.boolValue !== undefined ? { boolValue: Boolean(c.boolValue) } : {}),
    caseSensitive: typeof c.caseSensitive === 'boolean' ? c.caseSensitive : false,
  };
}

function repairAction(a: Record<string, unknown>): Action {
  const action: Action = {
    type: ACTION_TYPES.has(a.type as Action['type']) ? (a.type as Action['type']) : 'markRead',
  };
  if (typeof a.folderId === 'string') action.folderId = a.folderId;
  if (typeof a.tagKey === 'string') action.tagKey = a.tagKey;
  if (PRIORITIES.has(a.priority as NonNullable<Action['priority']>)) action.priority = a.priority as Action['priority'];
  if (typeof a.templateId === 'string') action.templateId = a.templateId;
  return action;
}

function repairRule(r: Record<string, unknown>): Rule {
  const conditions = Array.isArray(r.conditions)
    ? (r.conditions as unknown[]).filter(isObject).map(repairCondition)
    : [];
  const actions = Array.isArray(r.actions)
    ? (r.actions as unknown[]).filter(isObject).map(repairAction)
    : [];

  return {
    id: typeof r.id === 'string' && r.id !== '' ? r.id : crypto.randomUUID(),
    name: typeof r.name === 'string' ? r.name : '',
    enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
    conditions,
    conditionLogic: r.conditionLogic === 'any' ? 'any' : 'all',
    actions,
    stopProcessing: typeof r.stopProcessing === 'boolean' ? r.stopProcessing : false,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now(),
  };
}

export function sanitizeRules(raw: unknown): Rule[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map(repairRule);
}

function repairTemplate(t: Record<string, unknown>): ResponseTemplate {
  return {
    id: typeof t.id === 'string' && t.id !== '' ? t.id : crypto.randomUUID(),
    name: typeof t.name === 'string' ? t.name : '',
    subject: typeof t.subject === 'string' ? t.subject : '',
    body: typeof t.body === 'string' ? t.body : '',
    isPlainText: typeof t.isPlainText === 'boolean' ? t.isPlainText : true,
    sendMode: SEND_MODES.has(t.sendMode as ResponseTemplate['sendMode']) ? (t.sendMode as ResponseTemplate['sendMode']) : 'draft',
    replyType: REPLY_TYPES.has(t.replyType as ResponseTemplate['replyType']) ? (t.replyType as ResponseTemplate['replyType']) : 'replyToSender',
  };
}

export function sanitizeTemplates(raw: unknown): ResponseTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map(repairTemplate);
}

export function sanitizeSettings(raw: unknown): Settings {
  if (!isObject(raw)) return { ...DEFAULT_SETTINGS };
  const s = raw;
  return {
    classificationEnabled: typeof s.classificationEnabled === 'boolean' ? s.classificationEnabled : DEFAULT_SETTINGS.classificationEnabled,
    autoResponseEnabled: typeof s.autoResponseEnabled === 'boolean' ? s.autoResponseEnabled : DEFAULT_SETTINGS.autoResponseEnabled,
    processExistingOnStartup: typeof s.processExistingOnStartup === 'boolean' ? s.processExistingOnStartup : DEFAULT_SETTINGS.processExistingOnStartup,
    maxAutoResponsesPerHour: typeof s.maxAutoResponsesPerHour === 'number' ? s.maxAutoResponsesPerHour : DEFAULT_SETTINGS.maxAutoResponsesPerHour,
    logRetentionDays: typeof s.logRetentionDays === 'number' ? s.logRetentionDays : DEFAULT_SETTINGS.logRetentionDays,
    notifyOnClassification: typeof s.notifyOnClassification === 'boolean' ? s.notifyOnClassification : DEFAULT_SETTINGS.notifyOnClassification,
    notifyOnAutoResponse: typeof s.notifyOnAutoResponse === 'boolean' ? s.notifyOnAutoResponse : DEFAULT_SETTINGS.notifyOnAutoResponse,
    aiProvider: AI_PROVIDERS.has(s.aiProvider as string) ? (s.aiProvider as Settings['aiProvider']) : DEFAULT_SETTINGS.aiProvider,
    openaiApiKey: typeof s.openaiApiKey === 'string' ? s.openaiApiKey : DEFAULT_SETTINGS.openaiApiKey,
    openaiModel: typeof s.openaiModel === 'string' ? s.openaiModel : DEFAULT_SETTINGS.openaiModel,
    customBaseUrl: typeof s.customBaseUrl === 'string' ? s.customBaseUrl : DEFAULT_SETTINGS.customBaseUrl,
    aiConsentAccepted: typeof s.aiConsentAccepted === 'boolean' ? s.aiConsentAccepted : DEFAULT_SETTINGS.aiConsentAccepted,
  };
}

function repairActivityEntry(e: Record<string, unknown>): ActivityEntry {
  const entry: ActivityEntry = {
    timestamp: typeof e.timestamp === 'number' ? e.timestamp : 0,
    ruleId: typeof e.ruleId === 'string' ? e.ruleId : '',
    ruleName: typeof e.ruleName === 'string' ? e.ruleName : '',
    messageId: typeof e.messageId === 'number' ? e.messageId : 0,
    subject: typeof e.subject === 'string' ? e.subject : '',
    from: typeof e.from === 'string' ? e.from : '',
    actions: Array.isArray(e.actions) ? (e.actions as unknown[]).filter((a): a is string => typeof a === 'string') : [],
    type: ACTIVITY_TYPES.has(e.type as ActivityEntry['type']) ? (e.type as ActivityEntry['type']) : 'error',
  };
  if (typeof e.details === 'string') entry.details = e.details;
  if (typeof e.accountId === 'string') entry.accountId = e.accountId;
  return entry;
}

export function sanitizeActivityLog(raw: unknown): ActivityEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObject).map(repairActivityEntry);
}
