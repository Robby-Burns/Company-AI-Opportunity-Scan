import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createScan,
  getScan,
  listEvidence,
  setDisambiguationCandidates
} from "./evidence/store";
import {
  initInterview,
  nextQuestion,
  ingestResponse,
  clearInterviewState
} from "./orchestrator";

// Mock the LLM to avoid real API calls in tests
vi.mock("@/lib/llm", () => ({
  complete: vi.fn().mockResolvedValue({
    raw: "",
    json: {
      candidates: [
        {
          question: { text: "What is your core service model?", kind: "short" },
          scores: { novelty: 0.8, coverageGain: 0.8, companyUnderstanding: 0.8, answerable: 0.8, specific: 0.8, conversational: 0.8, depthAppropriate: 0.8 }
        }
      ]
    },
    promptTokens: 100,
    completionTokens: 50
  })
}));

// Mock coordinatorPlan to return predictable dimensions
vi.mock("@/lib/interview/coordinator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/interview/coordinator")>();
  return {
    ...actual,
    coordinatorPlan: vi.fn().mockResolvedValue({
      lens: "business",
      depth: 1,
      complete: false,
      rationale: "Testing",
      candidateCount: 2
    })
  };
});

describe("Conversational Disambiguation & Zero-Hallucination Fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers Quick-Select question when multiple ambiguous candidates exist", async () => {
    const scanId = `test_disambig_multi_${Date.now()}`;
    createScan({
      id: scanId,
      company: "Acme Services",
      location: "Austin, TX",
      email: "owner@acme.com",
      retentionScrapedDays: 1,
      retentionAnswersDays: 1
    });

    setDisambiguationCandidates(scanId, [
      {
        id: "cand_1",
        title: "Acme Plumbing Services",
        url: "https://www.acmeplumbingaustin.com",
        snippet: "Residential plumbing and drain cleaning in Austin, TX.",
        domain: "acmeplumbingaustin.com",
        locationSnippet: "Austin, TX",
        score: 0.75,
        isAggregator: false
      },
      {
        id: "cand_2",
        title: "Acme IT Solutions",
        url: "https://www.acmeitsolutions.com",
        snippet: "Managed IT services and cybersecurity for Austin businesses.",
        domain: "acmeitsolutions.com",
        locationSnippet: "Austin, TX",
        score: 0.70,
        isAggregator: false
      }
    ]);

    initInterview(scanId);

    const q1 = await nextQuestion(scanId);
    expect(q1).not.toBeNull();
    expect(q1?.id).toBe("q1_disambig");
    expect(q1?.kind).toBe("choice");
    expect(q1?.choices?.length).toBe(3); // 2 candidates + "None of these"
    expect(q1?.choices?.[2]).toContain("None of these");

    // User confirms candidate 1
    const ok = await ingestResponse(scanId, "q1_disambig", q1!.choices![0]!);
    expect(ok).toBe(true);

    // Verify candidate was promoted to verified evidence & scan.website updated
    const scan = getScan(scanId);
    expect(scan?.website).toBe("https://www.acmeplumbingaustin.com");
    expect(scan?.disambiguationCandidates).toBeUndefined();

    const ev = listEvidence(scanId);
    const verifiedEv = ev.find((e) => e.kind === "SEARCH_SNIPPET_VERIFIED");
    expect(verifiedEv).toBeDefined();
    expect(verifiedEv?.source).toBe("https://www.acmeplumbingaustin.com");

    clearInterviewState(scanId);
  });

  it("strictly discards unverified candidate data when user selects 'None of these' (Zero Hallucination)", async () => {
    const scanId = `test_disambig_reject_${Date.now()}`;
    createScan({
      id: scanId,
      company: "Apex Tech",
      location: "Denver, CO",
      email: "founder@apextech.com",
      retentionScrapedDays: 1,
      retentionAnswersDays: 1
    });

    setDisambiguationCandidates(scanId, [
      {
        id: "cand_1",
        title: "Apex Solar Technologies",
        url: "https://www.apexsolar.com",
        snippet: "Solar panel installation in Denver.",
        domain: "apexsolar.com",
        score: 0.65,
        isAggregator: false
      }
    ]);

    initInterview(scanId);

    const q1 = await nextQuestion(scanId);
    expect(q1?.id).toBe("q1_disambig");

    // User rejects the match
    const ok = await ingestResponse(scanId, "q1_disambig", "No, that's a different company");
    expect(ok).toBe(true);

    const scan = getScan(scanId);
    expect(scan?.disambiguationCandidates).toBeUndefined();
    expect(scan?.website).toBe("");

    // Verify NO unverified external evidence was leaked
    const ev = listEvidence(scanId);
    const leakedEv = ev.find((e) => e.kind === "SEARCH_SNIPPET_VERIFIED" || e.kind === "SCRAPED_WEB");
    expect(leakedEv).toBeUndefined();

    clearInterviewState(scanId);
  });
});
