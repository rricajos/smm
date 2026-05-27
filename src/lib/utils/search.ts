/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import type { Rule } from '../../types/rules';
import type { ResponseTemplate } from '../../types/templates';
import type { ActivityEntry } from '../../types/settings';

export interface SearchResult {
  type: 'rule' | 'template' | 'log';
  id: string;
  title: string;
  subtitle: string;
  tabId: string;
}

interface SearchLabels {
  active: string;
  inactive: string;
  noSubject: string;
}

/**
 * Search rules by name and condition values.
 */
export function searchRules(query: string, rules: Rule[], labels: SearchLabels, max: number = 5): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const items: SearchResult[] = [];

  for (const rule of rules) {
    if (items.length >= max) break;
    if (
      rule.name.toLowerCase().includes(q) ||
      rule.conditions.some(c => (c.value || '').toLowerCase().includes(q))
    ) {
      items.push({
        type: 'rule',
        id: rule.id,
        title: rule.name,
        subtitle: rule.enabled ? labels.active : labels.inactive,
        tabId: 'rules',
      });
    }
  }
  return items;
}

/**
 * Search templates by name and subject.
 */
export function searchTemplates(query: string, templates: ResponseTemplate[], max: number = 5): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const items: SearchResult[] = [];

  for (const tmpl of templates) {
    if (items.length >= max) break;
    if (
      tmpl.name.toLowerCase().includes(q) ||
      tmpl.subject.toLowerCase().includes(q)
    ) {
      items.push({
        type: 'template',
        id: tmpl.id,
        title: tmpl.name,
        subtitle: tmpl.subject,
        tabId: 'templates',
      });
    }
  }
  return items;
}

/**
 * Search activity log by subject, sender, and rule name.
 */
export function searchActivity(query: string, entries: ActivityEntry[], labels: SearchLabels, max: number = 5): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const items: SearchResult[] = [];

  for (const entry of entries) {
    if (items.length >= max) break;
    if (
      (entry.subject || '').toLowerCase().includes(q) ||
      (entry.from || '').toLowerCase().includes(q) ||
      (entry.ruleName || '').toLowerCase().includes(q)
    ) {
      items.push({
        type: 'log',
        id: String(entry.timestamp),
        title: entry.subject || labels.noSubject,
        subtitle: `${entry.ruleName} - ${entry.from}`,
        tabId: 'log',
      });
    }
  }
  return items;
}
