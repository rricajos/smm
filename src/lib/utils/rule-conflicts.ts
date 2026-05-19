import type { Rule, Condition, Action } from '../../types/rules';

export interface RuleConflict {
  ruleA: { id: string; name: string };
  ruleB: { id: string; name: string };
  type: 'contradictory_move' | 'redundant' | 'contradictory_priority';
  description: string;
  severity: 'warning' | 'info';
}

export function detectRuleConflicts(rules: Rule[]): RuleConflict[] {
  const enabled = rules.filter((r) => r.enabled);
  const conflicts: RuleConflict[] = [];

  for (let i = 0; i < enabled.length; i++) {
    for (let j = i + 1; j < enabled.length; j++) {
      const a = enabled[i];
      const b = enabled[j];

      if (!conditionsOverlap(a, b)) continue;

      // Check contradictory moves
      const moveA = a.actions.find((act) => act.type === 'moveToFolder' && act.folderId);
      const moveB = b.actions.find((act) => act.type === 'moveToFolder' && act.folderId);
      if (moveA && moveB && moveA.folderId !== moveB.folderId) {
        conflicts.push({
          ruleA: { id: a.id, name: a.name },
          ruleB: { id: b.id, name: b.name },
          type: 'contradictory_move',
          description: `Ambas reglas mueven a carpetas diferentes.`,
          severity: 'warning',
        });
      }

      // Check contradictory priorities
      const prioA = a.actions.find((act) => act.type === 'setPriority');
      const prioB = b.actions.find((act) => act.type === 'setPriority');
      if (prioA && prioB && prioA.priority !== prioB.priority) {
        conflicts.push({
          ruleA: { id: a.id, name: a.name },
          ruleB: { id: b.id, name: b.name },
          type: 'contradictory_priority',
          description: `Asignan prioridades diferentes (${prioA.priority} vs ${prioB.priority}).`,
          severity: 'warning',
        });
      }

      // Check redundancy
      if (actionsAreIdentical(a.actions, b.actions)) {
        conflicts.push({
          ruleA: { id: a.id, name: a.name },
          ruleB: { id: b.id, name: b.name },
          type: 'redundant',
          description: `Condiciones similares con acciones identicas (posible duplicado).`,
          severity: 'info',
        });
      }
    }
  }

  return conflicts;
}

function conditionsOverlap(ruleA: Rule, ruleB: Rule): boolean {
  // Two rules overlap if they share at least one condition on the same field
  // with the same operator and identical/contained value
  for (const ca of ruleA.conditions) {
    for (const cb of ruleB.conditions) {
      if (ca.field !== cb.field) continue;
      if (ca.field === 'hasAttachments') {
        if (ca.boolValue === cb.boolValue) return true;
        continue;
      }
      if (ca.operator === cb.operator) {
        const va = (ca.value || '').toLowerCase();
        const vb = (cb.value || '').toLowerCase();
        if (va === vb) return true;
        if (va.includes(vb) || vb.includes(va)) return true;
      }
    }
  }
  return false;
}

function actionsAreIdentical(a: Action[], b: Action[]): boolean {
  if (a.length !== b.length) return false;
  const serialize = (actions: Action[]) =>
    actions
      .map((act) => `${act.type}|${act.folderId || ''}|${act.tagKey || ''}|${act.priority || ''}|${act.templateId || ''}`)
      .sort()
      .join(';;');
  return serialize(a) === serialize(b);
}
