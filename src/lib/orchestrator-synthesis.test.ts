import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the LLM so the interview + synthesis can be tested deterministically
// without a network call or API key. vi.mock is hoisted; the factory must not
// reference outer variables, so we expose a getter.
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

const completeMock = (llmModule as unknown as { __completeMock: ReturnType<typeof vi.fn> }).__completeMock;

function setupScan(id: string) {
  createScan({
    id,
    company: "Acme",
    website: "https://acme.com",
    email: "a@acme.com",
    retentionScrapedDays: 90,
    retentionAnswersDays: 365
  });
  addEvidence(id, { kind: "SCRAPED_TECH", source: "https://acme.com", snippet: "uses hubspot", signal: "uses:hubspot", confidence: "medium" });
  addEvidence(id, { kind: "SCRAPED_WEB", source: "https://acme.com/about", snippet: "family logistics company", signal: "page:/about", confidence: "medium" });
}

function clearStores() {
  for (const s of allScans()) deleteScan(s.id);
}

/** Coordinator response (1st call per turn). */
function mockCoordinator(lenses: string[], complete = false) {
  completeMock.mockResolvedValueOnce({
    json: {
      lenses,
      weights: { relevance: 0.2, uncertaintyReduction: 0.25, businessSignificance: 0.2, novelty: 0.15, depthPotential: 0.1, conversationalNaturalness: 0.1 },
      complete,
      rationale: "test"
    },
    text: "", tokensIn: 1, tokensOut: 1
  });
}

/** Persona candidate response (one per lens the coordinator selected). */
function mockPersona(lens: string, text: string, opts: { novelty?: number } = {}) {
  completeMock.mockResolvedValueOnce({
    json: {
      question: { text, kind: "short" },
      perspective: {
        beliefs: [`${lens} belief`],
        uncertainties: [`${lens} uncertainty`],
        potentialOpportunity: `${lens} opportunity`,
        evidenceRefs: []
      },
      scores: { relevance: 0.7, uncertaintyReduction: 0.7, businessSignificance: 0.7, novelty: opts.novelty ?? 0.7, depthPotential: 0.5, conversationalNaturalness: 0.8 },
      rationale: "test"
    },
    text: "", tokensIn: 1, tokensOut: 1
  });
}

/** Drive one full question turn: coordinator + N persona candidates. */
async function turn(id: string, lenses: string[], qText: string, opts?: { novelty?: number; complete?: boolean }) {
  mockCoordinator(lenses, opts?.complete ?? false);
  for (const l of lenses) mockPersona(l, l === lenses[0] ? qText : `alt-${l}`);
  return nextQuestion(id);
}

describe("Interview bounds (spec §7.1: hard stop at max)", () => {
  const id = "iv-max";
  beforeEach(() => { clearStores(); setupScan(id); initInterview(id); completeMock.mockReset(); });
  afterEach(() => deleteScan(id));

  it("never asks more than maxQuestions (12), even if model wants to", async () => {
    const answers: string[] = [];
    for (let i = 0; i < 12; i++) {
      const q = await turn(id, ["operations", "business"], `Q${i + 1}`);
      if (!q) break;
      answers.push(q.text);
      await ingestResponse(id, q.id, `a${i + 1}`);
    }
    expect(answers.length).toBe(12);
    // 13th turn: coordinator + personas still fire, but hard stop must enforce max.
    const q13 = await turn(id, ["operations"], "Q13");
    expect(q13).toBeNull();
    expect(isInterviewFinished(id)).toBe(true);
  });

  it("can finish early once min reached via coordinator complete=true", async () => {
    for (let i = 0; i < 8; i++) {
      const q = await turn(id, ["operations", "business"], `Q${i + 1}`);
      if (!q) break;
      await ingestResponse(id, q.id, `a${i + 1}`);
    }
    // 9th turn: coordinator says complete → must finish.
    mockCoordinator(["operations"], true);
    const q9 = await nextQuestion(id);
    expect(q9).toBeNull();
    expect(isInterviewFinished(id)).toBe(true);
  });
});

describe("Interview fallback on LLM failure (graceful degradation, §7.1)", () => {
  const id = "iv-fallback";
  beforeEach(() => { clearStores(); setupScan(id); initInterview(id); completeMock.mockReset(); });
  afterEach(() => deleteScan(id));

  it("uses a fallback question when the coordinator LLM throws", async () => {
    completeMock.mockRejectedValueOnce(new Error("network down"));
    const q = await nextQuestion(id);
    expect(q).not.toBeNull();
    expect(q!.text.length).toBeGreaterThan(5);
    expect(q!.lens).toBeDefined(); // fallback questions carry a lens too
  });

  it("uses a fallback question when all persona candidates fail", async () => {
    mockCoordinator(["operations", "business"]);
    completeMock.mockRejectedValueOnce(new Error("persona down"));
    completeMock.mockRejectedValueOnce(new Error("persona down"));
    const q = await nextQuestion(id);
    expect(q).not.toBeNull();
    expect(q!.text.length).toBeGreaterThan(5);
  });
});

describe("Multi-perspective architecture (spec §7.2)", () => {
  const id = "iv-arch";
  beforeEach(() => { clearStores(); setupScan(id); initInterview(id); completeMock.mockReset(); });
  afterEach(() => deleteScan(id));

  it("coordinator selects lenses; personas generate candidates; scoring picks one", async () => {
    const q = await turn(id, ["operations", "business", "data"], "Where do handoffs stall?");
    expect(q).not.toBeNull();
    expect(q!.text).toBe("Where do handoffs stall?");
    expect(q!.lens).toBe("operations"); // first lens in coordinator order
  });

  it("higher novelty score wins under equal weights", async () => {
    mockCoordinator(["operations", "business"]);
    // operations: low novelty; business: high novelty → business should win.
    completeMock.mockResolvedValueOnce({
      json: { question: { text: "ops-q" }, perspective: { beliefs: [], uncertainties: [], potentialOpportunity: "", evidenceRefs: [] }, scores: { relevance: 0.5, uncertaintyReduction: 0.5, businessSignificance: 0.5, novelty: 0.1, depthPotential: 0.5, conversationalNaturalness: 0.5 }, rationale: "" },
      text: "", tokensIn: 0, tokensOut: 0
    });
    completeMock.mockResolvedValueOnce({
      json: { question: { text: "biz-q" }, perspective: { beliefs: [], uncertainties: [], potentialOpportunity: "", evidenceRefs: [] }, scores: { relevance: 0.5, uncertaintyReduction: 0.5, businessSignificance: 0.5, novelty: 0.9, depthPotential: 0.5, conversationalNaturalness: 0.5 }, rationale: "" },
      text: "", tokensIn: 0, tokensOut: 0
    });
    const q = await nextQuestion(id);
    expect(q!.text).toBe("biz-q");
    expect(q!.lens).toBe("business");
  });

  it("persona perspective state persists across turns (memory)", async () => {
    const q1 = await turn(id, ["operations"], "What's your team size?");
    await ingestResponse(id, q1!.id, "12 people");
    const q2 = await turn(id, ["operations", "business"], "What bottleneck repeats most?");
    await ingestResponse(id, q2!.id, "manual estimates");
    const st = getInterviewState(id)!;
    // The operations perspective should have been updated and retained.
    const ops = st.perspectives.get("operations");
    expect(ops).toBeDefined();
    expect(ops!.updatedAt).toBeGreaterThan(0);
    expect(ops!.potentialOpportunity).toContain("operations opportunity");
  });

  it("question carries the lens that generated it", async () => {
    const q = await turn(id, ["data", "risk"], "How is your data stored?");
    expect(q!.lens).toBe("data");
  });
});

describe("Synthesis evidence invariant (spec §7.1: omit unsupported claims)", () => {
  const id = "syn-test";
  beforeEach(() => { clearStores(); setupScan(id); completeMock.mockReset(); });
  afterEach(() => deleteScan(id));

  it("drops any area whose evidenceIds don't resolve to real evidence", async () => {
    const realIds = listEvidence(id).map((e) => e.id);
    expect(realIds.length).toBe(2);
    completeMock.mockResolvedValueOnce({
      json: {
        headline: "Acme: snapshot",
        areas: [
          { title: "Supported", summary: "s", example: "e", evidenceIds: [realIds[0]], gaps: [], lens: "operations" },
          { title: "Unsupported", summary: "s2", example: "e2", evidenceIds: ["FAKE_ID"], gaps: [], lens: "business" },
          { title: "No ids", summary: "s3", example: "e3", evidenceIds: [], gaps: [], lens: "data" }
        ],
        perspectives: [
          { lens: "operations", summary: "ops view", opportunity: "x", uncertainty: "y", evidenceIds: [realIds[1]] },
          { lens: "business", summary: "biz view", opportunity: "x", uncertainty: "y", evidenceIds: ["FAKE"] }
        ],
        notReadyNotes: [],
        salesSummary: "summary",
        recommendedQuestions: []
      },
      text: "", tokensIn: 0, tokensOut: 0
    });
    const { client, sales } = await synthesizeReports(id);
    expect(client.areas.length).toBe(1);
    expect(client.areas[0]!.title).toBe("Supported");
    expect(client.areas[0]!.lens).toBe("operations");
    // Perspectives: only the one with real evidence survives.
    expect(client.perspectives.length).toBe(1);
    expect(client.perspectives[0]!.lens).toBe("operations");
    expect(sales.areas.length).toBe(1);
    const real = new Set(listEvidence(id).map((e) => e.id));
    for (const a of client.areas) for (const eid of a.evidenceIds) expect(real.has(eid)).toBe(true);
    for (const p of client.perspectives) for (const eid of p.evidenceIds) expect(real.has(eid)).toBe(true);
  });

  it("produces a fallback report when the LLM fails (still evidence-backed)", async () => {
    completeMock.mockRejectedValueOnce(new Error("llm down"));
    const { client, sales } = await synthesizeReports(id);
    expect(client.areas.length).toBeGreaterThan(0);
    expect(sales.areas.length).toBeGreaterThan(0);
    expect(client.perspectives).toBeDefined();
    const real = new Set(listEvidence(id).map((e) => e.id));
    for (const a of client.areas) for (const eid of a.evidenceIds) expect(real.has(eid)).toBe(true);
  });
});

void getInterviewState;
