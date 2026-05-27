/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

/// <reference path="../lib/utils/messenger.d.ts" />

import type { Rule, Condition } from '../types/rules';
import type { ActivityEntry } from '../types/settings';
import { getRules } from '../lib/utils/storage';
import { appendActivityLog } from '../lib/utils/storage';
import { extractBodyText, hasAttachments } from './message-utils';
import { logger } from '../lib/utils/logger';
import { REGEX_MAX_INPUT_LENGTH } from '../lib/utils/constants';

export interface ClassificationResult {
  rule: Rule;
  messageId: number;
}

// Cache fullMessage per message ID to avoid re-downloading for each rule
const MAX_CACHE_SIZE = 200;
const fullMessageCache = new Map<number, messenger.messages.MessagePart>();

// Cache compiled regex patterns to avoid recompilation on every match
const MAX_REGEX_CACHE_SIZE = 100;
const regexCache = new Map<string, RegExp>();

function getCachedRegex(pattern: string, flags: string): RegExp {
  const key = `${pattern}\0${flags}`;
  const cached = regexCache.get(key);
  if (cached) return cached;
  const re = new RegExp(pattern, flags);
  if (regexCache.size >= MAX_REGEX_CACHE_SIZE) {
    const firstKey = regexCache.keys().next().value;
    if (firstKey !== undefined) regexCache.delete(firstKey);
  }
  regexCache.set(key, re);
  return re;
}

export async function classifyMessage(
  header: messenger.messages.MessageHeader,
  fullMessage?: messenger.messages.MessagePart | null,
): Promise<ClassificationResult[]> {
  const rules = await getRules();
  const matched: ClassificationResult[] = [];

  // Seed cache if we already have the full message
  if (fullMessage) {
    fullMessageCache.set(header.id, fullMessage);
  }

  for (const rule of rules.filter((r) => r.enabled)) {
    const isMatch = await evaluateConditions(rule, header);
    if (isMatch) {
      matched.push({ rule, messageId: header.id });
      if (rule.stopProcessing) break;
    }
  }

  return matched;
}

/** Clear the fullMessage cache after batch processing */
export function clearMessageCache(): void {
  fullMessageCache.clear();
}

async function getFullMessage(messageId: number): Promise<messenger.messages.MessagePart | null> {
  if (fullMessageCache.has(messageId)) {
    return fullMessageCache.get(messageId)!;
  }
  try {
    const full = await messenger.messages.getFull(messageId);
    // Evict oldest entries when cache exceeds size limit
    if (fullMessageCache.size >= MAX_CACHE_SIZE) {
      const firstKey = fullMessageCache.keys().next().value;
      if (firstKey !== undefined) fullMessageCache.delete(firstKey);
    }
    fullMessageCache.set(messageId, full);
    return full;
  } catch {
    return null;
  }
}

async function evaluateConditions(
  rule: Rule,
  header: messenger.messages.MessageHeader,
): Promise<boolean> {
  const results: boolean[] = [];

  for (const condition of rule.conditions) {
    const result = await evaluateSingleCondition(condition, header);
    results.push(result);
  }

  return rule.conditionLogic === 'all'
    ? results.every(Boolean)
    : results.some(Boolean);
}

async function evaluateSingleCondition(
  condition: Condition,
  header: messenger.messages.MessageHeader,
): Promise<boolean> {
  if (condition.field === 'hasAttachments') {
    const has = await hasAttachments(header.id);
    return condition.boolValue ? has : !has;
  }

  let fieldValue: string;

  switch (condition.field) {
    case 'from':
      fieldValue = header.author || '';
      break;
    case 'to':
      fieldValue = (header.recipients || []).join(', ');
      break;
    case 'subject':
      fieldValue = header.subject || '';
      break;
    case 'body': {
      const fullMessage = await getFullMessage(header.id);
      if (!fullMessage) return false;
      fieldValue = extractBodyText(fullMessage);
      break;
    }
    default:
      return false;
  }

  return matchString(fieldValue, condition.operator, condition.value, condition.caseSensitive);
}

export function matchString(
  haystack: string,
  operator: string,
  needle: string,
  caseSensitive: boolean,
): boolean {
  const h = caseSensitive ? haystack : haystack.toLowerCase();
  const n = caseSensitive ? needle : needle.toLowerCase();

  switch (operator) {
    case 'contains':
      return h.includes(n);
    case 'equals':
      return h === n;
    case 'startsWith':
      return h.startsWith(n);
    case 'endsWith':
      return h.endsWith(n);
    case 'matches':
      try {
        // Guard against catastrophic backtracking (nested quantifiers like (a+)+)
        if (hasNestedQuantifiers(needle)) return false;
        // Limit input length to prevent DoS on complex patterns
        const safeHaystack = haystack.length > REGEX_MAX_INPUT_LENGTH ? haystack.substring(0, REGEX_MAX_INPUT_LENGTH) : haystack;
        return getCachedRegex(needle, caseSensitive ? '' : 'i').test(safeHaystack);
      } catch (e) {
        logger.warn(`Invalid regex pattern: "${needle}"`, e);
        return false;
      }
    default:
      return false;
  }
}

/** Detect regex patterns with nested quantifiers that cause catastrophic backtracking */
export function hasNestedQuantifiers(pattern: string): boolean {
  // Matches patterns like (a+)+, (a*)+, (a{2})+, etc.
  return /([+*}])\)([+*{])/.test(pattern) || /([+*])\][+*]/.test(pattern);
}

export async function executeActions(
  header: messenger.messages.MessageHeader,
  results: ClassificationResult[],
): Promise<void> {
  for (const { rule } of results) {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'moveToFolder':
            if (action.folderId) {
              await messenger.messages.move([header.id], action.folderId);
            }
            break;
          case 'addTag':
            if (action.tagKey) {
              const currentTags = header.tags || [];
              if (!currentTags.includes(action.tagKey)) {
                await messenger.messages.update(header.id, {
                  tags: [...currentTags, action.tagKey],
                });
              }
            }
            break;
          case 'setPriority':
            await messenger.messages.update(header.id, {
              flagged: action.priority === 'highest' || action.priority === 'high',
            });
            break;
          case 'markRead':
            await messenger.messages.update(header.id, { read: true });
            break;
          case 'autoRespond':
            // Handled separately by the autoresponder module
            break;
        }
      } catch (err) {
        logger.error(`Error executing action ${action.type}`, err);
      }
    }

    const logEntry: ActivityEntry = {
      timestamp: Date.now(),
      ruleId: rule.id,
      ruleName: rule.name,
      messageId: header.id,
      subject: header.subject || '',
      from: header.author || '',
      actions: rule.actions.map((a) => a.type),
      type: 'classification',
      accountId: header.folder?.accountId || '',
    };
    await appendActivityLog(logEntry);
  }
}
