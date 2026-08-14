/**
 * Multi-perspective interview architecture (spec §7.1, §7.2).
 *
 * The interview is driven by a Coordinator + Specialist personas, modeled on
 * the six dimensions of the paid Deep Assessment (Workflow, Technology, Data,
 * People & Process, Business Value, Risk). The free scan is a lighter version
 * of that same intellectual model — not a generic adaptive questionnaire.
 *
 * Per turn:
 *   1. Coordinator (one LLM call) — maintains the investigation state,
 *      selects the 2–3 lenses with the highest current information value,
 *      and assigns scoring weights.
 *   2. Selected personas (parallel LLM calls) — each reviews the current
 *      evidence + conversation + its own prior perspective and proposes a
 *      candidate question plus an updated perspective and a self-scored
 *      rubric.
 *   3. Deterministic scoring (no LLM) — weighted sum picks the best
 *      candidate.
 *
 * Personas retain perspective state across the whole interview, so the final
 * report can say "Operations Perspective: ...", "Business Perspective: ...".
 */

/** The five specialist lenses. Stable ids — do not change. */
export type LensId = "operations" | "systems" | "data" | "business" | "risk";

export interface LensDef {
  id: LensId;
  /** Human label, e.g. "Operations". */
  label: string;
  /** One-line framing shown to the prospect, e.g. "Where is work getting stuck?" */
  prompt: string;
  /** Longer persona brief used in the LLM system prompt for this lens. */
  brief: string;
}

export interface InterviewQuestion {
  id: string;
  text: string;
  kind?: "short" | "long" | "choice";
  choices?: string[];
  /** Which lens generated this question (for the UI badge). */
  lens?: LensId;
}

export interface PerspectiveState {
  lens: LensId;
  beliefs: string[];
  uncertainties: string[];
  potentialOpportunity: string;
  evidenceRefs: string[];
  updatedAt: number;
}

export interface CandidateScores {
  relevance: number;
  uncertaintyReduction: number;
  businessSignificance: number;
  novelty: number;
  depthPotential: number;
  conversationalNaturalness: number;
}

export interface CandidateQuestion {
  lens: LensId;
  question: { text: string; kind?: "short" | "long" | "choice"; choices?: string[] };
  perspective: Omit<PerspectiveState, "lens" | "updatedAt">;
  scores: CandidateScores;
  rationale: string;
}

export interface CoordinatorPlan {
  lenses: LensId[];
  weights: CandidateScores;
  complete: boolean;
  rationale: string;
}

export interface InterviewState {
  scanId: string;
  asked: number;
  minQuestions: number;
  maxQuestions: number;
  current?: InterviewQuestion;
  finished: boolean;
  /** Per-lens perspective memory, persisted across turns. */
  perspectives: Map<LensId, PerspectiveState>;
  /** Lenses consulted so far (for novelty/coverage tracking). */
  consulted: LensId[];
}
