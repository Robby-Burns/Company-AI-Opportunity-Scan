/**
 * SSRF guard (spec §6.1).
 *
 * Validates a submitted website URL and refuses to fetch if the resolved
 * address is private, loopback, link-local, or cloud-metadata. Re-checks on
 * EVERY redirect hop, not just the initial URL.
 *
 * Exposed as a manual fetch (`safeFetch`) that follows redirects one hop at a
 * time, re-validating the destination each time.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_RANGES = [
  // IPv4
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10", // CGNAT
  "127.0.0.0/8",
  "169.254.0.0/16", // link-local + cloud metadata (169.254.169.254)
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24", // TEST-NET-1
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24", // TEST-NET-2
  "203.0.113.0/24", // TEST-NET-3
  "224.0.0.0/4", // multicast
  "240.0.0.0/4" // reserved
];

const BLOCKED_HOSTS = new Set([
  "metadata.google.internal", // GCP metadata
  "169.254.169.254", // AWS/Azure/etc metadata literal
  "metadata.azure.com" // Azure
]);

export class SsrfError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | "invalid-url"
      | "blocked-scheme"
      | "blocked-host"
      | "private-ip"
      | "unresolvable"
      | "too-many-redirects"
  ) {
    super(message);
    this.name = "SsrfError";
  }
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** True if `ip` is in any blocked range or is IPv6 loopback/link-local. */
export function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) return true; // not a valid IP literal → blocked (defensive)
  if (family === 6) {
    // ::1 loopback, fe80::/10 link-local, fc00::/7 unique-local
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fe9") || lower.startsWith("feb") || lower.startsWith("fec"))
      return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    return false;
  }
  // IPv4 CIDR check
  const num = ipv4ToInt(ip);
  if (num === null) return true;
  return PRIVATE_RANGES.some((cidr) => inCidr(num, cidr));
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const oct = Number(p);
    if (!Number.isInteger(oct) || oct < 0 || oct > 255) return null;
    n = (n << 8) + oct;
  }
  return n >>> 0;
}

function inCidr(ipNum: number, cidr: string): boolean {
  const parts = cidr.split("/");
  const base = parts[0];
  const bitsStr = parts[1];
  if (!base || bitsStr === undefined) return false;
  const bits = Number(bitsStr);
  const baseNum = ipv4ToInt(base);
  if (baseNum === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

/**
 * Resolve host → A/AAAA records; throws SsrfError if blocked/unresolvable.
 * Exported so non-fetch navigators (e.g. Playwright page.goto) can enforce the
 * same SSRF rule per request, including on redirect-initiated navigations.
 */
export async function assertSafeHost(host: string): Promise<void> {
  const cleaned = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(cleaned)) {
    throw new SsrfError(`Host "${cleaned}" is blocked`, "blocked-host");
  }
  // If the host is already an IP literal, check directly.
  if (isIP(cleaned) !== 0) {
    if (isBlockedIp(cleaned)) throw new SsrfError("Resolved address is private/metadata", "private-ip");
    return;
  }
  let addrs: string[];
  try {
    const rec = await lookup(cleaned, { all: true });
    addrs = rec.map((r) => r.address);
  } catch {
    throw new SsrfError(`Could not resolve host "${cleaned}"`, "unresolvable");
  }
  if (addrs.length === 0) throw new SsrfError(`No addresses for "${cleaned}"`, "unresolvable");
  // Block if ANY resolved address is private (defense against DNS rebinding).
  for (const a of addrs) {
    if (isBlockedIp(a)) throw new SsrfError("Resolved address is private/metadata", "private-ip");
  }
}

export interface SafeFetchResult {
  readonly url: string; // final URL
  readonly status: number;
  readonly headers: Headers;
  readonly body: string;
  readonly contentType: string;
}

export interface SafeFetchOptions {
  /** Max redirect hops. Default 5. */
  maxRedirects?: number;
  /** Per-request timeout ms. Default 15000. */
  timeoutMs?: number;
  /** Allowed content types; rejects otherwise (e.g. to avoid downloading binaries). */
  acceptContentTypes?: readonly string[];
}

/**
 * Fetch a URL while enforcing SSRF rules on every hop. Uses the global fetch
 * with `redirect: "manual"` so each hop can be re-validated.
 */
export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const maxRedirects = opts.maxRedirects ?? 5;
  const timeoutMs = opts.timeoutMs ?? 15000;
  const accept = opts.acceptContentTypes;

  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!isValidHttpUrl(current)) {
      throw new SsrfError(`Invalid URL: ${current}`, "invalid-url");
    }
    const u = new URL(current);
    await assertSafeHost(u.hostname);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": "FoxLoom-Opportunity-Scan/1.0 (+https://foxandloom.com)" }
      });
    } catch (e) {
      clearTimeout(timer);
      throw new SsrfError(`Fetch failed: ${(e as Error).message}`, "unresolvable");
    }
    clearTimeout(timer);

    const status = res.status;
    if (status >= 300 && status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new SsrfError("Redirect with no Location", "invalid-url");
      current = new URL(loc, current).toString(); // resolve relative redirects
      continue;
    }
    if (status >= 400) {
      throw new SsrfError(`HTTP ${status}`, "unresolvable");
    }
    const ct = res.headers.get("content-type") ?? "";
    if (accept && accept.length > 0 && !accept.some((t) => ct.includes(t))) {
      throw new SsrfError(`Disallowed content type: ${ct}`, "invalid-url");
    }
    const body = await res.text();
    return { url: current, status, headers: res.headers, body, contentType: ct };
  }
  throw new SsrfError("Too many redirects", "too-many-redirects");
}
