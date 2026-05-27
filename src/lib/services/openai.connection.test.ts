/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../i18n', () => ({
  getLocaleFromStorage: vi.fn(async () => 'es'),
  translate: vi.fn((_loc: string, key: string) => key),
}));

vi.stubGlobal('browser', {
  permissions: { request: vi.fn(async () => true) },
  storage: {
    local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
    onChanged: { addListener: vi.fn() },
  },
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { testConnection } from './openai';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('testConnection', () => {
  it('sends OpenRouter-specific headers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    await testConnection('sk-or-key', 'model', 'openrouter');

    const [, opts] = mockFetch.mock.calls[0];
    const headers = opts.headers;
    expect(headers['HTTP-Referer']).toBe('https://addons.thunderbird.net');
    expect(headers['X-Title']).toBe('Smart Mail Manager');
    expect(headers['Authorization']).toBe('Bearer sk-or-key');
  });

  it('sends Anthropic-specific headers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'ok' }] }),
    });

    await testConnection('sk-ant-key', 'claude-3', 'anthropic');

    const [, opts] = mockFetch.mock.calls[0];
    const headers = opts.headers;
    expect(headers['x-api-key']).toBe('sk-ant-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('throws with error body message on Anthropic failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Forbidden' } }),
    });

    await expect(testConnection('key', 'claude-3', 'anthropic')).rejects.toThrow('Forbidden');
  });

  it('throws with status code when Anthropic error body is unparseable', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(testConnection('key', 'claude-3', 'anthropic')).rejects.toThrow('Error: 500');
  });

  it('throws with status code when OpenAI error body is unparseable', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(testConnection('key', 'model', 'openai')).rejects.toThrow('Error: 502');
  });

  it('calls ensureCustomPermission for custom provider', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    await testConnection('key', 'model', 'custom', 'https://my-api.com/v1/chat');

    expect(browser.permissions.request).toHaveBeenCalledWith({
      origins: ['https://my-api.com/*'],
    });
  });

  it('throws when custom provider permission is denied', async () => {
    (browser.permissions.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    await expect(
      testConnection('key', 'model', 'custom', 'https://my-api.com/v1/chat'),
    ).rejects.toThrow('Permission denied');
  });

  it('throws when custom provider uses non-https remote URL', async () => {
    await expect(
      testConnection('key', 'model', 'custom', 'http://remote-server.com/v1/chat'),
    ).rejects.toThrow('HTTPS required');
  });

  it('allows localhost without HTTPS for custom provider', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });

    await testConnection('key', 'model', 'custom', 'http://localhost:8080/v1/chat');
    expect(mockFetch).toHaveBeenCalled();
  });
});
