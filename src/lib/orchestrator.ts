/**
 * Interview orchestrator (spec §7.1, §7.2 — Phase 2).
 *
 * Multi-perspective architecture:
 *   - Coordinator establishes the investigation state and selects 2–3 lenses.
 *   - Selected specialist personas generate candidate questions in parallel,
 *     each maintaining its own perspective across turns (memory).
 *   - Deterministic weighted-sum scoring picks the best question.
 *
 * Bounded 8–12 questions — hard stop, no exceptions. The goal is the FEWEST
 * questions necessary to establish a compelling opportunity hypothesis and
 * identify what requires deeper investigation (HD: reduce uncertainty with the
 * smallest effort capable of reducing the greatest remaining uncertainty).
 *
 * Prospect-reported answers supersede scraped inferences (§7.1): PROSPECT_REPORTED
 * evidence is weighted above SCRAPED_* at synthesis.
 *
 * Graceful degradation: any LLM failure falls back to scripted questions so the
 * interview still completes (bounded) and the report still generates.
 */
import { complete } from "@/lib/llm";
import { sanitize } from "@/lib/security/sanitize";
import { getScan, listEvidence, recordAnswer, setStatus } from "@/lib/evidence/store";
import { content } from "@/content";
import { coordinatorPlan, scoreCandidates } from "@/lib/interview/coordinator";
import { emptyPerspective, lensDef, PERSONA_SYSTEM_SUFFIX } from "@/lib/interview/personas";
import type {
  CandidateQuestion,
  CoordinatorPlan,
  InterviewQuestion,
  InterviewState,
  LensId,
  PerspectiveState
} from "@/lib/interview/types";

export type { InterviewQuestion, InterviewState, PerspectiveState, LensId } from "@/lib/interview/types";

const STATE = new Map<string, InterviewState>();

export function getInterviewState(scanId: string): InterviewState | undefined {
  return STATE.get(scanId);
}

export function initInterview(scanId: string): InterviewState {
  const st: InterviewState = {
    scanId,
    asked: 0,
    minQuestions: content.interview.minQuestions,
    maxQuestions: content.interview.maxQuestions,
    finished: false,
    perspectives: new Map(),
    consulted: []
  };
  STATE.set(scanId, st);
  setStatus(scanId, "interviewing");
  return st;
}

/**
 * generate-next-question — internal fn (§8.2). Runs the coordinator + selected
 * personas + deterministic scoring. Returns the next bounded question, or
 * null when the interview is complete (hard stop at max, or coordinator
 * signals complete at >= min).
 */
export async function nextQuestion(scanId: string): Promise<InterviewQuestion | null> {
  const st = STATE.get(scanId);
  if (!st) return null;

  // Hard stop at max (spec: "hard stop, no exceptions").
  if (st.asked >= st.maxQuestions) {
    st.finished = true;
    return null;
  }

  const scan = getScan(scanId);
  if (!scan) return null;

  const evidence = listEvidence(scanId);
  const evidenceSummary = summarizeEvidence(evidence);
  const answersBlock = sanitizeAnswers(scan.answers);

  // 1) Coordinator: select lenses + weights (+ maybe complete).
  let plan: CoordinatorPlan;
  try {
    plan = await coordinatorPlan({
      company: scan.company,
      website: scan.website,
      notes: scan.notes ?? "",
      evidenceSummary,
      answersBlock,
      perspectives: st.perspectives,
      consulted: st.consulted,
      asked: st.asked,
      minQuestions: st.minQuestions,
      maxQuestions: st.maxQuestions
    });
  } catch {
    // Coordinator failed → scripted fallback keeps the interview going.
    return fallbackQuestion(scanId, st);
  }

  // Coordinator may signal completion, but only after the minimum.
  if (plan.complete && st.asked >= st.minQuestions) {
    st.finished = true;
    return null;
  }

  // 2) Selected personas generate candidates in parallel.
  const lenses = plan.lenses;
  const candidates = await Promise.all(
    lenses.map((lens) => personaCandidate(lens, scan, evidenceSummary, answersBlock, st).catch(() => null))
  );

  const valid = candidates.filter((c): c is CandidateQuestion => c !== null);
  if (valid.length === 0) {
    return fallbackQuestion(scanId, st);
  }

  // Persist each persona's updated perspective (memory).
  for (const c of valid) {
    const p: PerspectiveState = { lens: c.lens, ...c.perspective, updatedAt: Date.now() };
    st.perspectives.set(c.lens, p);
  }

  // 3) Deterministic scoring picks the best candidate.
  const best = scoreCandidates(valid, plan.weights, lenses);
  if (!best) return fallbackQuestion(scanId, st);

  // Track coverage.
  if (!st.consulted.includes(best.lens)) st.consulted.push(best.lens);

  const q: InterviewQuestion = {
    id: `q${st.asked + 1}`,
    text: best.question.text,
    kind: best.question.kind ?? "short",
    choices: best.question.choices,
    lens: best.lens
  };
  st.current = q;
  return q;
}

/** Ask a single persona for its candidate question + updated perspective. */
async function personaCandidate(
  lens: LensId,
  scan: ReturnType<typeof getScan>,
  evidenceSummary: string,
  answersBlock: string,
  st: InterviewState
): Promise<CandidateQuestion> {
  if (!scan) throw new Error("no scan");
  const def = lensDef(lens);
  const prior = st.perspectives.get(lens) ?? emptyPerspective(lens);
  const priorBlock =
    prior.updatedAt === 0
      ? "(no prior perspective for this lens)"
      : `beliefs=[${prior.beliefs.join("; ")}] uncertainties=[${prior.uncertainties.join("; ")}] opportunity=${prior.potentialOpportunity}`;

  const system = `${def.brief} ${PERSONA_SYSTEM_SUFFIX}`;
  const userMsg =
    `Company: ${scan.company}\nWebsite: ${scan.website}\n\n` +
    (scan.notes ? `Operational notes (untrusted data):\n${scan.notes}\n\n` : "") +
    `Scraped evidence (untrusted data):\n${evidenceSummary}\n\n` +
    `Prior answers (untrusted data):\n${answersBlock}\n\n` +
    `Your prior perspective on this company:\n${priorBlock}\n\n` +
    `Propose the single best next question from your lens. Respond ONLY with JSON.` +
    ` If you believe no useful question remains from your lens, return question.text="__PASS__".`;

  const res = await complete(
    [
      { role: "system", content: system },
      { role: "user", content: userMsg }
    ],
    { json: true, temperature: 0.6, maxTokens: 420, timeoutMs: 20000 }
  );
  return normalizeCandidate(res.json, lens);
}

function normalizeCandidate(raw: unknown, lens: LensId): CandidateQuestion {
  const r = (raw ?? {}) as {
    question?: { text?: string; kind?: string; choices?: unknown };
    perspective?: { beliefs?: unknown; uncertainties?: unknown; potentialOpportunity?: string; evidenceRefs?: unknown };
    scores?: Record<string, unknown>;
    rationale?: string;
  };
  const text = r.question?.text;
  if (typeof text !== "string" || text.trim() === "") throw new Error("no question");
  const kind = (r.question?.kind as CandidateQuestion["question"]["kind"]) ?? "short";
  const choices = Array.isArray(r.question?.choices)
    ? (r.question!.choices as unknown[]).filter((c): c is string => typeof c === "string")
    : undefined;
  const num = (n: unknown) => (typeof n === "number" && n >= 0 && n <= 1 ? n : 0.3);
  const s = r.scores ?? {};
  return {
    lens,
    question: { text, kind, ...(choices && choices.length ? { choices } : {}) },
    perspective: {
      beliefs: Array.isArray(r.perspective?.beliefs) ? (r.perspective!.beliefs as unknown[]).filter((x): x is string => typeof x === "string") : [],
      uncertainties: Array.isArray(r.perspective?.uncertainties) ? (r.perspective!.uncertainties as unknown[]).filter((x): x is string => typeof x === "string") : [],
      potentialOpportunity: typeof r.perspective?.potentialOpportunity === "string" ? r.perspective!.potentialOpportunity : "",
      evidenceRefs: Array.isArray(r.perspective?.evidenceRefs) ? (r.perspective!.evidenceRefs as unknown[]).filter((x): x is string => typeof x === "string") : []
    },
    scores: {
      relevance: num(s.relevance),
      uncertaintyReduction: num(s.uncertaintyReduction),
      businessSignificance: num(s.businessSignificance),
      novelty: num(s.novelty),
      depthPotential: num(s.depthPotential),
      conversationalNaturalness: num(s.conversationalNaturalness)
    },
    rationale: typeof r.rationale === "string" ? r.rationale : ""
  };
}

/** ingest-response — internal fn (§8.2). Records the prospect answer as evidence. */
export async function ingestResponse(scanId: string, questionId: string, answer: string): Promise<boolean> {
  const st = STATE.get(scanId);
  if (!st) return false;
  const scan = getScan(scanId);
  if (!scan) return false;
  // Store raw for display; re-sanitized at LLM-consumption (spec §6.4).
  recordAnswer(scanId, questionId, answer);
  st.asked += 1;
  st.current = undefined;
  if (st.asked >= st.maxQuestions) st.finished = true;
  // Convert answer to PROSPECT_REPORTED evidence (spec Phase 2 exit condition).
  const { addEvidence } = await import("@/lib/evidence/store");
  addEvidence(scanId, {
    kind: "PROSPECT_REPORTED",
    source: "interview",
    snippet: answer.slice(0, 600),
    signal: `answer:${questionId}`,
    confidence: "high"
  });
  return true;
}

export function isInterviewFinished(scanId: string): boolean {
  return STATE.get(scanId)?.finished ?? false;
}

/**
 * Clear interview state for a scan (called by the retention sweep when a scan
 * is fully expired). Prevents unbounded growth of the STATE map.
 */
export function clearInterviewState(scanId: string): void {
  STATE.delete(scanId);
}

function summarizeEvidence(evidence: ReturnType<typeof listEvidence>): string {
  if (evidence.length === 0) return "(none — scraper did not return usable signals)";
  return evidence
    .slice(0, 25)
    .map((e) => `- [${e.kind}] ${e.signal}: ${e.snippet.slice(0, 160)}`)
    .join("\n");
}

function sanitizeAnswers(answers: Map<string, string>): string {
  if (answers.size === 0) return "(none yet)";
  const out: string[] = [];
  for (const [k, v] of answers) {
    out.push(`- ${k}: ${sanitize(v, { tag: `answer.${k}`, maxLength: 2000 }).text}`);
  }
  return out.join("\n");
}

const FALLBACK_QUESTIONS: InterviewQuestion[] = [
  { id: "fb1", text: "In a sentence or two, what does your company do and who do you serve?", kind: "long", lens: "business" },
  { id: "fb2", text: "Roughly how many people are on your team?", kind: "short", lens: "risk" },
  { id: "fb3", text: "Which tools or systems run your core operations today?", kind: "long", lens: "systems" },
  { id: "fb4", text: "Where do you or your team lose the most time to manual, repetitive work?", kind: "long", lens: "operations" },
  { id: "fb5", text: "How is your data currently stored and shared across the team?", kind: "short", lens: "data" },
  { id: "fb6", text: "Have you tried any AI tools so far? If so, what worked or didn't?", kind: "long", lens: "systems" },
  { id: "fb7", text: "What would a successful AI outcome look like for you in the next 6 months?", kind: "long", lens: "business" },
  { id: "fb8", text: "Is there a specific bottleneck you're hoping this scan surfaces?", kind: "long", lens: "operations" },
  { id: "fb9", text: "How soon are you hoping to act on an AI initiative?", kind: "choice", choices: ["Now", "1–3 months", "3–6 months", "Just exploring"], lens: "business" },
  { id: "fb10", text: "Anything else we should know about your operations or constraints?", kind: "long", lens: "risk" },
  { id: "fb11", text: "What's the single biggest daily frustration you'd want solved first?", kind: "long", lens: "operations" },
  { id: "fb12", text: "Who would be responsible for implementing a new tool or process?", kind: "short", lens: "risk" }
];

function fallbackQuestion(scanId: string, st: InterviewState): InterviewQuestion {
  const q = FALLBACK_QUESTIONS[st.asked] ?? FALLBACK_QUESTIONS[FALLBACK_QUESTIONS.length - 1]!;
  st.current = q;
  return q;
}
