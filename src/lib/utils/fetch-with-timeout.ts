/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { logger } from './logger';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const RETRYABLE_STATUS_CODES = new Set([429, 503]);

/**
 * Fetch with an AbortController timeout.
 * Throws a descriptive error if the request exceeds the timeout.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with timeout and exponential backoff retry for 429/503 responses.
 * Non-retryable errors (4xx except 429, 5xx except 503) are thrown immediately.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  opts?: { timeoutMs?: number; maxRetries?: number },
): Promise<Response> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

      if (response.ok || !RETRYABLE_STATUS_CODES.has(response.status)) {
        return response;
      }

      // Retryable status — log and continue
      lastError = new Error(`HTTP ${response.status}`);
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        logger.warn(
          `Retryable HTTP ${response.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await sleep(delayMs);
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Timeout errors are retryable
      if (attempt < maxRetries && lastError.message.includes('timed out')) {
        const delayMs = Math.pow(2, attempt) * 1000;
        logger.warn(
          `Request timed out, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await sleep(delayMs);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('Max retries exceeded');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
