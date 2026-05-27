/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

let mockStorage: Record<string, unknown> = {};

const mockBrowser = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => (key in mockStorage ? { [key]: mockStorage[key] } : {})),
      set: vi.fn(async (data: Record<string, unknown>) => Object.assign(mockStorage, data)),
    },
    onChanged: { addListener: vi.fn() },
  },
};

vi.stubGlobal('browser', mockBrowser);

import { settings } from './settings';
import { DEFAULT_SETTINGS } from '../utils/constants';

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage = {};
});

describe('settings store', () => {
  it('has DEFAULT_SETTINGS as initial value', () => {
    const current = get(settings);
    expect(current.classificationEnabled).toBe(DEFAULT_SETTINGS.classificationEnabled);
    expect(current.autoResponseEnabled).toBe(DEFAULT_SETTINGS.autoResponseEnabled);
    expect(current.logRetentionDays).toBe(DEFAULT_SETTINGS.logRetentionDays);
  });

  it('save() writes all settings fields to storage', async () => {
    const newSettings = {
      ...DEFAULT_SETTINGS,
      classificationEnabled: false,
      openaiApiKey: 'sk-test',
    };
    await settings.save(newSettings);
    expect(mockStorage['smm_settings']).toBeDefined();
    const saved = mockStorage['smm_settings'] as any;
    expect(saved.classificationEnabled).toBe(false);
    expect(saved.openaiApiKey).toBe('sk-test');
  });

  it('save() updates subscribers', async () => {
    await settings.save({ ...DEFAULT_SETTINGS, autoResponseEnabled: false });
    expect(get(settings).autoResponseEnabled).toBe(false);
  });

  it('update() merges partial settings', async () => {
    // Set initial in storage
    mockStorage['smm_settings'] = { ...DEFAULT_SETTINGS };
    await settings.update({ logRetentionDays: 90 });
    const saved = mockStorage['smm_settings'] as any;
    expect(saved.logRetentionDays).toBe(90);
    // Other fields preserved
    expect(saved.classificationEnabled).toBe(DEFAULT_SETTINGS.classificationEnabled);
  });

  it('update() preserves unmodified fields', async () => {
    mockStorage['smm_settings'] = { ...DEFAULT_SETTINGS, openaiApiKey: 'existing-key' };
    await settings.update({ notifyOnClassification: true });
    const saved = mockStorage['smm_settings'] as any;
    expect(saved.openaiApiKey).toBe('existing-key');
    expect(saved.notifyOnClassification).toBe(true);
  });

  it('update() applies defaults when storage is empty', async () => {
    await settings.update({ logRetentionDays: 7 });
    const saved = mockStorage['smm_settings'] as any;
    expect(saved.logRetentionDays).toBe(7);
    expect(saved.classificationEnabled).toBe(DEFAULT_SETTINGS.classificationEnabled);
  });
});
