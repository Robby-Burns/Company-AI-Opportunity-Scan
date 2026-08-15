/**
 * Multi-perspective interview architecture — coverage-controlled edition.
 *
 * Canonical discovery dimensions (exactly five, per the interview design spec):
 *   business  → Business Context
 *   operations → Operations
 *   systems   → Systems & Technology
 *   data      → Data
 *   people    → People & Work
 *
 * "Risk & People" is NO LONGER a combined lens. Risk is a cross-cutting
 * consideration surfaced as signals inside the dimensions, not a sixth
 * perspective. "Business Value" is NOT a standalone lens either — value
 * signals (volume, frequency, time, impact) are collected where naturally
 * available, but the deeper Business Value assessment belongs to the paid
 * Deep Assessment, not the shallow interview.
 *
 * Core design principle: COVERAGE IS CONTROLLED. DEPTH IS ADAPTIVE.
 *   - The Coordinator owns which dimension is investigated next and at what
 *     depth. It is constrained by a deterministic Company Coverage Map so it
 *     cannot tunnel-vision on one interesting answer.
 *   - The Specialist owns what question to ask about that dimension. It
 *     generates 2–3 candidates; the Coordinator's deterministic quality picker
 *     selects the final question.
 */

/** The five specialist lenses. Stable ids — do not change. */
export type LensId = "business" | "operations" | "systems" | "data" | "people";

export interface LensDef {
  id: LensId;
  /** Human label, e.g. "Operations". */
  label: string;
  /** One-line framing shown to the prospect. */
  prompt: string;
  /** Longer persona brief used in the LLM system prompt for this lens. */
  brief: string;
}

/** Coverage level for a discovery dimension. Asking ≠ covered. */
export type CoverageLevel = "NOT_STARTED" | "LIGHT" | "ADEQUATE" | "DEEP";

/** Question depth ladder (1=shallow context … 6=impact). Adaptive. */
export type DepthLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface InterviewQuestion {
  id: string;
  text: string;
  kind?: "short" | "long" | "choice";
  choices?: string[];
  /** Which lens generated this question (for the UI badge + trace). */
  lens?: LensId;
  /** Depth at which this question was asked (for the trace). */
  depth?: DepthLevel;
}

/** Per-dimension coverage state — the Company Coverage Map. */
export interface DimensionCoverage {
  dimension: LensId;
  coverage: CoverageLevel;
  confidence: "low" | "medium" | "high";
  questionsAsked: number;
  lastQuestionNumber: number; // 0 = never asked
  keyFacts: string[];
  knownUnknowns: string[];
  evidenceIds: string[];
  unresolvedGaps: string[];
  /** Current depth reached in this dimension (drives the depth ladder). */
  depth: DepthLevel;
  /** Answer-quality signal for depth adaptation: short/vague vs rich/detailed. */
  answerRichness: "thin" | "moderate" | "rich";
  /** Whether the user signaled this dimension is N/A (e.g. "we have no systems"). */
  notApplicable: boolean;
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
  novelty: number; // produces NEW information
  coverageGain: number; // improves understanding of an inadequately understood part of the selected dimension
  companyUnderstanding: number; // improves OVERALL understanding of how the company operates
  answerable: number; // answerable by the current user
  specific: number; // specific enough to produce useful evidence (not a generic response)
  conversational: number; // natural in a real consulting conversation; non-leading; non-technical
  depthAppropriate: number; // right level given current evidence and user sophistication
}

export interface CandidateQuestion {
  lens: LensId;
  depth: DepthLevel;
  question: { text: string; kind?: "short" | "long" | "choice"; choices?: string[] };
  /** Evidence this candidate would help extract, per the specialist. */
  expectedSignal?: string;
  scores: CandidateScores;
  rationale: string;
}

/**
 * Coordinator plan — ONE dimension per turn (not 2–3). The coordinator owns
 * coverage, rotation, depth, and a coverage update for the dimension that was
 * just answered (if any).
 */
export interface CoverageUpdate {
  dimension: LensId;
  coverage: CoverageLevel;
  confidence: "low" | "medium" | "high";
  keyFacts: string[];
  knownUnknowns: string[];
  evidenceIds: string[]; // NEW evidence ids harvested from the last answer
  unresolvedGaps: string[];
  answerRichness: "thin" | "moderate" | "rich";
  notApplicable: boolean;
}

export interface CoordinatorPlan {
  lens: LensId;
  depth: DepthLevel;
  coverageUpdate?: CoverageUpdate; // for the dimension just answered
  complete: boolean;
  rationale: string;
  /** Candidate questions the specialist should generate (2–3). */
  candidateCount: number;
}

/**
 * Coordinator runtime state — owned and mutated ONLY by the coordinator.
 * The persona never sees or modifies this; it only receives a snapshot of it
 * (the company coverage map + confidence + known facts/unknowns + history).
 */
export interface CoordinatorState {
  lastDimension: LensId | null;
  questionsByDimension: Record<LensId, number>;
  coverageByDimension: Record<LensId, CoverageLevel>;
  confidenceByDimension: Record<LensId, "low" | "medium" | "high">;
  knownUnknowns: string[]; // company-wide open questions
  remainingQuestionBudget: number;
}

export interface InterviewState {
  scanId: string;
  asked: number;
  minQuestions: number;
  maxQuestions: number;
  current?: InterviewQuestion;
  finished: boolean;
  /** The Company Coverage Map — the heart of coverage-controlled rotation. */
  coverage: Map<LensId, DimensionCoverage>;
  /** Per-lens perspective memory, persisted across turns (for synthesis). */
  perspectives: Map<LensId, PerspectiveState>;
  /** Ordered history of dimensions asked (for rotation guardrails). */
  dimensionHistory: LensId[];
  /** Coordinator runtime state — coverage/rotation/budget ownership. */
  coordinator: CoordinatorState;
  /** Developer instrumentation trace (per question). */
  trace: TraceEntry[];
}

export interface TraceEntry {
  questionNumber: number;
  selectedDimension: LensId;
  coverageBefore: CoverageLevel;
  coverageAfter: CoverageLevel;
  reasonDimensionSelected: string;
  candidateQuestions: { text: string; scores: CandidateScores; selected: boolean; why: string }[];
  selectedQuestion: string;
  questionDepth: DepthLevel;
  candidateScores: CandidateScores;
  selectionRationale: string;
  newEvidence: string[];
  newUnknowns: string[];
  opportunitySignals: string[];
}
