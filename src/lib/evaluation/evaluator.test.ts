import { describe, it, expect } from "vitest";
import { evaluateScanReport, evaluateMechanicalIntegrity, evaluateQualitativeQuality } from "./evaluator";
import { SEED_EXEMPLARS } from "./seed-exemplars";
import type { ClientReport } from "@/lib/synthesis";

describe("Dataset B: Quality Evaluation Engine & Exemplars", () => {
  it("contains 10 reference exemplars strictly isolated from prompt generation", () => {
    expect(SEED_EXEMPLARS.length).toBe(10);
    for (const ex of SEED_EXEMPLARS) {
      expect(ex.id).toBeDefined();
      expect(ex.industry).toBeDefined();
      expect(ex.businessDescription).toBeDefined();
      expect(ex.whatWeHeard.length).toBeGreaterThan(0);
      expect(ex.interventions.length).toBeGreaterThan(0);
      expect(ex.whatWeStillNeedToLearn).toBeDefined();
      expect(ex.ourTakeaway).toBeDefined();
    }
  });

  const validReport: ClientReport = {
    company: "Acme Logistics",
    website: "https://acmelogistics.example.com",
    headline: "Acme Logistics: Preliminary AI Opportunity Scan",
    generatedAt: Date.now(),
    evidenceIds: ["ev_1", "ev_2"],
    yourBusiness: "Acme Logistics operates regional freight hauling with 45 dispatchers.",
    whatWeHeard: [
      {
        observation: "Dispatchers spend 2 hours daily re-keying customer bills of lading.",
        evidenceIds: ["ev_1"]
      }
    ],
    aiJourney: {
      stage: "Exploring",
      explanation: "Ad-hoc employee experimentation without formal policy."
    },
    aiCulture: {
      whatMayHelp: ["High interest in reducing manual entry"],
      whatMayMakeAdoptionHarder: ["Skepticism from senior dispatchers"],
      whereAiMayHelp: "Drafting structured manifests"
    },
    dataAndTechnology: {
      dataIdentified: [{ data: "Bills of Lading", location: "Email / PDF", relevance: "Core dispatch" }],
      systems: ["Legacy TMS", "Outlook"],
      crossSystemFlow: ["Manual PDF transcription to TMS"],
      whyThisMatters: "Data siloing slows invoicing."
    },
    whereAiCouldHelp: {
      workflowFriction: [{ stage: "Intake", friction: "PDF transcription", evidenceIds: ["ev_1"] }],
      leveragePatterns: [{ category: "Boring administrative work", observation: "Manual data entry", evidenceIds: ["ev_1"] }],
      fitBreakdown: {
        wellSuited: ["Multimodal PDF ingestion"],
        traditionalAutomationSuited: ["TMS status webhooks"],
        humanJudgmentRequired: ["Carrier price negotiation"]
      }
    },
    opportunities: [
      {
        title: "Intelligent BOL Extraction",
        whyItStoodOut: "High daily volume of repetitive document re-entry.",
        potentialValue: "Operational leverage across dispatch without altering the core routing engine.",
        potentialApproach: "ai",
        evidenceConfidence: "Strong",
        confidenceReason: "Direct interview confirmation and confirmed TMS fields.",
        whatWeStillNeedToLearn: ["TMS API payload documentation"],
        thingsToWatch: ["Handwritten notation accuracy"],
        evidenceIds: ["ev_1"],
        status: "Potential opportunity"
      }
    ],
    whatWeStillNeedToLearn: [
      {
        question: "Can the TMS ingest structured JSON via API?",
        whyItMatters: "Determines if human-in-the-loop copy-paste is required.",
        evidenceNeeded: "TMS vendor documentation"
      }
    ],
    ourTakeaway: {
      whatWeUnderstand: "The bottleneck is in front-office intake rather than on-the-road dispatch.",
      whatAppearsWorthExploring: "Document ingestion for non-standard bills of lading.",
      whatMayNeedImprovementFirst: "Standardizing client PDF intake.",
      whatWeDontKnowYet: "TMS API write capabilities.",
      recommendedNextStep: "Audit sample customer PDF layouts and test parser feasibility."
    }
  };

  it("passes mechanical integrity for compliant reports", () => {
    const validEvidenceIds = new Set(["ev_1", "ev_2"]);
    const mech = evaluateMechanicalIntegrity(validReport, validEvidenceIds);
    expect(mech.passed).toBe(true);
    expect(mech.provenanceIssues).toHaveLength(0);
    expect(mech.roiViolations).toHaveLength(0);
    expect(mech.syntheticLeakage).toHaveLength(0);
  });

  it("catches invalid evidence provenance", () => {
    const invalidReport: ClientReport = {
      ...validReport,
      whatWeHeard: [
        {
          observation: "Unverified claim with fake ID",
          evidenceIds: ["fake_id_999"]
        }
      ]
    };
    const validEvidenceIds = new Set(["ev_1", "ev_2"]);
    const mech = evaluateMechanicalIntegrity(invalidReport, validEvidenceIds);
    expect(mech.passed).toBe(false);
    expect(mech.provenanceIssues.length).toBeGreaterThan(0);
  });

  it("catches forbidden financial ROI claims and numerical maturity scores", () => {
    const roiReport: ClientReport = {
      ...validReport,
      headline: "Acme Logistics: Save $250k with 300% ROI (Maturity 3.5/5)"
    };
    const validEvidenceIds = new Set(["ev_1", "ev_2"]);
    const mech = evaluateMechanicalIntegrity(roiReport, validEvidenceIds);
    expect(mech.passed).toBe(false);
    expect(mech.roiViolations.length).toBeGreaterThan(0);
  });

  it("catches synthetic Dataset B exemplar text leakage", () => {
    const leakedReport: ClientReport = {
      ...validReport,
      yourBusiness: "Managing 2,400 residential units across 14 multi-family properties as a Regional Property Management Firm."
    };
    const validEvidenceIds = new Set(["ev_1", "ev_2"]);
    const mech = evaluateMechanicalIntegrity(leakedReport, validEvidenceIds);
    expect(mech.passed).toBe(false);
    expect(mech.syntheticLeakage.length).toBeGreaterThan(0);
  });

  it("runs full two-pass evaluation and returns structured report", () => {
    const validEvidenceIds = new Set(["ev_1", "ev_2"]);
    const result = evaluateScanReport(validReport, validEvidenceIds);
    expect(result.overallPassed).toBe(true);
    expect(result.qualitative.intellectualHonesty).toBe("PASS");
    expect(result.qualitative.companySpecificity).toBe("PASS");
    expect(result.qualitative.sectionIntegrity).toBe("PASS");
  });
});
