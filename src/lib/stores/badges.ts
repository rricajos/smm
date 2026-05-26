/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { writable } from 'svelte/store';
import { STORAGE_KEYS } from '../utils/constants';

declare const browser: any;

function createBadgeStore() {
  const { subscribe, set } = writable<number>(0);

  try {
    if (typeof browser !== 'undefined' && browser?.storage?.local) {
      browser.storage.local.get(STORAGE_KEYS.UNREAD_CLASSIFICATIONS).then((result: any) => {
        set(result[STORAGE_KEYS.UNREAD_CLASSIFICATIONS] || 0);
      });

      browser.storage.onChanged.addListener(
        (changes: Record<string, any>, area: string) => {
          if (area === 'local' && changes[STORAGE_KEYS.UNREAD_CLASSIFICATIONS]) {
            set(changes[STORAGE_KEYS.UNREAD_CLASSIFICATIONS].newValue || 0);
          }
        },
      );
    }
  } catch { /* ignore */ }

  return {
    subscribe,

    async reset() {
      set(0);
      try {
        await browser.storage.local.set({ [STORAGE_KEYS.UNREAD_CLASSIFICATIONS]: 0 });
      } catch { /* ignore */ }
    },
  };
}

export const unreadClassifications = createBadgeStore();
