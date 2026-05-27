/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import type { Condition, Action } from '../../types/rules';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

/**
 * Validate a rule's fields, conditions, and actions.
 * Returns an array of human-readable error messages (empty = valid).
 */
export function validateRule(
  name: string,
  conditions: Condition[],
  actions: Action[],
  t: TranslateFn,
): string[] {
  const errs: string[] = [];

  if (!name.trim()) errs.push(t('editor_name_required'));
  if (conditions.length === 0) errs.push(t('editor_min_condition'));
  if (actions.length === 0) errs.push(t('editor_min_action'));

  // Validate conditions
  for (let i = 0; i < conditions.length; i++) {
    const c = conditions[i];
    if (c.field !== 'hasAttachments') {
      if (!c.value.trim()) {
        errs.push(t('editor_condition_empty', { n: i + 1 }));
      }
      if (c.operator === 'matches') {
        try {
          new RegExp(c.value);
        } catch {
          errs.push(t('editor_regex_invalid', { n: i + 1, value: c.value }));
        }
      }
    }
  }

  // Validate actions
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (a.type === 'moveToFolder' && !a.folderId) {
      errs.push(t('editor_action_select_folder', { n: i + 1 }));
    }
    if (a.type === 'addTag' && !a.tagKey) {
      errs.push(t('editor_action_select_tag', { n: i + 1 }));
    }
    if (a.type === 'autoRespond' && !a.templateId) {
      errs.push(t('editor_action_select_template', { n: i + 1 }));
    }
  }

  return errs;
}
