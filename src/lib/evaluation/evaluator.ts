/**
 * Independent Two-Pass Report Evaluator (Dataset B Rubric Engine).
 *
 * Epistemic Process:
 * Pass 1: Mechanical Integrity (Deterministic)
 *   - Verifies 100% provenance against valid evidence_ids
 *   - Verifies zero ROI / dollar projections / numerical maturity scores
 *   - Verifies zero synthetic Dataset B exemplar text leakage
 * Pass 2: Qualitative Quality & Epistemic Stance
 *   - Evaluates company specificity, reasoning rigor, appropriate AI fit,
 *     intellectual honesty, client teaching value, and section integrity.
 */

import { EVALUATION_RULES } from "./rubric";
import type { MechanicalCheckResult, QualitativeCheckResult, ScanEvaluationResult } from "./types";
import type { ClientReport } from "@/lib/synthesis";

/**
 * Runs deterministic mechanical integrity checks (Pass 1).
 */
export function evaluateMechanicalIntegrity(
  report: ClientReport,
  validEvidenceIds: Set<string>
): MechanicalCheckResult {
  const provenanceIssues: string[] = [];
  const roiViolations: string[] = [];
  const syntheticLeakage: string[] = [];

  // 1. Provenance Check
  for (const point of report.whatWeHeard) {
    if (!point.evidenceIds || point.evidenceIds.length === 0) {
      provenanceIssues.push(`Observation in What We Heard lacks evidence citation: "${point.observation.slice(0, 50)}..."`);
    } else {
      for (const id of point.evidenceIds) {
        if (!validEvidenceIds.has(id)) {
          provenanceIssues.push(`Invalid evidence ID cited in What We Heard: ${id}`);
        }
      }
    }
  }

  for (const opp of report.opportunities) {
    if (!opp.evidenceIds || opp.evidenceIds.length === 0) {
      provenanceIssues.push(`Opportunity "${opp.title}" lacks evidence citations.`);
    } else {
      for (const id of opp.evidenceIds) {
        if (!validEvidenceIds.has(id)) {
          provenanceIssues.push(`Invalid evidence ID cited in opportunity "${opp.title}": ${id}`);
        }
      }
    }
  }

  // 2. Anti-Hype / Zero-ROI Checks across all report fields
  const serializedReport = JSON.stringify({
    headline: report.headline,
    yourBusiness: report.yourBusiness,
    whatWeHeard: report.whatWeHeard,
    aiJourney: report.aiJourney,
    aiCulture: report.aiCulture,
    dataAndTechnology: report.dataAndTechnology,
    whereAiCouldHelp: report.whereAiCouldHelp,
    opportunities: report.opportunities,
    ourTakeaway: report.ourTakeaway
  });

  for (const pattern of EVALUATION_RULES.mechanical.forbiddenRoiPatterns) {
    const match = serializedReport.match(pattern);
    if (match) {
      roiViolations.push(`Found forbidden ROI / financial precision claim: "${match[0]}"`);
    }
  }

  for (const pattern of EVALUATION_RULES.mechanical.forbiddenMaturityScores) {
    const match = serializedReport.match(pattern);
    if (match) {
      roiViolations.push(`Found forbidden numerical maturity score: "${match[0]}"`);
    }
  }

  // 3. Synthetic Dataset B Exemplar Leakage Check
  for (const sig of EVALUATION_RULES.mechanical.syntheticExemplarSignatures) {
    // Only flag if the client company itself is not legitimately named after this industry
    if (serializedReport.includes(sig) && !report.company.toLowerCase().includes(sig.toLowerCase())) {
      syntheticLeakage.push(`Detected synthetic Dataset B exemplar text leakage: "${sig}"`);
    }
  }

  const passed = provenanceIssues.length === 0 && roiViolations.length === 0 && syntheticLeakage.length === 0;

  return {
    passed,
    provenanceIssues,
    roiViolations,
    syntheticLeakage
  };
}

/**
 * Runs qualitative and epistemic evaluation checks (Pass 2).
 */
export function evaluateQualitativeQuality(report: ClientReport): QualitativeCheckResult {
  const feedback: string[] = [];

  let companySpecificity: "PASS" | "NEEDS_REVISION" = "PASS";
  let reasoningRigor: "PASS" | "NEEDS_REVISION" = "PASS";
  let appropriateAiFit: "PASS" | "NEEDS_REVISION" = "PASS";
  let intellectualHonesty: "PASS" | "NEEDS_REVISION" = "PASS";
  let clientTeachingValue: "PASS" | "NEEDS_REVISION" = "PASS";
  let sectionIntegrity: "PASS" | "NEEDS_REVISION" = "PASS";

  // Check Intellectual Honesty: What We Still Need to Learn must have entries
  if (!report.whatWeStillNeedToLearn || report.whatWeStillNeedToLearn.length === 0) {
    intellectualHonesty = "NEEDS_REVISION";
    feedback.push("Missing What We Still Need to Learn section entries. Uncertainty must be explicitly stated.");
  }

  // Check Section Integrity: Data & Tech must have systems or data identified
  if (
    (!report.dataAndTechnology.systems || report.dataAndTechnology.systems.length === 0) &&
    (!report.dataAndTechnology.dataIdentified || report.dataAndTechnology.dataIdentified.length === 0)
  ) {
    sectionIntegrity = "NEEDS_REVISION";
    feedback.push("Data & Technology section lacks identified systems or data assets.");
  }

  // Check Appropriate AI Fit: Opportunities should have clear rationale and not exceed 3
  if (report.opportunities.length > 3) {
    appropriateAiFit = "NEEDS_REVISION";
    feedback.push("Exceeded maximum of 3 opportunity items. The scan must remain tightly focused.");
  }

  // Check Company Specificity: Your Business must not be blank or purely generic
  if (!report.yourBusiness || report.yourBusiness.length < 20) {
    companySpecificity = "NEEDS_REVISION";
    feedback.push("Your Business summary is too brief or lacks operational context.");
  }

  // Check Client Teaching Value: Our Takeaway must provide a concrete recommended next step
  if (!report.ourTakeaway.recommendedNextStep || report.ourTakeaway.recommendedNextStep.length < 15) {
    clientTeachingValue = "NEEDS_REVISION";
    feedback.push("Our Takeaway is missing a concrete, grounded recommended next step.");
  }

  return {
    companySpecificity,
    reasoningRigor,
    appropriateAiFit,
    intellectualHonesty,
    clientTeachingValue,
    sectionIntegrity,
    feedback
  };
}

/**
 * Executes the full Two-Pass Evaluation against the draft client report.
 */
export function evaluateScanReport(
  report: ClientReport,
  validEvidenceIds: Set<string>
): ScanEvaluationResult {
  const mechanical = evaluateMechanicalIntegrity(report, validEvidenceIds);
  const qualitative = evaluateQualitativeQuality(report);

  const requiredRevisions: string[] = [
    ...mechanical.provenanceIssues,
    ...mechanical.roiViolations,
    ...mechanical.syntheticLeakage,
    ...qualitative.feedback
  ];

  const overallPassed = mechanical.passed && requiredRevisions.length === 0;

  return {
    overallPassed,
    mechanical,
    qualitative,
    requiredRevisions,
    evaluatedAt: Date.now()
  };
}
