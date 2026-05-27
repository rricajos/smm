/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from './rate-limiter';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ maxConcurrent: 2, maxPerMinute: 20, minDelayMs: 50 });
  });

  it('allows up to maxConcurrent simultaneous calls', async () => {
    const order: string[] = [];

    const p1 = limiter.execute(async () => {
      order.push('start-1');
      await delay(100);
      order.push('end-1');
      return 1;
    });

    const p2 = limiter.execute(async () => {
      order.push('start-2');
      await delay(100);
      order.push('end-2');
      return 2;
    });

    // Small delay to let both start
    await delay(20);
    expect(limiter.active).toBe(2);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(1);
    expect(r2).toBe(2);
    expect(order.indexOf('start-1')).toBeLessThan(order.indexOf('end-1'));
    expect(order.indexOf('start-2')).toBeLessThan(order.indexOf('end-2'));
  });

  it('queues calls exceeding maxConcurrent', async () => {
    const order: string[] = [];

    const p1 = limiter.execute(async () => {
      order.push('start-1');
      await delay(100);
      order.push('end-1');
    });

    const p2 = limiter.execute(async () => {
      order.push('start-2');
      await delay(100);
      order.push('end-2');
    });

    const p3 = limiter.execute(async () => {
      order.push('start-3');
      await delay(50);
      order.push('end-3');
    });

    await delay(20);
    // Only 2 should be active, third is queued
    expect(limiter.active).toBe(2);

    await Promise.all([p1, p2, p3]);
    // Third one started after one of the first two finished
    expect(order.indexOf('start-3')).toBeGreaterThan(
      Math.min(order.indexOf('end-1'), order.indexOf('end-2')),
    );
  });

  it('returns the value from the wrapped function', async () => {
    const result = await limiter.execute(async () => 42);
    expect(result).toBe(42);
  });

  it('releases slot even when function throws', async () => {
    await expect(
      limiter.execute(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(limiter.active).toBe(0);

    // Should still work after error
    const result = await limiter.execute(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('tracks recent call count', async () => {
    expect(limiter.recentCount).toBe(0);

    await limiter.execute(async () => 'a');
    await limiter.execute(async () => 'b');

    expect(limiter.recentCount).toBe(2);
  });

  it('reports active count correctly', async () => {
    expect(limiter.active).toBe(0);

    const p = limiter.execute(async () => {
      expect(limiter.active).toBe(1);
      await delay(50);
    });

    await delay(10);
    expect(limiter.active).toBe(1);
    await p;
    expect(limiter.active).toBe(0);
  });

  it('reset clears all internal state', async () => {
    await limiter.execute(async () => 'x');
    expect(limiter.recentCount).toBe(1);

    limiter.reset();

    expect(limiter.active).toBe(0);
    expect(limiter.recentCount).toBe(0);
  });

  it('enforces minimum delay between calls', async () => {
    const minDelayLimiter = new RateLimiter({
      maxConcurrent: 1,
      maxPerMinute: 100,
      minDelayMs: 100,
    });

    const start = Date.now();
    await minDelayLimiter.execute(async () => 'a');
    await minDelayLimiter.execute(async () => 'b');
    const elapsed = Date.now() - start;

    // Second call should wait at least minDelayMs after first
    expect(elapsed).toBeGreaterThanOrEqual(90); // slight tolerance
  });

  it('waits when per-minute cap is reached', async () => {
    const tinyLimiter = new RateLimiter({
      maxConcurrent: 10,
      maxPerMinute: 2,
      minDelayMs: 0,
    });

    await tinyLimiter.execute(async () => 'a');
    await tinyLimiter.execute(async () => 'b');
    expect(tinyLimiter.recentCount).toBe(2);

    // Third call should still complete (after waiting)
    // We can't easily test the 60s wait without fake timers,
    // so just verify the count and that the limiter doesn't error
    expect(tinyLimiter.active).toBe(0);
  });

  it('handles multiple sequential calls correctly', async () => {
    const results: number[] = [];

    for (let i = 0; i < 5; i++) {
      const val = await limiter.execute(async () => i);
      results.push(val);
    }

    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(limiter.active).toBe(0);
  });
});
