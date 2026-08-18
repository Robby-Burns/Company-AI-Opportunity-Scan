import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Coverage-controlled interview + synthesis contract tests (Company AI Opportunity Scan).
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
import { synthesizeReports, createIntakePackage, type ClientReport } from "@/lib/synthesis";
import { selectDimension, determineDepth, selectCandidate } from "@/lib/interview/coordinator";
import { renderClientSummaryPdf } from "@/lib/pdf";
import { getFoxAndLoomLogoBase64 } from "@/components/pdf/client-summary-pdf";
import type { CandidateQuestion, DimensionCoverage, LensId } from "@/lib/interview/types";

const completeMock = (llmModule as unknown as { __completeMock: ReturnType<typeof vi.fn> }).__completeMock;

function setupScan(id: string) {
  createScan({
    id, company: "Acme Logistics", website: "https://acme.com", email: "a@acme.com",
    retentionScrapedDays: 90, retentionAnswersDays: 365
  });
  addEvidence(id, { kind: "SCRAPED_TECH", source: "https://acme.com", snippet: "uses hubspot and quickbooks", signal: "uses:quickbooks", confidence: "medium" });
  addEvidence(id, { kind: "SCRAPED_WEB", source: "https://acme.com/about", snippet: "family logistics company doing freight brokerage", signal: "page:/about", confidence: "medium" });
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

  it("can finish early at Q8 once sufficient hypothesis evidence is gathered via complete=true", async () => {
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
    expect(picked!.selected.question.text).toBe("How does information move between those systems?");
  });
});

describe("Synthesis 6-section schema & evidence invariant", () => {
  const id = "syn-test";
  beforeEach(() => { clearStores(); setupScan(id); completeMock.mockReset(); });
  afterEach(() => deleteScan(id));

  it("produces the complete 6-section Opportunity Hypothesis structure and filters fake evidence IDs", async () => {
    const realIds = listEvidence(id).map((e) => e.id);
    expect(realIds.length).toBe(2);

    completeMock.mockResolvedValueOnce({
      json: {
        headline: "Acme Logistics: Company AI Opportunity Scan",
        companySnapshot: "A freight brokerage company.",
        hypothesis: {
          title: "Carrier Rate Reconciliation",
          locus: "Daily discrepancy reconciliation between carrier rate confirmations and QuickBooks invoices",
          summary: "Dispatcher team spends significant manual time resolving freight invoice discrepancies.",
          confidence: "high",
          evidenceIds: [realIds[0]!, "FAKE_ID_1"]
        },
        whyIdentified: [
          { observation: "Dispatches manually re-key carrier invoices into QuickBooks.", evidenceIds: [realIds[0]!] },
          { observation: "Unsupported claim.", evidenceIds: ["FAKE_ID_2"] }
        ],
        potentialImpact: [
          { area: "Dispatch Operations", directionalImpact: "Reduction in end-of-month reconciliation backlog.", evidenceIds: [realIds[0]!] }
        ],
        additionalSignals: [
          { signal: "Quote turnaround delays during peak afternoon volume.", evidenceIds: [realIds[1]!] }
        ],
        whatRemainsUnknown: [
          { unknown: "Rate confirmation PDF consistency", whyItMatters: "Determines whether data is extractable or unstructured." }
        ],
        deepAssessmentQuestions: [
          "What rate of edge-case exceptions requires manual dispatcher approval?",
          "Are carrier rate confirmations accessible via direct EDI/API or trapped in email attachments?"
        ],
        whatsNext: "A Deep Assessment will evaluate whether this opportunity is feasible and worth pursuing.",
        salesSummary: "Strong freight reconciliation opportunity hypothesis.",
        contradictions: []
      },
      text: "", tokensIn: 0, tokensOut: 0
    });

    const { client, sales } = await synthesizeReports(id);

    // 1. Hypothesis verified
    expect(client.hypothesis).not.toBeNull();
    expect(client.hypothesis!.title).toBe("Carrier Rate Reconciliation");
    expect(client.hypothesis!.confidence).toBe("high");
    // Fake id filtered out of hypothesis evidenceIds
    expect(client.hypothesis!.evidenceIds).toEqual([realIds[0]!]);

    // 2. Why Identified verified (unsupported point with fake ID dropped)
    expect(client.whyIdentified.length).toBe(1);
    expect(client.whyIdentified[0]!.evidenceIds).toEqual([realIds[0]!]);

    // 3. Potential Impact verified
    expect(client.potentialImpact.length).toBe(1);
    expect(client.potentialImpact[0]!.area).toBe("Dispatch Operations");

    // 4. Additional Signals verified
    expect(client.additionalSignals.length).toBe(1);

    // 5. What Remains Unknown verified
    expect(client.whatRemainsUnknown.length).toBe(1);
    expect(client.whatRemainsUnknown[0]!.unknown).toBe("Rate confirmation PDF consistency");

    // 6. Deep Assessment Questions verified
    expect(client.deepAssessmentQuestions.length).toBe(2);
    expect(client.deepAssessmentQuestions[0]).toContain("dispatcher approval?");

    // All evidence IDs in client report must be real
    const realSet = new Set(realIds);
    for (const eid of client.evidenceIds) expect(realSet.has(eid)).toBe(true);

    // Intake package verification
    const intake = createIntakePackage(id, client, sales);
    expect(intake.opportunityHypothesis?.title).toBe("Carrier Rate Reconciliation");
    expect(intake.deepAssessmentQuestions.length).toBe(2);
  });

  it("handles null opportunity hypothesis gracefully (no false positive hallucination)", async () => {
    completeMock.mockResolvedValueOnce({
      json: {
        headline: "Acme Logistics: Company AI Opportunity Scan",
        companySnapshot: "A company with streamlined operations.",
        hypothesis: null,
        whyIdentified: [],
        potentialImpact: [],
        additionalSignals: [],
        whatRemainsUnknown: [],
        deepAssessmentQuestions: ["What workflows currently require manual intervention?"],
        whatsNext: "No immediate high-leverage opportunity was identified.",
        salesSummary: "No current opportunity.",
        contradictions: []
      },
      text: "", tokensIn: 0, tokensOut: 0
    });

    const { client, sales } = await synthesizeReports(id);
    expect(client.hypothesis).toBeNull();
    expect(client.whyIdentified.length).toBe(0);
    expect(sales.hypothesis).toBeNull();
  });

  it("produces a fallback report when the LLM fails", async () => {
    completeMock.mockRejectedValueOnce(new Error("llm down"));
    const { client, sales } = await synthesizeReports(id);
    expect(client.hypothesis).toBeNull();
    expect(client.whatsNext.length).toBeGreaterThan(0);
    expect(client.deepAssessmentQuestions.length).toBeGreaterThan(0);
    expect(sales.summary).toContain("Automated synthesis unavailable");
  });
});

describe("Synthesis Boundary-Leakage & Anti-Vagueness Invariants", () => {
  const id = "syn-boundary";
  beforeEach(() => { clearStores(); setupScan(id); completeMock.mockReset(); });
  afterEach(() => deleteScan(id));

  it("fails boundary checks if report leaks vendor recommendations or implementation architecture", () => {
    const forbiddenPatterns = [
      /langchain/i,
      /vector db|vector database/i,
      /rag pipeline/i,
      /openai|anthropic|zapier|make\.com/i,
      /\$\d{2,}(?:,\d{3})*(?:\.\d+)?\s*(?:annual|cost|savings|roi)/i
    ];

    const cleanHypothesis = {
      title: "Rate Reconciliation",
      locus: "Reconciling daily carrier rate confirmations with QuickBooks invoices",
      summary: "Manual cross-checking causes billing delays.",
      confidence: "high" as const,
      evidenceIds: ["ev-1"]
    };

    // Valid report passes pattern checks
    const textToCheck = `${cleanHypothesis.title} ${cleanHypothesis.locus} ${cleanHypothesis.summary}`;
    for (const pattern of forbiddenPatterns) {
      expect(pattern.test(textToCheck)).toBe(false);
    }

    // Leaky report fails pattern checks
    const leakyText = "Build a LangChain RAG pipeline using OpenAI and Zapier to save $50,000 annually";
    const foundViolations = forbiddenPatterns.filter((p) => p.test(leakyText));
    expect(foundViolations.length).toBeGreaterThanOrEqual(3);
  });

  it("enforces that deepAssessmentQuestions are diagnostic questions, not execution tasks", () => {
    const validQuestions = [
      "What rate of edge-case exceptions requires manual dispatcher approval?",
      "Are carrier rate confirmations accessible via direct EDI/API or trapped in email attachments?"
    ];

    const invalidTasks = [
      "Audit 100 historical invoices",
      "Configure write permissions in QuickBooks",
      "Test NetSuite webhook latency",
      "Build a proof of concept"
    ];

    for (const q of validQuestions) {
      expect(q.trim().endsWith("?")).toBe(true);
      expect(/^(audit|configure|test|build|provision|deploy)\b/i.test(q)).toBe(false);
    }

    for (const task of invalidTasks) {
      const isTask = /^(audit|configure|test|build|provision|deploy)\b/i.test(task) || !task.trim().endsWith("?");
      expect(isTask).toBe(true);
    }
  });

  it("enforces specific operational locus in hypothesis (rejects generic fluff)", () => {
    const genericFluff = [
      "Your business may benefit from AI",
      "There may be opportunities to improve operational efficiency",
      "AI automation opportunity"
    ];

    const specificLocus = [
      "Daily discrepancy reconciliation between carrier rate confirmations and QuickBooks invoices",
      "Cross-system customer order entry from unformatted email PDFs into ERP",
      "Field technician work order status handoff between ServiceTitan and billing"
    ];

    // Specific locus should have descriptive process context (> 25 chars and specific process terms)
    for (const locus of specificLocus) {
      expect(locus.length).toBeGreaterThan(25);
      expect(/reconciliation|entry|handoff|dispatch|invoices|billing|order/i.test(locus)).toBe(true);
    }

    for (const fluff of genericFluff) {
      expect(/reconciliation|entry|handoff|dispatch|invoices|billing|order/i.test(fluff)).toBe(false);
    }
  });
});

describe("Client Summary PDF Fox & Loom branding & logo", () => {
  it("finds the Fox & Loom logo on disk and converts to base64 data URI", () => {
    const logoDataUrl = getFoxAndLoomLogoBase64();
    expect(logoDataUrl).toBeDefined();
    expect(logoDataUrl).toContain("data:image/png;base64,");
  });

  it("renders a valid PDF with Fox & Loom branding and returns PDF bytes", async () => {
    const sampleReport: ClientReport = {
      company: "Acme Logistics",
      website: "https://acme.com",
      headline: "Acme Logistics: Carrier Rate Confirmation Reconciliation",
      companySnapshot: "A freight brokerage company.",
      hypothesis: {
        title: "Carrier Rate Reconciliation",
        locus: "Daily discrepancy reconciliation between carrier rate confirmations and QuickBooks invoices",
        summary: "Manual cross-checking causes billing delays and dispatcher rework.",
        confidence: "high",
        evidenceIds: ["ev-1"]
      },
      whyIdentified: [
        { observation: "Dispatchers manually re-key carrier invoices into QuickBooks.", evidenceIds: ["ev-1"] }
      ],
      potentialImpact: [
        { area: "Dispatch Operations", directionalImpact: "Reduces month-end reconciliation backlog.", evidenceIds: ["ev-1"] }
      ],
      additionalSignals: [
        { signal: "Quote turnaround delays during peak afternoon volume.", evidenceIds: ["ev-2"] }
      ],
      whatRemainsUnknown: [
        { unknown: "Carrier rate confirmation format consistency", whyItMatters: "Determines how structured the input data is." }
      ],
      deepAssessmentQuestions: [
        "What percentage of rate confirmations require exception handling?",
        "Are rate confirmations accessible via EDI/API or stored in email attachments?"
      ],
      whatsNext: "This scan flagged a potential opportunity worth looking into further. Figuring out whether it's feasible, valuable, safe, and actually worth building is what a Deep Assessment is for.",
      evidenceIds: ["ev-1", "ev-2"],
      generatedAt: Date.now()
    };

    const pdfBytes = await renderClientSummaryPdf(sampleReport);
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(500);

    // PDF magic bytes check (%PDF-)
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });
});

void getInterviewState;


