/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import type { Rule } from '../../types/rules';
import type { ResponseTemplate } from '../../types/templates';
import type { Settings, ActivityEntry } from '../../types/settings';
import { STORAGE_KEYS, DEFAULT_SETTINGS, MAX_ACTIVITY_LOG_ENTRIES } from './constants';
import { sanitizeRules, sanitizeTemplates, sanitizeSettings, sanitizeActivityLog } from './validators';

/// <reference path="./messenger.d.ts" />

export async function getRules(): Promise<Rule[]> {
  const result = await browser.storage.local.get(STORAGE_KEYS.RULES);
  return sanitizeRules(result[STORAGE_KEYS.RULES]);
}

export async function saveRules(rules: Rule[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.RULES]: rules });
}

export async function getTemplates(): Promise<ResponseTemplate[]> {
  const result = await browser.storage.local.get(STORAGE_KEYS.TEMPLATES);
  return sanitizeTemplates(result[STORAGE_KEYS.TEMPLATES]);
}

export async function saveTemplates(templates: ResponseTemplate[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.TEMPLATES]: templates });
}

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(STORAGE_KEYS.SETTINGS);
  return sanitizeSettings(result[STORAGE_KEYS.SETTINGS]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

export async function getActivityLog(): Promise<ActivityEntry[]> {
  const result = await browser.storage.local.get(STORAGE_KEYS.ACTIVITY_LOG);
  return sanitizeActivityLog(result[STORAGE_KEYS.ACTIVITY_LOG]);
}

let pendingLogEntries: ActivityEntry[] = [];
let logFlushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushActivityLog(): Promise<void> {
  if (pendingLogEntries.length === 0) return;
  const entries = pendingLogEntries;
  pendingLogEntries = [];
  logFlushTimer = null;

  const log = await getActivityLog();
  log.unshift(...entries);

  if (log.length > MAX_ACTIVITY_LOG_ENTRIES) {
    log.length = MAX_ACTIVITY_LOG_ENTRIES;
  }

  await browser.storage.local.set({ [STORAGE_KEYS.ACTIVITY_LOG]: log });
}

const MAX_PENDING_LOG_ENTRIES = 100;

export async function appendActivityLog(entry: ActivityEntry): Promise<void> {
  pendingLogEntries.push(entry);

  // Hard cap: drop oldest entries if buffer grows beyond limit (safety net)
  if (pendingLogEntries.length > MAX_PENDING_LOG_ENTRIES) {
    pendingLogEntries = pendingLogEntries.slice(-MAX_PENDING_LOG_ENTRIES);
  }

  // Batch writes: flush after 500ms of inactivity, or immediately if 10+ pending
  if (pendingLogEntries.length >= 10) {
    await flushActivityLog();
  } else {
    if (logFlushTimer) clearTimeout(logFlushTimer);
    logFlushTimer = setTimeout(() => flushActivityLog(), 500);
  }
}

export async function clearActivityLog(): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.ACTIVITY_LOG]: [] });
}

export async function cleanupOldActivityEntries(retentionDays: number): Promise<number> {
  if (retentionDays <= 0) return 0;
  const cutoff = Date.now() - retentionDays * 86400000;
  const log = await getActivityLog();
  const filtered = log.filter((entry) => entry.timestamp >= cutoff);
  const removed = log.length - filtered.length;
  if (removed > 0) {
    await browser.storage.local.set({ [STORAGE_KEYS.ACTIVITY_LOG]: filtered });
  }
  return removed;
}

export async function getAutoResponseCount(): Promise<{ hour: number; count: number }> {
  const result = await browser.storage.local.get(STORAGE_KEYS.AUTO_RESPONSE_COUNT);
  return (result[STORAGE_KEYS.AUTO_RESPONSE_COUNT] as { hour: number; count: number }) || { hour: 0, count: 0 };
}

export async function incrementAutoResponseCount(): Promise<void> {
  const currentHour = Math.floor(Date.now() / 3600000);
  const data = await getAutoResponseCount();

  if (data.hour === currentHour) {
    data.count++;
  } else {
    data.hour = currentHour;
    data.count = 1;
  }

  await browser.storage.local.set({ [STORAGE_KEYS.AUTO_RESPONSE_COUNT]: data });
}

export async function checkRateLimit(maxPerHour: number): Promise<boolean> {
  const currentHour = Math.floor(Date.now() / 3600000);
  const data = await getAutoResponseCount();

  if (data.hour !== currentHour) return true;
  return data.count < maxPerHour;
}
