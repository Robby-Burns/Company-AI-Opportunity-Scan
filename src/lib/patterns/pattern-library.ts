/**
 * Internal Opportunity Pattern Library Seed (Dataset A)
 *
 * Dataset Purpose: These examples are synthetic diagnostic patterns used to help
 * identify potential operational opportunities during the Company AI Opportunity Scan.
 * They are not validated Fox & Loom client findings, benchmarks, or evidence.
 * A pattern match must never be presented as a confirmed problem. Primary evidence
 * and client-provided information must independently support any observation.
 */

import type { DiagnosticPattern } from "./types";

export const PATTERN_LIBRARY: DiagnosticPattern[] = [
  {
    id: "pattern_01_multijurisdictional_rules",
    name: "Multi-Jurisdictional Rule-Checking & Custom Quoting",
    category: "Information Retrieval & Rule Checking",
    description: "A recurring manual information-retrieval workflow driven by hyper-local, variable constraints.",
    triggers: {
      externalEvidenceSignals: ["operates across multiple cities/counties", "highly customized products", "compliance or QA job postings", "local regulations"],
      interviewEvidenceSignals: ["takes forever to get quotes out", "check municipal code every time", "custom quoting bottlenecks", "local code verification"]
    },
    confirmingIndicators: ["Process mapping reveals distinct 'lookup and verify' step taking >15% of quoting time."],
    disprovingIndicators: ["The company sells pre-approved, standardized products; municipal codes rarely change or are centralized."],
    alternativeExplanations: ["Delays are caused by waiting on supplier pricing or engineering drafts, not code lookups."],
    diagnosticQuestions: [
      "Where do your estimators go to find local regulations and compliance constraints?",
      "What happens when a building or municipal code changes?"
    ],
    candidateInterventions: {
      processRedesign: ["Standardized dynamic intake forms", "Pre-flight compliance checklists"],
      deterministicAutomation: ["Routing intake to regional estimators by zip code", "Pulling structured tax data via API"],
      aiOpportunity: ["Extracting and summarizing dense municipal code PDFs into plain-English checklists tailored to the quote"]
    },
    whenAiAppropriate: "Extracting and summarizing dense municipal code PDFs into plain-English checklists tailored to the quote.",
    whenAutomationBetter: "Routing intake to regional estimators based on zip code; pulling structured tax data via API.",
    risksAndHumanInLoop: "AI hallucinating legal/building codes leading to non-compliant builds. Human-in-the-loop verification is mandatory."
  },
  {
    id: "pattern_02_unstructured_intake_triage",
    name: "Unstructured Intake Triage & Routing",
    category: "Communication & Classification",
    description: "A manual classification and data-extraction bottleneck caused by open-ended inbound communication.",
    triggers: {
      externalEvidenceSignals: ["generic info@ emails", "open-text contact forms", "wide variety of service offerings", "complaints about slow responses"],
      interviewEvidenceSignals: ["spend hours forwarding emails", "clients never give us the information we need", "inbox overload", "triage takes half the morning"]
    },
    confirmingIndicators: ["Inbox analysis shows high variability in requests and high volume of internal 'reply-all' chains to establish initial scope."],
    disprovingIndicators: ["Highly structured, logic-branched intake forms or customer portals are already in place and heavily utilized."],
    alternativeExplanations: ["The team is understaffed; services are so bespoke that structured intake is genuinely impossible."],
    diagnosticQuestions: [
      "How many touches does an average email or inquiry get before actual work begins?",
      "What information is consistently missing from initial client submissions?"
    ],
    candidateInterventions: {
      processRedesign: ["Logic-branched web intake forms", "Standardizing client onboarding questionnaires"],
      deterministicAutomation: ["Applying deterministic rules (e.g. 'If email contains billing, route to Finance')"],
      aiOpportunity: ["Reading open-ended email text to extract key entities (dates, urgency, scope) and drafting structured ticket summaries"]
    },
    whenAiAppropriate: "Reading open-ended email text to extract key entities (dates, urgency) and drafting a structured summary.",
    whenAutomationBetter: "Applying deterministic rules (e.g., 'If email contains billing, route to Finance').",
    risksAndHumanInLoop: "False positives in routing urgent escalations to low-priority queues. Human review required for edge cases."
  },
  {
    id: "pattern_03_multisystem_swivel_chair",
    name: "Unreconciled Multi-System Swivel-Chairing",
    category: "Data Entry & System Integration",
    description: "A data-entry redundancy where employees manually move information between disjointed software environments.",
    triggers: {
      externalEvidenceSignals: ["legacy software used alongside modern SaaS", "job postings mention data entry or reconciliation", "multiple siloed platforms"],
      interviewEvidenceSignals: ["enter the same address in three screens", "end-of-month takes days to match CRM to accounting", "copy-pasting between systems"]
    },
    confirmingIndicators: ["Employees frequently use dual monitors to manually copy/paste data; high error rates downstream from mismatched records."],
    disprovingIndicators: ["Native integrations or middleware (Zapier/Make/iPaaS) are successfully deployed as an authoritative single source of truth."],
    alternativeExplanations: ["Employees bypass existing integrations because they distrust them; manual review is intentional for audit/compliance purposes."],
    diagnosticQuestions: [
      "Can you walk me through the copy-paste process across your daily software tools?",
      "How often do you find mismatches or sync errors between these platforms?"
    ],
    candidateInterventions: {
      processRedesign: ["Consolidating overlapping tools", "Establishing single system of record"],
      deterministicAutomation: ["Direct API integrations", "Webhook syncing between platforms", "RPA for legacy desktop apps"],
      aiOpportunity: ["Translating unstructured text (call notes, inspection memos) into structured fields for CRM/ERP injection"]
    },
    whenAiAppropriate: "Translating unstructured data (meeting notes, narrative logs) into structured formats (CRM/ERP fields).",
    whenAutomationBetter: "Moving structured data (names, IDs, totals) directly via API; 1:1 data syncing.",
    risksAndHumanInLoop: "Creating infinite update loops or propagating dirty data across systems at scale."
  },
  {
    id: "pattern_04_unstructured_field_reporting",
    name: "High-Volume Unstructured Field Reporting",
    category: "Field Operations & Documentation",
    description: "A documentation bottleneck where post-service data capture is delayed, inconsistent, or highly manual.",
    triggers: {
      externalEvidenceSignals: ["large field service or mobile workforce", "detailed compliance or handover requirements", "field technician job listings"],
      interviewEvidenceSignals: ["technicians hate paperwork at end of day", "cannot invoice until site report is filed", "handwritten field notes"]
    },
    confirmingIndicators: ["Time-tracking shows 20%+ of field workers' time spent typing reports in trucks or late at night."],
    disprovingIndicators: ["Field staff use a structured mobile app with mandatory drop-downs that auto-generates reports upon job completion."],
    alternativeExplanations: ["The required report format is overly bureaucratic and collects data the business never actually analyzes."],
    diagnosticQuestions: [
      "What is the average time gap between a field job finishing and the invoice going out to the client?",
      "How do technicians currently document what they completed on site?"
    ],
    candidateInterventions: {
      processRedesign: ["Simplifying required report fields", "Mobile-first checklist workflows"],
      deterministicAutomation: ["Auto-filling client addresses, serial numbers, and timestamps based on work order ID"],
      aiOpportunity: ["Converting technician voice memos or photos into formatted PDF customer summaries and structured CRM tasks"]
    },
    whenAiAppropriate: "Converting a technician's unstructured voice memo ('Replaced valve, noticed pipe leak, needs follow-up') into formatted notes and action items.",
    whenAutomationBetter: "Auto-filling client addresses, serial numbers, and timestamp data based on work order ID.",
    risksAndHumanInLoop: "AI misinterpreting trade jargon or omitting a critical safety hazard hidden in a voice note."
  },
  {
    id: "pattern_05_tribal_knowledge_qa",
    name: "The 'Tribal Knowledge' QA Bottleneck",
    category: "Quality Assurance & Approval Workflows",
    description: "A workflow constrained by a single senior employee who must manually review outputs based on unwritten heuristics.",
    triggers: {
      externalEvidenceSignals: ["long turnaround times for final deliverables", "heavy reliance on a founder or long-tenured SME", "key-person dependency"],
      interviewEvidenceSignals: ["everything sits on Dave's desk for three days", "only one person knows if specs are right", "bottleneck at final sign-off"]
    },
    confirmingIndicators: ["Work-in-progress (WIP) limits are consistently breached at the final approval stage; junior drafts have high rejection rates."],
    disprovingIndicators: ["Documented Standard Operating Procedures (SOPs) are strictly followed, enabling distributed peer-to-peer QA."],
    alternativeExplanations: ["The bottleneck is an intentional legal/liability checkpoint rather than operational inefficiency."],
    diagnosticQuestions: [
      "If your principal reviewer went on vacation for a month, what exact workflows would break?",
      "What heuristics does the reviewer check that aren't documented in standard SOPs?"
    ],
    candidateInterventions: {
      processRedesign: ["Aggressive SOP documentation", "Decentralizing approval authority", "Peer review checklists"],
      deterministicAutomation: ["Preventing draft submission if mandatory fields (budget, timeline, checklist items) are blank"],
      aiOpportunity: ["Acting as a pre-screen assistant that checks drafts against past approved deliverables and style guidelines before human review"]
    },
    whenAiAppropriate: "Acting as a pre-screen agent that checks drafts against a database of past corrections and guidelines before the SME reviews.",
    whenAutomationBetter: "Preventing submission of a draft if mandatory structured fields are blank or out of tolerance.",
    risksAndHumanInLoop: "Employees relying entirely on the AI pre-screen and switching off critical judgment."
  },
  {
    id: "pattern_06_legacy_format_ingestion",
    name: "Legacy Format Ingestion (The Fax/PDF Trap)",
    category: "Document Processing & Extraction",
    description: "A data extraction problem where highly structured internal systems must be fed by unstructured or legacy external documents.",
    triggers: {
      externalEvidenceSignals: ["B2B company in legacy industries (manufacturing, logistics, wholesale)", "vendors submit orders via PDF/fax", "order entry clerks"],
      interviewEvidenceSignals: ["people whose whole job is retyping PDFs into ERP", "manual order entry errors", "inbound purchase orders in varying formats"]
    },
    confirmingIndicators: ["High volume of inbound PDFs with varying layouts; frequent typos in line items entered into ERP."],
    disprovingIndicators: ["90%+ of orders arrive through a standardized customer portal or Electronic Data Interchange (EDI)."],
    alternativeExplanations: ["Inbound PDFs persist simply because management has never enforced vendor compliance with a digital portal."],
    diagnosticQuestions: [
      "What percentage of your inbound orders or invoices arrive in a format requiring manual retyping?",
      "How many different layouts do your top 20 vendors submit?"
    ],
    candidateInterventions: {
      processRedesign: ["Enforcing vendor portal compliance", "Requiring structured order templates"],
      deterministicAutomation: ["Setting up direct EDI or CSV ingestion for top vendors representing majority volume"],
      aiOpportunity: ["Intelligent Document Processing (IDP) using multimodal models to extract line items from non-standard PDFs into ERP fields"]
    },
    whenAiAppropriate: "Using vision/multimodal models to read non-standard PDFs, identify line items, and map to ERP fields regardless of layout.",
    whenAutomationBetter: "Setting up EDI or structured CSV import for the top 3-5 vendors who represent the majority of volume.",
    risksAndHumanInLoop: "AI hallucinating quantities or confusing unit types (e.g. 'cases' vs 'pallets'). Human verification step mandatory."
  },
  {
    id: "pattern_07_complex_resource_scheduling",
    name: "Complex Resource Substitution & Scheduling",
    category: "Operations & Scheduling",
    description: "A daily operational puzzle of reallocating people, parts, or time when initial plans inevitably break down.",
    triggers: {
      externalEvidenceSignals: ["high-variability industries (logistics, healthcare staffing, field service)", "frequent supply chain or staffing disruptions"],
      interviewEvidenceSignals: ["dispatchers spend three hours playing Tetris when someone calls in sick", "constant route reshuffling", "parts delay scrambles"]
    },
    confirmingIndicators: ["High administrative overhead dedicated purely to real-time schedule adjustments and inventory corrections."],
    disprovingIndicators: ["Operations are highly predictable with standard buffers and excess capacity."],
    alternativeExplanations: ["The core issue is chronic understaffing or unreliable suppliers rather than scheduling complexity."],
    diagnosticQuestions: [
      "Walk me through what happens when your primary material is out of stock or your lead technician calls in sick.",
      "How do dispatchers balance skills, certifications, and travel time during disruptions?"
    ],
    candidateInterventions: {
      processRedesign: ["Buffer management improvements", "Cross-training staff", "Holding safety stock"],
      deterministicAutomation: ["Automated SMS dispatch to on-call roster when a shift is dropped; rules-based calendar booking"],
      aiOpportunity: ["Constraint-solving recommendations where AI evaluates inventory, skills, and SLA deadlines to propose 2-3 reallocation scenarios"]
    },
    whenAiAppropriate: "Analyzing complex unstructured constraints (skills, customer preferences, SLA nuances) to propose reallocation options.",
    whenAutomationBetter: "Deterministic scheduling logic in existing ERP/TMS; triggering automated notifications on shift cancellation.",
    risksAndHumanInLoop: "AI ignoring human fatigue factors (e.g. scheduling someone after a 14-hour shift). Dispatcher must make final decision."
  },
  {
    id: "pattern_08_adhoc_proposal_rfp",
    name: "Ad-Hoc Proposal & RFP Generation",
    category: "Sales & Proposal Operations",
    description: "A high-friction sales process where complex pitches are built largely from scratch or via risky copy-pasting.",
    triggers: {
      externalEvidenceSignals: ["B2B enterprise sales, government contracting, agency services", "long sales cycles with multi-page RFPs"],
      interviewEvidenceSignals: ["every RFP feels like reinventing the wheel", "lost a bid because we left another client's name in", "reps spending days drafting bids"]
    },
    confirmingIndicators: ["No centralized content library; highly variable proposal quality and turnaround times across sales reps."],
    disprovingIndicators: ["The company sells standardized products or SaaS with fixed pricing tiers and pre-approved proposal templates."],
    alternativeExplanations: ["Reps are pursuing low-probability, bad-fit RFPs that should have been disqualified at triage."],
    diagnosticQuestions: [
      "How much time is spent formatting and finding past answers versus strategizing the bid?",
      "Do you have a central repository of past winning proposal sections?"
    ],
    candidateInterventions: {
      processRedesign: ["Establishing stricter bid/no-bid qualification criteria", "Creating a standardized proposal template library"],
      deterministicAutomation: ["Auto-populating company info, tax IDs, and bios via document generation tools (PandaDoc, Proposify)"],
      aiOpportunity: ["Ingesting raw RFP requirements and searching past winning proposals to draft targeted first-pass responses"]
    },
    whenAiAppropriate: "Ingesting 50-page RFP requirements and searching historical proposals to generate tailored first-draft responses.",
    whenAutomationBetter: "Auto-populating static company metadata, executive bios, and pricing tables via template automation.",
    risksAndHumanInLoop: "AI generating generic or inaccurate claims that fail to address client-specific strategic requirements."
  },
  {
    id: "pattern_09_ghost_followup",
    name: "The 'Ghost' Follow-Up Process",
    category: "Revenue Operations & Lead Tracking",
    description: "A revenue leakage point where leads or service issues go cold due to a lack of systematic tracking and nudging.",
    triggers: {
      externalEvidenceSignals: ["high initial lead volume but lower-than-expected conversion", "negative online reviews mentioning slow follow-up"],
      interviewEvidenceSignals: ["sales reps work newest leads and forget last week's", "quotes sit without follow-up", "leads slipping through cracks"]
    },
    confirmingIndicators: ["CRM data reveals hundreds of open opportunities with zero logged activity in the last 30-60 days."],
    disprovingIndicators: ["Strict sales cadence management software (Outreach, Salesloft, HubSpot sequences) is actively enforced."],
    alternativeExplanations: ["Inbound lead quality is low, causing reps to intentionally abandon unresponsive contacts."],
    diagnosticQuestions: [
      "What trigger or alert reminds a rep to follow up on a quote sent two weeks ago?",
      "How does management track dormant pipeline opportunities?"
    ],
    candidateInterventions: {
      processRedesign: ["Weekly pipeline review cadences", "Standardized sales SLA for lead follow-up"],
      deterministicAutomation: ["Time-based CRM triggers: 'If quote sent > 5 days and status unchanged, create follow-up task'"],
      aiOpportunity: ["Analyzing client email replies to distinguish buying sentiment ('not right now' vs 'uninterested') to prioritize follow-up lists"]
    },
    whenAiAppropriate: "Analyzing unstructured email responses to detect buyer sentiment and summarize recent interaction context for the rep.",
    whenAutomationBetter: "Time-based follow-up reminders and scheduled notification sequences.",
    risksAndHumanInLoop: "AI misinterpreting nuanced communication or sending inappropriate automated messages without rep review."
  },
  {
    id: "pattern_10_sla_contract_monitoring",
    name: "Disparate SLA & Contract Monitoring",
    category: "Contract Management & Compliance",
    description: "An operational blind spot where custom contract obligations are forgotten post-signature, leading to over-servicing or compliance breaches.",
    triggers: {
      externalEvidenceSignals: ["professional services, managed IT, facility management", "frequent bespoke contract negotiations and MSAs"],
      interviewEvidenceSignals: ["didn't realize we owed a quarterly review until client complained", "over-servicing without billing", "bespoke client commitments"]
    },
    confirmingIndicators: ["Account managers rely on memory or personal notes to fulfill custom SLA commitments; unexpected SLA penalty payouts."],
    disprovingIndicators: ["All customer agreements use strictly standardized click-through terms with zero custom clauses."],
    alternativeExplanations: ["Sales negotiates terms that operations cannot deliver, regardless of tracking."],
    diagnosticQuestions: [
      "How does the delivery team know exactly what custom terms sales agreed to in the signed contract?",
      "Where are bespoke renewal dates and SLA commitments tracked?"
    ],
    candidateInterventions: {
      processRedesign: ["Standardizing contract tiers", "Establishing legal/operations sign-off for custom clauses"],
      deterministicAutomation: ["Automated calendar triggers for contract renewal dates and recurring milestones"],
      aiOpportunity: ["Ingesting signed PDF contracts to extract custom SLA commitments, renewal terms, and deliverables into a structured dashboard"]
    },
    whenAiAppropriate: "Ingesting bespoke executed MSAs and extracting specific obligations, custom SLA metrics, and dates into structured summaries.",
    whenAutomationBetter: "Triggering deterministic 90-day alert reminders before standard expiration dates.",
    risksAndHumanInLoop: "AI missing a subtle liability clause or non-standard warranty commitment. Human legal review remains essential."
  }
];
