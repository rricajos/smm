import type { Rule, Condition } from '../types/rules';
import type { ActivityEntry } from '../types/settings';
import { getRules } from '../lib/utils/storage';
import { appendActivityLog } from '../lib/utils/storage';
import { extractBodyText, hasAttachments } from './message-utils';

declare const messenger: any;

export interface ClassificationResult {
  rule: Rule;
  messageId: number;
}

// Cache fullMessage per message ID to avoid re-downloading for each rule
const fullMessageCache = new Map<number, any>();

export async function classifyMessage(
  header: any,
  fullMessage?: any,
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

async function getFullMessage(messageId: number): Promise<any | null> {
  if (fullMessageCache.has(messageId)) {
    return fullMessageCache.get(messageId);
  }
  try {
    const full = await messenger.messages.getFull(messageId);
    fullMessageCache.set(messageId, full);
    return full;
  } catch {
    return null;
  }
}

async function evaluateConditions(
  rule: Rule,
  header: any,
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
  header: any,
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

function matchString(
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
        const safeHaystack = haystack.length > 10000 ? haystack.substring(0, 10000) : haystack;
        return new RegExp(needle, caseSensitive ? '' : 'i').test(safeHaystack);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/** Detect regex patterns with nested quantifiers that cause catastrophic backtracking */
function hasNestedQuantifiers(pattern: string): boolean {
  // Matches patterns like (a+)+, (a*)+, (a{2})+, etc.
  return /([+*}])\)([+*{])/.test(pattern) || /([+*])\][+*]/.test(pattern);
}

export async function executeActions(
  header: any,
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
        console.error(`[SMM] Error executing action ${action.type}:`, err);
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
