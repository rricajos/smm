/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect } from 'vitest';
import { es } from './locales/es';
import { en } from './locales/en';
import { translate } from './index';
import type { Translations } from './types';

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
