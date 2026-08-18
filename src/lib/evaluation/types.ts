/**
 * Quality Evaluation Types (Dataset B — Derived Explicit Rubric).
 *
 * Epistemic Standards:
 * 1. Independent two-pass evaluation: Pass 1 (Mechanical Integrity) + Pass 2 (Qualitative Quality).
 * 2. Dataset B serves as reference gold-standard exemplars, NOT generation context.
 * 3. Evaluator enforces the 9 Fox & Loom dimensions including Section Integrity and Zero ROI.
 */

export type EvaluationDimension =
  | "evidenceProvenance"
  | "antiHypeZeroRoi"
  | "datasetIsolation"
  | "companySpecificity"
  | "reasoningRigor"
  | "appropriateAiFit"
  | "intellectualHonesty"
  | "clientTeachingValue"
  | "sectionIntegrity";

export interface MechanicalCheckResult {
  passed: boolean;
  provenanceIssues: string[];
  roiViolations: string[];
  syntheticLeakage: string[];
}

export interface QualitativeCheckResult {
  companySpecificity: "PASS" | "NEEDS_REVISION";
  reasoningRigor: "PASS" | "NEEDS_REVISION";
  appropriateAiFit: "PASS" | "NEEDS_REVISION";
  intellectualHonesty: "PASS" | "NEEDS_REVISION";
  clientTeachingValue: "PASS" | "NEEDS_REVISION";
  sectionIntegrity: "PASS" | "NEEDS_REVISION";
  feedback: string[];
}

export interface ScanEvaluationResult {
  overallPassed: boolean;
  mechanical: MechanicalCheckResult;
  qualitative: QualitativeCheckResult;
  requiredRevisions: string[];
  evaluatedAt: number;
}
