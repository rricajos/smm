/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import type { Rule } from '../../types/rules';
import type { ResponseTemplate } from '../../types/templates';
import type { Settings } from '../../types/settings';
import { importDataSchema } from './import-schemas';

export interface ExportData {
  version: 1;
  exportedAt: string;
  rules: Rule[];
  templates: ResponseTemplate[];
  settings: Settings;
}

export interface ConflictItem<T> {
  imported: T;
  existing: T;
}

export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  data: ExportData | null;
  conflicts: {
    rules: ConflictItem<Rule>[];
    templates: ConflictItem<ResponseTemplate>[];
  };
  newItems: {
    rules: Rule[];
    templates: ResponseTemplate[];
  };
}

export interface ImportOptions {
  importRules: boolean;
  importTemplates: boolean;
  importSettings: boolean;
  conflictResolutions: Record<string, 'replace' | 'skip' | 'duplicate'>;
}

export function exportConfiguration(
  rules: Rule[],
  templates: ResponseTemplate[],
  settings: Settings,
): ExportData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    rules: JSON.parse(JSON.stringify(rules)),
    templates: JSON.parse(JSON.stringify(templates)),
    settings: { ...JSON.parse(JSON.stringify(settings)), openaiApiKey: '' },
  };
}

export function validateImportData(raw: unknown): {
  valid: boolean;
  errors: string[];
  data: ExportData | null;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['El archivo no contiene JSON valido.'], data: null };
  }

  const result = importDataSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return `${path}: ${issue.message}`;
    });
    return { valid: false, errors, data: null };
  }

  const data = result.data;
  return {
    valid: true,
    errors: [],
    data: {
      version: data.version,
      exportedAt: data.exportedAt,
      rules: data.rules as Rule[],
      templates: data.templates as ResponseTemplate[],
      settings: data.settings as Settings,
    },
  };
}

export function detectConflicts(
  data: ExportData,
  existingRules: Rule[],
  existingTemplates: ResponseTemplate[],
): ImportValidationResult {
  const ruleNames = new Map(existingRules.map((r) => [r.name.toLowerCase(), r]));
  const templateNames = new Map(existingTemplates.map((t) => [t.name.toLowerCase(), t]));

  const ruleConflicts: ConflictItem<Rule>[] = [];
  const newRules: Rule[] = [];

  for (const imported of data.rules) {
    const existingById = existingRules.find((r) => r.id === imported.id);
    const existingByName = ruleNames.get(imported.name.toLowerCase());
    const existing = existingById || existingByName;
    if (existing) {
      ruleConflicts.push({ imported, existing });
    } else {
      newRules.push(imported);
    }
  }

  const templateConflicts: ConflictItem<ResponseTemplate>[] = [];
  const newTemplates: ResponseTemplate[] = [];

  for (const imported of data.templates) {
    const existingById = existingTemplates.find((t) => t.id === imported.id);
    const existingByName = templateNames.get(imported.name.toLowerCase());
    const existing = existingById || existingByName;
    if (existing) {
      templateConflicts.push({ imported, existing });
    } else {
      newTemplates.push(imported);
    }
  }

  return {
    valid: true,
    errors: [],
    data,
    conflicts: { rules: ruleConflicts, templates: templateConflicts },
    newItems: { rules: newRules, templates: newTemplates },
  };
}
