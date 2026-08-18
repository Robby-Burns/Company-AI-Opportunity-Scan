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
import { initInterview, nextQuestion, ingestResponse, isInterviewFinished, getInterviewState } from "@/lib/orchestrator";
import { synthesizeReports, type ClientReport } from "@/lib/synthesis";
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
          depth: 1,
          expectedSignal: `${lens}-sig-a`,
          scores: { novelty: noveltyA, coverageGain: 0.7, companyUnderstanding: 0.7, answerable: 0.8, specific: 0.6, conversational: 0.8, depthAppropriate: 0.7 },
          rationale: "a"
        },
        {
          question: { text: q2, kind: "short" },
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
    const sequence: LensId[] = [
      "business", "operations", "systems", "data", "people",
      "operations", "systems", "data", "business", "operations",
      "people", "systems"
    ];
    for (let i = 0; i < 12; i++) {
      const q = await turn(id, sequence[i]!, `Question ${i + 1}`);
      expect(q).not.toBeNull();
      ingestResponse(id, q!.id, `Answer to ${i + 1}`);
    }
    const state = getInterviewState(id);
    expect(state?.asked).toBe(12);
    expect(isInterviewFinished(id)).toBe(true);
    const beyond = await nextQuestion(id);
    expect(beyond).toBeNull();
  });
});

describe("Anti-tunneling rotation guardrails (§7.2 selectDimension)", () => {
  it("forces switch if same dimension asked twice in a row", () => {
    const coverage = new Map<LensId, DimensionCoverage>();
    const DIMS: LensId[] = ["business", "operations", "systems", "data", "people"];
    for (const d of DIMS) {
      coverage.set(d, {
        dimension: d, coverage: d === "operations" ? "LIGHT" : "NOT_STARTED", confidence: "low",
        questionsAsked: d === "operations" ? 2 : 0, lastQuestionNumber: d === "operations" ? 2 : 0,
        keyFacts: [], knownUnknowns: [], evidenceIds: [], unresolvedGaps: [], depth: 1,
        answerRichness: "moderate", notApplicable: false
      });
    }
    const next = selectDimension("operations", coverage, ["operations", "operations"], 2);
    expect(next.dimension).not.toBe("operations");
    expect(next.overridden).toBe(true);
  });
});

describe("Specialist Candidate Selection Picker (§7.3 selectCandidate)", () => {
  it("picks candidate maximizing quality heuristic", () => {
    const candidates: CandidateQuestion[] = [
      {
        lens: "systems",
        depth: 2,
        question: { text: "What CRM do you use?" },
        scores: { novelty: 0.3, coverageGain: 0.4, companyUnderstanding: 0.3, answerable: 0.9, specific: 0.5, conversational: 0.7, depthAppropriate: 0.6 },
        rationale: "crm"
      },
      {
        lens: "systems",
        depth: 2,
        question: { text: "How does information move between those systems?" },
        scores: { novelty: 0.9, coverageGain: 0.85, companyUnderstanding: 0.8, answerable: 0.85, specific: 0.8, conversational: 0.9, depthAppropriate: 0.8 },
        rationale: "flow"
      }
    ];
    const picked = selectCandidate(candidates, []);
    expect(picked).not.toBeNull();
    expect(picked!.selected.question.text).toBe("How does information move between those systems?");
  });
});

describe("Redesigned 12-Section Synthesis & Reasoning Pipeline", () => {
  const id = "syn-mustang-test";
  beforeEach(() => { clearStores(); completeMock.mockReset(); });
  afterEach(() => deleteScan(id));

  it("Scenario 1: Mustang Signs / Kennewick — Discovers custom, evidence-grounded opportunities without hardcoding", async () => {
    createScan({
      id,
      company: "Mustang Sign Company",
      location: "Kennewick, WA",
      website: "https://mustangsignco.com",
      email: "robby@mustangsignco.com",
      notes: "Custom signage fabricator handling monument signs, pylon signs, and vehicle wraps.",
      retentionScrapedDays: 90,
      retentionAnswersDays: 365
    });

    addEvidence(id, { kind: "SCRAPED_TECH", source: "https://mustangsignco.com", snippet: "uses shopVOX and Microsoft Teams", signal: "uses:shopvox", confidence: "high" });
    addEvidence(id, { kind: "PROSPECT_REPORTED", source: "intake-notes", snippet: "Custom signage fabricator in Kennewick WA", signal: "notes:operational", confidence: "high" });
    const ev3 = addEvidence(id, { kind: "PROSPECT_REPORTED", source: "interview-q2", snippet: "Sales reps spend 45 minutes manually checking Kennewick (KMC) and Pasco (PMC) setback and height zoning codes before quoting.", signal: "workflow:zoning_compliance", confidence: "high" });
    const ev4 = addEvidence(id, { kind: "PROSPECT_REPORTED", source: "interview-q3", snippet: "Historical won projects live in shopVOX and spreadsheets; building a monument sign quote requires manual part lookup.", signal: "data:recipe_pricing", confidence: "high" });
    const ev5 = addEvidence(id, { kind: "PROSPECT_REPORTED", source: "interview-q5", snippet: "Sales reps do not have time to manually follow up on sent estimates after 3 days.", signal: "workflow:quote_followup", confidence: "medium" });

    completeMock.mockResolvedValueOnce({
      json: {
        headline: "Mustang Sign Company: Preliminary AI Opportunity Scan",
        yourBusiness: "Mustang Sign Company is a custom design, fabrication, and installation business in Kennewick, WA serving regional commercial clients with monument signs, pylons, and vehicle graphics.",
        whatWeHeard: [
          { observation: "Sales estimators spend considerable manual time researching municipal zoning codes for Kennewick and Pasco.", evidenceIds: [ev3!.id] },
          { observation: "Quote building involves looking up past won project parts in shopVOX and spreadsheets.", evidenceIds: [ev4!.id] },
          { observation: "Follow-up on delivered estimates is inconsistent due to sales rep bandwidth constraints.", evidenceIds: [ev5!.id] }
        ],
        aiJourney: {
          stage: "Exploring",
          explanation: "Mustang Signs has solid operational software (shopVOX) and is exploring targeted automation to assist human estimators."
        },
        aiCulture: {
          whatMayHelp: ["Team is eager to eliminate repetitive municipal code lookups", "Clear desire to keep final quote review human-led"],
          whatMayMakeAdoptionHarder: ["Custom nature of architectural signs requires human judgment"],
          whereAiMayHelp: "AI can draft and assemble information while keeping approval firmly with the estimator."
        },
        yourData: {
          dataIdentified: [
            { data: "Municipal Sign Codes (KMC/PMC/RMC)", location: "Public city PDFs and planning docs", relevance: "Zoning limits" },
            { data: "Historical Won Estimates & Recipes", location: "shopVOX and internal spreadsheets", relevance: "Part lists and labor hours" }
          ],
          whyThisMatters: "Your operational data is split between structured tools like shopVOX and unstructured municipal PDF regulations."
        },
        opportunityMap: [
          { stage: "Inquiry & Address Verification", friction: "Manual confirmation of municipal jurisdiction", evidenceIds: [ev3!.id] },
          { stage: "Zoning & Compliance Lookup", friction: "Manual cross-referencing of height and setback rules", evidenceIds: [ev3!.id] },
          { stage: "Estimate Drafting", friction: "Manual lookup of past project recipes and parts in shopVOX", evidenceIds: [ev4!.id] },
          { stage: "Estimate Follow-up", friction: "Follow-ups dropped due to rep workload", evidenceIds: [ev5!.id] }
        ],
        aiLeverage: [
          { category: "Information retrieval", observation: "Searching municipal code regulations for height/setback limits.", evidenceIds: [ev3!.id] },
          { category: "Boring administrative work", observation: "Pulling historical part lists from past jobs to draft new quotes.", evidenceIds: [ev4!.id] },
          { category: "Communication gaps", observation: "Nudging clients on unapproved quotes after 3 business days.", evidenceIds: [ev5!.id] }
        ],
        aiFit: {
          wellSuited: ["Municipal zoning code retrieval and summarization", "Drafting estimate follow-up messages"],
          traditionalAutomationSuited: ["Calculating mileage travel SKU fees from address distance", "shopVOX margin calculations"],
          humanJudgmentRequired: ["Custom design adjustments", "Final price approval and customer negotiations"]
        },
        technologyEnvironment: {
          systems: ["shopVOX", "Microsoft Teams", "Excel Spreadsheets"],
          crossSystemFlow: ["Estimators manually copy specs between email, shopVOX, and spreadsheets."]
        },
        opportunities: [
          {
            title: "Municipal Zoning Code & Compliance Assistant",
            observation: "Estimators spend 45 minutes manually checking Kennewick and Pasco zoning codes for setbacks and height limits.",
            whyItMatters: "Compliance delays quote delivery and introduces risk if municipal codes are misread.",
            whereAiFits: "An AI retrieval helper can index municipal code PDFs and draft compliance summaries for the rep.",
            interventionFit: "ai",
            evidenceStrength: "Strong",
            status: "Potential opportunity",
            evidenceIds: [ev3!.id],
            whatWeStillNeedToLearn: ["How frequently do zoning rules change across local Tri-Cities jurisdictions?"]
          },
          {
            title: "Historical Estimate Recipe Assembly",
            observation: "Building new monument sign estimates requires manual part search from past won jobs.",
            whyItMatters: "Repetitive lookup slows quote turnaround time for standard sign types.",
            whereAiFits: "AI-assisted recipe matching surfaces past similar projects to pre-fill draft line items.",
            interventionFit: "ai_assisted",
            evidenceStrength: "Strong",
            status: "Potential opportunity",
            evidenceIds: [ev4!.id],
            whatWeStillNeedToLearn: ["What percentage of quotes match standard historical templates?"]
          },
          {
            title: "Automated Estimate Follow-up Nudges",
            observation: "Sent estimates frequently languish without timely follow-up.",
            whyItMatters: "Slow follow-up reduces quote conversion rates.",
            whereAiFits: "Traditional automation triggers Teams reminder cards with draft customer check-ins.",
            interventionFit: "automation",
            evidenceStrength: "Moderate",
            status: "Area for exploration",
            evidenceIds: [ev5!.id],
            whatWeStillNeedToLearn: ["What is the current win rate on quotes followed up within 3 days vs 7 days?"]
          }
        ],
        whatWeStillNeedToLearn: [
          { question: "What percentage of custom jobs fall outside historical recipe templates?", whyWeNeedToKnow: "Determines the scope of recipe-assisted quoting." },
          { question: "Are shopVOX API webhooks accessible on your current subscription plan?", whyWeNeedToKnow: "Determines whether follow-up triggers can be automated directly." }
        ],
        analystView: {
          summary: "Mustang Signs exhibits high operational clarity with clear, repetitive administrative bottlenecks in zoning research and quoting.",
          deepAssessmentRecommendation: "A Deep Assessment will evaluate shopVOX integration feasibility and municipal code retrieval accuracy."
        },
        salesSummary: "High intent custom sign business in Kennewick. Core opportunities in zoning retrieval and quoting assistance.",
        contradictions: []
      },
      text: "", tokensIn: 0, tokensOut: 0
    });

    const { client, sales } = await synthesizeReports(id);

    // Assert 12 sections are present and rich
    expect(client.yourBusiness).toContain("Kennewick");
    expect(client.whatWeHeard.length).toBe(3);
    expect(client.aiJourney.stage).toBe("Exploring");
    expect(client.aiCulture.whatMayHelp.length).toBeGreaterThan(0);
    expect(client.yourData.dataIdentified.length).toBe(2);
    expect(client.opportunityMap.length).toBe(4);
    expect(client.aiLeverage.length).toBe(3);
    expect(client.aiFit.wellSuited.length).toBe(2);
    expect(client.technologyEnvironment.systems).toContain("shopVOX");
    expect(client.opportunities.length).toBe(3);
    expect(client.opportunities[0]!.title).toContain("Zoning");
    expect(client.whatWeStillNeedToLearn.length).toBe(2);
    expect(client.whatWeStillNeedToLearn[0]!.question).toContain("?");
    expect(client.analystView.summary).toContain("Mustang Signs");

    // Provenance check
    expect(client.opportunities[0]!.evidenceIds).toEqual([ev3!.id]);
    expect(sales.clientReport).toBe(client);
  });

  it("Scenario 2: Weak / Thin Evidence — Honest handling without hallucinating opportunities", async () => {
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
        aiJourney: { stage: "Early awareness", explanation: "Early stages of considering AI." },
        aiCulture: { whatMayHelp: ["Curiosity"], whatMayMakeAdoptionHarder: ["Lack of defined workflows"], whereAiMayHelp: "Preliminary workflow definition." },
        yourData: { dataIdentified: [], whyThisMatters: "No specific data stores were identified." },
        opportunityMap: [],
        aiLeverage: [],
        aiFit: { wellSuited: [], traditionalAutomationSuited: [], humanJudgmentRequired: [] },
        technologyEnvironment: { systems: [], crossSystemFlow: [] },
        opportunities: [],
        whatWeStillNeedToLearn: [
          { question: "What specific operational tasks consume the most manual hours each week?", whyWeNeedToKnow: "Essential to identify any meaningful opportunity." }
        ],
        analystView: {
          summary: "Insufficient operational detail was provided to identify specific AI opportunities. We intentionally avoid manufacturing recommendations without evidence.",
          deepAssessmentRecommendation: "A consultation can help map workflows if AI exploration is desired."
        },
        salesSummary: "Thin discovery. No validated opportunities.",
        contradictions: []
      },
      text: "", tokensIn: 0, tokensOut: 0
    });

    const { client } = await synthesizeReports(thinId);
    expect(client.opportunities.length).toBe(0);
    expect(client.analystView.summary).toContain("Insufficient operational detail");
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
        yourData: { dataIdentified: [], whyThisMatters: "" },
        opportunityMap: [],
        aiLeverage: [
          { category: "Repetitive work", observation: "Supported leverage", evidenceIds: [realIds[1]!] },
          { category: "Information retrieval", observation: "Unsupported leverage", evidenceIds: ["FAKE_3"] }
        ],
        aiFit: { wellSuited: [], traditionalAutomationSuited: [], humanJudgmentRequired: [] },
        technologyEnvironment: { systems: [], crossSystemFlow: [] },
        opportunities: [
          {
            title: "Supported Opportunity",
            observation: "Real observation",
            whyItMatters: "Why",
            whereAiFits: "Where",
            interventionFit: "ai",
            evidenceStrength: "Moderate",
            status: "Potential opportunity",
            evidenceIds: [realIds[0]!, "FAKE_4"],
            whatWeStillNeedToLearn: []
          },
          {
            title: "Fake Opportunity",
            observation: "Fabricated observation",
            whyItMatters: "Why",
            whereAiFits: "Where",
            interventionFit: "ai",
            evidenceStrength: "Limited",
            status: "Area for exploration",
            evidenceIds: ["FAKE_5"],
            whatWeStillNeedToLearn: []
          }
        ],
        whatWeStillNeedToLearn: [{ question: "What is unknown?", whyWeNeedToKnow: "Why" }],
        analystView: { summary: "Summary", deepAssessmentRecommendation: "Rec" },
        salesSummary: "Summary",
        contradictions: []
      },
      text: "", tokensIn: 0, tokensOut: 0
    });

    const { client } = await synthesizeReports(id);

    // Only real IDs kept in whatWeHeard
    expect(client.whatWeHeard.length).toBe(1);
    expect(client.whatWeHeard[0]!.evidenceIds).toEqual([realIds[0]!]);

    // Unsupported aiLeverage dropped
    expect(client.aiLeverage.length).toBe(1);
    expect(client.aiLeverage[0]!.evidenceIds).toEqual([realIds[1]!]);

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
    expect(client.analystView.summary).toContain("Automated synthesis encountered an issue");
    expect(sales.summary).toContain("Automated synthesis unavailable");
  });
});

describe("Client Summary PDF 12-Section Rendering", () => {
  it("renders a valid multi-page PDF document with all 12 sections", async () => {
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
      yourData: {
        dataIdentified: [{ data: "Municipal Code PDFs", location: "City portals", relevance: "Zoning limits" }],
        whyThisMatters: "Data is split across PDF documents and shopVOX."
      },
      opportunityMap: [{ stage: "Zoning Check", friction: "Manual code search", evidenceIds: ["ev-1"] }],
      aiLeverage: [{ category: "Information retrieval", observation: "Looking up zoning codes.", evidenceIds: ["ev-1"] }],
      aiFit: {
        wellSuited: ["Municipal code lookup"],
        traditionalAutomationSuited: ["Travel fee SKU calculation"],
        humanJudgmentRequired: ["Custom design pricing"]
      },
      technologyEnvironment: {
        systems: ["shopVOX", "Microsoft Teams"],
        crossSystemFlow: ["Manual copy-paste from code PDFs to quote."]
      },
      opportunities: [
        {
          title: "Municipal Zoning Code Assistant",
          observation: "Estimators manually research Kennewick and Pasco municipal codes.",
          whyItMatters: "Slows down quote turnaround.",
          whereAiFits: "AI retrieval surfaces height limits and setbacks.",
          interventionFit: "ai",
          evidenceStrength: "Strong",
          status: "Potential opportunity",
          evidenceIds: ["ev-1"],
          whatWeStillNeedToLearn: ["How often do local codes change?"]
        }
      ],
      whatWeStillNeedToLearn: [
        { question: "What is the historical conversion rate on quotes?", whyWeNeedToKnow: "Evaluates impact." }
      ],
      analystView: {
        summary: "Clear opportunity in zoning research.",
        deepAssessmentRecommendation: "Schedule a Deep Assessment to review feasibility."
      }
    };

    const pdfBytes = await renderClientSummaryPdf(sampleReport);
    expect(pdfBytes).toBeDefined();
    expect(pdfBytes.length).toBeGreaterThan(1000);

    const header = Buffer.from(pdfBytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });
});
