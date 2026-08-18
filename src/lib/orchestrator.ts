/**
 * Interview orchestrator — coverage-controlled edition (spec §7.1, §7.2).
 *
 * Pipeline per turn:
 *   1. Coordinator (1 LLM call): coverage update for the just-answered
 *      dimension (if any) + proposed next dimension/depth + maybe complete.
 *   2. Deterministic guardrails (selectDimension / determineDepth) override
 *      the proposal if it would violate hard coverage constraints.
 *   3. Specialist (1 LLM call) for the ONE selected dimension: generates 2–3
 *      meaningfully-different candidate questions at the requested depth,
 *      given the FULL interview state.
 *   4. Coordinator (selectCandidate) picks ONE question.
 *
 * Bounded 8–12 questions — hard stop, no exceptions. Graceful degradation:
 * any LLM failure falls back to scripted questions so the interview still
 * completes (bounded) and the report still generates.
 */
import { complete } from "@/lib/llm";
import { sanitize } from "@/lib/security/sanitize";
import { getScan, listEvidence, recordAnswer, setStatus, addEvidence } from "@/lib/evidence/store";
import { content } from "@/content";
import {
  coordinatorPlan,
  selectDimension,
  determineDepth,
  selectCandidate,
  serializeInterviewStateForPersona
} from "@/lib/interview/coordinator";
import { lensDef, PERSONA_SYSTEM_SUFFIX, LENS_IDS } from "@/lib/interview/personas";
import { getLearningStore } from "@/lib/learning/store";
import type { QuestionArchetype } from "@/lib/learning/types";
import type {
  CandidateQuestion,
  CoordinatorPlan,
  CoverageUpdate,
  DepthLevel,
  DimensionCoverage,
  InterviewQuestion,
  InterviewState,
  LensId,
  TraceEntry
} from "@/lib/interview/types";

export type { InterviewQuestion, InterviewState, PerspectiveState, LensId, DimensionCoverage, TraceEntry } from "@/lib/interview/types";

interface GlobalInterviewStore {
  __COMPANY_AI_INTERVIEW_STATE__?: Map<string, InterviewState>;
}

const globalInterviewStore = globalThis as unknown as GlobalInterviewStore;
const STATE: Map<string, InterviewState> =
  globalInterviewStore.__COMPANY_AI_INTERVIEW_STATE__ ??
  (globalInterviewStore.__COMPANY_AI_INTERVIEW_STATE__ = new Map<string, InterviewState>());

function emptyCoverage(d: LensId): DimensionCoverage {
  return {
    dimension: d,
    coverage: "NOT_STARTED",
    confidence: "low",
    questionsAsked: 0,
    lastQuestionNumber: 0,
    keyFacts: [],
    knownUnknowns: [],
    evidenceIds: [],
    unresolvedGaps: [],
    depth: 1,
    answerRichness: "moderate",
    notApplicable: false
  };
}

export function getInterviewState(scanId: string): InterviewState | undefined {
  return STATE.get(scanId);
}

export function initInterview(scanId: string): InterviewState {
  const coverage = new Map<LensId, DimensionCoverage>();
  for (const l of LENS_IDS) coverage.set(l, emptyCoverage(l));
  const st: InterviewState = {
    scanId,
    asked: 0,
    minQuestions: content.interview.minQuestions,
    maxQuestions: content.interview.maxQuestions,
    finished: false,
    coverage,
    perspectives: new Map(),
    dimensionHistory: [],
    coordinator: {
      lastDimension: null,
      questionsByDimension: Object.fromEntries(LENS_IDS.map((l) => [l, 0])) as Record<LensId, number>,
      coverageByDimension: Object.fromEntries(LENS_IDS.map((l) => [l, "NOT_STARTED"])) as Record<LensId, "NOT_STARTED">,
      confidenceByDimension: Object.fromEntries(LENS_IDS.map((l) => [l, "low"])) as Record<LensId, "low" | "medium" | "high">,
      knownUnknowns: [],
      remainingQuestionBudget: content.interview.maxQuestions
    },
    trace: []
  };
  STATE.set(scanId, st);
  setStatus(scanId, "interviewing");
  return st;
}

function mergeUnique(arr: string[], items: string[]): string[] {
  return Array.from(new Set([...arr, ...items]));
}

function applyCoverageUpdate(st: InterviewState, update: CoverageUpdate, evidenceIds: string[]): void {
  const c = st.coverage.get(update.dimension);
  if (!c) return;
  c.coverage = update.coverage;
  c.confidence = update.confidence;
  c.keyFacts = mergeUnique(c.keyFacts, update.keyFacts);
  c.knownUnknowns = mergeUnique(c.knownUnknowns, update.knownUnknowns);
  c.unresolvedGaps = update.unresolvedGaps.length > 0 ? update.unresolvedGaps : c.unresolvedGaps;
  c.evidenceIds = mergeUnique(c.evidenceIds, evidenceIds);
  c.answerRichness = update.answerRichness;
  c.notApplicable = update.notApplicable || c.notApplicable;
  st.coordinator.lastDimension = update.dimension;
  st.coordinator.coverageByDimension[update.dimension] = update.coverage;
  st.coordinator.confidenceByDimension[update.dimension] = update.confidence;
  st.coordinator.knownUnknowns = mergeUnique(st.coordinator.knownUnknowns, update.knownUnknowns);
}

function allKnownFacts(st: InterviewState): string[] {
  const out: string[] = [];
  for (const l of LENS_IDS) {
    const c = st.coverage.get(l);
    if (c) out.push(...c.keyFacts);
  }
  return Array.from(new Set(out));
}
function allKnownUnknowns(st: InterviewState): string[] {
  const out: string[] = [];
  for (const l of LENS_IDS) {
    const c = st.coverage.get(l);
    if (c) out.push(...c.knownUnknowns);
  }
  return Array.from(new Set(out));
}

export async function nextQuestion(scanId: string): Promise<InterviewQuestion | null> {
  const st = STATE.get(scanId);
  if (!st) return null;
  if (st.asked >= st.maxQuestions) {
    st.finished = true;
    return null;
  }
  const scan = getScan(scanId);
  if (!scan) return null;

  const evidence = listEvidence(scanId);
  const evidenceSummary = summarizeEvidence(evidence);
  const answersBlock = sanitizeAnswers(scan.answers);
  const lastAnsweredDimension = st.current?.lens ?? null;
  const lastAnswer = lastAnsweredDimension ? (scan.answers.get(st.current?.id ?? "") ?? "") : "";

  // 1) Coordinator.
  let plan: CoordinatorPlan;
  try {
    plan = await coordinatorPlan({
      company: scan.company,
      website: scan.website,
      location: scan.location,
      notes: scan.notes ?? "",
      evidenceSummary,
      answersBlock,
      coverage: st.coverage,
      perspectives: st.perspectives,
      dimensionHistory: st.dimensionHistory,
      lastAnsweredDimension,
      lastAnswer,
      asked: st.asked,
      minQuestions: st.minQuestions,
      maxQuestions: st.maxQuestions
    });
  } catch {
    return fallbackQuestion(scanId, st);
  }

  // Apply coverage update for the dimension just answered.
  if (plan.coverageUpdate) {
    const evIds: string[] = [];
    if (lastAnswer) {
      const ev = addEvidence(scanId, {
        kind: "PROSPECT_REPORTED",
        source: "interview",
        snippet: lastAnswer.slice(0, 600),
        signal: `coverage:${plan.coverageUpdate.dimension}`,
        confidence: plan.coverageUpdate.confidence
      });
      if (ev) evIds.push(ev.id);
    }
    applyCoverageUpdate(st, plan.coverageUpdate, evIds);
    st.perspectives.set(plan.coverageUpdate.dimension, {
      lens: plan.coverageUpdate.dimension,
      beliefs: plan.coverageUpdate.keyFacts,
      uncertainties: plan.coverageUpdate.knownUnknowns,
      potentialOpportunity: "",
      evidenceRefs: evIds,
      updatedAt: Date.now()
    });
  }

  if (plan.complete && st.asked >= st.minQuestions) {
    st.finished = true;
    logTrace(st, plan, null, null, "Coordinator signaled complete after minimum; ending interview.");
    return null;
  }

  // 2) Deterministic coverage guardrails.
  const guard = selectDimension(plan.lens, st.coverage, st.dimensionHistory, st.asked);
  const dimension = guard.dimension;

  // 3) Adaptive depth.
  const depthRes = determineDepth(dimension, st.coverage, plan.depth);
  const depth = depthRes.depth;

  // Retrieve applicable learned archetype strategy for this dimension + depth
  let activeArchetype: QuestionArchetype | undefined;
  try {
    const store = getLearningStore();
    const archetypes = await store.getArchetypes(dimension, depth);
    activeArchetype = archetypes.find((a) => a.lifecycle !== "DEPRIORITIZED") ?? archetypes[0];
  } catch {
    // Gracefully proceed without archetype
  }

  // 4) Specialist candidates.
  let candidates: CandidateQuestion[] = [];
  try {
    candidates = await specialistCandidates(
      scan,
      evidenceSummary,
      answersBlock,
      st,
      dimension,
      depth,
      plan.candidateCount,
      activeArchetype
    );
  } catch {
    candidates = [];
  }
  if (candidates.length === 0) {
    const q = fallbackQuestion(scanId, st, dimension, depth);
    logTrace(
      st,
      plan,
      { dimension, depth, reason: guard.reason + " " + depthRes.reason },
      null,
      `Specialist failed; fallback for ${dimension}.`,
      activeArchetype
    );
    return q;
  }

  // 5) Coordinator picks ONE candidate.
  const askedTexts = st.trace.map((t) => t.selectedQuestion);
  const picked = selectCandidate(candidates, askedTexts);
  if (!picked) {
    const q = fallbackQuestion(scanId, st, dimension, depth);
    logTrace(
      st,
      plan,
      { dimension, depth, reason: guard.reason + " " + depthRes.reason },
      null,
      `No candidate selected; fallback for ${dimension}.`,
      activeArchetype
    );
    return q;
  }

  const best = picked.selected;
  st.coordinator.lastDimension = dimension;
  st.coordinator.questionsByDimension[dimension] += 1;
  st.coordinator.remainingQuestionBudget = st.maxQuestions - st.asked - 1;
  const cov = st.coverage.get(dimension);
  if (cov) {
    cov.questionsAsked += 1;
    cov.lastQuestionNumber = st.asked + 1;
    cov.depth = Math.max(cov.depth, depth) as DepthLevel;
    if (cov.coverage === "NOT_STARTED") cov.coverage = "LIGHT";
  }

  const q: InterviewQuestion = {
    id: `q${st.asked + 1}`,
    text: best.question.text,
    kind: best.question.kind ?? "short",
    choices: best.question.choices,
    lens: dimension,
    depth
  };
  st.current = q;
  st.dimensionHistory.push(dimension);
  logTrace(
    st,
    plan,
    { dimension, depth, reason: guard.reason + " " + depthRes.reason },
    picked,
    picked.rationale,
    activeArchetype
  );
  return q;
}

/** Ask the ONE specialist for 2–3 candidate questions for the selected dimension/depth. */
async function specialistCandidates(
  scan: ReturnType<typeof getScan>,
  evidenceSummary: string,
  answersBlock: string,
  st: InterviewState,
  dimension: LensId,
  depth: DepthLevel,
  count: number,
  archetype?: QuestionArchetype
): Promise<CandidateQuestion[]> {
  if (!scan) throw new Error("no scan");
  const def = lensDef(dimension);
  const system = `${def.brief} ${PERSONA_SYSTEM_SUFFIX}`;
  const fullState = serializeInterviewStateForPersona({
    coverage: st.coverage,
    knownFacts: allKnownFacts(st),
    knownUnknowns: allKnownUnknowns(st),
    recentAnswers: Array.from(scan.answers.values()).slice(-4),
    questionsAsked: st.trace.map((t) => t.selectedQuestion),
    currentDimension: dimension,
    requestedDepth: depth
  });

  const archetypeGuidance = archetype
    ? `\n\nRECOMMENDED DISCOVERY STRATEGY (${archetype.name}):\n` +
      `- Purpose: ${archetype.purpose}\n` +
      `- Strategy: ${archetype.strategyGuidance}\n` +
      `- Target State: ${archetype.targetState}\n` +
      `- Desired Evidence Types: ${archetype.desiredEvidenceCategories.join(", ")}\n` +
      `- Avoid: ${archetype.avoidWhen}\n`
    : "";

  const userMsg =
    `Company: ${scan.company}\n` +
    (scan.location ? `Location: ${scan.location}\n` : "") +
    (scan.website ? `Website: ${scan.website}\n\n` : `Website: (None provided)\n\n`) +
    (scan.notes ? `Operational notes (untrusted data):\n${scan.notes}\n\n` : "") +
    `Scraped evidence (untrusted data):\n${evidenceSummary}\n\n` +
    `Prior answers (untrusted data):\n${answersBlock}\n\n` +
    `${fullState}${archetypeGuidance}\n\n` +
    `Generate ${count} MEANINGFULLY DIFFERENT candidate questions for the "${dimension}" dimension at depth ${depth}. ` +
    `Use the full state above to avoid repeating anything already established. Respond ONLY with JSON.`;

  const res = await complete(
    [
      { role: "system", content: system },
      { role: "user", content: userMsg }
    ],
    { json: true, temperature: 0.6, maxTokens: 700, timeoutMs: 22000 }
  );
  return normalizeCandidates(res.json, dimension, depth);
}

function normalizeCandidates(raw: unknown, lens: LensId, depth: DepthLevel): CandidateQuestion[] {
  const r = (raw ?? {}) as { candidates?: unknown };
  const arr = Array.isArray(r.candidates) ? r.candidates : [];
  const out: CandidateQuestion[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const c = item as {
      question?: { text?: string; kind?: string; choices?: unknown };
      depth?: unknown;
      expectedSignal?: unknown;
      scores?: Record<string, unknown>;
      rationale?: unknown;
    };
    const text = c.question?.text;
    if (typeof text !== "string" || text.trim() === "") continue;
    const kind = (c.question?.kind as CandidateQuestion["question"]["kind"]) ?? "short";
    const choices = Array.isArray(c.question?.choices)
      ? (c.question!.choices as unknown[]).filter((x): x is string => typeof x === "string")
      : undefined;
    const num = (n: unknown) => (typeof n === "number" && n >= 0 && n <= 1 ? n : 0.3);
    const s = c.scores ?? {};
    out.push({
      lens,
      depth: (typeof c.depth === "number" && c.depth >= 1 && c.depth <= 6 ? c.depth : depth) as DepthLevel,
      question: { text, kind, ...(choices && choices.length ? { choices } : {}) },
      expectedSignal: typeof c.expectedSignal === "string" ? c.expectedSignal : undefined,
      scores: {
        novelty: num(s.novelty),
        coverageGain: num(s.coverageGain),
        companyUnderstanding: num(s.companyUnderstanding),
        answerable: num(s.answerable),
        specific: num(s.specific),
        conversational: num(s.conversational),
        depthAppropriate: num(s.depthAppropriate)
      },
      rationale: typeof c.rationale === "string" ? c.rationale : ""
    });
    if (out.length >= 3) break;
  }
  return out;
}

/** ingest-response — records the prospect answer. The coverage update for this
 *  answer is extracted by the coordinator on the NEXT nextQuestion() call. */
export async function ingestResponse(scanId: string, questionId: string, answer: string): Promise<boolean> {
  const st = STATE.get(scanId);
  if (!st) return false;
  const scan = getScan(scanId);
  if (!scan) return false;
  recordAnswer(scanId, questionId, answer);
  st.asked += 1;
  st.current = undefined;
  if (st.asked >= st.maxQuestions) st.finished = true;
  return true;
}

export function isInterviewFinished(scanId: string): boolean {
  return STATE.get(scanId)?.finished ?? false;
}

export function clearInterviewState(scanId: string): void {
  STATE.delete(scanId);
}

/* ── Trace logging (development instrumentation, §22) ──────────────── */

function logTrace(
  st: InterviewState,
  plan: CoordinatorPlan,
  selection: { dimension: LensId; depth: DepthLevel; reason: string } | null,
  picked: { selected: CandidateQuestion; rationale: string } | null,
  note: string,
  archetype?: { id: string; name: string } | null
): void {
  const dim = selection?.dimension ?? plan.lens;
  const cov = st.coverage.get(dim);
  const entry: TraceEntry = {
    questionNumber: st.asked + 1,
    selectedDimension: dim,
    coverageBefore: cov?.coverage ?? "NOT_STARTED",
    coverageAfter: cov?.coverage ?? "NOT_STARTED",
    reasonDimensionSelected: selection?.reason ?? plan.rationale,
    candidateQuestions: [],
    selectedQuestion: picked?.selected.question.text ?? "",
    questionDepth: selection?.depth ?? plan.depth,
    candidateScores: picked?.selected.scores ?? {
      novelty: 0, coverageGain: 0, companyUnderstanding: 0, answerable: 0, specific: 0, conversational: 0, depthAppropriate: 0
    },
    selectionRationale: note,
    archetypeId: archetype?.id,
    archetypeName: archetype?.name,
    newEvidence: [],
    newUnknowns: [],
    opportunitySignals: []
  };
  st.trace.push(entry);
  // eslint-disable-next-line no-console
  console.log(
    `[interview] Q${entry.questionNumber} dim=${entry.selectedDimension} depth=${entry.questionDepth} ` +
      `cov=${entry.coverageBefore}→${entry.coverageAfter} :: ${entry.reasonDimensionSelected} ` +
      `:: q="${entry.selectedQuestion.slice(0, 90)}" :: ${entry.selectionRationale}`
  );
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

const FALLBACK_QUESTIONS: Record<LensId, InterviewQuestion[]> = {
  business: [
    { id: "fb-b1", text: "In a sentence or two, what does your company do and who do you serve?", kind: "long", lens: "business", depth: 1 }
  ],
  operations: [
    { id: "fb-o1", text: "Walk me through how the main work in your business actually gets done day to day.", kind: "long", lens: "operations", depth: 1 },
    { id: "fb-o2", text: "Where does that work tend to slow down or need extra effort?", kind: "long", lens: "operations", depth: 4 }
  ],
  systems: [
    { id: "fb-s1", text: "What software or systems does your team rely on to run the business?", kind: "long", lens: "systems", depth: 1 },
    { id: "fb-s2", text: "How does information move between those systems today?", kind: "long", lens: "systems", depth: 3 }
  ],
  data: [
    { id: "fb-d1", text: "Where does the information your team needs actually live?", kind: "long", lens: "data", depth: 1 },
    { id: "fb-d2", text: "Is that information easy to get to when someone needs it?", kind: "short", lens: "data", depth: 2 }
  ],
  people: [
    { id: "fb-p1", text: "Who on your team handles the work we've been talking about?", kind: "short", lens: "people", depth: 1 },
    { id: "fb-p2", text: "How is the work split up across your team today?", kind: "long", lens: "people", depth: 2 }
  ]
};

function fallbackQuestion(scanId: string, st: InterviewState, dimension?: LensId, depth?: DepthLevel): InterviewQuestion {
  const dim = dimension ?? "business";
  const pool = FALLBACK_QUESTIONS[dim] ?? FALLBACK_QUESTIONS.business;
  const q = pool[Math.min(st.asked, pool.length - 1)] ?? FALLBACK_QUESTIONS.business[0]!;
  const out: InterviewQuestion = { ...q, id: `fb_${st.asked + 1}`, depth: depth ?? q.depth ?? 1 };
  st.current = out;
  if (!st.dimensionHistory.includes(dim)) st.dimensionHistory.push(dim);
  return out;
}
