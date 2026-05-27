/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

export class RateLimiter {
  private readonly maxConcurrent: number;
  private readonly maxPerMinute: number;
  private readonly minDelayMs: number;

  private activeCalls = 0;
  private timestamps: number[] = [];
  private lastCallTime = 0;
  private concurrencyQueue: Array<() => void> = [];

  constructor(
    opts: {
      maxConcurrent?: number;
      maxPerMinute?: number;
      minDelayMs?: number;
    } = {},
  ) {
    this.maxConcurrent = opts.maxConcurrent ?? 2;
    this.maxPerMinute = opts.maxPerMinute ?? 20;
    this.minDelayMs = opts.minDelayMs ?? 200;
  }

  get active(): number {
    return this.activeCalls;
  }

  get recentCount(): number {
    const cutoff = Date.now() - 60_000;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
    return this.timestamps.length;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireSlot();
    try {
      await this.waitForRateLimits();
      this.timestamps.push(Date.now());
      this.lastCallTime = Date.now();
      return await fn();
    } finally {
      this.activeCalls--;
      this.releaseNext();
    }
  }

  reset(): void {
    this.activeCalls = 0;
    this.timestamps = [];
    this.lastCallTime = 0;
    this.concurrencyQueue = [];
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeCalls < this.maxConcurrent) {
      this.activeCalls++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.concurrencyQueue.push(resolve);
    });
    // When resolved, the releasing side already incremented activeCalls for us
  }

  private async waitForRateLimits(): Promise<void> {
    // Wait for per-minute cap
    const cutoff = Date.now() - 60_000;
    this.timestamps = this.timestamps.filter((t) => t > cutoff);
    if (this.timestamps.length >= this.maxPerMinute) {
      const oldest = this.timestamps[0];
      const waitTime = oldest + 60_000 - Date.now();
      if (waitTime > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, waitTime));
      }
    }

    // Enforce minimum delay between calls
    const elapsed = Date.now() - this.lastCallTime;
    if (elapsed < this.minDelayMs && this.lastCallTime > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, this.minDelayMs - elapsed));
    }
  }

  private releaseNext(): void {
    const next = this.concurrencyQueue.shift();
    if (next) {
      // Transfer the slot: increment before resolving to avoid race
      this.activeCalls++;
      next();
    }
  }
}

export const aiRateLimiter = new RateLimiter();
