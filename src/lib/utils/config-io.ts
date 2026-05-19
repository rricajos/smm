import type { Rule } from '../../types/rules';
import type { ResponseTemplate } from '../../types/templates';
import type { Settings } from '../../types/settings';

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
    settings: JSON.parse(JSON.stringify(settings)),
  };
}

export function validateImportData(raw: unknown): { valid: boolean; errors: string[]; data: ExportData | null } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['El archivo no contiene JSON valido.'], data: null };
  }

  const obj = raw as any;

  if (!Array.isArray(obj.rules)) {
    errors.push('Falta el campo "rules" o no es un array.');
  } else {
    for (let i = 0; i < obj.rules.length; i++) {
      const r = obj.rules[i];
      if (!r.id || !r.name || !Array.isArray(r.conditions) || !Array.isArray(r.actions)) {
        errors.push(`Regla ${i + 1}: faltan campos requeridos (id, name, conditions, actions).`);
      }
    }
  }

  if (!Array.isArray(obj.templates)) {
    errors.push('Falta el campo "templates" o no es un array.');
  } else {
    for (let i = 0; i < obj.templates.length; i++) {
      const t = obj.templates[i];
      if (!t.id || !t.name) {
        errors.push(`Plantilla ${i + 1}: faltan campos requeridos (id, name).`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: [],
    data: {
      version: obj.version || 1,
      exportedAt: obj.exportedAt || '',
      rules: obj.rules,
      templates: obj.templates,
      settings: obj.settings || {},
    },
  };
}

export function detectConflicts(
  data: ExportData,
  existingRules: Rule[],
  existingTemplates: ResponseTemplate[],
): ImportValidationResult {
  const ruleIds = new Set(existingRules.map(r => r.id));
  const ruleNames = new Map(existingRules.map(r => [r.name.toLowerCase(), r]));
  const templateIds = new Set(existingTemplates.map(t => t.id));
  const templateNames = new Map(existingTemplates.map(t => [t.name.toLowerCase(), t]));

  const ruleConflicts: ConflictItem<Rule>[] = [];
  const newRules: Rule[] = [];

  for (const imported of data.rules) {
    const existingById = existingRules.find(r => r.id === imported.id);
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
    const existingById = existingTemplates.find(t => t.id === imported.id);
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
