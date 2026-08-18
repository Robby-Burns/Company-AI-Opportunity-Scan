import { describe, it, expect } from "vitest";
import { evaluateScanReport, evaluateHardFailures, evaluateCriteria } from "./evaluator";
import { SEED_EXEMPLARS } from "./seed-exemplars";
import { HardFailureCode } from "./types";
import type { ClientReport } from "@/lib/synthesis";

describe("Dataset B: Opportunity Scan Evaluator & Rubric", () => {
  it("contains 10 reference exemplars isolated from prompt generation context", () => {
    expect(SEED_EXEMPLARS.length).toBe(10);
    for (const ex of SEED_EXEMPLARS) {
      expect(ex.id).toBeDefined();
      expect(ex.industry).toBeDefined();
      expect(ex.businessDescription).toBeDefined();
      expect(ex.whatWeHeard.length).toBeGreaterThan(0);
      expect(ex.interventions.length).toBeGreaterThan(0);
    }
  });

  const validReport: ClientReport = {
    company: "Acme Logistics",
    website: "https://acmelogistics.example.com",
    headline: "Acme Logistics: Preliminary AI Opportunity Scan",
    generatedAt: Date.now(),
    evidenceIds: ["ev_1", "ev_2"],
    yourBusiness: "Acme Logistics operates regional freight hauling with 45 dispatchers and custom TMS integration.",
    whatWeHeard: [
      {
        observation: "Dispatchers spend 2 hours daily re-keying customer bills of lading into legacy TMS.",
        evidenceIds: ["ev_1"]
      }
    ],
    aiJourney: {
      stage: "Exploring",
      explanation: "Ad-hoc employee experimentation without formal policy."
    },
    aiCulture: {
      whatMayHelp: ["High interest in reducing manual entry"],
      whatMayMakeAdoptionHarder: ["Skepticism from senior dispatchers regarding accuracy"],
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
        wellSuited: ["Multimodal PDF document extraction"],
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

  it("passes all hard-failure checks and achieves a low penalty score for valid reports", () => {
    const validEvidenceIds = new Set(["ev_1", "ev_2"]);
    const result = evaluateScanReport(validReport, validEvidenceIds);
    expect(result.status).toBe("PASS");
    expect(result.overallPassed).toBe(true);
    expect(result.hardFailures).toHaveLength(0);
    expect(result.overallPenaltyPct).toBeLessThan(20);
    expect(result.totalPossiblePoints).toBeGreaterThan(0);
  });

  it("triggers H1 for unverified evidence citations", () => {
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
    const hChecks = evaluateHardFailures(invalidReport, validEvidenceIds);
    const h1 = hChecks.find((c) => c.code === HardFailureCode.H1);
    expect(h1?.passed).toBe(false);

    const result = evaluateScanReport(invalidReport, validEvidenceIds);
    expect(result.status).toBe("FAIL");
    expect(result.hardFailures).toContain(HardFailureCode.H1);
  });

  it("triggers H2 for forbidden financial ROI and numerical maturity scores", () => {
    const roiReport: ClientReport = {
      ...validReport,
      headline: "Acme Logistics: Save $250k with 300% ROI (Maturity 3.5/5)"
    };
    const validEvidenceIds = new Set(["ev_1", "ev_2"]);
    const result = evaluateScanReport(roiReport, validEvidenceIds);
    expect(result.status).toBe("FAIL");
    expect(result.hardFailures).toContain(HardFailureCode.H2);
  });

  it("triggers H6 for synthetic Dataset B exemplar text leakage", () => {
    const leakedReport: ClientReport = {
      ...validReport,
      yourBusiness: "Managing 2,400 residential units across 14 multi-family properties as a Regional Property Management Firm."
    };
    const validEvidenceIds = new Set(["ev_1", "ev_2"]);
    const result = evaluateScanReport(leakedReport, validEvidenceIds);
    expect(result.status).toBe("FAIL");
    expect(result.hardFailures).toContain(HardFailureCode.H6);
  });

  it("triggers H7 for unverified inferences presented as fact", () => {
    const inferentialReport: ClientReport = {
      ...validReport,
      yourBusiness: "Acme Logistics operates freight. Employees probably spend hours wrestling with manual data entry."
    };
    const validEvidenceIds = new Set(["ev_1", "ev_2"]);
    const result = evaluateScanReport(inferentialReport, validEvidenceIds);
    expect(result.status).toBe("FAIL");
    expect(result.hardFailures).toContain(HardFailureCode.H7);
  });

  it("enforces max 3 opportunities rule (O1)", () => {
    const opp = validReport.opportunities[0]!;
    const paddedReport: ClientReport = {
      ...validReport,
      opportunities: [
        opp,
        { ...opp, title: "Opp 2" },
        { ...opp, title: "Opp 3" },
        { ...opp, title: "Opp 4" }
      ]
    };
    const validEvidenceIds = new Set(["ev_1", "ev_2"]);
    const crits = evaluateCriteria(paddedReport, validEvidenceIds);
    const o1 = crits.find((c) => c.id === "O1");
    expect(o1?.verdict).toBe("FAIL");
  });
});
