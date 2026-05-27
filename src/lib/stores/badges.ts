/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { STORAGE_KEYS } from '../utils/constants';
import { createSyncedStore } from './synced-store';

function createBadgeStore() {
  const { subscribe, persist } = createSyncedStore<number>(STORAGE_KEYS.UNREAD_CLASSIFICATIONS, 0, 'badges');

  return {
    subscribe,

    async reset() {
      await persist(0);
    },
  };
}

export const unreadClassifications = createBadgeStore();
