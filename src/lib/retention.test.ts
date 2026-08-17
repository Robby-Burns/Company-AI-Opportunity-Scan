import { describe, it, expect, beforeEach } from "vitest";
import { createScan, addEvidence, listEvidence, getScan, deleteScan, allScans } from "@/lib/evidence/store";
import { initInterview, getInterviewState } from "@/lib/orchestrator";
import { getClientReport, startSynthesis } from "@/lib/synthesis-queue";
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

  it("clears derived interview + synthesis state when fully deleting (no leak)", () => {
    const now = Date.now();
    createScan({
      id: "r3",
      company: "Acme",
      website: "https://acme.com",
      email: "a@acme.com",
      retentionScrapedDays: 90,
      retentionAnswersDays: 365
    });
    const rec = getScan("r3")!;
    (rec as { expiresAt: number }).expiresAt = now - 2000;
    (rec as { answersExpireAt: number }).answersExpireAt = now - 1000;

    // Populate derived state the way the pipeline does.
    initInterview("r3");
    expect(getInterviewState("r3")).toBeDefined();
    // Synthesis promise/report — seed a resolved report so REPORTS is populated.
    startSynthesis("r3", Promise.resolve({
      pdfBytes: new Uint8Array(0),
      emailOk: true,
      clientReport: {
        company: "Acme",
        website: "https://acme.com",
        headline: "h",
        companySnapshot: "",
        hypothesis: null,
        whyIdentified: [],
        potentialImpact: [],
        additionalSignals: [],
        whatRemainsUnknown: [],
        deepAssessmentQuestions: [],
        whatsNext: "",
        evidenceIds: [],
        generatedAt: now
      }
    }));

    return Promise.resolve().then(async () => {
      // Let the synthesis promise settle so REPORTS is populated.
      await new Promise((r) => setTimeout(r, 10));
      expect(getInterviewState("r3")).toBeDefined();

      runRetentionSweep(now);

      expect(getInterviewState("r3")).toBeUndefined();
      expect(getClientReport("r3")).toBeUndefined();
      expect(getScan("r3")).toBeUndefined();
    });
  });
});
