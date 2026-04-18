import type { ZodTypeAny, z } from "zod";
import type { LlmProvider, StructuredRequest } from "./types";

/**
 * Parses Google's retryDelay hint from a 429 error message.
 * Gemini returns values like "7.127207984s" or "31s" in error.details[].retryDelay.
 * Returns milliseconds, or null if not found.
 */
function parseRetryDelayMs(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err ?? "");

  // Try to pull a JSON blob from the message first (Google errors embed JSON).
  const jsonMatch = msg.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const details = parsed?.error?.details ?? parsed?.details;
      if (Array.isArray(details)) {
        for (const d of details) {
          if (typeof d?.retryDelay === "string") {
            const seconds = parseFloat(d.retryDelay.replace(/s$/, ""));
            if (!Number.isNaN(seconds)) return Math.ceil(seconds * 1000);
          }
        }
      }
    } catch {
      // fall through
    }
  }

  // Fallback: regex scan for "retryDelay":"Ns"
  const re = /retryDelay"?\s*[:=]\s*"?(\d+(?:\.\d+)?)s/i;
  const m = msg.match(re);
  if (m) {
    const seconds = parseFloat(m[1]);
    if (!Number.isNaN(seconds)) return Math.ceil(seconds * 1000);
  }
  return null;
}

function is429(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /\b429\b|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type QueueItem = {
  run: () => Promise<unknown>;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

/**
 * Wraps an LlmProvider to enforce a requests-per-minute cap using a rolling
 * window and to back off on 429s using the server's retryDelay hint.
 *
 * Callers can fire as many parallel generateStructured() calls as they want;
 * this wrapper serializes them against the RPM budget transparently.
 */
export class RateLimitedProvider implements LlmProvider {
  name: string;
  model: string;
  private inner: LlmProvider;
  private rpm: number;
  private windowMs = 60_000;
  private timestamps: number[] = [];
  private queue: QueueItem[] = [];
  private draining = false;
  private pausedUntil = 0;

  constructor(inner: LlmProvider, opts: { rpm: number }) {
    this.inner = inner;
    this.rpm = Math.max(1, opts.rpm);
    this.name = `${inner.name}+ratelimit`;
    this.model = inner.model;
  }

  async generateStructured<S extends ZodTypeAny>(
    req: StructuredRequest<S>,
  ): Promise<z.infer<S>> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        run: () => this.inner.generateStructured(req),
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const now = Date.now();

        // Respect a server-imposed pause window.
        if (now < this.pausedUntil) {
          await sleep(this.pausedUntil - now);
          continue;
        }

        // Roll the RPM window.
        const cutoff = now - this.windowMs;
        this.timestamps = this.timestamps.filter((t) => t > cutoff);
        if (this.timestamps.length >= this.rpm) {
          const oldest = this.timestamps[0];
          const waitMs = oldest + this.windowMs - now + 50;
          await sleep(Math.max(waitMs, 100));
          continue;
        }

        const item = this.queue.shift()!;
        this.timestamps.push(Date.now());

        try {
          const value = await item.run();
          item.resolve(value);
        } catch (err) {
          if (is429(err)) {
            const hint = parseRetryDelayMs(err);
            const waitMs = hint ?? 30_000;
            this.pausedUntil = Date.now() + waitMs;
            console.warn(
              `[rate-limiter] 429 from ${this.inner.name}; pausing queue ${waitMs}ms (hint=${hint !== null})`,
            );
            // Requeue this item at the head and continue draining.
            this.queue.unshift(item);
            continue;
          }
          item.reject(err);
        }
      }
    } finally {
      this.draining = false;
    }
  }
}
