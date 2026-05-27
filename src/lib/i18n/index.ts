/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { writable, derived } from 'svelte/store';
import type { Translations } from './types';
import { es } from './locales/es';
import { en } from './locales/en';
import { STORAGE_KEYS } from '../utils/constants';

/// <reference path="../utils/messenger.d.ts" />

export type SupportedLocale = 'es' | 'en';

const dictionaries: Record<SupportedLocale, Translations> = { es, en };

export const locale = writable<SupportedLocale>('es');

// Load persisted locale
try {
  browser.storage.local.get(STORAGE_KEYS.LOCALE).then((result: Record<string, unknown>) => {
    const stored = result[STORAGE_KEYS.LOCALE];
    if (stored && (stored === 'es' || stored === 'en')) {
      locale.set(stored);
    }
  });
} catch {
  // Not in extension context (e.g. background)
}

// Sync across contexts via storage.onChanged
try {
  browser.storage.onChanged.addListener((changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => {
    if (area === 'local' && changes[STORAGE_KEYS.LOCALE]) {
      const newVal = changes[STORAGE_KEYS.LOCALE].newValue;
      if (newVal === 'es' || newVal === 'en') {
        locale.set(newVal);
      }
    }
  });
} catch {
  // Not in extension context
}

export async function setLocale(loc: SupportedLocale): Promise<void> {
  locale.set(loc);
  try {
    await browser.storage.local.set({ [STORAGE_KEYS.LOCALE]: loc });
  } catch {
    // ignore
  }
}

type TranslateFn = (key: keyof Translations, params?: Record<string, string | number>) => string;

export const t = derived<typeof locale, TranslateFn>(locale, ($locale) => {
  const dict = dictionaries[$locale] || dictionaries.es;
  return (key: keyof Translations, params?: Record<string, string | number>) => {
    let str = dict[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return str;
  };
});

/** Read locale from storage directly (for non-reactive contexts like background scripts) */
export async function getLocaleFromStorage(): Promise<SupportedLocale> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEYS.LOCALE);
    const stored = result[STORAGE_KEYS.LOCALE];
    if (stored === 'es' || stored === 'en') return stored;
  } catch { /* ignore */ }
  return 'es';
}

/** Get translation for a key using a given locale (for background scripts) */
export function translate(loc: SupportedLocale, key: keyof Translations, params?: Record<string, string | number>): string {
  const dict = dictionaries[loc] || dictionaries.es;
  let str = dict[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}
