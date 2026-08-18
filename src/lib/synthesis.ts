/**
 * Re-Analysis & Synthesis Engine — Company AI Opportunity Scan edition.
 *
 * Produces two reports from the stored evidence set + interview trajectory:
 *  - Client Preliminary AI Opportunity Report (12 structured sections)
 *  - Internal Sales Intelligence Brief (for Marcus / consulting team).
 *
 * Core Epistemic Principles:
 *  1. NEVER equate absence of evidence with evidence of absence.
 *     If we don't have enough evidence, state "Insufficient evidence to determine whether this represents a meaningful opportunity."
 *     Do NOT say "There is no opportunity" and do NOT manufacture fake opportunities.
 *  2. Multi-layer reasoning: Evidence -> Observations -> Operational Map -> AI Fit -> Ranked Opportunities (0-3) -> Unknowns -> Client Report.
 *  3. Strict Provenance: 100% of claims and opportunities must trace to valid evidence_ids. Unsupported claims are omitted.
 *  4. Intervention Fit: Distinguish between AI-suited, Traditional Automation-suited, and Human-led work.
 *  5. Plainspoken Voice: Direct, conversational, practical, zero corporate buzzwords or consultant jargon.
 */
import { complete } from "@/lib/llm";
import { getScan, listEvidence, setStatus } from "@/lib/evidence/store";
import { getInterviewState } from "@/lib/orchestrator";
import { evaluateAndRecordSession } from "@/lib/learning/evaluator";
import type { DimensionCoverage, LensId } from "@/lib/interview/types";
import { LENS_IDS } from "@/lib/interview/personas";

export type InterventionFit = "ai" | "automation" | "ai_assisted" | "human_led";
export type EvidenceStrength = "Strong" | "Moderate" | "Limited";
export type OpportunityStatus = "Potential opportunity" | "Area for exploration" | "Insufficient evidence";

export interface WhatWeHeardPoint {
  observation: string;
  evidenceIds: string[];
}

export interface DataEntityItem {
  data: string;
  location: string;
  relevance: string;
}

export interface OpportunityMapStage {
  stage: string;
  friction: string;
  evidenceIds?: string[];
}

export interface AiLeverageItem {
  category:
    | "Repetitive work"
    | "Boring administrative work"
    | "Information handoffs"
    | "Communication gaps"
    | "Information retrieval"
    | "Tribal knowledge"
    | "Exception handling";
  observation: string;
  evidenceIds: string[];
}

export interface AiFitComparison {
  wellSuited: string[];
  traditionalAutomationSuited: string[];
  humanJudgmentRequired: string[];
}

export interface TechEnvironment {
  systems: string[];
  crossSystemFlow: string[];
}

export interface OpportunityItem {
  title: string;
  observation: string;
  whyItMatters: string;
  whereAiFits: string;
  interventionFit: InterventionFit;
  evidenceStrength: EvidenceStrength;
  status: OpportunityStatus;
  evidenceIds: string[];
  whatWeStillNeedToLearn: string[];
}

export interface RemainingUncertainty {
  question: string;
  whyWeNeedToKnow: string;
}

export interface ClientReport {
  company: string;
  website?: string;
  location?: string;
  headline: string;
  generatedAt: number;
  evidenceIds: string[];

  // 1. Your Business
  yourBusiness: string;

  // 2. What We Heard
  whatWeHeard: WhatWeHeardPoint[];

  // 3. Where You Are on Your AI Journey
  aiJourney: {
    stage:
      | "Early awareness"
      | "Exploring"
      | "Beginning to experiment"
      | "Using AI in isolated areas"
      | "Beginning operational adoption"
      | "Integrating AI into operations";
    explanation: string;
  };

  // 4. AI Culture & Adoption Considerations
  aiCulture: {
    whatMayHelp: string[];
    whatMayMakeAdoptionHarder: string[];
    whereAiMayHelp: string;
  };

  // 5. Your Data
  yourData: {
    dataIdentified: DataEntityItem[];
    whyThisMatters: string;
  };

  // 6. AI Opportunity Map
  opportunityMap: OpportunityMapStage[];

  // 7. Where AI May Help
  aiLeverage: AiLeverageItem[];

  // 8. Where AI Fits
  aiFit: AiFitComparison;

  // 9. Your Technology Environment
  technologyEnvironment: TechEnvironment;

  // 10. Areas Worth Investigating (0-3 max)
  opportunities: OpportunityItem[];

  // 11. What We Still Need to Learn
  whatWeStillNeedToLearn: RemainingUncertainty[];

  // 12. Preliminary AI Analyst View
  analystView: {
    summary: string;
    deepAssessmentRecommendation: string;
  };
}

export interface SalesBrief {
  to: string;
  company: string;
  website?: string;
  location?: string;
  contactEmail: string;
  summary: string;
  contradictions: string[];
  evidenceIds: string[];
  generatedAt: number;
  clientReport: ClientReport;
}

const SYNTH_SYSTEM = [
  "You synthesize a Company AI Opportunity Scan report for Fox & Loom ('Humans helping humans'), based on an adaptive discovery interview and pre-scraped evidence.",
  "You write in the authentic voice of Fox & Loom's founder.",
  "",
  "=== WRITE IN MY VOICE ===",
  "Write as if you are me:",
  "- Direct and conversational.",
  "- Plainspoken rather than polished.",
  "- Confident without trying to sound impressive.",
  "- Practical and grounded in what something actually does day to day.",
  "- Skeptical of buzzwords, corporate language, and marketing-speak.",
  "- Willing to say something sounds gimmicky, unnecessary, or unproven.",
  "- More interested in clarity than sophistication.",
  "- Short and punchy when the idea calls for it.",
  "- NEVER use corporate buzzwords: leverage (as a verb), facilitate, empower, enable, optimize, transform, synergize, operationalize, holistic, seamless, cutting-edge.",
  "- NEVER use internal jargon in client-facing text: do NOT use the words 'signal', 'AI Gold', 'readiness score', or 'telemetry'.",
  "- Use plain business phrasing: 'What supports this', 'Area for exploration', 'Potential opportunity', 'Worth investigating', 'What we still need to learn'.",
  "",
  "=== REASONING & SYNTHESIS ARCHITECTURE ===",
  "Execute multi-layer reasoning from the evidence provided:",
  "1. Evidence: What the customer actually stated or public scrape signals.",
  "2. Observation: What we can reasonably state based on that evidence.",
  "3. Inferences & Operational Patterns: How work moves, where data lives, systems involved, communication handoffs.",
  "4. Intervention Fit: Is this suited for AI (unstructured text, docs, search, variable inputs, judgment support), Traditional Automation (deterministic rules, calculations, fixed forms), or Human Judgment (relationships, approvals, high stakes)?",
  "5. Opportunities (0 to 3 maximum): Rank up to 3 evidence-supported opportunities. If evidence only supports 2, return 2; if 1, return 1; if none, return 0.",
  "6. Remaining Uncertainty: What we still need to learn, structured as specific diagnostic questions ending in '?' with the explicit reason why we need to know.",
  "",
  "=== CRITICAL INVARIANTS ===",
  "- NEVER EQUATE ABSENCE OF EVIDENCE WITH EVIDENCE OF ABSENCE. If there is not enough evidence to identify an opportunity, state 'Insufficient evidence to determine whether this represents a meaningful opportunity.' Do NOT say 'There is no opportunity.' Do NOT manufacture opportunities to fill space.",
  "- STRICT TRACEABILITY: Every claim in whatWeHeard, yourData, aiLeverage, and opportunities MUST cite valid, non-empty subsets of real evidence_ids from the evidence list. Unsupported claims must be omitted.",
  "- STRICT NEGATIVE BOUNDARIES: NO system architecture / code design, NO vendor picks (OpenAI, LangChain, Zapier, n8n), NO task checklists ('Audit 100 invoices'), NO fabricated ROI dollar projections ($50k savings).",
  "- deepAssessmentQuestions / whatWeStillNeedToLearn must be questions ending in '?', NOT implementation tasks.",
  "",
  "=== OUTPUT JSON SCHEMA ===",
  "Respond ONLY with a JSON object matching this exact structure:",
  "{",
  '  "headline": string,',
  '  "yourBusiness": string,',
  '  "whatWeHeard": [',
  '    { "observation": string, "evidenceIds": string[] }',
  "  ],",
  '  "aiJourney": {',
  '    "stage": "Early awareness|Exploring|Beginning to experiment|Using AI in isolated areas|Beginning operational adoption|Integrating AI into operations",',
  '    "explanation": string',
  "  },",
  '  "aiCulture": {',
  '    "whatMayHelp": string[],',
  '    "whatMayMakeAdoptionHarder": string[],',
  '    "whereAiMayHelp": string',
  "  },",
  '  "yourData": {',
  '    "dataIdentified": [',
  '      { "data": string, "location": string, "relevance": string }',
  "    ],",
  '    "whyThisMatters": string',
  "  },",
  '  "opportunityMap": [',
  '    { "stage": string, "friction": string, "evidenceIds": string[] }',
  "  ],",
  '  "aiLeverage": [',
  '    { "category": "Repetitive work|Boring administrative work|Information handoffs|Communication gaps|Information retrieval|Tribal knowledge|Exception handling", "observation": string, "evidenceIds": string[] }',
  "  ],",
  '  "aiFit": {',
  '    "wellSuited": string[],',
  '    "traditionalAutomationSuited": string[],',
  '    "humanJudgmentRequired": string[]',
  "  },",
  '  "technologyEnvironment": {',
  '    "systems": string[],',
  '    "crossSystemFlow": string[]',
  "  },",
  '  "opportunities": [',
  "    {",
  '      "title": string,',
  '      "observation": string,',
  '      "whyItMatters": string,',
  '      "whereAiFits": string,',
  '      "interventionFit": "ai|automation|ai_assisted|human_led",',
  '      "evidenceStrength": "Strong|Moderate|Limited",',
  '      "status": "Potential opportunity|Area for exploration|Insufficient evidence",',
  '      "evidenceIds": string[],',
  '      "whatWeStillNeedToLearn": string[]',
  "    }",
  "  ],",
  '  "whatWeStillNeedToLearn": [',
  '    { "question": string, "whyWeNeedToKnow": string }',
  "  ],",
  '  "analystView": {',
  '    "summary": string,',
  '    "deepAssessmentRecommendation": string',
  "  },",
  '  "salesSummary": string,',
  '  "contradictions": string[]',
  "}"
].join("\n");

export async function synthesizeReports(scanId: string): Promise<{ client: ClientReport; sales: SalesBrief }> {
  const scan = getScan(scanId);
  if (!scan) throw new Error(`Scan not found: ${scanId}`);
  setStatus(scanId, "synthesizing");

  const evidence = listEvidence(scanId);
  const validIds = new Set(evidence.map((e) => e.id));
  const evidenceJson = evidence.map((e) => ({
    id: e.id,
    kind: e.kind,
    signal: e.signal,
    snippet: e.snippet.slice(0, 300),
    source: e.source,
    confidence: e.confidence
  }));

  const interview = getInterviewState(scanId);
  const coverageBlock = serializeCoverage(interview?.coverage);

  const userMsg =
    `Company: ${scan.company}\n` +
    (scan.location ? `Location: ${scan.location}\n` : "") +
    (scan.website ? `Website: ${scan.website}\n\n` : `Website: (None provided)\n\n`) +
    (scan.notes ? `Operational Notes from submitter:\n${scan.notes}\n\n` : "") +
    `Evidence (ids are real and must be cited in evidenceIds):\n${JSON.stringify(evidenceJson)}\n\n` +
    `INTERVIEW CONTEXT & COMPANY COVERAGE MAP:\n${coverageBlock}\n\n` +
    `Synthesize the 12-section preliminary AI Opportunity Scan report. Follow the strict JSON schema.`;

  let parsed: RawSynthesis;
  try {
    const res = await complete(
      [{ role: "system", content: SYNTH_SYSTEM }, { role: "user", content: userMsg }],
      { json: true, temperature: 0.3, maxTokens: 3500, timeoutMs: 45000 }
    );
    parsed = res.json ?? {};
  } catch (e) {
    return fallbackReports(scan, evidence, `Synthesis unavailable: ${(e as Error).message}`);
  }

  const headline = typeof parsed.headline === "string" && parsed.headline.trim()
    ? parsed.headline
    : `${scan.company}: Company AI Opportunity Scan`;

  const yourBusiness = typeof parsed.yourBusiness === "string" && parsed.yourBusiness.trim()
    ? parsed.yourBusiness.trim()
    : `${scan.company} operates in ${scan.location || "its market"} providing services to its clients.`;

  const whatWeHeard = normalizeWhatWeHeard(parsed.whatWeHeard, validIds);
  const aiJourney = normalizeAiJourney(parsed.aiJourney);
  const aiCulture = normalizeAiCulture(parsed.aiCulture);
  const yourData = normalizeYourData(parsed.yourData);
  const opportunityMap = normalizeOpportunityMap(parsed.opportunityMap, validIds);
  const aiLeverage = normalizeAiLeverage(parsed.aiLeverage, validIds);
  const aiFit = normalizeAiFit(parsed.aiFit);
  const technologyEnvironment = normalizeTechnologyEnvironment(parsed.technologyEnvironment);
  const opportunities = normalizeOpportunities(parsed.opportunities, validIds);
  const whatWeStillNeedToLearn = normalizeWhatWeStillNeedToLearn(parsed.whatWeStillNeedToLearn);
  const analystView = normalizeAnalystView(parsed.analystView);

  const allEvidenceIds = Array.from(
    new Set([
      ...whatWeHeard.flatMap((w) => w.evidenceIds),
      ...opportunityMap.flatMap((o) => o.evidenceIds || []),
      ...aiLeverage.flatMap((a) => a.evidenceIds),
      ...opportunities.flatMap((o) => o.evidenceIds)
    ])
  ).filter((id) => validIds.has(id));

  const client: ClientReport = {
    company: scan.company,
    website: scan.website,
    location: scan.location,
    headline,
    generatedAt: Date.now(),
    evidenceIds: allEvidenceIds.length > 0 ? allEvidenceIds : Array.from(validIds).slice(0, 5),
    yourBusiness,
    whatWeHeard,
    aiJourney,
    aiCulture,
    yourData,
    opportunityMap,
    aiLeverage,
    aiFit,
    technologyEnvironment,
    opportunities,
    whatWeStillNeedToLearn,
    analystView
  };

  const sales: SalesBrief = {
    to: "",
    company: scan.company,
    website: scan.website,
    location: scan.location,
    contactEmail: scan.email,
    summary: typeof parsed.salesSummary === "string" && parsed.salesSummary.trim()
      ? parsed.salesSummary
      : headline,
    contradictions: Array.isArray(parsed.contradictions)
      ? parsed.contradictions.filter((x: unknown): x is string => typeof x === "string")
      : [],
    evidenceIds: client.evidenceIds,
    generatedAt: Date.now(),
    clientReport: client
  };

  setStatus(scanId, "complete");
  void evaluateAndRecordSession(scanId).catch(() => {});
  return { client, sales };
}

interface RawSynthesis {
  headline?: string;
  yourBusiness?: string;
  whatWeHeard?: unknown;
  aiJourney?: unknown;
  aiCulture?: unknown;
  yourData?: unknown;
  opportunityMap?: unknown;
  aiLeverage?: unknown;
  aiFit?: unknown;
  technologyEnvironment?: unknown;
  opportunities?: unknown;
  whatWeStillNeedToLearn?: unknown;
  analystView?: unknown;
  salesSummary?: string;
  contradictions?: unknown;
}

function normalizeWhatWeHeard(raw: unknown, validIds: Set<string>): WhatWeHeardPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: WhatWeHeardPoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const w = item as { observation?: unknown; evidenceIds?: unknown };
    const observation = typeof w.observation === "string" ? w.observation.trim() : "";
    if (!observation) continue;
    const ids = Array.isArray(w.evidenceIds)
      ? (w.evidenceIds as unknown[]).filter((id): id is string => typeof id === "string" && validIds.has(id))
      : [];
    if (ids.length === 0) continue;
    out.push({ observation, evidenceIds: ids });
  }
  return out.slice(0, 6);
}

function normalizeAiJourney(raw: unknown): ClientReport["aiJourney"] {
  const defaultStage = "Exploring";
  const validStages = [
    "Early awareness",
    "Exploring",
    "Beginning to experiment",
    "Using AI in isolated areas",
    "Beginning operational adoption",
    "Integrating AI into operations"
  ];
  if (!raw || typeof raw !== "object") {
    return {
      stage: defaultStage,
      explanation: "Initial evidence suggests the company is exploring where AI can be applied practically."
    };
  }
  const r = raw as { stage?: unknown; explanation?: unknown };
  const stage = (typeof r.stage === "string" && validStages.includes(r.stage) ? r.stage : defaultStage) as ClientReport["aiJourney"]["stage"];
  const explanation = typeof r.explanation === "string" && r.explanation.trim()
    ? r.explanation.trim()
    : "The business is assessing practical applications while maintaining human oversight across core workflows.";
  return { stage, explanation };
}

function normalizeAiCulture(raw: unknown): ClientReport["aiCulture"] {
  if (!raw || typeof raw !== "object") {
    return {
      whatMayHelp: ["Interest in finding practical automation opportunities"],
      whatMayMakeAdoptionHarder: ["Reliance on manual verification and human judgment"],
      whereAiMayHelp: "AI may reduce routine coordination burden without removing human decision-making."
    };
  }
  const r = raw as { whatMayHelp?: unknown; whatMayMakeAdoptionHarder?: unknown; whereAiMayHelp?: unknown };
  const whatMayHelp = Array.isArray(r.whatMayHelp)
    ? (r.whatMayHelp as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
  const whatMayMakeAdoptionHarder = Array.isArray(r.whatMayMakeAdoptionHarder)
    ? (r.whatMayMakeAdoptionHarder as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
  const whereAiMayHelp = typeof r.whereAiMayHelp === "string" && r.whereAiMayHelp.trim()
    ? r.whereAiMayHelp.trim()
    : "AI can help streamline repetitive preparation tasks while preserving employee ownership over final approvals.";
  return {
    whatMayHelp: whatMayHelp.length ? whatMayHelp : ["Openness to reducing administrative drag"],
    whatMayMakeAdoptionHarder: whatMayMakeAdoptionHarder.length ? whatMayMakeAdoptionHarder : ["Workflows that require customized review"],
    whereAiMayHelp
  };
}

function normalizeYourData(raw: unknown): ClientReport["yourData"] {
  const defaultWhy = "Your operational information lives across multiple systems and files. AI is most useful when it can work directly with the data your team already uses to make decisions.";
  if (!raw || typeof raw !== "object") {
    return { dataIdentified: [], whyThisMatters: defaultWhy };
  }
  const r = raw as { dataIdentified?: unknown; whyThisMatters?: unknown };
  const items: DataEntityItem[] = [];
  if (Array.isArray(r.dataIdentified)) {
    for (const d of r.dataIdentified) {
      if (!d || typeof d !== "object") continue;
      const di = d as { data?: unknown; location?: unknown; relevance?: unknown };
      const data = typeof di.data === "string" ? di.data.trim() : "";
      const location = typeof di.location === "string" ? di.location.trim() : "";
      const relevance = typeof di.relevance === "string" ? di.relevance.trim() : "";
      if (data) items.push({ data, location: location || "Operational systems", relevance });
    }
  }
  return {
    dataIdentified: items,
    whyThisMatters: typeof r.whyThisMatters === "string" && r.whyThisMatters.trim() ? r.whyThisMatters.trim() : defaultWhy
  };
}

function normalizeOpportunityMap(raw: unknown, validIds: Set<string>): OpportunityMapStage[] {
  if (!Array.isArray(raw)) return [];
  const out: OpportunityMapStage[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const stageObj = s as { stage?: unknown; friction?: unknown; evidenceIds?: unknown };
    const stage = typeof stageObj.stage === "string" ? stageObj.stage.trim() : "";
    const friction = typeof stageObj.friction === "string" ? stageObj.friction.trim() : "";
    if (!stage) continue;
    const ids = Array.isArray(stageObj.evidenceIds)
      ? (stageObj.evidenceIds as unknown[]).filter((id): id is string => typeof id === "string" && validIds.has(id))
      : [];
    out.push({ stage, friction, evidenceIds: ids });
  }
  return out;
}

function normalizeAiLeverage(raw: unknown, validIds: Set<string>): AiLeverageItem[] {
  if (!Array.isArray(raw)) return [];
  const validCategories = [
    "Repetitive work",
    "Boring administrative work",
    "Information handoffs",
    "Communication gaps",
    "Information retrieval",
    "Tribal knowledge",
    "Exception handling"
  ];
  const out: AiLeverageItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const l = item as { category?: unknown; observation?: unknown; evidenceIds?: unknown };
    const category = (typeof l.category === "string" && validCategories.includes(l.category)
      ? l.category
      : "Repetitive work") as AiLeverageItem["category"];
    const observation = typeof l.observation === "string" ? l.observation.trim() : "";
    if (!observation) continue;
    const ids = Array.isArray(l.evidenceIds)
      ? (l.evidenceIds as unknown[]).filter((id): id is string => typeof id === "string" && validIds.has(id))
      : [];
    if (ids.length === 0) continue;
    out.push({ category, observation, evidenceIds: ids });
  }
  return out;
}

function normalizeAiFit(raw: unknown): AiFitComparison {
  if (!raw || typeof raw !== "object") {
    return { wellSuited: [], traditionalAutomationSuited: [], humanJudgmentRequired: [] };
  }
  const r = raw as { wellSuited?: unknown; traditionalAutomationSuited?: unknown; humanJudgmentRequired?: unknown };
  const filterStrings = (arr: unknown) =>
    Array.isArray(arr) ? (arr as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
  return {
    wellSuited: filterStrings(r.wellSuited),
    traditionalAutomationSuited: filterStrings(r.traditionalAutomationSuited),
    humanJudgmentRequired: filterStrings(r.humanJudgmentRequired)
  };
}

function normalizeTechnologyEnvironment(raw: unknown): TechEnvironment {
  if (!raw || typeof raw !== "object") {
    return { systems: [], crossSystemFlow: [] };
  }
  const r = raw as { systems?: unknown; crossSystemFlow?: unknown };
  const filterStrings = (arr: unknown) =>
    Array.isArray(arr) ? (arr as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
  return {
    systems: filterStrings(r.systems),
    crossSystemFlow: filterStrings(r.crossSystemFlow)
  };
}

function normalizeOpportunities(raw: unknown, validIds: Set<string>): OpportunityItem[] {
  if (!Array.isArray(raw)) return [];
  const out: OpportunityItem[] = [];
  const validInterventions: InterventionFit[] = ["ai", "automation", "ai_assisted", "human_led"];
  const validStrengths: EvidenceStrength[] = ["Strong", "Moderate", "Limited"];
  const validStatuses: OpportunityStatus[] = ["Potential opportunity", "Area for exploration", "Insufficient evidence"];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as {
      title?: unknown;
      observation?: unknown;
      whyItMatters?: unknown;
      whereAiFits?: unknown;
      interventionFit?: unknown;
      evidenceStrength?: unknown;
      status?: unknown;
      evidenceIds?: unknown;
      whatWeStillNeedToLearn?: unknown;
    };
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const observation = typeof o.observation === "string" ? o.observation.trim() : "";
    const whyItMatters = typeof o.whyItMatters === "string" ? o.whyItMatters.trim() : "";
    const whereAiFits = typeof o.whereAiFits === "string" ? o.whereAiFits.trim() : "";
    if (!title || !observation) continue;

    const ids = Array.isArray(o.evidenceIds)
      ? (o.evidenceIds as unknown[]).filter((id): id is string => typeof id === "string" && validIds.has(id))
      : [];
    if (ids.length === 0) continue; // Invariant: must cite real evidence

    const interventionFit = (typeof o.interventionFit === "string" && validInterventions.includes(o.interventionFit as InterventionFit)
      ? o.interventionFit
      : "ai_assisted") as InterventionFit;

    const evidenceStrength = (typeof o.evidenceStrength === "string" && validStrengths.includes(o.evidenceStrength as EvidenceStrength)
      ? o.evidenceStrength
      : "Moderate") as EvidenceStrength;

    const status = (typeof o.status === "string" && validStatuses.includes(o.status as OpportunityStatus)
      ? o.status
      : "Potential opportunity") as OpportunityStatus;

    const whatWeStillNeedToLearn = Array.isArray(o.whatWeStillNeedToLearn)
      ? (o.whatWeStillNeedToLearn as unknown[]).filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      : [];

    out.push({
      title,
      observation,
      whyItMatters,
      whereAiFits,
      interventionFit,
      evidenceStrength,
      status,
      evidenceIds: ids,
      whatWeStillNeedToLearn
    });
    if (out.length >= 3) break; // Invariant: max 3 opportunities
  }
  return out;
}

function normalizeWhatWeStillNeedToLearn(raw: unknown): RemainingUncertainty[] {
  if (!Array.isArray(raw)) return [];
  const out: RemainingUncertainty[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const u = item as { question?: unknown; whyWeNeedToKnow?: unknown };
    const question = typeof u.question === "string" ? u.question.trim() : "";
    const whyWeNeedToKnow = typeof u.whyWeNeedToKnow === "string" ? u.whyWeNeedToKnow.trim() : "";
    if (!question) continue;
    out.push({ question: question.endsWith("?") ? question : `${question}?`, whyWeNeedToKnow });
  }
  return out.slice(0, 8);
}

function normalizeAnalystView(raw: unknown): ClientReport["analystView"] {
  const defaultSummary = "Based on the preliminary evidence, we identified areas worth investigating for AI and automation. We have intentionally not treated these as confirmed problems. The next step is to determine whether the underlying work is frequent, costly, difficult, or constrained enough to justify intervention.";
  const defaultRec = "A Deep Company AI Readiness & Opportunity Assessment will evaluate workflows, data accessibility, technical feasibility, and business impact in depth.";
  if (!raw || typeof raw !== "object") {
    return { summary: defaultSummary, deepAssessmentRecommendation: defaultRec };
  }
  const r = raw as { summary?: unknown; deepAssessmentRecommendation?: unknown };
  return {
    summary: typeof r.summary === "string" && r.summary.trim() ? r.summary.trim() : defaultSummary,
    deepAssessmentRecommendation: typeof r.deepAssessmentRecommendation === "string" && r.deepAssessmentRecommendation.trim() ? r.deepAssessmentRecommendation.trim() : defaultRec
  };
}

function serializeCoverage(coverage: Map<LensId, DimensionCoverage> | undefined): string {
  if (!coverage || coverage.size === 0) return "(no coverage map available)";
  return LENS_IDS.map((l) => {
    const c = coverage.get(l);
    if (!c) return `- ${l}: NOT_STARTED`;
    return [
      `- ${l}: ${c.coverage} (confidence: ${c.confidence}${c.notApplicable ? ", N/A" : ""})`,
      c.keyFacts.length ? `    facts: ${c.keyFacts.join("; ")}` : "",
      c.knownUnknowns.length ? `    unknowns: ${c.knownUnknowns.join("; ")}` : "",
      c.evidenceIds.length ? `    evidence: ${c.evidenceIds.join(", ")}` : ""
    ].filter(Boolean).join("\n");
  }).join("\n");
}

function fallbackReports(
  scan: ReturnType<typeof getScan>,
  evidence: ReturnType<typeof listEvidence>,
  note: string
): { client: ClientReport; sales: SalesBrief } {
  if (!scan) throw new Error("scan missing");
  const validIds = new Set(evidence.map((e) => e.id));
  const fallbackIds = Array.from(validIds).slice(0, 5);

  const client: ClientReport = {
    company: scan.company,
    website: scan.website,
    location: scan.location,
    headline: `${scan.company}: Company AI Opportunity Scan`,
    generatedAt: Date.now(),
    evidenceIds: fallbackIds,
    yourBusiness: `${scan.company} operates in ${scan.location || "its regional market"}.`,
    whatWeHeard: evidence.slice(0, 3).map((e) => ({
      observation: e.snippet.slice(0, 160),
      evidenceIds: [e.id]
    })),
    aiJourney: {
      stage: "Exploring",
      explanation: "Insufficient evidence available from the current scan to determine operational AI adoption."
    },
    aiCulture: {
      whatMayHelp: ["Initial exploration of AI capabilities"],
      whatMayMakeAdoptionHarder: ["Insufficient evidence to determine organizational factors"],
      whereAiMayHelp: "AI may assist with preliminary information organization."
    },
    yourData: {
      dataIdentified: [],
      whyThisMatters: "Understanding where company information lives is a prerequisite for evaluating AI tools."
    },
    opportunityMap: [],
    aiLeverage: [],
    aiFit: {
      wellSuited: [],
      traditionalAutomationSuited: [],
      humanJudgmentRequired: []
    },
    technologyEnvironment: {
      systems: [],
      crossSystemFlow: []
    },
    opportunities: [],
    whatWeStillNeedToLearn: [
      {
        question: "What operational workflows currently consume the most manual employee effort?",
        whyWeNeedToKnow: "Required to identify where AI or automation can create genuine operational leverage."
      },
      {
        question: "Where do cross-system data handoffs cause delays or rework?",
        whyWeNeedToKnow: "Determines whether data integration or workflow automation is feasible."
      }
    ],
    analystView: {
      summary: `Automated synthesis encountered an issue (${note}). A direct review with our consulting team can inspect the captured evidence.`,
      deepAssessmentRecommendation: "Schedule a discussion with Fox & Loom to review your operational context."
    }
  };

  const sales: SalesBrief = {
    to: "",
    company: scan.company,
    website: scan.website,
    location: scan.location,
    contactEmail: scan.email,
    summary: `Automated synthesis unavailable: ${note}`,
    contradictions: [],
    evidenceIds: fallbackIds,
    generatedAt: Date.now(),
    clientReport: client
  };

  setStatus(scan.id, "complete");
  void evaluateAndRecordSession(scan.id).catch(() => {});
  return { client, sales };
}

/** Deep Assessment intake package JSON (§8.2 create-intake-package). */
export function createIntakePackage(scanId: string, client: ClientReport, sales: SalesBrief) {
  const scan = getScan(scanId);
  return {
    scanId,
    createdAt: Date.now(),
    company: scan?.company ?? "",
    website: scan?.website ?? "",
    location: scan?.location ?? "",
    contactEmail: scan?.email ?? "",
    yourBusiness: client.yourBusiness,
    whatWeHeard: client.whatWeHeard,
    aiJourney: client.aiJourney,
    aiCulture: client.aiCulture,
    yourData: client.yourData,
    opportunityMap: client.opportunityMap,
    aiLeverage: client.aiLeverage,
    aiFit: client.aiFit,
    technologyEnvironment: client.technologyEnvironment,
    opportunities: client.opportunities,
    whatWeStillNeedToLearn: client.whatWeStillNeedToLearn,
    analystView: client.analystView,
    clientReport: client,
    salesBrief: sales,
    evidence: listEvidence(scanId).map((e) => ({
      id: e.id,
      kind: e.kind,
      signal: e.signal,
      source: e.source,
      snippet: e.snippet,
      confidence: e.confidence
    }))
  };
}
