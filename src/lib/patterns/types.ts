/**
 * Diagnostic Pattern Library Types (Dataset A — Synthetic Seed).
 *
 * Epistemic Rules:
 * 1. Diagnostic patterns are reasoning lenses and reference tools, NOT validated findings.
 * 2. Primary company evidence ALWAYS takes precedence over pattern matches.
 * 3. Pattern candidates must undergo disconfirmation testing and can be rejected.
 */

export type PatternDisposition =
  | "supported"
  | "partially_supported"
  | "insufficient_evidence"
  | "contradicted"
  | "rejected";

export type InterventionType =
  | "ai"
  | "deterministic_automation"
  | "process_redesign"
  | "human_led"
  | "existing_software";

export interface PatternTrigger {
  externalEvidenceSignals: string[];
  interviewEvidenceSignals: string[];
}

export interface DiagnosticPattern {
  id: string;
  name: string;
  category: string;
  description: string;
  triggers: PatternTrigger;
  confirmingIndicators: string[];
  disprovingIndicators: string[];
  alternativeExplanations: string[];
  diagnosticQuestions: string[];
  candidateInterventions: {
    processRedesign: string[];
    deterministicAutomation: string[];
    aiOpportunity: string[];
  };
  whenAiAppropriate: string;
  whenAutomationBetter: string;
  risksAndHumanInLoop: string;
}

export interface PatternCandidate {
  patternId: string;
  patternName: string;
  matchRationale: string;
  
  // Evidence comparison
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  alternativeExplanations: string[];
  remainingUncertainties: string[];
  
  // Triangulated Intervention Fit
  interventionType: InterventionType;
  interventionRationale: string;
  
  // Decision
  confidence: "Strong" | "Moderate" | "Limited";
  disposition: PatternDisposition;
}
