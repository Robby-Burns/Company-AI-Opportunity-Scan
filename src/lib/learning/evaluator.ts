import type { CoverageLevel, DepthLevel, LensId } from "@/lib/interview/types";
import { getScan } from "@/lib/evidence/store";
import { getInterviewState } from "@/lib/orchestrator";
import { getLearningStore } from "./store";
import type { DiscrepancyType, LearningStore, QuestionOutcome, SessionTelemetry, TurnTelemetry } from "./types";

const COVERAGE_SCORE: Record<CoverageLevel, number> = {
  NOT_STARTED: 0,
  LIGHT: 0.33,
  ADEQUATE: 0.66,
  DEEP: 1.0
};

export interface TurnEvaluationInput {
  questionNumber: number;
  dimension: LensId;
  depth: DepthLevel;
  archetypeId?: string;
  coverageBefore: CoverageLevel;
  coverageAfter: CoverageLevel;
  unknownsBefore: string[];
  unknownsAfter: string[];
  factsBefore: string[];
  factsAfter: string[];
  answerSnippet: string;
  evidenceGeneratedCount: number;
  assumptionInvalidated?: boolean;
  discrepancyType?: DiscrepancyType;
  isRedundant?: boolean;
  isLeading?: boolean;
}

export function evaluateTurn(input: TurnEvaluationInput): TurnTelemetry {
  const covBefore = COVERAGE_SCORE[input.coverageBefore] ?? 0;
  const covAfter = COVERAGE_SCORE[input.coverageAfter] ?? 0;
  const coverageGain = Math.max(0, covAfter - covBefore);

  // Uncertainty reduction: decrease in known unknowns count
  const deltaUnknowns = Math.max(0, input.unknownsBefore.length - input.unknownsAfter.length);
  // High-value weighted uncertainty metric
  const weightedDeltaUncertainty = Number((deltaUnknowns * 0.2 + coverageGain * 0.5).toFixed(3));

  // Evidence specificity: new concrete facts surfaced
  const newFactsCount = Math.max(0, input.factsAfter.length - input.factsBefore.length);
  const evidenceSpecificCount = newFactsCount + input.evidenceGeneratedCount;

  const assumptionInvalidated = Boolean(input.assumptionInvalidated);
  const discrepancyType = input.discrepancyType ?? "none";
  const isRedundant = Boolean(input.isRedundant || (coverageGain === 0 && newFactsCount === 0 && deltaUnknowns === 0));
  const isLeading = Boolean(input.isLeading);

  // Efficacy Score Calculation
  let rawScore = 0.5; // baseline

  // Additions
  rawScore += Math.min(0.35, weightedDeltaUncertainty);
  rawScore += Math.min(0.25, evidenceSpecificCount * 0.08);
  if (assumptionInvalidated) rawScore += 0.25;
  if (discrepancyType !== "none") rawScore += 0.2;

  // Deductions
  if (isRedundant) rawScore -= 0.3;
  if (isLeading) rawScore -= 0.25;

  const efficacyScore = Number(Math.max(0.1, Math.min(1.0, rawScore)).toFixed(3));

  // Determine Outcome Category
  let outcome: QuestionOutcome = "NEUTRAL";
  if (assumptionInvalidated) {
    outcome = "INVALIDATED_ASSUMPTION";
  } else if (discrepancyType !== "none") {
    outcome = "SURFACED_DISCREPANCY";
  } else if (isLeading) {
    outcome = "LEADING";
  } else if (isRedundant) {
    outcome = "REDUNDANT";
  } else if (efficacyScore >= 0.78) {
    outcome = "HIGH_VALUE";
  } else if (efficacyScore >= 0.62) {
    outcome = "USEFUL";
  } else if (efficacyScore < 0.35) {
    outcome = "MISDIRECTED";
  }

  return {
    questionNumber: input.questionNumber,
    dimension: input.dimension,
    depth: input.depth,
    archetypeId: input.archetypeId,
    coverageBefore: input.coverageBefore,
    coverageAfter: input.coverageAfter,
    uncertaintyCountBefore: input.unknownsBefore.length,
    uncertaintyCountAfter: input.unknownsAfter.length,
    weightedDeltaUncertainty,
    evidenceSpecificCount,
    assumptionInvalidated,
    discrepancyType,
    isRedundant,
    isLeading,
    outcome,
    efficacyScore
  };
}

/**
 * Asynchronously process a completed scan session for cross-session learning.
 * Extracts 100% PII-free metadata and evaluates state transitions.
 */
export async function evaluateAndRecordSession(scanId: string, customStore?: LearningStore): Promise<void> {
  try {
    const scan = getScan(scanId);
    const st = getInterviewState(scanId);
    if (!scan || !st || st.trace.length === 0) return;

    const turns: TurnTelemetry[] = [];

    for (let i = 0; i < st.trace.length; i++) {
      const traceEntry = st.trace[i];
      if (!traceEntry) continue;

      const dim = traceEntry.selectedDimension;
      const cov = st.coverage.get(dim);

      // Evaluate turn based on trace progression
      const turn = evaluateTurn({
        questionNumber: traceEntry.questionNumber,
        dimension: dim,
        depth: traceEntry.questionDepth,
        archetypeId: traceEntry.archetypeId,
        coverageBefore: traceEntry.coverageBefore,
        coverageAfter: traceEntry.coverageAfter,
        unknownsBefore: i === 0 ? [] : [traceEntry.selectedDimension + "_unknown"],
        unknownsAfter: cov?.knownUnknowns ?? [],
        factsBefore: [],
        factsAfter: cov?.keyFacts ?? [],
        answerSnippet: "",
        evidenceGeneratedCount: traceEntry.newEvidence.length,
        assumptionInvalidated: false,
        discrepancyType: "none",
        isRedundant: traceEntry.coverageBefore === "ADEQUATE" && traceEntry.coverageAfter === "ADEQUATE" && traceEntry.newEvidence.length === 0
      });

      turns.push(turn);
    }

    const sessionTelemetry: SessionTelemetry = {
      scanId,
      turns,
      completedAt: Date.now()
    };

    const store = customStore ?? getLearningStore();
    await store.recordSessionTelemetry(sessionTelemetry);
  } catch {
    // Non-blocking background failure
  }
}
