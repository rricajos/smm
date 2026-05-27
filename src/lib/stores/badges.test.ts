/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

let mockStorage: Record<string, unknown> = {};

vi.stubGlobal('browser', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => (key in mockStorage ? { [key]: mockStorage[key] } : {})),
      set: vi.fn(async (data: Record<string, unknown>) => Object.assign(mockStorage, data)),
    },
    onChanged: { addListener: vi.fn() },
  },
});

import { unreadClassifications } from './badges';

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage = {};
});

describe('badges store', () => {
  it('has 0 as default', () => {
    expect(get(unreadClassifications)).toBe(0);
  });

  it('reset() persists 0', async () => {
    await unreadClassifications.reset();
    expect(mockStorage['smm_unread_classifications']).toBe(0);
  });
});
