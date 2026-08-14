import { describe, it, expect, beforeEach } from "vitest";
import { createScan, addEvidence, listEvidence, getScan, deleteScan, allScans } from "@/lib/evidence/store";
import { runRetentionSweep } from "@/lib/retention";

describe("Retention sweep — per-class (spec §6.5)", () => {
  beforeEach(() => {
    for (const s of allScans()) deleteScan(s.id);
  });

  it("purges scraped evidence at the scraped window while keeping prospect answers", () => {
    const now = Date.now();
    // Scraped window expired 1ms ago; answer window far in the future.
    createScan({
      id: "r1",
      company: "Acme",
      website: "https://acme.com",
      email: "a@acme.com",
      retentionScrapedDays: 0, // expiresAt = now (approx)
      retentionAnswersDays: 365
    });
    // Force expiresAt into the past while answersExpireAt stays future.
    const rec = getScan("r1")!;
    (rec as { expiresAt: number }).expiresAt = now - 1000;
    (rec as { answersExpireAt: number }).answersExpireAt = now + 365 * 86400_000;

    addEvidence("r1", { kind: "SCRAPED_WEB", source: "u", snippet: "x", signal: "s", confidence: "low" });
    addEvidence("r1", { kind: "PROSPECT_REPORTED", source: "interview", snippet: "ans", signal: "answer:q1", confidence: "high" });
    expect(listEvidence("r1").length).toBe(2);

    const res = runRetentionSweep(now);
    expect(res.purgedScraped).toBe(1);
    expect(res.deletedScans).toBe(0);
    const remaining = listEvidence("r1");
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.kind).toBe("PROSPECT_REPORTED");
    expect(getScan("r1")).toBeDefined(); // record kept for answers
  });

  it("deletes the whole scan once the answer window also passes", () => {
    const now = Date.now();
    createScan({
      id: "r2",
      company: "Acme",
      website: "https://acme.com",
      email: "a@acme.com",
      retentionScrapedDays: 90,
      retentionAnswersDays: 365
    });
    const rec = getScan("r2")!;
    (rec as { expiresAt: number }).expiresAt = now - 2000;
    (rec as { answersExpireAt: number }).answersExpireAt = now - 1000;

    addEvidence("r2", { kind: "PROSPECT_REPORTED", source: "interview", snippet: "ans", signal: "answer:q1", confidence: "high" });

    const res = runRetentionSweep(now);
    expect(res.deletedScans).toBe(1);
    expect(getScan("r2")).toBeUndefined();
  });
});
