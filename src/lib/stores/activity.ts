/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import type { ActivityEntry } from '../../types/settings';
import { createSyncedStore } from './synced-store';

const STORAGE_KEY = 'smm_activity_log';

function createActivityStore() {
  const { subscribe, persist } = createSyncedStore<ActivityEntry[]>(STORAGE_KEY, [], 'activity');

  return {
    subscribe,

    async clear() {
      await persist([]);
    },
  };
}

export const activity = createActivityStore();
