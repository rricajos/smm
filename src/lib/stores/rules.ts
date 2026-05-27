/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import type { Rule } from '../../types/rules';
import { createSyncedStore } from './synced-store';

const STORAGE_KEY = 'smm_rules';

function createRulesStore() {
  const { subscribe, set, update, persist } = createSyncedStore<Rule[]>(STORAGE_KEY, [], 'rules');

  return {
    subscribe,

    async addRule(rule: Rule) {
      update((rules) => {
        const updated = [...rules, rule];
        persist(updated);
        return updated;
      });
    },

    async updateRule(id: string, partial: Partial<Rule>) {
      update((rules) => {
        const updated = rules.map((r) =>
          r.id === id ? { ...r, ...partial, updatedAt: Date.now() } : r,
        );
        persist(updated);
        return updated;
      });
    },

    async deleteRule(id: string) {
      update((rules) => {
        const updated = rules.filter((r) => r.id !== id);
        persist(updated);
        return updated;
      });
    },

    async reorderRules(ids: string[]) {
      update((rules) => {
        const map = new Map(rules.map((r) => [r.id, r]));
        const updated = ids.map((id) => map.get(id)!).filter(Boolean);
        persist(updated);
        return updated;
      });
    },

    async setRules(newRules: Rule[]) {
      set(newRules);
      await persist(newRules);
    },

    async toggleRule(id: string) {
      update((rules) => {
        const updated = rules.map((r) =>
          r.id === id ? { ...r, enabled: !r.enabled, updatedAt: Date.now() } : r,
        );
        persist(updated);
        return updated;
      });
    },
  };
}

export const rules = createRulesStore();
