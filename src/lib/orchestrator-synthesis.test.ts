import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Coverage-controlled interview + synthesis contract tests.
 *
 * The interview is now driven by a Coordinator that selects ONE dimension per
 * turn and a Specialist that returns 2–3 candidate questions. These tests mock
 * the LLM deterministically so the contracts (bounds, coverage guardrails,
 * candidate selection, evidence-omit invariants) are verified without a network.
 */
vi.mock("@/lib/llm", () => {
  const fn = vi.fn();
  return {
    complete: fn,
    extractJson: (t: string) => {
      try { return JSON.parse(t); } catch { return null; }
    },
    __completeMock: fn
  };
});

import * as llmModule from "@/lib/llm";
import { createScan, addEvidence, listEvidence, deleteScan, allScans } from "@/lib/evidence/store";
import { initInterview, nextQuestion, ingestResponse, isInterviewFinished, getInterviewState } from "@/lib/orchestrator";
import { synthesizeReports } from "@/lib/synthesis";
import { selectDimension, determineDepth, selectCandidate } from "@/lib/interview/coordinator";
import type { CandidateQuestion, DimensionCoverage, LensId } from "@/lib/interview/types";

const completeMock = (llmModule as unknown as { __completeMock: ReturnType<typeof vi.fn> }).__completeMock;

function setupScan(id: string) {
  createScan({
    id, company: "Acme", website: "https://acme.com", email: "a@acme.com",
    retentionScrapedDays: 90, retentionAnswersDays: 365
  });
  addEvidence(id, { kind: "SCRAPED_TECH", source: "https://acme.com", snippet: "uses hubspot", signal: "uses:hubspot", confidence: "medium" });
  addEvidence(id, { kind: "SCRAPED_WEB", source: "https://acme.com/about", snippet: "family logistics company", signal: "page:/about", confidence: "medium" });
}

function clearStores() {
  for (const s of allScans()) deleteScan(s.id);
}

/** Coordinator response: ONE lens + depth + optional coverage update + complete. */
function mockCoordinator(lens: LensId, depth = 1, opts: { complete?: boolean; coverageUpdate?: { dimension: LensId; coverage: "NOT_STARTED" | "LIGHT" | "ADEQUATE" | "DEEP" } } = {}) {
  completeMock.mockResolvedValueOnce({
    json: {
      lens,
      depth,
      coverageUpdate: opts.coverageUpdate ? {
        dimension: opts.coverageUpdate.dimension,
        coverage: opts.coverageUpdate.coverage,
        confidence: "medium" as const,
        keyFacts: [`${opts.coverageUpdate.dimension} fact`],
        knownUnknowns: [],
        evidenceIds: [],
        unresolvedGaps: [],
        answerRichness: "moderate" as const,
        notApplicable: false
      } : undefined,
      complete: opts.complete ?? false,
      rationale: "test",
      candidateCount: 2
    },
    text: "", tokensIn: 1, tokensOut: 1
  });
}

/** Specialist response: 2 candidates for the given lens. */
function mockCandidates(lens: LensId, q1: string, q2 = `alt-${lens}`, noveltyA = 0.7, noveltyB = 0.5) {
  completeMock.mockResolvedValueOnce({
    json: {
      candidates: [
        {
          question: { text: q1, kind: "short" },
          depth: 1,
          expectedSignal: `${lens}-sig-a`,
          scores: { novelty: noveltyA, coverageGain: 0.7, companyUnderstanding: 0.7, answerable: 0.8, specific: 0.6, conversational: 0.8, depthAppropriate: 0.7 },
          rationale: "a"
        },
        {
          question: { text: q2, kind: "short" },
          depth: 1,
          expectedSignal: `${lens}-sig-b`,
          scores: { novelty: noveltyB, coverageGain: 0.6, companyUnderstanding: 0.6, answerable: 0.8, specific: 0.5, conversational: 0.7, depthAppropriate: 0.7 },
          rationale: "b"
        }
      ]
    },
    text: "", tokensIn: 1, tokensOut: 1
  });
}

/** Drive one full turn: coordinator (1 call) + specialist (1 call). */
async function turn(id: string, lens: LensId, qText: string, opts?: { depth?: number; coverageUpdate?: { dimension: LensId; coverage: "NOT_STARTED" | "LIGHT" | "ADEQUATE" | "DEEP" }; complete?: boolean; noveltyA?: number }) {
  mockCoordinator(lens, opts?.depth ?? 1, { coverageUpdate: opts?.coverageUpdate, complete: opts?.complete });
  mockCandidates(lens, qText, `alt-${lens}`, opts?.noveltyA ?? 0.7);
  return nextQuestion(id);
}

describe("Interview bounds (spec §7.1: hard stop at max)", () => {
  const id = "iv-max";
  beforeEach(() => { clearStores(); setupScan(id); initInterview(id); completeMock.mockReset(); });
  afterEach(() => deleteScan(id));

  it("never asks more than maxQuestions (12), even if model wants to", async () => {
    const answers: string[] = [];
    const lensOrder: LensId[] = ["business", "operations", "systems", "data", "people"];
    for (let i = 0; i < 12; i++) {
      const lens = lensOrder[i % 5]!;
      const q = await turn(id, lens, `Q${i + 1}`, {
        coverageUpdate: { dimension: lens, coverage: "ADEQUATE" }
      });
      if (!q) break;
      answers.push(q.text);
      await ingestResponse(id, q.id, `a${i + 1}`);
    }
    expect(answers.length).toBe(12);
    const q13 = await turn(id, "business", "Q13");
    expect(q13).toBeNull();
    expect(isInterviewFinished(id)).toBe(true);
  });

  it("can finish early once min reached via coordinator complete=true", async () => {
    const lensOrder: LensId[] = ["business", "operations", "systems", "data", "people"];
    for (let i = 0; i < 8; i++) {
      const lens = lensOrder[i % 5]!;
      const q = await turn(id, lens, `Q${i + 1}`, { coverageUpdate: { dimension: lens, coverage: "ADEQUATE" } });
      if (!q) break;
      await ingestResponse(id, q.id, `a${i + 1}`);
    }
    mockCoordinator("business", 1, { complete: true });
    const q9 = await nextQuestion(id);
    expect(q9).toBeNull();
    expect(isInterviewFinished(id)).toBe(true);
  });
});

describe("Graceful degradation on LLM failure (§7.1)", () => {
  const id = "iv-fallback";
  beforeEach(() => { clearStores(); setupScan(id); initInterview(id); completeMock.mockReset(); });
  afterEach(() => deleteScan(id));

  it("uses a fallback question when the coordinator LLM throws", async () => {
    completeMock.mockRejectedValueOnce(new Error("network down"));
    const q = await nextQuestion(id);
    expect(q).not.toBeNull();
    expect(q!.text.length).toBeGreaterThan(5);
    expect(q!.lens).toBeDefined();
  });

  it("uses a fallback question when the specialist returns no candidates", async () => {
    mockCoordinator("operations", 1);
    completeMock.mockResolvedValueOnce({ json: { candidates: [] }, text: "", tokensIn: 0, tokensOut: 0 });
    const q = await nextQuestion(id);
    expect(q).not.toBeNull();
    expect(q!.text.length).toBeGreaterThan(5);
  });
});

describe("Coverage guardrails (deterministic, no LLM)", () => {
  function cov(coverage: "NOT_STARTED" | "LIGHT" | "ADEQUATE" | "DEEP" = "NOT_STARTED", notApplicable = false): DimensionCoverage {
    return {
      dimension: "operations", coverage, confidence: "medium", questionsAsked: 0, lastQuestionNumber: 0,
      keyFacts: [], knownUnknowns: [], evidenceIds: [], unresolvedGaps: [], depth: 1, answerRichness: "moderate", notApplicable
    };
  }
  function coverageMap(overrides: Map<LensId, DimensionCoverage> = new Map()): Map<LensId, DimensionCoverage> {
    const m = new Map<LensId, DimensionCoverage>();
    const all: LensId[] = ["business", "operations", "systems", "data", "people"];
    for (const l of all) m.set(l, overrides.get(l) ?? cov("NOT_STARTED"));
    return m;
  }

  it("overrides a consecutive repeat when other dimensions remain under-ADEQUATE", () => {
    const m = coverageMap();
    m.set("operations", cov("LIGHT"));
    const r = selectDimension("operations", m, ["operations"], 2);
    expect(r.dimension).not.toBe("operations");
    expect(r.overridden).toBe(true);
  });

  it("allows a consecutive repeat when every other dimension is ADEQUATE/DEEP or N/A", () => {
    const m = coverageMap();
    m.set("operations", cov("LIGHT"));
    for (const l of ["business", "systems", "data", "people"] as LensId[]) m.set(l, cov("ADEQUATE"));
    const r = selectDimension("operations", m, ["operations"], 2);
    expect(r.dimension).toBe("operations");
    expect(r.overridden).toBe(false);
  });

  it("prefers a NOT_STARTED dimension over depth on an ADEQUATE+ dimension", () => {
    const m = coverageMap();
    m.set("operations", cov("ADEQUATE"));
    const r = selectDimension("operations", m, ["business"], 5);
    expect(r.dimension).not.toBe("operations");
    expect(r.overridden).toBe(true);
  });
});

describe("Adaptive depth (deterministic)", () => {
  function cov(coverage: "NOT_STARTED" | "LIGHT" | "ADEQUATE" | "DEEP", richness: "thin" | "moderate" | "rich" = "moderate", gaps: string[] = [], na = false): DimensionCoverage {
    return {
      dimension: "operations", coverage, confidence: "medium", questionsAsked: 1, lastQuestionNumber: 1,
      keyFacts: [], knownUnknowns: [], evidenceIds: [], unresolvedGaps: gaps, depth: 1, answerRichness: richness, notApplicable: na
    };
  }
  function map(c: DimensionCoverage): Map<LensId, DimensionCoverage> {
    const m = new Map<LensId, DimensionCoverage>();
    for (const l of ["business", "operations", "systems", "data", "people"] as LensId[]) m.set(l, l === "operations" ? c : cov("NOT_STARTED"));
    return m;
  }

  it("simplifies (depth -1) on thin answers with no flagged gap", () => {
    const r = determineDepth("operations", map(cov("LIGHT", "thin", [])), 3);
    expect(r.depth).toBe(2);
  });

  it("deepens (+1) when a thin answer reveals an important gap", () => {
    const r = determineDepth("operations", map(cov("LIGHT", "thin", ["important gap"])), 2);
    expect(r.depth).toBe(3);
  });

  it("caps at depth 2 when the dimension is already ADEQUATE with no gaps", () => {
    const r = determineDepth("operations", map(cov("ADEQUATE", "rich", [])), 5);
    expect(r.depth).toBe(2);
  });

  it("stays at depth 1 when the dimension is not-applicable", () => {
    const r = determineDepth("operations", map(cov("ADEQUATE", "rich", [], true)), 4);
    expect(r.depth).toBe(1);
  });
});

describe("Candidate selection (coordinator picks ONE)", () => {
  function cand(text: string, novelty: number, lens: LensId = "operations"): CandidateQuestion {
    return {
      lens, depth: 1, question: { text, kind: "short" },
      scores: { novelty, coverageGain: 0.6, companyUnderstanding: 0.6, answerable: 0.8, specific: 0.6, conversational: 0.8, depthAppropriate: 0.7 },
      rationale: text
    };
  }

  it("picks the higher-quality candidate", () => {
    const picked = selectCandidate([cand("low", 0.2), cand("high", 0.9)], []);
    expect(picked!.selected.question.text).toBe("high");
  });

  it("penalizes candidates near-duplicating an already-asked question", () => {
    const dup = cand("What software does your team rely on to run the business?", 0.9);
    const other = cand("How does information move between those systems?", 0.5);
    const picked = selectCandidate([dup, other], ["What software does your team rely on to run the business?"]);
    // The duplicate should be penalized enough that the different question wins.
    expect(picked!.selected.question.text).toBe("How does information move between those systems?");
  });
});

describe("Synthesis evidence invariant (spec §7.1: omit unsupported claims)", () => {
  const id = "syn-test";
  beforeEach(() => { clearStores(); setupScan(id); completeMock.mockReset(); });
  afterEach(() => deleteScan(id));

  it("drops any opportunity whose evidenceIds don't resolve to real evidence", async () => {
    const realIds = listEvidence(id).map((e) => e.id);
    expect(realIds.length).toBe(2);
    completeMock.mockResolvedValueOnce({
      json: {
        headline: "Acme: snapshot",
        companySnapshot: "A family logistics company.",
        dimensionsLearned: [
          { dimension: "business", whatWeLearned: "Family logistics company", confidence: "medium", evidenceIds: [realIds[1]!] },
          { dimension: "operations", whatWeLearned: "Manual quoting", confidence: "low", evidenceIds: ["FAKE"] }
        ],
        opportunities: [
          { name: "Supported", whatWeHeard: "w", whyItMayMatter: "m", evidenceIds: [realIds[0]], whatRemainsUnknown: [], recommendedDeeperInvestigation: [] },
          { name: "Unsupported", whatWeHeard: "w2", whyItMayMatter: "m2", evidenceIds: ["FAKE_ID"], whatRemainsUnknown: [], recommendedDeeperInvestigation: [] }
        ],
        questionsWorthInvestigating: ["How much time does quoting take?"],
        remainingUncertainty: [{ unknown: "Quote volume", whyItMatters: "scale", evidenceNeeded: "weekly count" }],
        whatsNext: "Investigate further.",
        salesSummary: "summary",
        contradictions: []
      },
      text: "", tokensIn: 0, tokensOut: 0
    });
    const { client, sales } = await synthesizeReports(id);
    expect(client.opportunities.length).toBe(1);
    expect(client.opportunities[0]!.name).toBe("Supported");
    // The dimension with a fake id keeps its real-text but evidenceIds filtered to real ones;
    // the "business" dimension (with a real id) survives.
    expect(client.dimensionsLearned.find((d) => d.dimension === "business")).toBeDefined();
    const real = new Set(listEvidence(id).map((e) => e.id));
    for (const o of client.opportunities) for (const eid of o.evidenceIds) expect(real.has(eid)).toBe(true);
    for (const d of client.dimensionsLearned) for (const eid of d.evidenceIds) expect(real.has(eid)).toBe(true);
    expect(sales.opportunities.length).toBe(1);
  });

  it("produces a fallback report when the LLM fails (still evidence-backed)", async () => {
    completeMock.mockRejectedValueOnce(new Error("llm down"));
    const { client, sales } = await synthesizeReports(id);
    expect(client.opportunities.length).toBe(0); // no manufactured opportunities
    expect(client.whatsNext.length).toBeGreaterThan(0);
    expect(sales.dimensionsLearned).toBeDefined();
  });
});

void getInterviewState;
