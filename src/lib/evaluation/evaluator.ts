/**
 * Independent Two-Pass Report Evaluator (Dataset B Evaluation Rubric Engine).
 *
 * Epistemic Process:
 * Pass 1: Hard-Failure Gate (H1-H7)
 *   - H1: Fabricated company evidence
 *   - H2: Fabricated financial impact / ROI / numerical maturity scores
 *   - H3: Synthetic pattern presented as company-specific fact
 *   - H4: Critical evidence contradiction ignored
 *   - H5: Forced AI recommendation despite contrary evidence
 *   - H6: Dataset contamination (Dataset B synthetic signatures)
 *   - H7: Material inference presented as established fact
 *
 * Pass 2: Weighted Criterion Evaluator across 9 Dimensions
 *   - Dynamic total possible penalty calculation (no hard-coded denominator)
 *   - Criterion weights are the single source of truth
 *   - PASS = 0 penalty, PARTIAL = 0.5 * weight penalty, FAIL = 1 * weight penalty
 */

import { EVALUATION_RULES, CRITERIA } from "./rubric";
import {
  HardFailureCode,
  type HardFailureCheckResult,
  type CriterionEvaluationResult,
  type DimensionScore,
  type ScanEvaluationResult,
  type Verdict,
  type EvaluationDimension
} from "./types";
import type { ClientReport } from "@/lib/synthesis";

/**
 * Executes Pass 1: Hard Failure Gate (H1 - H7).
 */
export function evaluateHardFailures(
  report: ClientReport,
  validEvidenceIds: Set<string>
): HardFailureCheckResult[] {
  const results: HardFailureCheckResult[] = [];

  const serializedReport = JSON.stringify(report);

  // H1: Fabricated company evidence (claims with missing or invalid evidence IDs in What We Heard & Opportunities)
  let h1Failed = false;
  const h1Details: string[] = [];
  for (const point of report.whatWeHeard) {
    if (!point.evidenceIds || point.evidenceIds.length === 0) {
      h1Failed = true;
      h1Details.push(`Observation in What We Heard lacks evidence citation: "${point.observation.slice(0, 40)}..."`);
    } else {
      for (const id of point.evidenceIds) {
        if (!validEvidenceIds.has(id)) {
          h1Failed = true;
          h1Details.push(`Invalid evidence ID cited in What We Heard: ${id}`);
        }
      }
    }
  }

  for (const opp of report.opportunities) {
    if (!opp.evidenceIds || opp.evidenceIds.length === 0) {
      h1Failed = true;
      h1Details.push(`Opportunity "${opp.title}" lacks evidence citations.`);
    } else {
      for (const id of opp.evidenceIds) {
        if (!validEvidenceIds.has(id)) {
          h1Failed = true;
          h1Details.push(`Invalid evidence ID cited in opportunity "${opp.title}": ${id}`);
        }
      }
    }
  }
  results.push({
    code: HardFailureCode.H1,
    passed: !h1Failed,
    details: h1Failed ? h1Details.join("; ") : undefined
  });

  // H2: Fabricated financial impact (ROI, dollar projections, numerical maturity scores)
  let h2Failed = false;
  const h2Details: string[] = [];
  for (const pattern of EVALUATION_RULES.mechanical.forbiddenRoiPatterns) {
    const match = serializedReport.match(pattern);
    if (match) {
      h2Failed = true;
      h2Details.push(`Forbidden ROI / financial claim detected: "${match[0]}"`);
    }
  }
  for (const pattern of EVALUATION_RULES.mechanical.forbiddenMaturityScores) {
    const match = serializedReport.match(pattern);
    if (match) {
      h2Failed = true;
      h2Details.push(`Forbidden numerical maturity score detected: "${match[0]}"`);
    }
  }
  results.push({
    code: HardFailureCode.H2,
    passed: !h2Failed,
    details: h2Failed ? h2Details.join("; ") : undefined
  });

  // H3: Synthetic pattern presented as company fact without evidence
  let h3Failed = false;
  const h3Details: string[] = [];
  for (const opp of report.opportunities) {
    if (opp.whyItStoodOut.toLowerCase().includes("industry standard") && (!opp.evidenceIds || opp.evidenceIds.length === 0)) {
      h3Failed = true;
      h3Details.push(`Industry pattern presented as company fact in opportunity: "${opp.title}"`);
    }
  }
  results.push({
    code: HardFailureCode.H3,
    passed: !h3Failed,
    details: h3Failed ? h3Details.join("; ") : undefined
  });

  // H4: Critical evidence contradiction ignored
  let h4Failed = false;
  const h4Details: string[] = [];
  const hardAdoptionBlocks = report.aiCulture?.whatMayMakeAdoptionHarder || [];
  for (const opp of report.opportunities) {
    for (const block of hardAdoptionBlocks) {
      if (
        block.toLowerCase().includes("no api") &&
        opp.potentialApproach === "automation" &&
        !opp.thingsToWatch.some((t) => t.toLowerCase().includes("api"))
      ) {
        h4Failed = true;
        h4Details.push(`Opportunity "${opp.title}" ignores identified blocker: "${block}"`);
      }
    }
  }
  results.push({
    code: HardFailureCode.H4,
    passed: !h4Failed,
    details: h4Failed ? h4Details.join("; ") : undefined
  });

  // H5: Forced AI recommendation
  let h5Failed = false;
  const h5Details: string[] = [];
  for (const opp of report.opportunities) {
    if (
      opp.potentialApproach === "ai" &&
      report.whereAiCouldHelp?.fitBreakdown?.traditionalAutomationSuited?.some((item) =>
        item.toLowerCase().includes(opp.title.toLowerCase())
      )
    ) {
      h5Failed = true;
      h5Details.push(`Forced AI recommendation for opportunity suited to traditional automation: "${opp.title}"`);
    }
  }
  results.push({
    code: HardFailureCode.H5,
    passed: !h5Failed,
    details: h5Failed ? h5Details.join("; ") : undefined
  });

  // H6: Dataset contamination (Dataset B synthetic signatures appearing in client report)
  let h6Failed = false;
  const h6Details: string[] = [];
  for (const sig of EVALUATION_RULES.mechanical.syntheticExemplarSignatures) {
    if (serializedReport.includes(sig) && !report.company.toLowerCase().includes(sig.toLowerCase())) {
      h6Failed = true;
      h6Details.push(`Dataset B synthetic signature leaked into report: "${sig}"`);
    }
  }
  results.push({
    code: HardFailureCode.H6,
    passed: !h6Failed,
    details: h6Failed ? h6Details.join("; ") : undefined
  });

  // H7: Material inference presented as established fact
  let h7Failed = false;
  const h7Details: string[] = [];
  for (const pattern of EVALUATION_RULES.mechanical.unverifiedInferencePatterns) {
    const match = serializedReport.match(pattern);
    if (match) {
      h7Failed = true;
      h7Details.push(`Material unverified inference presented as fact: "${match[0]}"`);
    }
  }
  results.push({
    code: HardFailureCode.H7,
    passed: !h7Failed,
    details: h7Failed ? h7Details.join("; ") : undefined
  });

  return results;
}

/**
 * Executes Pass 2: Criterion Evaluator.
 */
export function evaluateCriteria(
  report: ClientReport,
  validEvidenceIds: Set<string>
): CriterionEvaluationResult[] {
  const results: CriterionEvaluationResult[] = [];

  for (const crit of CRITERIA) {
    let verdict: Verdict = "PASS";
    let reason: string | undefined = undefined;

    switch (crit.id) {
      // Evidence
      case "E1":
        // Evaluated via H1
        verdict = "PASS";
        break;
      case "E2":
        if (report.whatWeHeard.some((w) => !w.evidenceIds || w.evidenceIds.length === 0)) {
          verdict = "PARTIAL";
          reason = "Some observations in What We Heard lack complete provenance citations.";
        }
        break;
      case "E3":
        if (report.yourBusiness.toLowerCase().includes("typically companies in this sector")) {
          verdict = "PARTIAL";
          reason = "Report mentions sector patterns in company summary.";
        }
        break;
      case "E4":
        if (report.whatWeHeard.length === 0) {
          verdict = "FAIL";
          reason = "Missing What We Heard evidence observations.";
        }
        break;
      case "E6":
        // Client-facing attribution check
        if (report.whatWeHeard.some((w) => w.evidenceIds.length === 0)) {
          verdict = "PARTIAL";
          reason = "Missing evidence attribution on some claims.";
        }
        break;
      case "E7":
        if (!report.whatWeStillNeedToLearn || report.whatWeStillNeedToLearn.length === 0) {
          verdict = "PARTIAL";
          reason = "Material assumptions and missing evidence questions not explicitly listed.";
        }
        break;

      // Reasoning
      case "R1":
        if (!report.ourTakeaway.whatWeUnderstand) {
          verdict = "FAIL";
          reason = "Our Takeaway lacks underlying understanding narrative.";
        }
        break;
      case "R2":
        if (report.opportunities.some((o) => !o.whyItStoodOut)) {
          verdict = "PARTIAL";
          reason = "An opportunity skips the intermediate observation step.";
        }
        break;
      case "R3":
        if (!report.aiCulture.whatMayMakeAdoptionHarder || report.aiCulture.whatMayMakeAdoptionHarder.length === 0) {
          verdict = "PARTIAL";
          reason = "Contradictory adoption friction not explicitly acknowledged.";
        }
        break;
      case "R4":
        if (!report.whereAiCouldHelp.fitBreakdown.traditionalAutomationSuited) {
          verdict = "PARTIAL";
          reason = "Alternative explanations and traditional automation fits not explored.";
        }
        break;
      case "R5":
        if (report.opportunities.some((o) => !o.thingsToWatch || o.thingsToWatch.length === 0)) {
          verdict = "PARTIAL";
          reason = "Disconfirmation paths (things to watch) missing from opportunities.";
        }
        break;
      case "R6":
        if (report.opportunities.some((o) => o.potentialValue.toLowerCase().includes("will guarantee"))) {
          verdict = "FAIL";
          reason = "Implying guaranteed outcomes instead of potential benefits.";
        }
        break;

      // AI Fit
      case "AI1":
        if (report.opportunities.some((o) => o.potentialApproach === "ai" && o.title.toLowerCase().includes("routing"))) {
          verdict = "PARTIAL";
          reason = "Recommending AI for deterministic routing.";
        }
        break;
      case "AI2":
        if (!report.whereAiCouldHelp.fitBreakdown.humanJudgmentRequired || report.whereAiCouldHelp.fitBreakdown.humanJudgmentRequired.length === 0) {
          verdict = "PARTIAL";
          reason = "Human-led alternatives not explicitly distinguished in fit breakdown.";
        }
        break;
      case "AI3":
        if (!report.ourTakeaway.whatMayNeedImprovementFirst) {
          verdict = "PARTIAL";
          reason = "Process improvement alternatives not evaluated in takeaway.";
        }
        break;
      case "AI4":
        // Evaluated via H5
        verdict = "PASS";
        break;
      case "AI5":
        if (report.opportunities.some((o) => o.title.toLowerCase().includes("gpt-4") || o.title.toLowerCase().includes("vector database"))) {
          verdict = "PARTIAL";
          reason = "Opportunity title specifies premature low-level implementation details.";
        }
        break;
      case "AI6":
        if (report.opportunities.some((o) => o.thingsToWatch.length === 0)) {
          verdict = "PARTIAL";
          reason = "Material risks or review requirements omitted.";
        }
        break;

      // Client Value
      case "CV1":
        if (!report.yourBusiness || report.yourBusiness.length < 20) {
          verdict = "FAIL";
          reason = "Business context summary is insufficient.";
        }
        break;
      case "CV2":
        if (!report.whereAiCouldHelp.fitBreakdown.wellSuited) {
          verdict = "PARTIAL";
          reason = "Explicit AI fit vs non-AI fit breakdown missing.";
        }
        break;
      case "CV3":
        if (!report.aiJourney.stage || !report.aiJourney.explanation) {
          verdict = "FAIL";
          reason = "Current AI journey position not explained.";
        }
        break;
      case "CV4":
        if (report.opportunities.length === 0 && report.whatWeHeard.length < 2) {
          verdict = "PARTIAL";
          reason = "Limited insights surfaced in scan.";
        }
        break;
      case "CV5":
        if (!report.ourTakeaway.recommendedNextStep || report.ourTakeaway.recommendedNextStep.length < 15) {
          verdict = "FAIL";
          reason = "Missing concrete, grounded recommended next step.";
        }
        break;
      case "CV6":
        if (!report.dataAndTechnology.whyThisMatters) {
          verdict = "PARTIAL";
          reason = "Report does not explain what must be true for technology to work.";
        }
        break;

      // Uncertainty
      case "U1":
        if (!report.whatWeStillNeedToLearn || report.whatWeStillNeedToLearn.length === 0) {
          verdict = "FAIL";
          reason = "What We Still Need to Learn section is empty.";
        }
        break;
      case "U2":
        if (report.opportunities.some((o) => !o.confidenceReason)) {
          verdict = "PARTIAL";
          reason = "Confidence reasons missing for some opportunities.";
        }
        break;
      case "U3":
        // Evaluated via H2
        verdict = "PASS";
        break;
      case "U4":
        if (report.yourBusiness.match(/\d+%/)) {
          verdict = "PARTIAL";
          reason = "Numerical precision in business summary without source.";
        }
        break;

      // Business Impact
      case "B1":
        // Evaluated via H2
        verdict = "PASS";
        break;
      case "B2":
        if (report.opportunities.some((o) => o.potentialValue.match(/\$\d+/))) {
          verdict = "FAIL";
          reason = "Financial figures in potential value not presented qualitatively.";
        }
        break;
      case "B3":
        if (report.opportunities.some((o) => !o.potentialValue)) {
          verdict = "PARTIAL";
          reason = "Potential value missing from an opportunity.";
        }
        break;

      // Report Quality
      case "Q1":
        if (JSON.stringify(report).length > 20000) {
          verdict = "PARTIAL";
          reason = "Report contains excessive wordiness.";
        }
        break;
      case "Q2":
        verdict = "PASS";
        break;
      case "Q3":
        if (!report.headline || !report.yourBusiness || !report.ourTakeaway) {
          verdict = "FAIL";
          reason = "Key report sections are missing.";
        }
        break;
      case "Q4":
        if (!report.whatWeHeard.length || !report.ourTakeaway.recommendedNextStep) {
          verdict = "FAIL";
          reason = "Incomplete evidence-to-recommendation narrative.";
        }
        break;
      case "Q5":
        if (report.headline.toLowerCase().includes("ai transformational roadmap")) {
          verdict = "PARTIAL";
          reason = "Headline sounds like hype marketing instead of business assessment.";
        }
        break;
      case "Q6":
        if (!report.dataAndTechnology.systems || report.dataAndTechnology.systems.length === 0) {
          verdict = "PARTIAL";
          reason = "Data & technology systems listing missing.";
        }
        break;
      case "Q7":
        verdict = "PASS";
        break;

      // Foundations
      case "F1":
        if (!report.dataAndTechnology.dataIdentified || report.dataAndTechnology.dataIdentified.length === 0) {
          verdict = "PARTIAL";
          reason = "Data limitations/sources not identified.";
        }
        break;
      case "F2":
        if (!report.whereAiCouldHelp.workflowFriction || report.whereAiCouldHelp.workflowFriction.length === 0) {
          verdict = "PARTIAL";
          reason = "Workflow friction points not identified.";
        }
        break;
      case "F3":
        if (!report.dataAndTechnology.crossSystemFlow || report.dataAndTechnology.crossSystemFlow.length === 0) {
          verdict = "PARTIAL";
          reason = "Cross-system technology flows not identified.";
        }
        break;
      case "F4":
        if (!report.aiCulture.whatMayMakeAdoptionHarder || report.aiCulture.whatMayMakeAdoptionHarder.length === 0) {
          verdict = "PARTIAL";
          reason = "People/adoption considerations not identified.";
        }
        break;
      case "F5":
        if (!report.ourTakeaway.whatMayNeedImprovementFirst) {
          verdict = "PARTIAL";
          reason = "Distinction of what needs improvement first missing.";
        }
        break;
      case "F6":
        if (report.dataAndTechnology.whyThisMatters.length > 500) {
          verdict = "PARTIAL";
          reason = "Data & technology section turns into overly long technical audit.";
        }
        break;

      // Opportunity Count
      case "O1":
        if (report.opportunities.length > 3) {
          verdict = "FAIL";
          reason = "Report exceeds maximum allowed limit of 3 opportunities.";
        }
        break;
    }

    const penaltyFactor = verdict === "PASS" ? 0 : verdict === "PARTIAL" ? 0.5 : 1;
    const penalty = crit.weight * penaltyFactor;

    results.push({
      id: crit.id,
      description: crit.description,
      dimension: crit.dimension,
      weight: crit.weight,
      verdict,
      penalty,
      reason
    });
  }

  return results;
}

/**
 * Main entry point — executes the full evaluation against a draft ClientReport.
 */
export function evaluateScanReport(
  report: ClientReport,
  validEvidenceIds: Set<string>,
  revisionCycle: number = 0
): ScanEvaluationResult {
  // 1️⃣ Run Pass 1: Hard Failure Gate
  const hardChecks = evaluateHardFailures(report, validEvidenceIds);
  const failedHardChecks = hardChecks.filter((c) => !c.passed);

  if (failedHardChecks.length > 0) {
    const hardFailures = failedHardChecks.map((c) => c.code);
    const hardFailureDetails = failedHardChecks.map((c) => `${c.code}: ${c.details || "Hard failure triggered"}`);

    const dimensionScores: Record<EvaluationDimension, DimensionScore> = {
      "Evidence": { dimension: "Evidence", penaltyPoints: 0, maxPoints: 0, penaltyPct: 100 },
      "Reasoning": { dimension: "Reasoning", penaltyPoints: 0, maxPoints: 0, penaltyPct: 100 },
      "AI Fit": { dimension: "AI Fit", penaltyPoints: 0, maxPoints: 0, penaltyPct: 100 },
      "Client Value": { dimension: "Client Value", penaltyPoints: 0, maxPoints: 0, penaltyPct: 100 },
      "Uncertainty": { dimension: "Uncertainty", penaltyPoints: 0, maxPoints: 0, penaltyPct: 100 },
      "Business Impact": { dimension: "Business Impact", penaltyPoints: 0, maxPoints: 0, penaltyPct: 100 },
      "Report Quality": { dimension: "Report Quality", penaltyPoints: 0, maxPoints: 0, penaltyPct: 100 },
      "Foundations": { dimension: "Foundations", penaltyPoints: 0, maxPoints: 0, penaltyPct: 100 },
      "Opportunity Count": { dimension: "Opportunity Count", penaltyPoints: 0, maxPoints: 0, penaltyPct: 100 }
    };

    return {
      status: "FAIL",
      overallPassed: false,
      hardFailures,
      hardFailureDetails,
      totalPenaltyPoints: 0,
      totalPossiblePoints: 0,
      overallPenaltyPct: 100,
      dimensionScores,
      criterionResults: [],
      requiredRevisions: hardFailureDetails,
      revisionCycle,
      evaluatedAt: Date.now()
    };
  }

  // 2️⃣ Run Pass 2: Criterion Evaluator
  const criterionResults = evaluateCriteria(report, validEvidenceIds);

  // Compute dynamic total penalty and total possible points
  const totalPossiblePoints = criterionResults.reduce((sum, c) => sum + c.weight, 0);
  const totalPenaltyPoints = criterionResults.reduce((sum, c) => sum + c.penalty, 0);
  const overallPenaltyPct = totalPossiblePoints === 0 ? 0 : Number(((totalPenaltyPoints / totalPossiblePoints) * 100).toFixed(1));

  // Aggregate dimension scores
  const dimensionsList: EvaluationDimension[] = [
    "Evidence",
    "Reasoning",
    "AI Fit",
    "Client Value",
    "Uncertainty",
    "Business Impact",
    "Report Quality",
    "Foundations",
    "Opportunity Count"
  ];

  const dimensionScores: Record<EvaluationDimension, DimensionScore> = {} as Record<EvaluationDimension, DimensionScore>;
  for (const dim of dimensionsList) {
    const dimCrits = criterionResults.filter((c) => c.dimension === dim);
    const maxPoints = dimCrits.reduce((sum, c) => sum + c.weight, 0);
    const penaltyPoints = dimCrits.reduce((sum, c) => sum + c.penalty, 0);
    const penaltyPct = maxPoints === 0 ? 0 : Number(((penaltyPoints / maxPoints) * 100).toFixed(1));
    dimensionScores[dim] = { dimension: dim, penaltyPoints, maxPoints, penaltyPct };
  }

  // Determine required revisions
  const requiredRevisions = criterionResults
    .filter((c) => c.verdict !== "PASS" && c.reason)
    .map((c) => `[${c.id} - ${c.dimension}] ${c.reason}`);

  // Status thresholds: <= 30% penalty is PASS, > 30% penalty is NEEDS_REVISION
  const status: "PASS" | "FAIL" | "NEEDS_REVISION" = overallPenaltyPct > 30 ? "NEEDS_REVISION" : "PASS";
  const overallPassed = status === "PASS";

  return {
    status,
    overallPassed,
    hardFailures: [],
    hardFailureDetails: [],
    totalPenaltyPoints,
    totalPossiblePoints,
    overallPenaltyPct,
    dimensionScores,
    criterionResults,
    requiredRevisions,
    revisionCycle,
    evaluatedAt: Date.now()
  };
}
