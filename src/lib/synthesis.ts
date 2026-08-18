/**
 * Re-Analysis & Synthesis Engine — Company AI Opportunity Scan edition.
 *
 * Produces two reports from the stored evidence set + interview trajectory:
 *  - Client Preliminary AI Opportunity Report (9 structured sections)
 *  - Internal Sales Intelligence Brief (for Marcus / consulting team).
 *
 * Core Epistemic Principles:
 *  1. NEVER equate absence of evidence with evidence of absence.
 *     If we don't have enough evidence, state "Insufficient evidence to determine whether this represents a meaningful opportunity."
 *     Do NOT say "There is no opportunity" and do NOT manufacture fake opportunities.
 *  2. Multi-layer reasoning: Evidence -> Observations -> Operational Map -> AI Fit -> Ranked Opportunities (0-3) -> Unknowns -> Client Report.
 *  3. Strict Provenance: 100% of claims and opportunities must trace to valid evidence_ids. Unsupported claims are omitted.
 *  4. Intervention Fit: Distinguish between AI-suited, Traditional Automation-suited, Process improvement, and Human-led work.
 *  5. Plainspoken Voice: Direct, conversational, practical, zero corporate buzzwords or consultant jargon.
 *  6. No ROI in free Opportunity Scan: No fake quantitative precision, no dollar savings projections, no 1-5 maturity scores.
 */
import { complete } from "@/lib/llm";
import { getScan, listEvidence, setStatus } from "@/lib/evidence/store";
import { getInterviewState } from "@/lib/orchestrator";
import { evaluateAndRecordSession } from "@/lib/learning/evaluator";
import type { DimensionCoverage, LensId } from "@/lib/interview/types";
import { LENS_IDS } from "@/lib/interview/personas";

export type InterventionFit =
  | "ai"
  | "automation"
  | "ai_assisted"
  | "process_improvement"
  | "existing_software"
  | "human_led";

export type EvidenceStrength = "Strong" | "Moderate" | "Limited";
export type OpportunityStatus = "Potential opportunity" | "Area for exploration" | "Insufficient evidence";

export type AiJourneyStage =
  | "Getting Started"
  | "Exploring"
  | "Experimenting"
  | "Using AI in Isolated Areas"
  | "Beginning Operational Adoption"
  | "Integrating AI into Operations";

export interface WhatWeHeardPoint {
  observation: string;
  evidenceIds: string[];
}

export interface DataEntityItem {
  data: string;
  location: string;
  relevance: string;
}

export interface DataAndTechnology {
  dataIdentified: DataEntityItem[];
  systems: string[];
  crossSystemFlow: string[];
  whyThisMatters: string;
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

export interface WhereAiCouldHelp {
  workflowFriction: OpportunityMapStage[];
  leveragePatterns: AiLeverageItem[];
  fitBreakdown: AiFitComparison;
}

export interface OpportunityItem {
  title: string;
  whyItStoodOut: string;
  potentialValue: string;
  potentialApproach: InterventionFit;
  evidenceConfidence: EvidenceStrength;
  confidenceReason: string;
  whatWeStillNeedToLearn: string[];
  thingsToWatch: string[];
  evidenceIds: string[];
  status: OpportunityStatus;
}

export interface RemainingUncertainty {
  question: string;
  whyItMatters: string;
  evidenceNeeded?: string;
}

export interface OurTakeaway {
  whatWeUnderstand: string;
  whatAppearsWorthExploring: string;
  whatMayNeedImprovementFirst: string;
  whatWeDontKnowYet: string;
  recommendedNextStep: string;
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

  // 3. Your AI Journey
  aiJourney: {
    stage: AiJourneyStage;
    explanation: string;
  };

  // 4. AI Culture & Adoption
  aiCulture: {
    whatMayHelp: string[];
    whatMayMakeAdoptionHarder: string[];
    whereAiMayHelp: string;
  };

  // 5. Your Data & Technology
  dataAndTechnology: DataAndTechnology;

  // 6. Where AI Could Help (combines workflow friction, leverage patterns, and fit breakdown)
  whereAiCouldHelp: WhereAiCouldHelp;

  // 7. Areas Worth Investigating (0-3 max)
  opportunities: OpportunityItem[];

  // 8. What We Still Need to Learn
  whatWeStillNeedToLearn: RemainingUncertainty[];

  // 9. Our Takeaway
  ourTakeaway: OurTakeaway;
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
  "=== TARGET CLIENT OUTCOME ===",
  "The client should finish the report thinking:",
  "- 'They actually understand how my business works.'",
  "- 'They found a couple things I hadn't considered.'",
  "- 'They aren't trying to sell me AI where it doesn't belong.'",
  "- 'I now have a better understanding of what AI actually means for my business.'",
  "- 'I understand roughly where I am today with AI.'",
  "- 'I understand what I may need to improve to make AI useful for me.'",
  "- 'I know what is worth looking at next.'",
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
  "- Use plain business phrasing: 'What We Heard', 'What We Observed', 'Evidence', 'Why It Matters', 'Where AI Could Help', 'Areas Worth Investigating', 'What We Still Need to Learn', 'Our Takeaway'.",
  "",
  "=== HARD EPISTEMIC RULES (NON-NEGOTIABLE) ===",
  "1. NO ROI IN THE FREE SCAN: Ever. No dollar savings projections ($100k savings), no payback periods, no invented hours saved, no fake financial precision.",
  "2. NO 1-5 MATURITY SCORE: Categorical stage only ('Getting Started', 'Exploring', 'Experimenting', 'Using AI in Isolated Areas', 'Beginning Operational Adoption', 'Integrating AI into Operations').",
  "3. AI IS NOT AUTOMATICALLY THE ANSWER: Traditional automation, process improvements, better use of existing software, human-led work, and 'do nothing yet' must remain legitimate first-class outcomes.",
  "4. PRESERVE UNCERTAINTY: Never equate absence of evidence with evidence of absence. If evidence is lacking, state 'Insufficient evidence to determine whether this represents a meaningful opportunity.'",
  "5. STRICT PROVENANCE: Every observation, workflow friction point, leverage pattern, and candidate opportunity must cite valid, non-empty subsets of real evidence_ids from the evidence list.",
  "6. 0 TO 3 OPPORTUNITIES: Rank up to 3 candidate opportunities grounded in evidence. Zero opportunities is completely acceptable if evidence is insufficient.",
  "7. CONDITIONAL NEXT STEP: In 'ourTakeaway.recommendedNextStep', give an honest, grounded next step (e.g. fix a process, improve data, explore automation, conduct a deeper assessment if uncertainty warrants it, or do nothing yet). Do NOT automatically pitch a paid engagement.",
  "",
  "=== 9-SECTION STRUCTURE ===",
  "Section 1: Your Business — Plain-language company description, operating model, and context.",
  "Section 2: What We Heard — Grounded observations from interview and scrape with evidence citations.",
  "Section 3: Your AI Journey — Categorical stage + grounded narrative explanation.",
  "Section 4: AI Culture & Adoption — What may help adoption vs. what may require care / make adoption harder.",
  "Section 5: Your Data & Technology — Identified data stores, software systems, cross-system flows, and why data/tech readiness matters.",
  "Section 6: Where AI Could Help (Single unified section with 3 lenses):",
  "  A. Where the work gets hard (workflow stages, triggers, friction).",
  "  B. What technology could help (repetitive work, administrative drag, retrieval, communication, exception handling).",
  "  C. Where AI fits (explicitly comparing AI vs. Traditional Automation vs. Human Judgment Required).",
  "Section 7: Areas Worth Investigating (0-3 max) — Grounded opportunities with title, why it stood out, qualitative potential value (NO ROI!), potential approach, evidence confidence ('Strong'|'Moderate'|'Limited') + reason, missing evidence questions, things to watch.",
  "Section 8: What We Still Need to Learn — Diagnostic questions ending in '?' with why it matters and evidence needed.",
  "Section 9: Our Takeaway — What we understand, what appears worth exploring, what may need improvement first, what we don't know yet, and recommended next step.",
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
  '    "stage": "Getting Started|Exploring|Experimenting|Using AI in Isolated Areas|Beginning Operational Adoption|Integrating AI into Operations",',
  '    "explanation": string',
  "  },",
  '  "aiCulture": {',
  '    "whatMayHelp": string[],',
  '    "whatMayMakeAdoptionHarder": string[],',
  '    "whereAiMayHelp": string',
  "  },",
  '  "dataAndTechnology": {',
  '    "dataIdentified": [',
  '      { "data": string, "location": string, "relevance": string }',
  "    ],",
  '    "systems": string[],',
  '    "crossSystemFlow": string[],',
  '    "whyThisMatters": string',
  "  },",
  '  "whereAiCouldHelp": {',
  '    "workflowFriction": [',
  '      { "stage": string, "friction": string, "evidenceIds": string[] }',
  "    ],",
  '    "leveragePatterns": [',
  '      { "category": "Repetitive work|Boring administrative work|Information handoffs|Communication gaps|Information retrieval|Tribal knowledge|Exception handling", "observation": string, "evidenceIds": string[] }',
  "    ],",
  '    "fitBreakdown": {',
  '      "wellSuited": string[],',
  '      "traditionalAutomationSuited": string[],',
  '      "humanJudgmentRequired": string[]',
  "    }",
  "  },",
  '  "opportunities": [',
  "    {",
  '      "title": string,',
  '      "whyItStoodOut": string,',
  '      "potentialValue": string,',
  '      "potentialApproach": "ai|automation|ai_assisted|process_improvement|existing_software|human_led",',
  '      "evidenceConfidence": "Strong|Moderate|Limited",',
  '      "confidenceReason": string,',
  '      "whatWeStillNeedToLearn": string[],',
  '      "thingsToWatch": string[],',
  '      "evidenceIds": string[],',
  '      "status": "Potential opportunity|Area for exploration|Insufficient evidence"',
  "    }",
  "  ],",
  '  "whatWeStillNeedToLearn": [',
  '    { "question": string, "whyItMatters": string, "evidenceNeeded": string }',
  "  ],",
  '  "ourTakeaway": {',
  '    "whatWeUnderstand": string,',
  '    "whatAppearsWorthExploring": string,',
  '    "whatMayNeedImprovementFirst": string,',
  '    "whatWeDontKnowYet": string,',
  '    "recommendedNextStep": string',
  "  },",
  '  "salesSummary": string,',
  '  "contradictions": string[]',
  "}"
].join("\n");

/**
 * Filter out any hallucinated ROI / dollar figures or numerical maturity scores.
 */
export function sanitizeNoRoi(text: string): string {
  if (!text) return "";
  return text
    .replace(/\$\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:k|m|billion|million|thousand)?/gi, "[operational value to be validated in deeper assessment]")
    .replace(/\b(?:ROI|payback period|annual savings of|save \$)\b[^.;\n]*/gi, "operational leverage")
    .replace(/\b\d+(?:\.\d+)?\s*\/\s*5\b/g, "categorical stage");
}

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
    `Synthesize the 9-section preliminary AI Opportunity Scan report. Follow the strict JSON schema and anti-ROI rules.`;

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
    ? sanitizeNoRoi(parsed.headline.trim())
    : `${scan.company}: Company AI Opportunity Scan`;

  const yourBusiness = typeof parsed.yourBusiness === "string" && parsed.yourBusiness.trim()
    ? sanitizeNoRoi(parsed.yourBusiness.trim())
    : `${scan.company} operates in ${scan.location || "its market"} providing services to its clients.`;

  const whatWeHeard = normalizeWhatWeHeard(parsed.whatWeHeard, validIds);
  const aiJourney = normalizeAiJourney(parsed.aiJourney);
  const aiCulture = normalizeAiCulture(parsed.aiCulture);
  const dataAndTechnology = normalizeDataAndTechnology(parsed.dataAndTechnology ?? parsed.yourData, parsed.technologyEnvironment);
  const whereAiCouldHelp = normalizeWhereAiCouldHelp(
    parsed.whereAiCouldHelp ?? {
      workflowFriction: parsed.opportunityMap,
      leveragePatterns: parsed.aiLeverage,
      fitBreakdown: parsed.aiFit
    },
    validIds
  );
  const opportunities = normalizeOpportunities(parsed.opportunities, validIds);
  const whatWeStillNeedToLearn = normalizeWhatWeStillNeedToLearn(parsed.whatWeStillNeedToLearn);
  const ourTakeaway = normalizeOurTakeaway(parsed.ourTakeaway ?? parsed.analystView);

  const allEvidenceIds = Array.from(
    new Set([
      ...whatWeHeard.flatMap((w) => w.evidenceIds),
      ...whereAiCouldHelp.workflowFriction.flatMap((o) => o.evidenceIds || []),
      ...whereAiCouldHelp.leveragePatterns.flatMap((a) => a.evidenceIds),
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
    dataAndTechnology,
    whereAiCouldHelp,
    opportunities,
    whatWeStillNeedToLearn,
    ourTakeaway
  };

  const sales: SalesBrief = {
    to: "",
    company: scan.company,
    website: scan.website,
    location: scan.location,
    contactEmail: scan.email,
    summary: typeof parsed.salesSummary === "string" && parsed.salesSummary.trim()
      ? parsed.salesSummary.trim()
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
  dataAndTechnology?: unknown;
  yourData?: unknown;
  technologyEnvironment?: unknown;
  whereAiCouldHelp?: unknown;
  opportunityMap?: unknown;
  aiLeverage?: unknown;
  aiFit?: unknown;
  opportunities?: unknown;
  whatWeStillNeedToLearn?: unknown;
  ourTakeaway?: unknown;
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
    const observation = typeof w.observation === "string" ? sanitizeNoRoi(w.observation.trim()) : "";
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
  const defaultStage: AiJourneyStage = "Exploring";
  const validStages: AiJourneyStage[] = [
    "Getting Started",
    "Exploring",
    "Experimenting",
    "Using AI in Isolated Areas",
    "Beginning Operational Adoption",
    "Integrating AI into Operations"
  ];
  if (!raw || typeof raw !== "object") {
    return {
      stage: defaultStage,
      explanation: "Initial evidence suggests the company is exploring where AI can be applied practically."
    };
  }
  const r = raw as { stage?: unknown; explanation?: unknown };
  let stageStr = typeof r.stage === "string" ? r.stage.trim() : "";
  // Map old stages if LLM generated them
  if (stageStr === "Early awareness") stageStr = "Getting Started";
  if (stageStr === "Beginning to experiment") stageStr = "Experimenting";

  const stage = (validStages.includes(stageStr as AiJourneyStage) ? stageStr : defaultStage) as AiJourneyStage;
  const rawExplanation = typeof r.explanation === "string" ? r.explanation.trim() : "";
  const explanation = rawExplanation
    ? sanitizeNoRoi(rawExplanation)
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
    ? (r.whatMayHelp as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => sanitizeNoRoi(x))
    : [];
  const whatMayMakeAdoptionHarder = Array.isArray(r.whatMayMakeAdoptionHarder)
    ? (r.whatMayMakeAdoptionHarder as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => sanitizeNoRoi(x))
    : [];
  const whereAiMayHelp = typeof r.whereAiMayHelp === "string" && r.whereAiMayHelp.trim()
    ? sanitizeNoRoi(r.whereAiMayHelp.trim())
    : "AI can help streamline repetitive preparation tasks while preserving employee ownership over final approvals.";
  return {
    whatMayHelp: whatMayHelp.length ? whatMayHelp : ["Openness to reducing administrative drag"],
    whatMayMakeAdoptionHarder: whatMayMakeAdoptionHarder.length ? whatMayMakeAdoptionHarder : ["Workflows that require customized review"],
    whereAiMayHelp
  };
}

function normalizeDataAndTechnology(rawDt: unknown, rawTechEnv?: unknown): DataAndTechnology {
  const defaultWhy = "Your operational information lives across multiple systems and files. AI is most useful when it can work directly with the data your team already uses to make decisions.";
  const items: DataEntityItem[] = [];
  let systems: string[] = [];
  let crossSystemFlow: string[] = [];
  let whyThisMatters = defaultWhy;

  if (rawDt && typeof rawDt === "object") {
    const dt = rawDt as { dataIdentified?: unknown; systems?: unknown; crossSystemFlow?: unknown; whyThisMatters?: unknown };
    if (Array.isArray(dt.dataIdentified)) {
      for (const d of dt.dataIdentified) {
        if (!d || typeof d !== "object") continue;
        const di = d as { data?: unknown; location?: unknown; relevance?: unknown };
        const data = typeof di.data === "string" ? sanitizeNoRoi(di.data.trim()) : "";
        const location = typeof di.location === "string" ? sanitizeNoRoi(di.location.trim()) : "";
        const relevance = typeof di.relevance === "string" ? sanitizeNoRoi(di.relevance.trim()) : "";
        if (data) items.push({ data, location: location || "Operational systems", relevance });
      }
    }
    if (Array.isArray(dt.systems)) {
      systems = (dt.systems as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => sanitizeNoRoi(x));
    }
    if (Array.isArray(dt.crossSystemFlow)) {
      crossSystemFlow = (dt.crossSystemFlow as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => sanitizeNoRoi(x));
    }
    if (typeof dt.whyThisMatters === "string" && dt.whyThisMatters.trim()) {
      whyThisMatters = sanitizeNoRoi(dt.whyThisMatters.trim());
    }
  }

  // Fallback / merge if technologyEnvironment passed separately
  if (rawTechEnv && typeof rawTechEnv === "object") {
    const te = rawTechEnv as { systems?: unknown; crossSystemFlow?: unknown };
    if (systems.length === 0 && Array.isArray(te.systems)) {
      systems = (te.systems as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => sanitizeNoRoi(x));
    }
    if (crossSystemFlow.length === 0 && Array.isArray(te.crossSystemFlow)) {
      crossSystemFlow = (te.crossSystemFlow as unknown[])
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => sanitizeNoRoi(x));
    }
  }

  return {
    dataIdentified: items,
    systems,
    crossSystemFlow,
    whyThisMatters
  };
}

function normalizeWhereAiCouldHelp(raw: unknown, validIds: Set<string>): WhereAiCouldHelp {
  const defaultObj: WhereAiCouldHelp = {
    workflowFriction: [],
    leveragePatterns: [],
    fitBreakdown: { wellSuited: [], traditionalAutomationSuited: [], humanJudgmentRequired: [] }
  };
  if (!raw || typeof raw !== "object") return defaultObj;

  const r = raw as { workflowFriction?: unknown; leveragePatterns?: unknown; fitBreakdown?: unknown };

  // 1. Workflow Friction
  const workflowFriction: OpportunityMapStage[] = [];
  if (Array.isArray(r.workflowFriction)) {
    for (const s of r.workflowFriction) {
      if (!s || typeof s !== "object") continue;
      const stageObj = s as { stage?: unknown; friction?: unknown; evidenceIds?: unknown };
      const stage = typeof stageObj.stage === "string" ? sanitizeNoRoi(stageObj.stage.trim()) : "";
      const friction = typeof stageObj.friction === "string" ? sanitizeNoRoi(stageObj.friction.trim()) : "";
      if (!stage) continue;
      const ids = Array.isArray(stageObj.evidenceIds)
        ? (stageObj.evidenceIds as unknown[]).filter((id): id is string => typeof id === "string" && validIds.has(id))
        : [];
      workflowFriction.push({ stage, friction, evidenceIds: ids });
    }
  }

  // 2. Leverage Patterns
  const validCategories = [
    "Repetitive work",
    "Boring administrative work",
    "Information handoffs",
    "Communication gaps",
    "Information retrieval",
    "Tribal knowledge",
    "Exception handling"
  ];
  const leveragePatterns: AiLeverageItem[] = [];
  if (Array.isArray(r.leveragePatterns)) {
    for (const item of r.leveragePatterns) {
      if (!item || typeof item !== "object") continue;
      const l = item as { category?: unknown; observation?: unknown; evidenceIds?: unknown };
      const category = (typeof l.category === "string" && validCategories.includes(l.category)
        ? l.category
        : "Repetitive work") as AiLeverageItem["category"];
      const observation = typeof l.observation === "string" ? sanitizeNoRoi(l.observation.trim()) : "";
      if (!observation) continue;
      const ids = Array.isArray(l.evidenceIds)
        ? (l.evidenceIds as unknown[]).filter((id): id is string => typeof id === "string" && validIds.has(id))
        : [];
      if (ids.length === 0) continue;
      leveragePatterns.push({ category, observation, evidenceIds: ids });
    }
  }

  // 3. Fit Breakdown
  const fitBreakdown: AiFitComparison = { wellSuited: [], traditionalAutomationSuited: [], humanJudgmentRequired: [] };
  if (r.fitBreakdown && typeof r.fitBreakdown === "object") {
    const fb = r.fitBreakdown as { wellSuited?: unknown; traditionalAutomationSuited?: unknown; humanJudgmentRequired?: unknown };
    const filterStrings = (arr: unknown) =>
      Array.isArray(arr)
        ? (arr as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => sanitizeNoRoi(x))
        : [];
    fitBreakdown.wellSuited = filterStrings(fb.wellSuited);
    fitBreakdown.traditionalAutomationSuited = filterStrings(fb.traditionalAutomationSuited);
    fitBreakdown.humanJudgmentRequired = filterStrings(fb.humanJudgmentRequired);
  }

  return { workflowFriction, leveragePatterns, fitBreakdown };
}

function normalizeOpportunities(raw: unknown, validIds: Set<string>): OpportunityItem[] {
  if (!Array.isArray(raw)) return [];
  const out: OpportunityItem[] = [];
  const validInterventions: InterventionFit[] = [
    "ai",
    "automation",
    "ai_assisted",
    "process_improvement",
    "existing_software",
    "human_led"
  ];
  const validStrengths: EvidenceStrength[] = ["Strong", "Moderate", "Limited"];
  const validStatuses: OpportunityStatus[] = ["Potential opportunity", "Area for exploration", "Insufficient evidence"];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as {
      title?: unknown;
      whyItStoodOut?: unknown;
      observation?: unknown;
      potentialValue?: unknown;
      whyItMatters?: unknown;
      potentialApproach?: unknown;
      interventionFit?: unknown;
      whereAiFits?: unknown;
      evidenceConfidence?: unknown;
      evidenceStrength?: unknown;
      confidenceReason?: unknown;
      status?: unknown;
      evidenceIds?: unknown;
      whatWeStillNeedToLearn?: unknown;
      thingsToWatch?: unknown;
    };
    const title = typeof o.title === "string" ? sanitizeNoRoi(o.title.trim()) : "";
    const whyItStoodOut = typeof o.whyItStoodOut === "string"
      ? sanitizeNoRoi(o.whyItStoodOut.trim())
      : typeof o.observation === "string"
        ? sanitizeNoRoi(o.observation.trim())
        : "";
    const potentialValue = typeof o.potentialValue === "string"
      ? sanitizeNoRoi(o.potentialValue.trim())
      : typeof o.whyItMatters === "string"
        ? sanitizeNoRoi(o.whyItMatters.trim())
        : "Operational streamlining and reduced coordination friction.";
    if (!title || !whyItStoodOut) continue;

    const ids = Array.isArray(o.evidenceIds)
      ? (o.evidenceIds as unknown[]).filter((id): id is string => typeof id === "string" && validIds.has(id))
      : [];
    if (ids.length === 0) continue; // Invariant: must cite real evidence

    const approachRaw = o.potentialApproach ?? o.interventionFit;
    const potentialApproach = (typeof approachRaw === "string" && validInterventions.includes(approachRaw as InterventionFit)
      ? approachRaw
      : "ai_assisted") as InterventionFit;

    const confidenceRaw = o.evidenceConfidence ?? o.evidenceStrength;
    const evidenceConfidence = (typeof confidenceRaw === "string" && validStrengths.includes(confidenceRaw as EvidenceStrength)
      ? confidenceRaw
      : "Moderate") as EvidenceStrength;

    const confidenceReason = typeof o.confidenceReason === "string" && o.confidenceReason.trim()
      ? sanitizeNoRoi(o.confidenceReason.trim())
      : `Based on interview statements and verified operational signals.`;

    const status = (typeof o.status === "string" && validStatuses.includes(o.status as OpportunityStatus)
      ? o.status
      : "Potential opportunity") as OpportunityStatus;

    const whatWeStillNeedToLearn = Array.isArray(o.whatWeStillNeedToLearn)
      ? (o.whatWeStillNeedToLearn as unknown[])
          .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
          .map((q) => sanitizeNoRoi(q))
      : [];

    const thingsToWatch = Array.isArray(o.thingsToWatch)
      ? (o.thingsToWatch as unknown[])
          .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
          .map((w) => sanitizeNoRoi(w))
      : [];

    out.push({
      title,
      whyItStoodOut,
      potentialValue,
      potentialApproach,
      evidenceConfidence,
      confidenceReason,
      whatWeStillNeedToLearn,
      thingsToWatch,
      evidenceIds: ids,
      status
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
    const u = item as { question?: unknown; whyItMatters?: unknown; whyWeNeedToKnow?: unknown; evidenceNeeded?: unknown };
    let question = typeof u.question === "string" ? sanitizeNoRoi(u.question.trim()) : "";
    const whyItMatters = typeof u.whyItMatters === "string"
      ? sanitizeNoRoi(u.whyItMatters.trim())
      : typeof u.whyWeNeedToKnow === "string"
        ? sanitizeNoRoi(u.whyWeNeedToKnow.trim())
        : "";
    const evidenceNeeded = typeof u.evidenceNeeded === "string" ? sanitizeNoRoi(u.evidenceNeeded.trim()) : undefined;
    if (!question) continue;
    if (!question.endsWith("?")) question = `${question}?`;
    out.push({ question, whyItMatters, evidenceNeeded });
  }
  return out.slice(0, 8);
}

function normalizeOurTakeaway(raw: unknown): OurTakeaway {
  const defaultUnderstand = "Based on the preliminary discovery scan, we have mapped key operational touchpoints, data sources, and technology platforms currently in use.";
  const defaultExplore = "A focused look at high-friction administrative handoffs and information lookups represents the most practical area for investigation.";
  const defaultImprove = "Ensuring structured document access and clear workflow handoff boundaries before introducing automation.";
  const defaultDontKnow = "Detailed error frequencies, volume thresholds, and exception handling specifics remain to be validated.";
  const defaultNextStep = "Review these findings with your operational team to confirm whether the identified workflow friction justifies a deeper investigation.";

  if (!raw || typeof raw !== "object") {
    return {
      whatWeUnderstand: defaultUnderstand,
      whatAppearsWorthExploring: defaultExplore,
      whatMayNeedImprovementFirst: defaultImprove,
      whatWeDontKnowYet: defaultDontKnow,
      recommendedNextStep: defaultNextStep
    };
  }
  const r = raw as {
    whatWeUnderstand?: unknown;
    whatAppearsWorthExploring?: unknown;
    whatMayNeedImprovementFirst?: unknown;
    whatWeDontKnowYet?: unknown;
    recommendedNextStep?: unknown;
    summary?: unknown;
    deepAssessmentRecommendation?: unknown;
  };

  return {
    whatWeUnderstand: typeof r.whatWeUnderstand === "string" && r.whatWeUnderstand.trim()
      ? sanitizeNoRoi(r.whatWeUnderstand.trim())
      : typeof r.summary === "string" && r.summary.trim()
        ? sanitizeNoRoi(r.summary.trim())
        : defaultUnderstand,
    whatAppearsWorthExploring: typeof r.whatAppearsWorthExploring === "string" && r.whatAppearsWorthExploring.trim()
      ? sanitizeNoRoi(r.whatAppearsWorthExploring.trim())
      : defaultExplore,
    whatMayNeedImprovementFirst: typeof r.whatMayNeedImprovementFirst === "string" && r.whatMayNeedImprovementFirst.trim()
      ? sanitizeNoRoi(r.whatMayNeedImprovementFirst.trim())
      : defaultImprove,
    whatWeDontKnowYet: typeof r.whatWeDontKnowYet === "string" && r.whatWeDontKnowYet.trim()
      ? sanitizeNoRoi(r.whatWeDontKnowYet.trim())
      : defaultDontKnow,
    recommendedNextStep: typeof r.recommendedNextStep === "string" && r.recommendedNextStep.trim()
      ? sanitizeNoRoi(r.recommendedNextStep.trim())
      : typeof r.deepAssessmentRecommendation === "string" && r.deepAssessmentRecommendation.trim()
        ? sanitizeNoRoi(r.deepAssessmentRecommendation.trim())
        : defaultNextStep
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
      whatMayHelp: ["Initial exploration of practical automation"],
      whatMayMakeAdoptionHarder: ["Insufficient evidence to determine organizational factors"],
      whereAiMayHelp: "AI may assist with preliminary information organization."
    },
    dataAndTechnology: {
      dataIdentified: [],
      systems: [],
      crossSystemFlow: [],
      whyThisMatters: "Understanding where company information lives is a prerequisite for evaluating AI tools."
    },
    whereAiCouldHelp: {
      workflowFriction: [],
      leveragePatterns: [],
      fitBreakdown: {
        wellSuited: [],
        traditionalAutomationSuited: [],
        humanJudgmentRequired: []
      }
    },
    opportunities: [],
    whatWeStillNeedToLearn: [
      {
        question: "What operational workflows currently consume the most manual employee effort?",
        whyItMatters: "Required to identify where AI or automation can create genuine operational leverage.",
        evidenceNeeded: "Team time allocation estimates on manual repetitive tasks."
      },
      {
        question: "Where do cross-system data handoffs cause delays or rework?",
        whyItMatters: "Determines whether data integration or workflow automation is feasible.",
        evidenceNeeded: "Software integration points and manual copy-paste routines."
      }
    ],
    ourTakeaway: {
      whatWeUnderstand: `Automated synthesis encountered an issue (${note}). A direct review can inspect the captured evidence.`,
      whatAppearsWorthExploring: "Operational workflows with high coordination overhead.",
      whatMayNeedImprovementFirst: "Mapping core systems and data stores.",
      whatWeDontKnowYet: "Specific friction points and frequency of routine tasks.",
      recommendedNextStep: "Review the captured discovery notes with the Fox & Loom team to evaluate next steps."
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
    dataAndTechnology: client.dataAndTechnology,
    whereAiCouldHelp: client.whereAiCouldHelp,
    opportunities: client.opportunities,
    whatWeStillNeedToLearn: client.whatWeStillNeedToLearn,
    ourTakeaway: client.ourTakeaway,
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
