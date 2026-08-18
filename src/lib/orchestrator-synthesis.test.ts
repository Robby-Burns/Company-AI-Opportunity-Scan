import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Coverage-controlled interview + synthesis contract tests (Company AI Opportunity Scan).
 */
vi.mock("@/lib/llm", () => {
  const fn = vi.fn();
  return {
    complete: fn,
    extractJson: (t: string) => {
      try { return JSON.parse(t); } catch { return null; }
    },
    __completeMock: fn
  };
});

import * as llmModule from "@/lib/llm";
import { createScan, addEvidence, listEvidence, deleteScan, allScans } from "@/lib/evidence/store";
import { initInterview, nextQuestion, ingestResponse, isInterviewFinished } from "@/lib/orchestrator";
import { synthesizeReports, sanitizeNoRoi, type ClientReport } from "@/lib/synthesis";
import { selectDimension, selectCandidate } from "@/lib/interview/coordinator";
import { renderClientSummaryPdf } from "@/lib/pdf";
import type { CandidateQuestion, DimensionCoverage, LensId } from "@/lib/interview/types";

const completeMock = (llmModule as unknown as { __completeMock: ReturnType<typeof vi.fn> }).__completeMock;

function setupScan(id: string) {
  createScan({
    id, company: "Acme Logistics", website: "https://acme.com", email: "a@acme.com",
    retentionScrapedDays: 90, retentionAnswersDays: 365
  });
  addEvidence(id, { kind: "SCRAPED_TECH", source: "https://acme.com", snippet: "uses hubspot and quickbooks", signal: "uses:quickbooks", confidence: "medium" });
  addEvidence(id, { kind: "SCRAPED_WEB", source: "https://acme.com/about", snippet: "family logistics company doing freight brokerage", signal: "page:/about", confidence: "medium" });
}

function clearStores() {
  for (const s of allScans()) deleteScan(s.id);
}

/** Coordinator response: ONE lens + depth + optional coverage update + complete. */
function mockCoordinator(lens: LensId, depth = 1, opts: { complete?: boolean; coverageUpdate?: { dimension: LensId; coverage: "NOT_STARTED" | "LIGHT" | "ADEQUATE" | "DEEP" } } = {}) {
  completeMock.mockResolvedValueOnce({
    json: {
      lens,
      depth,
      coverageUpdate: opts.coverageUpdate ? {
        dimension: opts.coverageUpdate.dimension,
        coverage: opts.coverageUpdate.coverage,
        confidence: "medium" as const,
        keyFacts: [`${opts.coverageUpdate.dimension} fact`],
        knownUnknowns: [],
        evidenceIds: [],
        unresolvedGaps: [],
        answerRichness: "moderate" as const,
        notApplicable: false
      } : undefined,
      complete: opts.complete ?? false,
      rationale: "test",
      candidateCount: 2
    },
    text: "", tokensIn: 1, tokensOut: 1
  });
}

/** Specialist response: 2 candidates for the given lens. */
function mockCandidates(lens: LensId, q1: string, q2 = `alt-${lens}`, noveltyA = 0.7, noveltyB = 0.5) {
  completeMock.mockResolvedValueOnce({
    json: {
      candidates: [
        {
          question: { text: q1, kind: "short" },
          lens,
          depth: 1,
          expectedSignal: `${lens}-sig-a`,
          scores: { novelty: noveltyA, coverageGain: 0.7, companyUnderstanding: 0.7, answerable: 0.8, specific: 0.6, conversational: 0.8, depthAppropriate: 0.7 },
          rationale: "a"
        },
        {
          question: { text: q2, kind: "short" },
          lens,
          depth: 1,
          expectedSignal: `${lens}-sig-b`,
          scores: { novelty: noveltyB, coverageGain: 0.6, companyUnderstanding: 0.6, answerable: 0.8, specific: 0.5, conversational: 0.7, depthAppropriate: 0.7 },
          rationale: "b"
        }
      ]
    },
    text: "", tokensIn: 1, tokensOut: 1
  });
}

/** Drive one full turn: coordinator (1 call) + specialist (1 call). */
async function turn(id: string, lens: LensId, qText: string, opts?: { depth?: number; coverageUpdate?: { dimension: LensId; coverage: "NOT_STARTED" | "LIGHT" | "ADEQUATE" | "DEEP" }; complete?: boolean; noveltyA?: number }) {
  mockCoordinator(lens, opts?.depth ?? 1, { coverageUpdate: opts?.coverageUpdate, complete: opts?.complete });
  mockCandidates(lens, qText, `alt-${lens}`, opts?.noveltyA ?? 0.7);
  return nextQuestion(id);
}

describe("Interview bounds (spec §7.1: hard stop at max)", () => {
  const id = "iv-max";
  beforeEach(() => { clearStores(); setupScan(id); initInterview(id); completeMock.mockReset(); });
  afterEach(() => deleteScan(id));

  it("terminates automatically when maxQuestions is reached", async () => {
    for (let i = 1; i <= 12; i++) {
      const q = await turn(id, (["business", "operations", "systems", "data", "people"] as LensId[])[(i - 1) % 5]!, `Question ${i}`);
      expect(q).not.toBeNull();
      await ingestResponse(id, q!.id, `Answer ${i}`);
    }
    expect(isInterviewFinished(id)).toBe(true);
    const after = await nextQuestion(id);
    expect(after).toBeNull();
  });
});

describe("Deterministic Coordinator and Selection (§5)", () => {
  it("selectCandidate picks the highest weighted novelty candidate", () => {
    const c1: CandidateQuestion = {
      question: { text: "Q1", kind: "short" },
      lens: "business",
      depth: 1,
      expectedSignal: "sig1",
      scores: { novelty: 0.9, coverageGain: 0.8, companyUnderstanding: 0.8, answerable: 0.9, specific: 0.7, conversational: 0.9, depthAppropriate: 0.8 },
      rationale: "r1"
    };
    const c2: CandidateQuestion = {
      question: { text: "Q2", kind: "short" },
      lens: "business",
      depth: 1,
      expectedSignal: "sig2",
      scores: { novelty: 0.3, coverageGain: 0.4, companyUnderstanding: 0.4, answerable: 0.5, specific: 0.4, conversational: 0.5, depthAppropriate: 0.5 },
      rationale: "r2"
    };
    const sel = selectCandidate([c1, c2], []);
    expect(sel?.selected.question.text).toBe("Q1");
  });

  it("selectDimension targets lowest coverage dimension deterministically", () => {
    const cov = new Map<LensId, DimensionCoverage>([
      ["business", { dimension: "business", coverage: "DEEP", confidence: "high", keyFacts: [], knownUnknowns: [], evidenceIds: [], unresolvedGaps: [], answerRichness: "rich", notApplicable: false, depth: 1, questionsAsked: 1, lastQuestionNumber: 1 }],
      ["operations", { dimension: "operations", coverage: "ADEQUATE", confidence: "high", keyFacts: [], knownUnknowns: [], evidenceIds: [], unresolvedGaps: [], answerRichness: "rich", notApplicable: false, depth: 1, questionsAsked: 1, lastQuestionNumber: 2 }],
      ["systems", { dimension: "systems", coverage: "LIGHT", confidence: "medium", keyFacts: [], knownUnknowns: [], evidenceIds: [], unresolvedGaps: [], answerRichness: "moderate", notApplicable: false, depth: 1, questionsAsked: 1, lastQuestionNumber: 3 }],
      ["data", { dimension: "data", coverage: "NOT_STARTED", confidence: "low", keyFacts: [], knownUnknowns: [], evidenceIds: [], unresolvedGaps: [], answerRichness: "thin", notApplicable: false, depth: 1, questionsAsked: 0, lastQuestionNumber: 0 }],
      ["people", { dimension: "people", coverage: "LIGHT", confidence: "medium", keyFacts: [], knownUnknowns: [], evidenceIds: [], unresolvedGaps: [], answerRichness: "moderate", notApplicable: false, depth: 1, questionsAsked: 1, lastQuestionNumber: 4 }]
    ]);
    const { dimension } = selectDimension("business", cov, ["business"], 1);
    expect(dimension).toBe("systems");
  });
});

describe("Re-Analysis & Synthesis Engine — 9-Section Opportunity Scan Structure", () => {
  const id = "syn-9sec";
  beforeEach(() => { clearStores(); completeMock.mockReset(); });
  afterEach(() => deleteScan(id));

  it("Scenario 1: Mustang Sign Company — Generates rich 9-section report with strict provenance and anti-ROI rules", async () => {
    createScan({
      id, company: "Mustang Sign Company", website: "https://mustangsignco.com", email: "info@mustangsignco.com",
      location: "Kennewick, WA",
      retentionScrapedDays: 90, retentionAnswersDays: 365
    });

    addEvidence(id, { kind: "SCRAPED_WEB", source: "https://mustangsignco.com", snippet: "Custom signage in Tri-Cities, WA. Vehicles, monuments, illuminated channel letters.", signal: "company:custom_signage", confidence: "high" });
    const ev2 = addEvidence(id, { kind: "SCRAPED_TECH", source: "https://mustangsignco.com", snippet: "Powered by shopVOX sign estimating software.", signal: "uses:shopvox", confidence: "high" });
    const ev3 = addEvidence(id, { kind: "PROSPECT_REPORTED", source: "interview-q1", snippet: "Estimators spend 45 minutes looking up Kennewick municipal sign codes and setback rules for every monument sign quote.", signal: "friction:municipal_code_lookup", confidence: "high" });
    const ev4 = addEvidence(id, { kind: "PROSPECT_REPORTED", source: "interview-q2", snippet: "Estimators rebuild quotes from scratch because historical recipes in shopVOX are hard to search.", signal: "friction:recipe_rebuild", confidence: "high" });
    const ev5 = addEvidence(id, { kind: "PROSPECT_REPORTED", source: "interview-q3", snippet: "Sent quotes often wait 4-5 days for manual follow-up nudges.", signal: "friction:quote_followup_lag", confidence: "medium" });

    completeMock.mockResolvedValueOnce({
      json: {
        headline: "Mustang Sign Company: Preliminary AI Opportunity Scan",
        yourBusiness: "Mustang Sign Company is a custom architectural, commercial, and vehicle signage fabricator based in Kennewick, Washington.",
        whatWeHeard: [
          { observation: "Estimators spend 45 minutes manually cross-referencing Tri-Cities municipal code PDFs for each monument quote.", evidenceIds: [ev3!.id] },
          { observation: "shopVOX is used for estimating, but historical recipes and material specs are manually rebuilt from scratch.", evidenceIds: [ev4!.id, ev2!.id] },
          { observation: "Quote follow-up is manual and frequently delayed when estimator volume peaks.", evidenceIds: [ev5!.id] }
        ],
        aiJourney: {
          stage: "Exploring",
          explanation: "Mustang Sign Company has digital operations in shopVOX and Microsoft Teams, but workflows remain largely manual with estimators carrying significant research burden."
        },
        aiCulture: {
          whatMayHelp: ["Team is eager to eliminate repetitive municipal code lookups", "Clear desire to keep final quote review human-led"],
          whatMayMakeAdoptionHarder: ["Custom nature of architectural signs requires human judgment"],
          whereAiMayHelp: "AI can draft and assemble information while keeping approval firmly with the estimator."
        },
        dataAndTechnology: {
          dataIdentified: [
            { data: "Municipal Sign Codes (KMC/PMC/RMC)", location: "Public city PDFs and planning docs", relevance: "Zoning limits" },
            { data: "Historical Won Estimates & Recipes", location: "shopVOX and internal spreadsheets", relevance: "Part lists and labor hours" }
          ],
          systems: ["shopVOX", "Microsoft Teams", "Excel Spreadsheets"],
          crossSystemFlow: ["Estimators manually copy specs between email, shopVOX, and spreadsheets."],
          whyThisMatters: "Your operational data is split between structured tools like shopVOX and unstructured municipal PDF regulations."
        },
        whereAiCouldHelp: {
          workflowFriction: [
            { stage: "Inquiry & Address Verification", friction: "Manual confirmation of municipal jurisdiction", evidenceIds: [ev3!.id] },
            { stage: "Zoning & Compliance Lookup", friction: "Manual cross-referencing of height and setback rules", evidenceIds: [ev3!.id] },
            { stage: "Estimate Drafting", friction: "Manual lookup of past project recipes and parts in shopVOX", evidenceIds: [ev4!.id] },
            { stage: "Estimate Follow-up", friction: "Follow-ups dropped due to rep workload", evidenceIds: [ev5!.id] }
          ],
          leveragePatterns: [
            { category: "Information retrieval", observation: "Searching municipal code regulations for height/setback limits.", evidenceIds: [ev3!.id] },
            { category: "Boring administrative work", observation: "Pulling historical part lists from past jobs to draft new quotes.", evidenceIds: [ev4!.id] },
            { category: "Communication gaps", observation: "Nudging clients on unapproved quotes after 3 business days.", evidenceIds: [ev5!.id] }
          ],
          fitBreakdown: {
            wellSuited: ["Municipal zoning code retrieval and summarization", "Drafting estimate follow-up messages"],
            traditionalAutomationSuited: ["Calculating mileage travel SKU fees from address distance", "shopVOX margin calculations"],
            humanJudgmentRequired: ["Custom design adjustments", "Final price approval and customer negotiations"]
          }
        },
        opportunities: [
          {
            title: "Municipal Zoning Code & Compliance Assistant",
            whyItStoodOut: "Estimators spend 45 minutes manually checking Kennewick and Pasco zoning codes for setbacks and height limits.",
            potentialValue: "Faster turnaround on monument sign quotes and fewer compliance errors.",
            potentialApproach: "ai",
            evidenceConfidence: "Strong",
            confidenceReason: "Directly reported in discovery with verified Tri-Cities municipal code structure.",
            whatWeStillNeedToLearn: ["How frequently do zoning rules change across local Tri-Cities jurisdictions?"],
            thingsToWatch: ["Accurate interpretation of overlay districts and sign type exceptions."],
            evidenceIds: [ev3!.id],
            status: "Potential opportunity"
          },
          {
            title: "Historical Estimate Recipe Assembly",
            whyItStoodOut: "Building new monument sign estimates requires manual part search from past won jobs in shopVOX.",
            potentialValue: "Reduced quoting prep time and improved estimate consistency.",
            potentialApproach: "ai_assisted",
            evidenceConfidence: "Strong",
            confidenceReason: "Reported by lead estimator and verified by shopVOX data structure.",
            whatWeStillNeedToLearn: ["What percentage of quotes match standard historical templates?"],
            thingsToWatch: ["Price drift in raw materials since original job was completed."],
            evidenceIds: [ev4!.id],
            status: "Potential opportunity"
          },
          {
            title: "Automated Estimate Follow-up Nudges",
            whyItStoodOut: "Sent estimates frequently languish without timely follow-up due to peak workload.",
            potentialValue: "Higher quote closing velocity through consistent follow-up cadence.",
            potentialApproach: "automation",
            evidenceConfidence: "Moderate",
            confidenceReason: "Mentioned as an operational friction point during interview.",
            whatWeStillNeedToLearn: ["What is the current follow-up policy across different sign project sizes?"],
            thingsToWatch: ["Avoid sending robotic reminders to key commercial relationships."],
            evidenceIds: [ev5!.id],
            status: "Area for exploration"
          }
        ],
        whatWeStillNeedToLearn: [
          {
            question: "What percentage of custom jobs fall outside historical recipe templates?",
            whyItMatters: "Determines the scope and coverage of recipe-assisted quoting.",
            evidenceNeeded: "Past 6 months quote breakdown by sign category."
          },
          {
            question: "Are shopVOX API webhooks accessible on your current subscription plan?",
            whyItMatters: "Determines whether follow-up triggers can be automated directly or require polling.",
            evidenceNeeded: "shopVOX plan tier and API documentation review."
          }
        ],
        ourTakeaway: {
          whatWeUnderstand: "Mustang Sign Company exhibits strong operational discipline with clear, repetitive administrative bottlenecks in zoning research and quoting.",
          whatAppearsWorthExploring: "Zoning code lookup assistant and quote recipe matching offer the most grounded starting points.",
          whatMayNeedImprovementFirst: "Structuring historical estimate records and confirming zoning PDF document sources.",
          whatWeDontKnowYet: "Direct API integration limits for shopVOX.",
          recommendedNextStep: "Conduct a focused review of municipal code document sources and shopVOX export capabilities to confirm technical feasibility."
        },
        salesSummary: "High intent custom sign business in Kennewick. Core opportunities in zoning retrieval and quoting assistance.",
        contradictions: []
      },
      text: "", tokensIn: 0, tokensOut: 0
    });

    const { client, sales } = await synthesizeReports(id);

    // Assert 9 sections are present and structured
    expect(client.yourBusiness).toContain("Kennewick");
    expect(client.whatWeHeard.length).toBe(3);
    expect(client.aiJourney.stage).toBe("Exploring");
    expect(client.aiCulture.whatMayHelp.length).toBeGreaterThan(0);
    expect(client.dataAndTechnology.dataIdentified.length).toBe(2);
    expect(client.dataAndTechnology.systems).toContain("shopVOX");
    expect(client.whereAiCouldHelp.workflowFriction.length).toBe(4);
    expect(client.whereAiCouldHelp.leveragePatterns.length).toBe(3);
    expect(client.whereAiCouldHelp.fitBreakdown.wellSuited.length).toBe(2);
    expect(client.opportunities.length).toBe(3);
    expect(client.opportunities[0]!.title).toContain("Zoning");
    expect(client.opportunities[0]!.evidenceConfidence).toBe("Strong");
    expect(client.whatWeStillNeedToLearn.length).toBe(2);
    expect(client.whatWeStillNeedToLearn[0]!.question).toContain("?");
    expect(client.ourTakeaway.whatWeUnderstand).toContain("Mustang Sign Company");
    expect(client.ourTakeaway.recommendedNextStep).toContain("focused review");

    // Provenance check
    expect(client.opportunities[0]!.evidenceIds).toEqual([ev3!.id]);
    expect(sales.clientReport).toBe(client);
  });

  it("Scenario 2: Weak / Thin Evidence — Honest handling with zero opportunities", async () => {
    const thinId = "syn-thin";
    createScan({
      id: thinId, company: "Generic Services", email: "info@generic.com",
      retentionScrapedDays: 90, retentionAnswersDays: 365
    });
    const ev = addEvidence(thinId, { kind: "PROSPECT_REPORTED", source: "interview-q1", snippet: "We are a small business doing general services.", signal: "business:general", confidence: "low" });

    completeMock.mockResolvedValueOnce({
      json: {
        headline: "Generic Services: Preliminary AI Opportunity Scan",
        yourBusiness: "Generic Services is a small service provider.",
        whatWeHeard: [{ observation: "The company provides general services.", evidenceIds: [ev!.id] }],
        aiJourney: { stage: "Getting Started", explanation: "Early stages of considering AI." },
        aiCulture: { whatMayHelp: ["Curiosity"], whatMayMakeAdoptionHarder: ["Lack of defined workflows"], whereAiMayHelp: "Preliminary workflow definition." },
        dataAndTechnology: { dataIdentified: [], systems: [], crossSystemFlow: [], whyThisMatters: "No specific data stores were identified." },
        whereAiCouldHelp: {
          workflowFriction: [],
          leveragePatterns: [],
          fitBreakdown: { wellSuited: [], traditionalAutomationSuited: [], humanJudgmentRequired: [] }
        },
        opportunities: [],
        whatWeStillNeedToLearn: [
          { question: "What specific operational tasks consume the most manual hours each week?", whyItMatters: "Essential to identify any meaningful opportunity.", evidenceNeeded: "Time breakdown of weekly tasks." }
        ],
        ourTakeaway: {
          whatWeUnderstand: "Insufficient operational detail was provided to identify specific AI opportunities. We intentionally avoid manufacturing recommendations without evidence.",
          whatAppearsWorthExploring: "None at this stage.",
          whatMayNeedImprovementFirst: "Documenting repetitive daily routines.",
          whatWeDontKnowYet: "Core software tools and process bottlenecks.",
          recommendedNextStep: "Map 2-3 core daily operational routines before evaluating AI or automation tools."
        },
        salesSummary: "Thin discovery. No validated opportunities.",
        contradictions: []
      },
      text: "", tokensIn: 0, tokensOut: 0
    });

    const { client } = await synthesizeReports(thinId);
    expect(client.opportunities.length).toBe(0);
    expect(client.ourTakeaway.whatWeUnderstand).toContain("Insufficient operational detail");
    deleteScan(thinId);
  });

  it("Scenario 3: Provenance Invariant — Filters out fake / hallucinated evidence IDs", async () => {
    setupScan(id);
    const realIds = listEvidence(id).map((e) => e.id);

    completeMock.mockResolvedValueOnce({
      json: {
        headline: "Acme Logistics: Scan",
        yourBusiness: "Acme Logistics",
        whatWeHeard: [
          { observation: "Supported observation", evidenceIds: [realIds[0]!, "FAKE_1"] },
          { observation: "Fabricated observation", evidenceIds: ["FAKE_2"] }
        ],
        aiJourney: { stage: "Exploring", explanation: "exploring" },
        aiCulture: { whatMayHelp: [], whatMayMakeAdoptionHarder: [], whereAiMayHelp: "" },
        dataAndTechnology: { dataIdentified: [], systems: [], crossSystemFlow: [], whyThisMatters: "" },
        whereAiCouldHelp: {
          workflowFriction: [],
          leveragePatterns: [
            { category: "Repetitive work", observation: "Supported leverage", evidenceIds: [realIds[1]!] },
            { category: "Information retrieval", observation: "Unsupported leverage", evidenceIds: ["FAKE_3"] }
          ],
          fitBreakdown: { wellSuited: [], traditionalAutomationSuited: [], humanJudgmentRequired: [] }
        },
        opportunities: [
          {
            title: "Supported Opportunity",
            whyItStoodOut: "Real observation",
            potentialValue: "Operational value",
            potentialApproach: "ai",
            evidenceConfidence: "Moderate",
            confidenceReason: "Evidence reason",
            status: "Potential opportunity",
            evidenceIds: [realIds[0]!, "FAKE_4"],
            whatWeStillNeedToLearn: []
          },
          {
            title: "Fake Opportunity",
            whyItStoodOut: "Fabricated observation",
            potentialValue: "Fake value",
            potentialApproach: "ai",
            evidenceConfidence: "Limited",
            confidenceReason: "Fake reason",
            status: "Area for exploration",
            evidenceIds: ["FAKE_5"],
            whatWeStillNeedToLearn: []
          }
        ],
        whatWeStillNeedToLearn: [{ question: "What is unknown?", whyItMatters: "Why" }],
        ourTakeaway: {
          whatWeUnderstand: "Summary",
          whatAppearsWorthExploring: "Explore",
          whatMayNeedImprovementFirst: "Improve",
          whatWeDontKnowYet: "Unknown",
          recommendedNextStep: "Next"
        },
        salesSummary: "Summary",
        contradictions: []
      },
      text: "", tokensIn: 0, tokensOut: 0
    });

    const { client } = await synthesizeReports(id);

    // Only real IDs kept in whatWeHeard
    expect(client.whatWeHeard.length).toBe(1);
    expect(client.whatWeHeard[0]!.evidenceIds).toEqual([realIds[0]!]);

    // Unsupported leveragePatterns dropped
    expect(client.whereAiCouldHelp.leveragePatterns.length).toBe(1);
    expect(client.whereAiCouldHelp.leveragePatterns[0]!.evidenceIds).toEqual([realIds[1]!]);

    // Unsupported opportunity dropped, fake IDs stripped
    expect(client.opportunities.length).toBe(1);
    expect(client.opportunities[0]!.title).toBe("Supported Opportunity");
    expect(client.opportunities[0]!.evidenceIds).toEqual([realIds[0]!]);
  });

  it("Scenario 4: Fallback Report Invariant — Generates honest fallback when LLM fails", async () => {
    setupScan(id);
    completeMock.mockRejectedValueOnce(new Error("LLM provider timeout"));

    const { client, sales } = await synthesizeReports(id);
    expect(client.headline).toContain("Acme Logistics");
    expect(client.opportunities.length).toBe(0);
    expect(client.whatWeStillNeedToLearn.length).toBeGreaterThan(0);
    expect(client.ourTakeaway.whatWeUnderstand).toContain("Automated synthesis encountered an issue");
    expect(sales.summary).toContain("Automated synthesis unavailable");
  });

  it("Scenario 5: Anti-ROI and Epistemic Sanitization", () => {
    const rawCost = "Project cost estimate is $100,000.";
    expect(sanitizeNoRoi(rawCost)).toContain("operational value to be validated in deeper assessment");
    expect(sanitizeNoRoi(rawCost)).not.toContain("$100,000");

    const rawRoi = "Expected ROI: 250% over the next year.";
    expect(sanitizeNoRoi(rawRoi)).toContain("Expected operational leverage.");
    expect(sanitizeNoRoi(rawRoi)).not.toContain("ROI");

    const rawMaturity = "Assessed maturity score: 3.5 / 5.";
    expect(sanitizeNoRoi(rawMaturity)).toContain("categorical stage");
    expect(sanitizeNoRoi(rawMaturity)).not.toContain("3.5 / 5");
  });
});

describe("Client Summary PDF 9-Section Rendering", () => {
  it("renders a valid multi-page PDF document with all 9 sections", async () => {
    const sampleReport: ClientReport = {
      company: "Mustang Sign Company",
      website: "https://mustangsignco.com",
      location: "Kennewick, WA",
      headline: "Mustang Sign Company: Preliminary AI Opportunity Scan",
      generatedAt: Date.now(),
      evidenceIds: ["ev-1", "ev-2"],
      yourBusiness: "Custom sign company in Kennewick, WA.",
      whatWeHeard: [{ observation: "Zoning lookups take 45 mins per quote.", evidenceIds: ["ev-1"] }],
      aiJourney: { stage: "Exploring", explanation: "Exploring practical automation." },
      aiCulture: {
        whatMayHelp: ["Estimators want relief from repetitive municipal research."],
        whatMayMakeAdoptionHarder: ["Custom signage requires human sign-off."],
        whereAiMayHelp: "AI assists with preparation while reps retain final review."
      },
      dataAndTechnology: {
        dataIdentified: [{ data: "Municipal Code PDFs", location: "City portals", relevance: "Zoning limits" }],
        systems: ["shopVOX", "Microsoft Teams"],
        crossSystemFlow: ["Manual copy-paste from code PDFs to quote."],
        whyThisMatters: "Data is split across PDF documents and shopVOX."
      },
      whereAiCouldHelp: {
        workflowFriction: [{ stage: "Zoning Check", friction: "Manual code search", evidenceIds: ["ev-1"] }],
        leveragePatterns: [{ category: "Information retrieval", observation: "Looking up zoning codes.", evidenceIds: ["ev-1"] }],
        fitBreakdown: {
          wellSuited: ["Municipal code lookup"],
          traditionalAutomationSuited: ["Travel fee SKU calculation"],
          humanJudgmentRequired: ["Custom design pricing"]
        }
      },
      opportunities: [
        {
          title: "Reduce manual municipal research during quoting",
          whyItStoodOut: "Estimators manually research Kennewick and Pasco municipal codes.",
          potentialValue: "Faster quote turnaround and fewer zoning compliance delays.",
          potentialApproach: "ai",
          evidenceConfidence: "Strong",
          confidenceReason: "Reported directly during interview with verified public code sources.",
          whatWeStillNeedToLearn: ["How often do local codes change?"],
          thingsToWatch: ["Complex variance exception handling."],
          evidenceIds: ["ev-1"],
          status: "Potential opportunity"
        }
      ],
      whatWeStillNeedToLearn: [
        {
          question: "What is the historical conversion rate on quotes followed up within 3 days?",
          whyItMatters: "Evaluates impact of follow-up timing on revenue velocity.",
          evidenceNeeded: "shopVOX won/lost quote timestamps."
        }
      ],
      ourTakeaway: {
        whatWeUnderstand: "Clear opportunity in zoning research.",
        whatAppearsWorthExploring: "Municipal code indexing and quoting assistant.",
        whatMayNeedImprovementFirst: "Organizing municipal code reference materials.",
        whatWeDontKnowYet: "shopVOX webhook access level.",
        recommendedNextStep: "Schedule a discussion to review municipal code documents and shopVOX integration feasibility."
      }
    };

    const pdfBytes = await renderClientSummaryPdf(sampleReport);
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(1000);

    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });
});
