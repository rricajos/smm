/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// vi.hoisted runs BEFORE imports, ensuring browser global is set when settings.ts initializes
const { capturedListeners, state } = vi.hoisted(() => {
  const state = { storage: {} as Record<string, unknown> };

  const capturedListeners: Array<
    (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void
  > = [];

  const mockBrowser = {
    storage: {
      local: {
        get: vi.fn(async (key: string) =>
          key in state.storage ? { [key]: state.storage[key] } : {},
        ),
        set: vi.fn(async (data: Record<string, unknown>) => Object.assign(state.storage, data)),
      },
      onChanged: {
        addListener: vi.fn((cb: (...args: unknown[]) => void) => {
          capturedListeners.push(cb as (typeof capturedListeners)[0]);
        }),
      },
    },
  };

  (globalThis as any).browser = mockBrowser;

  return { capturedListeners, state };
});

import { settings } from './settings';
import { DEFAULT_SETTINGS } from '../utils/constants';

beforeEach(() => {
  vi.clearAllMocks();
  state.storage = {};
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
    expect(state.storage['smm_settings']).toBeDefined();
    const saved = state.storage['smm_settings'] as any;
    expect(saved.classificationEnabled).toBe(false);
    expect(saved.openaiApiKey).toBe('sk-test');
  });

  it('save() updates subscribers', async () => {
    await settings.save({ ...DEFAULT_SETTINGS, autoResponseEnabled: false });
    expect(get(settings).autoResponseEnabled).toBe(false);
  });

  it('update() merges partial settings', async () => {
    state.storage['smm_settings'] = { ...DEFAULT_SETTINGS };
    await settings.update({ logRetentionDays: 90 });
    const saved = state.storage['smm_settings'] as any;
    expect(saved.logRetentionDays).toBe(90);
    expect(saved.classificationEnabled).toBe(DEFAULT_SETTINGS.classificationEnabled);
  });

  it('update() preserves unmodified fields', async () => {
    state.storage['smm_settings'] = { ...DEFAULT_SETTINGS, openaiApiKey: 'existing-key' };
    await settings.update({ notifyOnClassification: true });
    const saved = state.storage['smm_settings'] as any;
    expect(saved.openaiApiKey).toBe('existing-key');
    expect(saved.notifyOnClassification).toBe(true);
  });

  it('update() applies defaults when storage is empty', async () => {
    await settings.update({ logRetentionDays: 7 });
    const saved = state.storage['smm_settings'] as any;
    expect(saved.logRetentionDays).toBe(7);
    expect(saved.classificationEnabled).toBe(DEFAULT_SETTINGS.classificationEnabled);
  });

  it('registers onChanged listener during initialization', () => {
    expect(capturedListeners.length).toBeGreaterThan(0);
    expect(typeof capturedListeners[0]).toBe('function');
  });

  it('onChanged listener updates store when settings change externally', () => {
    const listener = capturedListeners[0];
    expect(listener).toBeDefined();
    const newSettings = { ...DEFAULT_SETTINGS, logRetentionDays: 99 };
    listener({ smm_settings: { newValue: newSettings } }, 'local');

    const current = get(settings);
    expect(current.logRetentionDays).toBe(99);
  });

  it('onChanged listener ignores changes to other keys', () => {
    const listener = capturedListeners[0];
    expect(listener).toBeDefined();
    const before = get(settings);
    listener({ other_key: { newValue: 'something' } }, 'local');
    const after = get(settings);
    expect(after).toEqual(before);
  });

  it('onChanged listener ignores non-local area changes', () => {
    const listener = capturedListeners[0];
    expect(listener).toBeDefined();
    const before = get(settings);
    listener({ smm_settings: { newValue: { ...DEFAULT_SETTINGS, logRetentionDays: 1 } } }, 'sync');
    const after = get(settings);
    expect(after).toEqual(before);
  });
});
