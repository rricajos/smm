/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { writable } from 'svelte/store';
import type { Settings } from '../../types/settings';
import { DEFAULT_SETTINGS } from '../utils/constants';

declare const browser: any;

const STORAGE_KEY = 'smm_settings';

function createSettingsStore() {
  const { subscribe, set } = writable<Settings>({ ...DEFAULT_SETTINGS });

  try {
    if (typeof browser !== 'undefined' && browser?.storage?.local) {
      browser.storage.local.get(STORAGE_KEY).then((result: any) => {
        set({ ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY] || {}) });
      }).catch((e: any) => console.error('[SMM] settings load error:', e));

      browser.storage.onChanged.addListener(
        (changes: Record<string, any>, area: string) => {
          if (area === 'local' && changes[STORAGE_KEY]) {
            set({ ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue || {}) });
          }
        },
      );
    }
  } catch (e) {
    console.error('[SMM] settings store init error:', e);
  }

  return {
    subscribe,

    async save(newSettings: Settings) {
      // Spread to plain object - Svelte 5 $state Proxy can fail with structured clone
      const plain: Settings = {
        classificationEnabled: newSettings.classificationEnabled,
        autoResponseEnabled: newSettings.autoResponseEnabled,
        processExistingOnStartup: newSettings.processExistingOnStartup,
        maxAutoResponsesPerHour: newSettings.maxAutoResponsesPerHour,
        logRetentionDays: newSettings.logRetentionDays,
        notifyOnClassification: newSettings.notifyOnClassification,
        notifyOnAutoResponse: newSettings.notifyOnAutoResponse,
        aiProvider: newSettings.aiProvider,
        openaiApiKey: newSettings.openaiApiKey,
        openaiModel: newSettings.openaiModel,
        customBaseUrl: newSettings.customBaseUrl,
        aiConsentAccepted: newSettings.aiConsentAccepted,
      };
      set(plain);
      await browser.storage.local.set({ [STORAGE_KEY]: plain });
    },

    async update(partial: Partial<Settings>) {
      const result = await browser.storage.local.get(STORAGE_KEY);
      const current = { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY] || {}) };
      const updated = { ...current, ...partial };
      set(updated);
      await browser.storage.local.set({ [STORAGE_KEY]: updated });
    },
  };
}

export const settings = createSettingsStore();
