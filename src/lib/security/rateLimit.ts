/**
 * In-memory rate limiter (spec §6.3). Token-bucket per IP and per session.
 *
 * Caveat (logged in build_log.md): in-memory state does not survive
 * serverless cold-starts or multi-instance deployments. Acceptable for MVP
 * single-instance; swap for Redis before scale.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export class RateLimiter {
  private ipBuckets = new Map<string, Bucket>();
  private sessionBuckets = new Map<string, Bucket>();
  private limit: number;

  constructor(limitPerHour: number) {
    this.limit = Math.max(1, Math.floor(limitPerHour));
  }

  /** Returns ok=true if both IP and session are within limit. */
  check(ip: string | null, sessionId: string | null): { ok: boolean; remaining: number } {
    const now = Date.now();
    const ipOk = this.allow(this.ipBuckets, ip ?? "unknown", now);
    const sessOk = this.allow(this.sessionBuckets, sessionId ?? "anonymous", now);
    const ok = ipOk.ok && sessOk.ok;
    const remaining = Math.min(ipOk.remaining, sessOk.remaining);
    return { ok, remaining };
  }

  private allow(store: Map<string, Bucket>, key: string, now: number): { ok: boolean; remaining: number } {
    const b = store.get(key);
    if (!b || now - b.windowStart > WINDOW_MS) {
      store.set(key, { count: 1, windowStart: now });
      return { ok: true, remaining: this.limit - 1 };
    }
    if (b.count >= this.limit) {
      return { ok: false, remaining: 0 };
    }
    b.count += 1;
    return { ok: true, remaining: this.limit - b.count };
  }

  /** Test helper. */
  reset(): void {
    this.ipBuckets.clear();
    this.sessionBuckets.clear();
  }
}

/** Singleton for the app (per process). */
let singleton: RateLimiter | null = null;
export function getRateLimiter(limitPerHour: number): RateLimiter {
  if (!singleton) singleton = new RateLimiter(limitPerHour);
  return singleton;
}
