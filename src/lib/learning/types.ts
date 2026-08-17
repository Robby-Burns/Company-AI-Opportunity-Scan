import type { DepthLevel, LensId } from "@/lib/interview/types";

export type ArchetypeLifecycle = "SEEDED" | "EXPERIMENTAL" | "ESTABLISHED" | "DEPRIORITIZED";

export type QuestionOutcome =
  | "HIGH_VALUE"
  | "USEFUL"
  | "NEUTRAL"
  | "REDUNDANT"
  | "MISDIRECTED"
  | "LEADING"
  | "INVALIDATED_ASSUMPTION"
  | "SURFACED_DISCREPANCY";

export type DiscrepancyType = "signal_vs_reality" | "process_inconsistency" | "data_mismatch" | "none";

export interface QuestionArchetype {
  id: string;
  name: string;
  dimension: LensId;
  depths: DepthLevel[];
  purpose: string;
  targetState: string;
  usefulWhen: string;
  avoidWhen: string;
  desiredEvidenceCategories: string[];
  strategyGuidance: string;
  lifecycle: ArchetypeLifecycle;
  sampleCount: number;
  avgEfficacyScore: number;
  variance: number;
  invalidationsCount: number;
  discrepanciesCount: number;
  lastUpdated: number;
}

export interface TurnTelemetry {
  questionNumber: number;
  dimension: LensId;
  depth: DepthLevel;
  archetypeId?: string;
  coverageBefore: string;
  coverageAfter: string;
  uncertaintyCountBefore: number;
  uncertaintyCountAfter: number;
  weightedDeltaUncertainty: number;
  evidenceSpecificCount: number;
  assumptionInvalidated: boolean;
  discrepancyType: DiscrepancyType;
  isRedundant: boolean;
  isLeading: boolean;
  outcome: QuestionOutcome;
  efficacyScore: number;
}

export interface SessionTelemetry {
  scanId: string;
  turns: TurnTelemetry[];
  completedAt: number;
}

export interface PromotionCriteria {
  minSampleSize: number;
  minEfficacyScore: number;
  maxVariance: number;
  minInvalidationOrDiscrepancyRate?: number;
}

export interface LearningStore {
  getArchetypes(dimension?: LensId, depth?: DepthLevel): Promise<QuestionArchetype[]>;
  getArchetype(id: string): Promise<QuestionArchetype | undefined>;
  recordSessionTelemetry(telemetry: SessionTelemetry): Promise<void>;
  evaluatePromotion(archetypeId: string, criteria?: Partial<PromotionCriteria>): Promise<boolean>;
  updateArchetype(archetype: QuestionArchetype): Promise<void>;
  resetToSeeds(): Promise<void>;
}
