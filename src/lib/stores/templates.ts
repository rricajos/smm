/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import type { ResponseTemplate } from '../../types/templates';
import { createSyncedStore } from './synced-store';

const STORAGE_KEY = 'smm_templates';

function createTemplatesStore() {
  const { subscribe, set, update, persist } = createSyncedStore<ResponseTemplate[]>(STORAGE_KEY, [], 'templates');

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
