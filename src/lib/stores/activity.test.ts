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

import { activity } from './activity';

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage = {};
});

describe('activity store', () => {
  it('has empty array as default', () => {
    expect(get(activity)).toEqual([]);
  });

  it('clear() persists an empty array', async () => {
    await activity.clear();
    expect(mockStorage['smm_activity_log']).toEqual([]);
  });
});
