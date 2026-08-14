import { describe, it, expect } from "vitest";
import { checkOwnership } from "@/lib/security/ownership";

describe("Ownership signal (spec §6.2)", () => {
  it("passes on registrable-domain match between email and website", () => {
    const r = checkOwnership({
      email: "alice@acme.com",
      website: "https://www.acme.com",
      confirmed: false
    });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("domain-match");
  });

  it("normalizes subdomains (mail subdomain vs www site)", () => {
    const r = checkOwnership({
      email: "alice@mail.acme.com",
      website: "https://www.acme.com",
      confirmed: false
    });
    expect(r.ok).toBe(true);
    expect(r.emailDomain).toBe("acme.com");
    expect(r.websiteDomain).toBe("acme.com");
  });

  it("passes on explicit confirmation when domains mismatch", () => {
    const r = checkOwnership({
      email: "alice@gmail.com",
      website: "https://acme.com",
      confirmed: true
    });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("confirmed");
  });

  it("fails when neither match nor confirmation", () => {
    const r = checkOwnership({
      email: "alice@gmail.com",
      website: "https://acme.com",
      confirmed: false
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("mismatch");
  });

  it("handles malformed inputs defensively", () => {
    const r = checkOwnership({ email: "", website: "", confirmed: false });
    expect(r.ok).toBe(false);
  });
});
