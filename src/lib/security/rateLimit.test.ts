import { describe, it, expect } from "vitest";
import { RateLimiter } from "@/lib/security/rateLimit";

describe("Rate limiter (spec §6.3)", () => {
  it("allows up to N per window per IP and session", () => {
    const rl = new RateLimiter(3);
    expect(rl.check("1.2.3.4", "s1").ok).toBe(true);
    expect(rl.check("1.2.3.4", "s1").ok).toBe(true);
    expect(rl.check("1.2.3.4", "s1").ok).toBe(true);
    // 4th request: IP bucket is full → blocked (spec: per-IP OR per-session)
    expect(rl.check("1.2.3.4", "s1").ok).toBe(false);
  });

  it("blocks once the limit is exceeded", () => {
    const rl = new RateLimiter(2);
    rl.check("1.2.3.4", "s1");
    rl.check("1.2.3.4", "s1");
    const r = rl.check("1.2.3.4", "s1");
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("blocks when the IP bucket is full even with a fresh session (per-IP guard)", () => {
    const rl = new RateLimiter(2);
    expect(rl.check("1.2.3.4", "s1").ok).toBe(true);
    expect(rl.check("1.2.3.4", "s1").ok).toBe(true);
    // IP exhausted → blocked regardless of session
    expect(rl.check("1.2.3.4", "s2").ok).toBe(false);
  });

  it("blocks when the session bucket is full even from a new IP (per-session guard)", () => {
    const rl = new RateLimiter(1);
    expect(rl.check("1.2.3.4", "s1").ok).toBe(true);
    // session exhausted → blocked regardless of IP
    expect(rl.check("5.6.7.8", "s1").ok).toBe(false);
  });

  it("isolates IPs from each other for independent requests", () => {
    const rl = new RateLimiter(2);
    // Each IP gets its own bucket; neither hits the limit alone.
    expect(rl.check("1.2.3.4", "s-ipA").ok).toBe(true);
    expect(rl.check("5.6.7.8", "s-ipB").ok).toBe(true);
    // second request per IP still allowed
    expect(rl.check("1.2.3.4", "s-ipA").ok).toBe(true);
    expect(rl.check("5.6.7.8", "s-ipB").ok).toBe(true);
    // third per IP blocked
    expect(rl.check("1.2.3.4", "s-ipA").ok).toBe(false);
    expect(rl.check("5.6.7.8", "s-ipB").ok).toBe(false);
  });
});
