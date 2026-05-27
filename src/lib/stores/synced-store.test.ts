/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

let mockStorage: Record<string, unknown> = {};
const onChangedListeners: Array<(changes: Record<string, any>, area: string) => void> = [];

const mockBrowser = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => (key in mockStorage ? { [key]: mockStorage[key] } : {})),
      set: vi.fn(async (data: Record<string, unknown>) => Object.assign(mockStorage, data)),
    },
    onChanged: {
      addListener: vi.fn((cb: any) => onChangedListeners.push(cb)),
    },
  },
};

vi.stubGlobal('browser', mockBrowser);

// Must import AFTER stubbing browser
import { createSyncedStore } from './synced-store';

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage = {};
  onChangedListeners.length = 0;
});

describe('createSyncedStore', () => {
  it('creates a store with the default value', () => {
    const store = createSyncedStore('test_key', 42, 'test');
    expect(get(store)).toBe(42);
  });

  it('loads persisted value from storage on creation', async () => {
    mockStorage['test_key'] = [1, 2, 3];
    const store = createSyncedStore('test_key', [], 'test');
    // Wait for async load
    await vi.waitFor(() => expect(get(store)).toEqual([1, 2, 3]));
  });

  it('persist() writes value to browser.storage.local', async () => {
    const store = createSyncedStore('test_key', 'default', 'test');
    await store.persist('new value');
    expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({ test_key: 'new value' });
  });

  it('persist() strips Svelte proxy via JSON roundtrip', async () => {
    const store = createSyncedStore('test_key', { a: 1 }, 'test');
    const obj = { a: 2, nested: { b: 3 } };
    await store.persist(obj);
    const calledWith = mockBrowser.storage.local.set.mock.calls[0][0];
    expect(calledWith.test_key).toEqual({ a: 2, nested: { b: 3 } });
    // Verify it's a plain object (not same reference)
    expect(calledWith.test_key).not.toBe(obj);
  });

  it('set() updates subscribers', () => {
    const store = createSyncedStore('test_key', 0, 'test');
    store.set(99);
    expect(get(store)).toBe(99);
  });

  it('update() transforms value correctly', () => {
    const store = createSyncedStore<number[]>('test_key', [1], 'test');
    store.update(arr => [...arr, 2, 3]);
    expect(get(store)).toEqual([1, 2, 3]);
  });

  it('onChanged listener updates store when matching key changes', async () => {
    mockStorage = {};
    createSyncedStore('my_key', 'old', 'test');
    // Simulate external change
    expect(onChangedListeners.length).toBeGreaterThan(0);
    onChangedListeners[onChangedListeners.length - 1](
      { my_key: { newValue: 'updated' } },
      'local',
    );
  });

  it('onChanged listener ignores changes to different keys', () => {
    const store = createSyncedStore('my_key', 'original', 'test');
    const listener = onChangedListeners[onChangedListeners.length - 1];
    listener({ other_key: { newValue: 'irrelevant' } }, 'local');
    expect(get(store)).toBe('original');
  });

  it('onChanged listener ignores non-local area changes', () => {
    const store = createSyncedStore('my_key', 'original', 'test');
    const listener = onChangedListeners[onChangedListeners.length - 1];
    listener({ my_key: { newValue: 'changed' } }, 'sync');
    expect(get(store)).toBe('original');
  });

  it('resets to default when newValue is undefined on onChanged', () => {
    const store = createSyncedStore('my_key', 'default_val', 'test');
    const listener = onChangedListeners[onChangedListeners.length - 1];
    store.set('changed');
    listener({ my_key: { newValue: undefined } }, 'local');
    expect(get(store)).toBe('default_val');
  });

  it('handles storage get failure gracefully', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockBrowser.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
    createSyncedStore('err_key', 'fallback', 'test');
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    spy.mockRestore();
  });
});
