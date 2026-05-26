/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { writable } from 'svelte/store';
import type { Rule } from '../../types/rules';

declare const browser: any;

const STORAGE_KEY = 'smm_rules';

function createRulesStore() {
  const { subscribe, set, update } = writable<Rule[]>([]);

  try {
    if (typeof browser !== 'undefined' && browser?.storage?.local) {
      browser.storage.local.get(STORAGE_KEY).then((result: any) => {
        set(result[STORAGE_KEY] || []);
      }).catch((e: any) => console.error('[SMM] rules load error:', e));

      browser.storage.onChanged.addListener(
        (changes: Record<string, any>, area: string) => {
          if (area === 'local' && changes[STORAGE_KEY]) {
            set(changes[STORAGE_KEY].newValue || []);
          }
        },
      );
    }
  } catch (e) {
    console.error('[SMM] rules store init error:', e);
  }

  async function persist(rules: Rule[]) {
    // Deep clone to strip Svelte 5 Proxy objects before structured clone
    const plain = JSON.parse(JSON.stringify(rules));
    await browser.storage.local.set({ [STORAGE_KEY]: plain });
  }

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
