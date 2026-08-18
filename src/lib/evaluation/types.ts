/**
 * Quality Evaluation Types (Dataset B — Derived Explicit Rubric).
 *
 * Epistemic Standards:
 * 1. Independent two-pass evaluation: Pass 1 (Mechanical Integrity) + Pass 2 (Qualitative Quality).
 * 2. Dataset B serves as reference gold-standard exemplars, NOT generation context.
 * 3. Evaluator enforces the 9 Fox & Loom dimensions including Section Integrity and Zero ROI.
 */

export type EvaluationDimension =
  | "Evidence"
  | "Reasoning"
  | "AI Fit"
  | "Client Value"
  | "Uncertainty"
  | "Business Impact"
  | "Report Quality"
  | "Foundations"
  | "Opportunity Count";

export enum HardFailureCode {
  H1 = "H1", // Fabricated company evidence
  H2 = "H2", // Fabricated financial impact / ROI / maturity score
  H3 = "H3", // Synthetic pattern presented as company fact
  H4 = "H4", // Critical evidence contradiction ignored
  H5 = "H5", // Forced AI recommendation
  H6 = "H6", // Dataset contamination (Dataset B synthetic signatures)
  H7 = "H7", // Material inference presented as established fact
}

export type Verdict = "PASS" | "PARTIAL" | "FAIL";

export interface HardFailureCheckResult {
  code: HardFailureCode;
  passed: boolean;
  details?: string;
}

export interface CriterionDefinition {
  id: string;
  description: string;
  weight: number;
  dimension: EvaluationDimension;
}

export interface CriterionEvaluationResult {
  id: string;
  description: string;
  dimension: EvaluationDimension;
  weight: number;
  verdict: Verdict;
  penalty: number;
  reason?: string;
}

export interface DimensionScore {
  dimension: EvaluationDimension;
  penaltyPoints: number;
  maxPoints: number;
  penaltyPct: number;
}

export interface ScanEvaluationResult {
  status: "PASS" | "FAIL" | "NEEDS_REVISION";
  overallPassed: boolean;
  hardFailures: HardFailureCode[];
  hardFailureDetails: string[];
  totalPenaltyPoints: number;
  totalPossiblePoints: number;
  overallPenaltyPct: number;
  dimensionScores: Record<EvaluationDimension, DimensionScore>;
  criterionResults: CriterionEvaluationResult[];
  requiredRevisions: string[];
  revisionCycle: number;
  evaluatedAt: number;
}

