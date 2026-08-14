import { describe, it, expect } from "vitest";
import { assertSafeHost, isBlockedIp, isValidHttpUrl, SsrfError } from "@/lib/security/ssrf";

describe("SSRF: URL validation", () => {
  it("accepts http/https URLs", () => {
    expect(isValidHttpUrl("https://example.com")).toBe(true);
    expect(isValidHttpUrl("http://example.com/path?q=1")).toBe(true);
  });
  it("rejects non-http schemes", () => {
    expect(isValidHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("not a url")).toBe(false);
  });
});

describe("SSRF: assertSafeHost (per-request host check)", () => {
  it("blocks an IP literal in a private range", async () => {
    await expect(assertSafeHost("127.0.0.1")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeHost("10.0.0.5")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertSafeHost("169.254.169.254")).rejects.toBeInstanceOf(SsrfError);
  });
  it("blocks known metadata hosts", async () => {
    await expect(assertSafeHost("metadata.google.internal")).rejects.toBeInstanceOf(SsrfError);
  });
  it("allows a public IP literal", async () => {
    await expect(assertSafeHost("8.8.8.8")).resolves.toBeUndefined();
  });
});

describe("SSRF: blocked IP detection", () => {
  it("blocks loopback", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("127.255.255.254")).toBe(true);
  });
  it("blocks private ranges", () => {
    expect(isBlockedIp("10.0.0.1")).toBe(true);
    expect(isBlockedIp("10.255.255.255")).toBe(true);
    expect(isBlockedIp("172.16.0.1")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
  });
  it("blocks cloud metadata", () => {
    expect(isBlockedIp("169.254.169.254")).toBe(true); // AWS/Azure/etc
  });
  it("blocks link-local", () => {
    expect(isBlockedIp("169.254.0.1")).toBe(true);
  });
  it("blocks CGNAT and TEST-NET", () => {
    expect(isBlockedIp("100.64.0.1")).toBe(true);
    expect(isBlockedIp("198.51.100.1")).toBe(true);
  });
  it("blocks IPv6 loopback/unique-local", () => {
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("fe80::1")).toBe(true);
    expect(isBlockedIp("fd00::1")).toBe(true);
  });
  it("allows public addresses", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("1.1.1.1")).toBe(false);
    expect(isBlockedIp("93.184.216.34")).toBe(false);
  });
});
