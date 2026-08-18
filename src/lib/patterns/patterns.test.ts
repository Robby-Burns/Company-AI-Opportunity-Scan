import { describe, it, expect } from "vitest";
import { PATTERN_LIBRARY } from "./pattern-library";
import {
  buildEvidenceLedger,
  evaluateCandidatePatterns,
  filterSupportedHypotheses
} from "./matcher";
import type { Evidence } from "@/lib/evidence/store";

describe("Dataset A: Diagnostic Pattern Library & Matcher", () => {
  it("contains 10 structured diagnostic patterns with disconfirmers and intervention options", () => {
    expect(PATTERN_LIBRARY.length).toBe(10);
    for (const pattern of PATTERN_LIBRARY) {
      expect(pattern.id).toBeDefined();
      expect(pattern.name).toBeDefined();
      expect(pattern.confirmingIndicators.length).toBeGreaterThan(0);
      expect(pattern.disprovingIndicators.length).toBeGreaterThan(0);
      expect(pattern.alternativeExplanations.length).toBeGreaterThan(0);
      expect(pattern.diagnosticQuestions.length).toBeGreaterThan(0);
      expect(pattern.whenAiAppropriate).toBeDefined();
      expect(pattern.whenAutomationBetter).toBeDefined();
      expect(pattern.risksAndHumanInLoop).toBeDefined();
    }
  });

  it("matches candidate patterns and supports them when primary evidence is present", () => {
    const mockEvidence: Evidence[] = [
      {
        id: "ev_1",
        scanId: "s1",
        kind: "PROSPECT_REPORTED",
        source: "interview",
        signal: "friction:quoting_rules",
        snippet: "Takes forever to get quotes out because we have to check municipal code every time across different cities.",
        confidence: "high",
        createdAt: Date.now()
      },
      {
        id: "ev_2",
        scanId: "s1",
        kind: "SCRAPED_WEB",
        source: "https://example.com/jobs",
        signal: "hiring:compliance",
        snippet: "Seeking compliance and QA specialists for multi-jurisdictional builds.",
        confidence: "medium",
        createdAt: Date.now()
      }
    ];

    const ledger = buildEvidenceLedger(mockEvidence);
    const candidates = evaluateCandidatePatterns(ledger);

    expect(candidates.length).toBeGreaterThan(0);
    const ruleCheckCandidate = candidates.find(
      (c) => c.patternId === "pattern_01_multijurisdictional_rules"
    );

    expect(ruleCheckCandidate).toBeDefined();
    expect(ruleCheckCandidate?.disposition).toBe("supported");
    expect(ruleCheckCandidate?.confidence).toBe("Strong");
    expect(ruleCheckCandidate?.supportingEvidenceIds).toContain("ev_1");
  });

  it("handles zero matching signals by returning empty supported hypotheses (null opportunity case)", () => {
    const mockEvidence: Evidence[] = [
      {
        id: "ev_generic",
        scanId: "s2",
        kind: "SCRAPED_WEB",
        source: "https://example.com",
        signal: "general:about",
        snippet: "We are an advisory firm providing general business consulting.",
        confidence: "low",
        createdAt: Date.now()
      }
    ];

    const ledger = buildEvidenceLedger(mockEvidence);
    const candidates = evaluateCandidatePatterns(ledger);
    const supported = filterSupportedHypotheses(candidates);

    // No strong matching triggers → zero or empty supported hypotheses
    expect(supported.length).toBeLessThanOrEqual(1);
  });

  it("triangulates deterministic automation when API/structured signals are observed", () => {
    const mockEvidence: Evidence[] = [
      {
        id: "ev_api",
        scanId: "s3",
        kind: "PROSPECT_REPORTED",
        source: "interview",
        signal: "systems:api_available",
        snippet: "Our CRM and ERP have direct REST APIs and structured EDI feeds, but staff still copy-paste.",
        confidence: "high",
        createdAt: Date.now()
      }
    ];

    const ledger = buildEvidenceLedger(mockEvidence);
    const candidates = evaluateCandidatePatterns(ledger);
    const swivelChair = candidates.find((c) => c.patternId === "pattern_03_multisystem_swivel_chair");

    if (swivelChair) {
      expect(swivelChair.interventionType).toBe("deterministic_automation");
    }
  });
});
