/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { writable, type Writable } from 'svelte/store';
import { logger } from '../utils/logger';

/// <reference path="../utils/messenger.d.ts" />

export interface SyncedStore<T> {
  subscribe: Writable<T>['subscribe'];
  set: Writable<T>['set'];
  update: Writable<T>['update'];
  persist(value: T): Promise<void>;
}

/**
 * Creates a Svelte writable store that auto-syncs with browser.storage.local.
 *
 * Handles: initial load, cross-context sync via onChanged, and persistence.
 * Each store only needs to add its own domain-specific methods on top.
 */
export function createSyncedStore<T>(storageKey: string, defaultValue: T, name: string): SyncedStore<T> {
  const { subscribe, set, update } = writable<T>(defaultValue);

  try {
    if (typeof browser !== 'undefined' && browser?.storage?.local) {
      browser.storage.local.get(storageKey).then((result: Record<string, unknown>) => {
        const val = result[storageKey];
        if (val !== undefined) set(val as T);
      }).catch((e: unknown) => logger.error(`${name} load error`, e));

      browser.storage.onChanged.addListener(
        (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => {
          if (area === 'local' && changes[storageKey]) {
            set((changes[storageKey].newValue ?? defaultValue) as T);
          }
        },
      );
    }
  } catch (e) {
    logger.error(`${name} store init error`, e);
  }

  async function persist(value: T) {
    const plain = JSON.parse(JSON.stringify(value));
    await browser.storage.local.set({ [storageKey]: plain });
  }

  return { subscribe, set, update, persist };
}
