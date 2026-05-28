/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout, fetchWithRetry } from './fetch-with-timeout';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Save original fetch
const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('fetchWithTimeout', () => {
  it('returns response for successful fetch', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await fetchWithTimeout('https://api.test.com', { method: 'POST' });
    expect(result.status).toBe(200);
  });

  it('throws timeout error when request exceeds timeout', async () => {
    globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });

    const promise = fetchWithTimeout('https://api.test.com', { method: 'POST' }, 100);
    vi.advanceTimersByTime(150);

    await expect(promise).rejects.toThrow('Request timed out after 100ms');
  });

  it('clears timeout on successful response', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));

    await fetchWithTimeout('https://api.test.com', { method: 'POST' });
    expect(clearSpy).toHaveBeenCalled();
  });

  it('propagates network errors directly', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchWithTimeout('https://api.test.com', { method: 'POST' })).rejects.toThrow(
      'Failed to fetch',
    );
  });

  it('passes options to fetch including signal', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok'));

    await fetchWithTimeout('https://api.test.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test.com',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: expect.any(AbortSignal),
      }),
    );
  });
});

describe('fetchWithRetry', () => {
  it('returns response on first success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    const result = await fetchWithRetry('https://api.test.com', { method: 'POST' });
    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const promise = fetchWithRetry('https://api.test.com', { method: 'POST' }, { maxRetries: 3 });
    // Advance past the 1s delay
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 503 and succeeds', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const promise = fetchWithRetry('https://api.test.com', { method: 'POST' }, { maxRetries: 3 });
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(result.status).toBe(200);
  });

  it('does not retry on 400 error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('bad request', { status: 400 }));

    const result = await fetchWithRetry('https://api.test.com', { method: 'POST' });
    expect(result.status).toBe(400);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 401 error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));

    const result = await fetchWithRetry('https://api.test.com', { method: 'POST' });
    expect(result.status).toBe(401);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 500 error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('server error', { status: 500 }));

    const result = await fetchWithRetry('https://api.test.com', { method: 'POST' });
    expect(result.status).toBe(500);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting all retries on 429', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }));

    await expect(
      fetchWithRetry('https://api.test.com', { method: 'POST' }, { maxRetries: 0 }),
    ).rejects.toThrow('HTTP 429');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
  });

  it('throws network error immediately without retry', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Network failure'));

    await expect(fetchWithRetry('https://api.test.com', { method: 'POST' })).rejects.toThrow(
      'Network failure',
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('uses exponential backoff delays', async () => {
    const { logger } = await import('./logger');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const promise = fetchWithRetry('https://api.test.com', { method: 'POST' }, { maxRetries: 3 });

    // First retry after 1s (2^0 * 1000)
    await vi.advanceTimersByTimeAsync(1500);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('1000ms'));

    // Second retry after 2s (2^1 * 1000)
    await vi.advanceTimersByTimeAsync(2500);

    await promise;
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
});

// ── Branch coverage: fetchWithRetry additional branches ──────────────

describe('fetchWithRetry – uncovered branches', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('retries on timeout error when not the last attempt', async () => {
    // First call times out, second call succeeds
    globalThis.fetch = vi
      .fn()
      .mockImplementationOnce((_url: string, opts: RequestInit) => {
        return new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        });
      })
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const promise = fetchWithRetry(
      'https://api.test.com',
      { method: 'POST' },
      { timeoutMs: 100, maxRetries: 2 },
    );

    // Advance past the timeout for the first attempt
    await vi.advanceTimersByTimeAsync(150);
    // Advance past the backoff delay (2^0 * 1000 = 1000ms)
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws non-timeout error immediately without retrying', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('DNS resolution failed'));

    await expect(
      fetchWithRetry('https://api.test.com', { method: 'POST' }, { maxRetries: 3 }),
    ).rejects.toThrow('DNS resolution failed');

    // Should not retry — only one call
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting all retries on 503 (last attempt for retryable status)', async () => {
    vi.useRealTimers();
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 }));

    await expect(
      fetchWithRetry('https://api.test.com', { method: 'POST' }, { maxRetries: 0 }),
    ).rejects.toThrow('HTTP 503');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('returns non-retryable status codes immediately (e.g. 404, 422)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));

    const result = await fetchWithRetry('https://api.test.com', { method: 'POST' });
    expect(result.status).toBe(404);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns 200 OK immediately without retries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    const result = await fetchWithRetry('https://api.test.com', { method: 'POST' });
    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('wraps non-Error thrown values into Error objects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue('string-error');

    await expect(
      fetchWithRetry('https://api.test.com', { method: 'POST' }, { maxRetries: 0 }),
    ).rejects.toThrow('string-error');
  });

  it('timeout error on last attempt throws instead of retrying', async () => {
    vi.useRealTimers();

    // maxRetries=0 means attempt 0 is the only (and last) attempt
    // A timeout error on the last attempt should throw immediately
    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });

    await expect(
      fetchWithRetry('https://api.test.com', { method: 'POST' }, { timeoutMs: 50, maxRetries: 0 }),
    ).rejects.toThrow('timed out');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('uses exponential backoff: 1s, 2s, 4s for attempts 0, 1, 2', async () => {
    const { logger } = await import('./logger');
    vi.mocked(logger.warn).mockClear();

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const promise = fetchWithRetry('https://api.test.com', { method: 'POST' }, { maxRetries: 3 });

    // Attempt 0 -> 429, delay 1s (2^0 * 1000)
    await vi.advanceTimersByTimeAsync(1500);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('1000ms'));

    // Attempt 1 -> 429, delay 2s (2^1 * 1000)
    await vi.advanceTimersByTimeAsync(2500);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('2000ms'));

    // Attempt 2 -> 429, delay 4s (2^2 * 1000)
    await vi.advanceTimersByTimeAsync(4500);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('4000ms'));

    // Attempt 3 -> 200 OK
    const result = await promise;
    expect(result.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });

  it('uses default timeout and maxRetries when opts are not provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    const result = await fetchWithRetry('https://api.test.com', { method: 'POST' });
    expect(result.status).toBe(200);
  });
});
