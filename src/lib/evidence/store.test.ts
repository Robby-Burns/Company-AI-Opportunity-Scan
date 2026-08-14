import { describe, it, expect, beforeEach } from "vitest";
import {
  createScan,
  addEvidence,
  listEvidence,
  recordAnswer,
  getScan,
  deleteScan,
  allScans,
  purgeScrapedEvidence
} from "@/lib/evidence/store";

function freshScan(id = "test") {
  return createScan({
    id,
    company: "Acme",
    website: "https://acme.com",
    email: "a@acme.com",
    retentionScrapedDays: 90,
    retentionAnswersDays: 365
  });
}

describe("Evidence store (spec §7.1, §13)", () => {
  beforeEach(() => {
    // Clean the global in-memory store between tests for isolation.
    for (const s of allScans()) deleteScan(s.id);
  });

  it("assigns a stable evidence_id per evidence item", () => {
    freshScan();
    const e = addEvidence("test", {
      kind: "SCRAPED_WEB",
      source: "https://acme.com",
      snippet: "x",
      signal: "s",
      confidence: "medium"
    });
    expect(e).not.toBeNull();
    expect(e!.id).toMatch(/^ev_test_\d+$/);
  });

  it("stores PROSPECT_REPORTED answers on the record, evidence via addEvidence", () => {
    freshScan();
    addEvidence("test", { kind: "SCRAPED_WEB", source: "u", snippet: "x", signal: "s", confidence: "low" });
    recordAnswer("test", "q1", "my answer");
    expect(listEvidence("test").length).toBe(1); // only the addEvidence item
    expect(getScan("test")?.answers.get("q1")).toBe("my answer");
  });

  it("retention timestamps are set per spec §6.5", () => {
    const s = freshScan("ret");
    expect(s.expiresAt).toBeGreaterThan(s.createdAt);
    expect(s.answersExpireAt).toBeGreaterThan(s.expiresAt); // answers kept longer
  });

  it("stores sanitized notes on the scan record (spec §6.4)", () => {
    createScan({
      id: "notes-scan",
      company: "Acme",
      website: "https://acme.com",
      email: "a@acme.com",
      notes: "<<<UNTRUSTED_NOTES_BEGIN>>>we use shopify<<<UNTRUSTED_NOTES_END>>>",
      retentionScrapedDays: 90,
      retentionAnswersDays: 365
    });
    expect(getScan("notes-scan")?.notes).toContain("UNTRUSTED_NOTES_BEGIN");
  });

  it("per-class retention: purgeScrapedEvidence keeps PROSPECT_REPORTED", () => {
    freshScan("purge");
    addEvidence("purge", { kind: "SCRAPED_WEB", source: "u", snippet: "x", signal: "s", confidence: "low" });
    addEvidence("purge", { kind: "SCRAPED_TECH", source: "u", snippet: "y", signal: "t", confidence: "low" });
    addEvidence("purge", { kind: "PROSPECT_REPORTED", source: "interview", snippet: "ans", signal: "answer:q1", confidence: "high" });
    expect(listEvidence("purge").length).toBe(3);
    const removed = purgeScrapedEvidence("purge");
    expect(removed).toBe(2);
    const remaining = listEvidence("purge");
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.kind).toBe("PROSPECT_REPORTED");
  });
});
