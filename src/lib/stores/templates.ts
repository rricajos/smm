import { writable } from 'svelte/store';
import type { ResponseTemplate } from '../../types/templates';

declare const browser: any;

const STORAGE_KEY = 'smm_templates';

function createTemplatesStore() {
  const { subscribe, set, update } = writable<ResponseTemplate[]>([]);

  try {
    if (typeof browser !== 'undefined' && browser?.storage?.local) {
      browser.storage.local.get(STORAGE_KEY).then((result: any) => {
        set(result[STORAGE_KEY] || []);
      }).catch((e: any) => console.error('[SMM] templates load error:', e));

      browser.storage.onChanged.addListener(
        (changes: Record<string, any>, area: string) => {
          if (area === 'local' && changes[STORAGE_KEY]) {
            set(changes[STORAGE_KEY].newValue || []);
          }
        },
      );
    }
  } catch (e) {
    console.error('[SMM] templates store init error:', e);
  }

  async function persist(templates: ResponseTemplate[]) {
    await browser.storage.local.set({ [STORAGE_KEY]: templates });
  }

  return {
    subscribe,

    async addTemplate(template: ResponseTemplate) {
      update((templates) => {
        const updated = [...templates, template];
        persist(updated);
        return updated;
      });
    },

    async updateTemplate(id: string, partial: Partial<ResponseTemplate>) {
      update((templates) => {
        const updated = templates.map((t) =>
          t.id === id ? { ...t, ...partial } : t,
        );
        persist(updated);
        return updated;
      });
    },

    async setTemplates(newTemplates: ResponseTemplate[]) {
      set(newTemplates);
      await persist(newTemplates);
    },

    async deleteTemplate(id: string) {
      update((templates) => {
        const updated = templates.filter((t) => t.id !== id);
        persist(updated);
        return updated;
      });
    },
  };
}

export const templates = createTemplatesStore();
