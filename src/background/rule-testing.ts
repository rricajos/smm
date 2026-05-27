/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { classifyMessage, executeActions, clearMessageCache } from './classifier';
import { getRules, saveRules, getSettings } from '../lib/utils/storage';
import { logger } from '../lib/utils/logger';
import { getErrorMessage } from '../lib/utils/error';
import type { Rule } from '../types/rules';

/// <reference path="../lib/utils/messenger.d.ts" />

export interface TestRuleResult {
  matched: boolean;
  results: string[];
}

export interface ProcessExistingResult {
  processed: number;
  matched: number;
  errors: number;
  details?: Array<{ subject: string; from: string; rules: string[] }>;
  error?: string;
}

export interface TestSingleRuleResult {
  processed: number;
  matched: number;
  details: Array<{ subject: string; from: string }>;
  error?: string;
}

export async function testRule(messageId: number, ruleId: string): Promise<TestRuleResult> {
  const header = await messenger.messages.get(messageId);
  let fullMessage = null;
  try {
    fullMessage = await messenger.messages.getFull(messageId);
  } catch (err) { logger.warn('Could not fetch full message for test', err); }
  const results = await classifyMessage(header, fullMessage);
  return {
    matched: results.some((r) => r.rule.id === ruleId),
    results: results.map((r) => r.rule.name),
  };
}

export async function processExisting(limit: number = 50): Promise<ProcessExistingResult> {
  try {
    const accounts = await messenger.accounts.list();
    if (accounts.length === 0) return { processed: 0, matched: 0, errors: 0 };

    const settings = await getSettings();
    let processed = 0;
    let matched = 0;
    let errors = 0;
    const details: Array<{ subject: string; from: string; rules: string[] }> = [];

    for (const account of accounts) {
      if (processed >= limit) break;
      const subFolders = await messenger.folders.getSubFolders(account.rootFolder.id);
      const inbox = subFolders.find((f: messenger.folders.MailFolder) => f.type === 'inbox');
      if (!inbox) continue;

      const queryResult = await messenger.messages.list(inbox.id);
      let page = queryResult;

      while (page && processed < limit) {
        for (const msg of page.messages) {
          if (processed >= limit) break;
          processed++;
          try {
            const results = await classifyMessage(msg, null);
            if (results.length > 0) {
              await executeActions(msg, results);
              matched++;
              details.push({
                subject: msg.subject || '',
                from: msg.author || '',
                rules: results.map((r) => r.rule.name),
              });
            }
          } catch {
            errors++;
          }
        }
        if (page.id && processed < limit) {
          page = await messenger.messages.continueList(page.id);
        } else {
          break;
        }
      }
    }

    clearMessageCache();
    return { processed, matched, errors, details };
  } catch (err: unknown) {
    logger.error('Error processing existing', err);
    clearMessageCache();
    return { processed: 0, matched: 0, errors: 0, error: getErrorMessage(err) };
  }
}

export async function testSingleRule(rule: Rule, limit: number = 50): Promise<TestSingleRuleResult> {
  try {
    const accounts = await messenger.accounts.list();
    if (accounts.length === 0) return { processed: 0, matched: 0, details: [] };

    let processed = 0;
    const details: Array<{ subject: string; from: string }> = [];

    // Temporarily save only this rule to test against
    const originalRules = await getRules();
    await saveRules([{ ...rule, enabled: true }]);

    try {
      for (const account of accounts) {
        if (processed >= limit) break;
        const subFolders = await messenger.folders.getSubFolders(account.rootFolder.id);
        const inbox = subFolders.find((f: messenger.folders.MailFolder) => f.type === 'inbox');
        if (!inbox) continue;

        const queryResult = await messenger.messages.list(inbox.id);
        let page = queryResult;

        while (page && processed < limit) {
          for (const msg of page.messages) {
            if (processed >= limit) break;
            processed++;
            try {
              const results = await classifyMessage(msg, null);
              if (results.length > 0) {
                details.push({
                  subject: msg.subject || '',
                  from: msg.author || '',
                });
              }
            } catch { /* skip */ }
          }
          if (page.id && processed < limit) {
            page = await messenger.messages.continueList(page.id);
          } else {
            break;
          }
        }
      }
    } finally {
      // Restore original rules
      await saveRules(originalRules);
    }

    clearMessageCache();
    return { processed, matched: details.length, details };
  } catch (err: unknown) {
    logger.error('Error testing rule', err);
    clearMessageCache();
    return { processed: 0, matched: 0, details: [], error: getErrorMessage(err) };
  }
}
