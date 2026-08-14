import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the LLM so the interview + synthesis can be tested deterministically
// without a network call or API key. vi.mock is hoisted to the top of the
// file, so the factory must not reference outer variables; we expose a getter
// and grab the mock fn after import.
vi.mock("@/lib/llm", () => {
  const fn = vi.fn();
  return {
    complete: fn,
    extractJson: (t: string) => {
      try {
        return JSON.parse(t);
      } catch {
        return null;
      }
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
  addEvidence(id, {
    kind: "SCRAPED_TECH",
    source: "https://acme.com",
    snippet: "uses hubspot",
    signal: "uses:hubspot",
    confidence: "medium"
  });
  addEvidence(id, {
    kind: "SCRAPED_WEB",
    source: "https://acme.com/about",
    snippet: "family logistics company",
    signal: "page:/about",
    confidence: "medium"
  });
}

function clearStores() {
  for (const s of allScans()) deleteScan(s.id);
  // Clear interview state map via the public getter (no public clear; recreate
  // by deleting each known id through getInterviewState returning undefined).
  // The state map is module-private; tests below use unique ids per case so
  // cross-test bleed is impossible.
}

function mockQuestion(text: string) {
  completeMock.mockResolvedValueOnce({
    json: { text, kind: "short" },
    text: JSON.stringify({ text }),
    tokensIn: 10,
    tokensOut: 5
  });
}

describe("Interview bounds (spec §7.1: hard stop at max)", () => {
  const id = "iv-max";

  beforeEach(() => {
    clearStores();
    setupScan(id);
    initInterview(id);
    completeMock.mockReset();
  });
  afterEach(() => {
    deleteScan(id);
  });

  it("never asks more than maxQuestions (12), even if model wants to", async () => {
    const answers: string[] = [];
    // Ask + answer 12 questions.
    for (let i = 0; i < 12; i++) {
      mockQuestion(`Question ${i + 1}`);
      const q = await nextQuestion(id);
      if (!q) break;
      answers.push(q.text);
      await ingestResponse(id, q.id, `answer ${i + 1}`);
    }
    expect(answers.length).toBe(12);
    // 13th call: model keeps returning a question, but hard stop must enforce max.
    mockQuestion("Question 13, more?");
    const q13 = await nextQuestion(id);
    expect(q13).toBeNull();
    expect(isInterviewFinished(id)).toBe(true);
  });

  it("can finish early once min reached via __COMPLETE__", async () => {
    // 8 = min; on the 9th call return COMPLETE → must finish.
    for (let i = 0; i < 8; i++) {
      mockQuestion(`Q${i + 1}`);
      const q = await nextQuestion(id);
      if (!q) break;
      await ingestResponse(id, q.id, `a${i + 1}`);
    }
    mockQuestion("__COMPLETE__");
    const q = await nextQuestion(id);
    expect(q).toBeNull();
    expect(isInterviewFinished(id)).toBe(true);
  });
});

describe("Interview fallback on LLM failure (graceful degradation, §7.1)", () => {
  const id = "iv-fallback";

  beforeEach(() => {
    clearStores();
    setupScan(id);
    initInterview(id);
    completeMock.mockReset();
  });
  afterEach(() => deleteScan(id));

  it("uses a fallback question when the LLM throws", async () => {
    completeMock.mockRejectedValueOnce(new Error("network down"));
    const q = await nextQuestion(id);
    expect(q).not.toBeNull();
    expect(q!.text.length).toBeGreaterThan(5);
  });

  it("uses a fallback question when the LLM returns garbage", async () => {
    completeMock.mockResolvedValueOnce({ json: {}, text: "not json", tokensIn: 0, tokensOut: 0 });
    const q = await nextQuestion(id);
    expect(q).not.toBeNull();
  });
});

describe("Synthesis evidence invariant (spec §7.1: omit unsupported claims)", () => {
  const id = "syn-test";

  beforeEach(() => {
    clearStores();
    setupScan(id);
    completeMock.mockReset();
  });
  afterEach(() => deleteScan(id));

  it("drops any area whose evidenceIds don't resolve to real evidence", async () => {
    const realIds = listEvidence(id).map((e) => e.id);
    expect(realIds.length).toBe(2);
    completeMock.mockResolvedValueOnce({
      json: {
        headline: "Acme: snapshot",
        areas: [
          { title: "Supported", summary: "s", example: "e", evidenceIds: [realIds[0]], gaps: [] },
          { title: "Unsupported", summary: "s2", example: "e2", evidenceIds: ["FAKE_ID"], gaps: [] },
          { title: "No ids", summary: "s3", example: "e3", evidenceIds: [], gaps: [] }
        ],
        notReadyNotes: [],
        salesSummary: "summary",
        recommendedQuestions: []
      },
      text: "",
      tokensIn: 0,
      tokensOut: 0
    });
    const { client, sales } = await synthesizeReports(id);
    expect(client.areas.length).toBe(1);
    expect(client.areas[0]!.title).toBe("Supported");
    expect(sales.areas.length).toBe(1);
    // Every cited id must exist in the evidence store.
    const real = new Set(listEvidence(id).map((e) => e.id));
    for (const a of client.areas) {
      expect(a.evidenceIds.length).toBeGreaterThan(0);
      for (const eid of a.evidenceIds) expect(real.has(eid)).toBe(true);
    }
  });

  it("produces a fallback report when the LLM fails (still evidence-backed)", async () => {
    completeMock.mockRejectedValueOnce(new Error("llm down"));
    const { client, sales } = await synthesizeReports(id);
    expect(client.areas.length).toBeGreaterThan(0);
    expect(sales.areas.length).toBeGreaterThan(0);
    const real = new Set(listEvidence(id).map((e) => e.id));
    for (const a of client.areas) for (const eid of a.evidenceIds) expect(real.has(eid)).toBe(true);
  });
});

// Keep the getter referenced so tree-shaking doesn't drop it in some setups.
void getInterviewState;
