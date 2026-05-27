/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { es } from './locales/es';
import { en } from './locales/en';
import type { Translations } from './types';

// Mock browser global before importing i18n module
let mockStorageData: Record<string, unknown> = {};
const mockGet = vi.fn(async (key: string) =>
  key in mockStorageData ? { [key]: mockStorageData[key] } : {},
);
const mockSet = vi.fn(async (data: Record<string, unknown>) => {
  Object.assign(mockStorageData, data);
});
const mockOnChangedListeners: Array<
  (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void
> = [];

vi.stubGlobal('browser', {
  storage: {
    local: { get: mockGet, set: mockSet },
    onChanged: {
      addListener: vi.fn((cb: (typeof mockOnChangedListeners)[0]) => {
        mockOnChangedListeners.push(cb);
      }),
    },
  },
});

import { translate, setLocale, getLocaleFromStorage, t, locale } from './index';

beforeEach(() => {
  vi.clearAllMocks();
  mockStorageData = {};
});

describe('translate', () => {
  it('returns correct Spanish string for known key', () => {
    const result = translate('es', 'common_save');
    expect(result).toBe(es.common_save);
    expect(result).toBeTruthy();
  });

  it('returns correct English string for known key', () => {
    const result = translate('en', 'common_save');
    expect(result).toBe(en.common_save);
    expect(result).toBeTruthy();
  });

  it('returns the key itself if translation is missing', () => {
    const fakeKey = 'nonexistent_key_xyz' as keyof Translations;
    const result = translate('es', fakeKey);
    expect(result).toBe('nonexistent_key_xyz');
  });

  it('interpolates parameters correctly', () => {
    const result = translate('es', 'log_entries_count', { n: 42 });
    expect(result).toContain('42');
    expect(result).not.toContain('{n}');
  });

  it('falls back to Spanish for invalid locale', () => {
    const result = translate('fr' as 'es', 'common_save');
    expect(result).toBe(es.common_save);
  });
});

describe('locale dictionaries', () => {
  const esKeys = Object.keys(es) as (keyof Translations)[];
  const enKeys = Object.keys(en) as (keyof Translations)[];

  it('both locales have the same number of keys', () => {
    expect(esKeys.length).toBe(enKeys.length);
  });

  it('every Spanish key exists in English', () => {
    const missingInEn = esKeys.filter((k) => !(k in en));
    expect(missingInEn).toEqual([]);
  });

  it('every English key exists in Spanish', () => {
    const missingInEs = enKeys.filter((k) => !(k in es));
    expect(missingInEs).toEqual([]);
  });

  it('no translation values are empty strings', () => {
    const emptyEs = esKeys.filter((k) => es[k] === '');
    const emptyEn = enKeys.filter((k) => en[k] === '');
    expect(emptyEs).toEqual([]);
    expect(emptyEn).toEqual([]);
  });
});

describe('setLocale', () => {
  it('updates locale store and persists to storage', async () => {
    await setLocale('en');
    expect(get(locale)).toBe('en');
    expect(mockSet).toHaveBeenCalledWith({ smm_locale: 'en' });
  });

  it('handles storage write failure silently', async () => {
    mockSet.mockRejectedValueOnce(new Error('storage error'));
    // Should not throw
    await setLocale('en');
    expect(get(locale)).toBe('en');
  });
});

describe('getLocaleFromStorage', () => {
  it('returns stored locale when valid', async () => {
    mockStorageData['smm_locale'] = 'en';
    const result = await getLocaleFromStorage();
    expect(result).toBe('en');
  });

  it('returns es by default when no locale stored', async () => {
    const result = await getLocaleFromStorage();
    expect(result).toBe('es');
  });

  it('returns es when stored value is invalid', async () => {
    mockStorageData['smm_locale'] = 'fr';
    const result = await getLocaleFromStorage();
    expect(result).toBe('es');
  });

  it('returns es when storage throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('storage error'));
    const result = await getLocaleFromStorage();
    expect(result).toBe('es');
  });
});

describe('t store', () => {
  it('returns a translation function', () => {
    const translateFn = get(t);
    expect(typeof translateFn).toBe('function');
  });

  it('translates known keys', () => {
    const translateFn = get(t);
    const result = translateFn('common_save');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('interpolates parameters', () => {
    const translateFn = get(t);
    const result = translateFn('log_entries_count', { n: 10 });
    expect(result).toContain('10');
    expect(result).not.toContain('{n}');
  });

  it('returns key for missing translations', () => {
    const translateFn = get(t);
    const result = translateFn('nonexistent_key_abc' as keyof Translations);
    expect(result).toBe('nonexistent_key_abc');
  });
});
