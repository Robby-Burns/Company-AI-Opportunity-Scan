/**
 * Pattern Matcher & Disconfirmation Engine (Dataset A Reasoning Lens).
 *
 * Epistemic Process:
 * 1. Read primary company evidence signals.
 * 2. Retrieve 0 to N candidate patterns from Dataset A whose triggers match.
 * 3. Run Disconfirmation Check:
 *    - Does company evidence confirm or contradict the pattern?
 *    - Are there alternative operational explanations?
 *    - Is the appropriate intervention AI, Deterministic Automation, Process Redesign, or Human-led?
 * 4. Assign disposition (supported / partially_supported / insufficient_evidence / contradicted / rejected).
 * 5. Pass ONLY evidence-supported candidate hypotheses to synthesis.
 */

import { PATTERN_LIBRARY } from "./pattern-library";
import type { DiagnosticPattern, PatternCandidate, PatternDisposition, InterventionType } from "./types";
import type { Evidence } from "@/lib/evidence/store";

export interface EvidenceLedgerItem {
  id: string;
  kind: string;
  source: string;
  signal: string;
  snippet: string;
  confidence: "low" | "medium" | "high";
}

/**
 * Converts raw Evidence records into an Evidence Ledger representation.
 */
export function buildEvidenceLedger(evidenceList: Evidence[]): EvidenceLedgerItem[] {
  return evidenceList.map((e) => ({
    id: e.id,
    kind: e.kind,
    source: e.source,
    signal: e.signal,
    snippet: e.snippet,
    confidence: e.confidence
  }));
}

/**
 * Evaluates candidate patterns against the Evidence Ledger.
 * Returns structured PatternCandidates with disposition and disconfirmation analysis.
 */
export function evaluateCandidatePatterns(
  ledger: EvidenceLedgerItem[],
  notes: string = ""
): PatternCandidate[] {
  if (ledger.length === 0 && !notes.trim()) {
    return [];
  }

  const combinedText = [
    notes,
    ...ledger.map((l) => `${l.signal} ${l.snippet}`)
  ].join(" ").toLowerCase();

  const candidates: PatternCandidate[] = [];

  for (const pattern of PATTERN_LIBRARY) {
    const matchAnalysis = scorePatternMatch(pattern, ledger, combinedText);
    if (matchAnalysis.matched) {
      candidates.push(matchAnalysis.candidate);
    }
  }

  // Sort by confidence / supported status
  return candidates.sort((a, b) => {
    const scoreMap: Record<PatternDisposition, number> = {
      supported: 4,
      partially_supported: 3,
      insufficient_evidence: 2,
      contradicted: 1,
      rejected: 0
    };
    return scoreMap[b.disposition] - scoreMap[a.disposition];
  });
}

/**
 * Filter candidates down to only evidence-supported hypotheses (0 to 3 max).
 * If 0 patterns qualify, returns empty array (supporting zero-opportunity outcome).
 */
export function filterSupportedHypotheses(candidates: PatternCandidate[], maxCount: number = 3): PatternCandidate[] {
  return candidates
    .filter((c) => c.disposition === "supported" || c.disposition === "partially_supported")
    .slice(0, maxCount);
}

function scorePatternMatch(
  pattern: DiagnosticPattern,
  ledger: EvidenceLedgerItem[],
  combinedText: string
): { matched: boolean; candidate: PatternCandidate } {
  const supportingIds: string[] = [];
  const contradictingIds: string[] = [];
  const triggerMatches: string[] = [];

  // Check external & interview signals
  const allSignals = [
    ...pattern.triggers.externalEvidenceSignals,
    ...pattern.triggers.interviewEvidenceSignals
  ];

  for (const signal of allSignals) {
    const signalTokens = signal.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    const hasMatch = signalTokens.some((token) => combinedText.includes(token));
    if (hasMatch) {
      triggerMatches.push(signal);
    }
  }

  // Find supporting evidence items in ledger
  for (const item of ledger) {
    const text = `${item.signal} ${item.snippet}`.toLowerCase();
    const matchesPattern = allSignals.some((sig) =>
      sig.toLowerCase().split(/\s+/).filter((t) => t.length > 3).some((token) => text.includes(token))
    );

    if (matchesPattern) {
      supportingIds.push(item.id);
    }
  }

  // Minimum trigger threshold to be considered a candidate
  if (triggerMatches.length === 0 && supportingIds.length === 0) {
    return {
      matched: false,
      candidate: {
        patternId: pattern.id,
        patternName: pattern.name,
        matchRationale: "No matching signals in company evidence.",
        supportingEvidenceIds: [],
        contradictingEvidenceIds: [],
        alternativeExplanations: [],
        remainingUncertainties: [],
        interventionType: "existing_software",
        interventionRationale: "No friction detected.",
        confidence: "Limited",
        disposition: "rejected"
      }
    };
  }

  // Disconfirmation check
  const altExplanations = pattern.alternativeExplanations;
  const remainingUncertainties = [
    ...pattern.diagnosticQuestions,
    `Verify if existing tools already have native capabilities for ${pattern.name}.`
  ];

  // Determine disposition based on evidence strength
  let disposition: PatternDisposition = "insufficient_evidence";
  let confidence: "Strong" | "Moderate" | "Limited" = "Limited";
  let interventionType: InterventionType = "ai";
  let interventionRationale = pattern.whenAiAppropriate;

  if (supportingIds.length >= 2) {
    disposition = "supported";
    confidence = "Strong";
  } else if (supportingIds.length === 1 || triggerMatches.length >= 2) {
    disposition = "partially_supported";
    confidence = "Moderate";
  }

  // Heuristic intervention check: if evidence mentions existing API / structured data, note automation fit
  if (combinedText.includes("api") || combinedText.includes("structured") || combinedText.includes("edi")) {
    interventionType = "deterministic_automation";
    interventionRationale = pattern.whenAutomationBetter;
  } else if (combinedText.includes("sop") || combinedText.includes("staffing") || combinedText.includes("training")) {
    interventionType = "process_redesign";
    interventionRationale = pattern.candidateInterventions.processRedesign.join("; ");
  }

  return {
    matched: true,
    candidate: {
      patternId: pattern.id,
      patternName: pattern.name,
      matchRationale: `Observed signals: ${triggerMatches.slice(0, 3).join(", ") || "General operational context"}`,
      supportingEvidenceIds: supportingIds,
      contradictingEvidenceIds: contradictingIds,
      alternativeExplanations: altExplanations,
      remainingUncertainties: remainingUncertainties,
      interventionType,
      interventionRationale,
      confidence,
      disposition
    }
  };
}
