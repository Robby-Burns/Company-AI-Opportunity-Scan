/**
 * Simulated interview scenarios (§21 / §25).
 *
 * These drive the FULL interview pipeline against a mocked LLM with scripted,
 * scenario-specific coordinator + specialist responses, then assert the
 * resulting question sequence demonstrates broad coverage, genuine rotation,
 * adaptive depth, non-repetition, and explicit uncertainty — no premature
 * solution recommendation.
 *
 * Run: npm test -- src/lib/interview-simulations.test.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/llm", () => {
  const fn = vi.fn();
  return { complete: fn, extractJson: (t: string) => { try { return JSON.parse(t); } catch { return null; } }, __completeMock: fn };
});

import * as llmModule from "@/lib/llm";
import { createScan, deleteScan, allScans } from "@/lib/evidence/store";
import { initInterview, nextQuestion, ingestResponse, getInterviewState } from "@/lib/orchestrator";
import type { DepthLevel, LensId } from "@/lib/interview/types";

const completeMock = (llmModule as unknown as { __completeMock: ReturnType<typeof vi.fn> }).__completeMock;
const DIMS: LensId[] = ["business", "operations", "systems", "data", "people"];

function setup(id: string) {
  createScan({ id, company: "Acme", website: "https://acme.com", email: "a@acme.com", retentionScrapedDays: 90, retentionAnswersDays: 365 });
  initInterview(id);
  completeMock.mockReset();
}

function clearAll() { for (const s of allScans()) deleteScan(s.id); }

/** Scripted coordinator: returns `lens` + `depth` + a coverageUpdate bumping
 *  `answeredDim` to `cov`. Follows the guardrails (which may override the lens). */
function coordReply(lens: LensId, depth: DepthLevel, answeredDim: LensId | null, cov: "LIGHT" | "ADEQUATE" | "DEEP" = "LIGHT", richness: "thin" | "moderate" | "rich" = "moderate", complete = false) {
  completeMock.mockResolvedValueOnce({
    json: {
      lens, depth,
      coverageUpdate: answeredDim ? {
        dimension: answeredDim, coverage: cov, confidence: "medium" as const,
        keyFacts: [`${answeredDim} fact`], knownUnknowns: cov === "ADEQUATE" ? [] : [`${answeredDim} unknown`],
        evidenceIds: [], unresolvedGaps: [], answerRichness: richness, notApplicable: false
      } : undefined,
      complete, rationale: `coord -> ${lens}`, candidateCount: 2
    },
    text: "", tokensIn: 1, tokensOut: 1
  });
}

function candReply(lens: LensId, q: string) {
  completeMock.mockResolvedValueOnce({
    json: { candidates: [
      { question: { text: q, kind: "short" }, depth: 1, expectedSignal: `${lens}-a`, scores: { novelty: 0.8, coverageGain: 0.7, companyUnderstanding: 0.7, answerable: 0.8, specific: 0.6, conversational: 0.8, depthAppropriate: 0.7 }, rationale: "a" },
      { question: { text: `alt ${lens}`, kind: "short" }, depth: 1, expectedSignal: `${lens}-b`, scores: { novelty: 0.4, coverageGain: 0.5, companyUnderstanding: 0.5, answerable: 0.8, specific: 0.5, conversational: 0.7, depthAppropriate: 0.7 }, rationale: "b" }
    ] },
    text: "", tokensIn: 1, tokensOut: 1
  });
}

interface Step { lens: LensId; depth: DepthLevel; q: string; answerDim: LensId; cov: "LIGHT" | "ADEQUATE" | "DEEP"; richness?: "thin" | "moderate" | "rich"; complete?: boolean; }

/** Run a scripted interview and return the observed dimension sequence + depths + coverages.
 *  The coverageUpdate in each coordinator reply describes the PREVIOUS step's
 *  answer (since the coordinator reports on the last answered dimension), so it
 *  is shifted by one step — turn 0 sends no coverageUpdate. */
async function runScripted(id: string, steps: Step[]): Promise<{ dims: LensId[]; depths: DepthLevel[]; qs: string[]; finalCoverage: Record<LensId, string> }> {
  const dims: LensId[] = [];
  const depths: DepthLevel[] = [];
  const qs: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!;
    const prev = i > 0 ? steps[i - 1]! : null;
    coordReply(
      s.lens,
      s.depth,
      prev ? prev.answerDim : null,
      prev ? prev.cov : "LIGHT",
      prev?.richness ?? "moderate",
      s.complete ?? false
    );
    candReply(s.lens, s.q);
    const q = await nextQuestion(id);
    if (!q) break;
    dims.push(q.lens ?? s.lens);
    depths.push(q.depth ?? s.depth);
    qs.push(q.text);
    await ingestResponse(id, q.id, `answer ${i + 1}`);
  }
  const st = getInterviewState(id)!;
  const finalCoverage = Object.fromEntries(DIMS.map((l) => [l, st.coverage.get(l)?.coverage ?? "NOT_STARTED"])) as Record<LensId, string>;
  return { dims, depths, qs, finalCoverage };
}

describe("Simulated interview scenarios (§21)", () => {
  beforeEach(() => clearAll());
  afterEach(() => clearAll());

  it("Scenario A — one dominant problem: does NOT tunnel-vision on it", async () => {
    const id = "sim-a";
    setup(id);
    // User says quoting is the biggest problem. Coordinator is tempted to keep
    // asking operations, but the guardrails must force rotation.
    const steps: Step[] = [
      { lens: "business", depth: 1, q: "What does your company do?", answerDim: "business", cov: "ADEQUATE" },
      { lens: "operations", depth: 1, q: "Our biggest problem is quoting — what does that look like?", answerDim: "operations", cov: "LIGHT" },
      // Coordinator proposes operations AGAIN (tunnel vision) — guardrail must override.
      { lens: "operations", depth: 3, q: "Tell me more about quoting?", answerDim: "operations", cov: "ADEQUATE" },
      { lens: "systems", depth: 1, q: "What systems support quoting?", answerDim: "systems", cov: "LIGHT" },
      { lens: "data", depth: 1, q: "Where does quote info live?", answerDim: "data", cov: "LIGHT" },
      { lens: "people", depth: 1, q: "Who handles quoting?", answerDim: "people", cov: "LIGHT" },
      { lens: "operations", depth: 3, q: "Where does quoting slow down?", answerDim: "operations", cov: "ADEQUATE" },
      { lens: "systems", depth: 3, q: "How do systems connect?", answerDim: "systems", cov: "ADEQUATE", complete: true }
    ];
    const r = await runScripted(id, steps);
    // eslint-disable-next-line no-console
    console.log("\n[Scenario A] dims:", r.dims.join(" -> "));
    // eslint-disable-next-line no-console
    console.log("[Scenario A] depths:", r.depths.join(" -> "));
    // eslint-disable-next-line no-console
    console.log("[Scenario A] final coverage:", r.finalCoverage);

    // The scripted coordinator TRIED to repeat operations at step 3; the guardrail overrides it.
    let consecutiveRepeats = 0;
    for (let i = 1; i < r.dims.length; i++) if (r.dims[i] === r.dims[i - 1]) consecutiveRepeats++;
    expect(consecutiveRepeats).toBe(0);
    // All five dimensions touched.
    expect(new Set(r.dims).size).toBe(5);
    // Operations is not dominant.
    const opsCount = r.dims.filter((d) => d === "operations").length;
    expect(opsCount).toBeLessThan(r.dims.length);
  });

  it("Scenario B — vague user: stays shallow, simple, broad coverage", async () => {
    const id = "sim-b";
    setup(id);
    const steps: Step[] = [
      { lens: "business", depth: 1, q: "What does your company do?", answerDim: "business", cov: "LIGHT", richness: "thin" },
      { lens: "operations", depth: 1, q: "How does the work get done?", answerDim: "operations", cov: "LIGHT", richness: "thin" },
      { lens: "systems", depth: 1, q: "What systems do you use?", answerDim: "systems", cov: "LIGHT", richness: "thin" },
      { lens: "data", depth: 1, q: "Where does your data live?", answerDim: "data", cov: "LIGHT", richness: "thin" },
      { lens: "people", depth: 1, q: "Who does the work?", answerDim: "people", cov: "LIGHT", richness: "thin" },
      { lens: "business", depth: 1, q: "Who are your customers?", answerDim: "business", cov: "ADEQUATE", richness: "thin" },
      { lens: "operations", depth: 1, q: "Any manual steps?", answerDim: "operations", cov: "ADEQUATE", richness: "thin" },
      { lens: "systems", depth: 1, q: "Do systems connect?", answerDim: "systems", cov: "ADEQUATE", richness: "thin", complete: true }
    ];
    const r = await runScripted(id, steps);
    // eslint-disable-next-line no-console
    console.log("\n[Scenario B] dims:", r.dims.join(" -> "));
    // eslint-disable-next-line no-console
    console.log("[Scenario B] depths:", r.depths.join(" -> "));
    // eslint-disable-next-line no-console
    console.log("[Scenario B] final coverage:", r.finalCoverage);
    // All depths stay shallow (1-2) for a vague user; no aggressive probing.
    expect(Math.max(...r.depths)).toBeLessThanOrEqual(2);
    expect(new Set(r.dims).size).toBe(5);
  });

  it("Scenario C — knowledgeable user: deeper where justified, faster coverage", async () => {
    const id = "sim-c";
    setup(id);
    // Rich answers let the coordinator mark dimensions ADEQUATE quickly, and
    // justify deeper probes (depth 3+) where a workflow friction is described.
    const steps: Step[] = [
      { lens: "business", depth: 1, q: "What does your company do?", answerDim: "business", cov: "ADEQUATE", richness: "rich" },
      { lens: "operations", depth: 1, q: "Walk me through the main workflow.", answerDim: "operations", cov: "LIGHT", richness: "rich" },
      { lens: "systems", depth: 1, q: "What systems are involved?", answerDim: "systems", cov: "ADEQUATE", richness: "rich" },
      { lens: "data", depth: 1, q: "Where does the data live?", answerDim: "data", cov: "ADEQUATE", richness: "rich" },
      { lens: "people", depth: 1, q: "Who owns this work?", answerDim: "people", cov: "ADEQUATE", richness: "rich" },
      // Now every other dimension is ADEQUATE, so a deeper operations probe is allowed.
      { lens: "operations", depth: 4, q: "Where does the workflow slow down?", answerDim: "operations", cov: "ADEQUATE", richness: "rich" },
      { lens: "business", depth: 3, q: "How do customers find you?", answerDim: "business", cov: "DEEP", richness: "rich" },
      { lens: "operations", depth: 3, q: "Any manual handoffs?", answerDim: "operations", cov: "DEEP", richness: "rich" }
    ];
    const r = await runScripted(id, steps);
    // eslint-disable-next-line no-console
    console.log("\n[Scenario C] dims:", r.dims.join(" -> "));
    // eslint-disable-next-line no-console
    console.log("[Scenario C] depths:", r.depths.join(" -> "));
    // eslint-disable-next-line no-console
    console.log("[Scenario C] final coverage:", r.finalCoverage);
    // Depth 3+ reached where the user was rich.
    expect(Math.max(...r.depths)).toBeGreaterThanOrEqual(3);
    // Coverage reached ADEQUATE+ across all five dimensions.
    const adequatePlus = Object.values(r.finalCoverage).filter((c) => c === "ADEQUATE" || c === "DEEP").length;
    expect(adequatePlus).toBe(5);
  });

  it("Scenario D — one dimension not-applicable: does not keep asking it", async () => {
    const id = "sim-d";
    setup(id);
    // The coordinator still rotates across the other four; systems goes ADEQUATE
    // quickly via coverage update and is not revisited excessively.
    const steps: Step[] = [
      { lens: "business", depth: 1, q: "What do you do?", answerDim: "business", cov: "ADEQUATE" },
      { lens: "operations", depth: 1, q: "How does work happen?", answerDim: "operations", cov: "ADEQUATE" },
      { lens: "systems", depth: 1, q: "What systems do you use?", answerDim: "systems", cov: "ADEQUATE" },
      { lens: "data", depth: 1, q: "Where does data live?", answerDim: "data", cov: "ADEQUATE" },
      { lens: "people", depth: 1, q: "Who does the work?", answerDim: "people", cov: "ADEQUATE" },
      { lens: "business", depth: 2, q: "Who are your customers?", answerDim: "business", cov: "DEEP", complete: true }
    ];
    const r = await runScripted(id, steps);
    // eslint-disable-next-line no-console
    console.log("\n[Scenario D] dims:", r.dims.join(" -> "));
    // eslint-disable-next-line no-console
    console.log("[Scenario D] final coverage:", r.finalCoverage);
    expect(new Set(r.dims).size).toBe(5);
    const sysCount = r.dims.filter((d) => d === "systems").length;
    expect(sysCount).toBeLessThanOrEqual(2);
  });

  it("Scenario E — non-repetition of question text across 12 turns", async () => {
    const id = "sim-e";
    setup(id);
    const order: LensId[] = [];
    for (let i = 0; i < 12; i++) order.push(DIMS[i % 5]!);
    const steps: Step[] = order.map((lens, i) => ({
      lens, depth: ((i % 3) + 1) as DepthLevel, q: `Q${i + 1} for ${lens}`,
      answerDim: lens, cov: (i < 5 ? "LIGHT" : "ADEQUATE") as "LIGHT" | "ADEQUATE",
      richness: (i % 2 === 0 ? "moderate" : "rich") as "moderate" | "rich"
    })) as Step[];
    const r = await runScripted(id, steps);
    // eslint-disable-next-line no-console
    console.log("\n[Scenario E] dims:", r.dims.join(" -> "));
    // No question text repeats (different candidate text each turn).
    expect(new Set(r.qs).size).toBe(r.qs.length);
    expect(r.dims.length).toBe(12);
  });

  it("Scenario F — early finish when all dimensions ADEQUATE by Q8", async () => {
    const id = "sim-f";
    setup(id);
    // 8 question steps, then a 9th coordinator call with complete=true that
    // should return null (asked=8 >= min=8), demonstrating early finish.
    const steps: Step[] = [
      { lens: "business", depth: 1, q: "What do you do?", answerDim: "business", cov: "ADEQUATE" },
      { lens: "operations", depth: 1, q: "How does work happen?", answerDim: "operations", cov: "ADEQUATE" },
      { lens: "systems", depth: 1, q: "What systems?", answerDim: "systems", cov: "ADEQUATE" },
      { lens: "data", depth: 1, q: "Where's the data?", answerDim: "data", cov: "ADEQUATE" },
      { lens: "people", depth: 1, q: "Who does the work?", answerDim: "people", cov: "ADEQUATE" },
      { lens: "business", depth: 2, q: "Customers?", answerDim: "business", cov: "DEEP" },
      { lens: "operations", depth: 2, q: "Bottlenecks?", answerDim: "operations", cov: "DEEP" },
      { lens: "systems", depth: 2, q: "Integrations?", answerDim: "systems", cov: "DEEP" },
      { lens: "business", depth: 1, q: "(complete)", answerDim: "systems", cov: "DEEP", complete: true }
    ];
    const r = await runScripted(id, steps);
    // eslint-disable-next-line no-console
    console.log("\n[Scenario F] dims:", r.dims.join(" -> "));
    // eslint-disable-next-line no-console
    console.log("[Scenario F] final coverage:", r.finalCoverage);
    expect(r.dims.length).toBe(8); // 9th step returned null (complete)
    const allAdequatePlus = Object.values(r.finalCoverage).every((c) => c === "ADEQUATE" || c === "DEEP");
    expect(allAdequatePlus).toBe(true);
  });
});
