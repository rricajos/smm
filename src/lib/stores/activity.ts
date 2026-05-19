import { writable } from 'svelte/store';
import type { ActivityEntry } from '../../types/settings';

declare const browser: any;

const STORAGE_KEY = 'smm_activity_log';

function createActivityStore() {
  const { subscribe, set } = writable<ActivityEntry[]>([]);

  try {
    if (typeof browser !== 'undefined' && browser?.storage?.local) {
      browser.storage.local.get(STORAGE_KEY).then((result: any) => {
        set(result[STORAGE_KEY] || []);
      }).catch((e: any) => console.error('[SMM] activity load error:', e));

      browser.storage.onChanged.addListener(
        (changes: Record<string, any>, area: string) => {
          if (area === 'local' && changes[STORAGE_KEY]) {
            set(changes[STORAGE_KEY].newValue || []);
          }
        },
      );
    }
  } catch (e) {
    console.error('[SMM] activity store init error:', e);
  }

  return {
    subscribe,

    async clear() {
      set([]);
      await browser.storage.local.set({ [STORAGE_KEY]: [] });
    },
  };
}

export const activity = createActivityStore();
