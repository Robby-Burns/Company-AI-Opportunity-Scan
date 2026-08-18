/**
 * Fox & Loom Opportunity Scan Seed Examples (Dataset B)
 *
 * Dataset Purpose: These examples are synthetic reference examples used to
 * demonstrate the intended structure, reasoning, language, and level of
 * specificity for the Company AI Opportunity Scan. They are not real Fox & Loom
 * client engagements, findings, evidence, benchmarks, or validated outcomes.
 *
 * THIS DATASET IS STRICTLY ISOLATED FROM GENERATION PROMPTS TO PREVENT
 * EVALUATION LEAKAGE AND UNGROUNDED COPY IMITATION.
 */

export interface SeedScanExemplar {
  id: string;
  industry: string;
  businessDescription: string;
  whatWeHeard: string[];
  aiJourney: string;
  aiCulture: string;
  dataAndTechnology: string;
  interventions: Array<{
    title: string;
    type: "AI_HIGH" | "AI_MODERATE" | "TRADITIONAL_AUTOMATION" | "PROCESS_OR_HUMAN_ONLY" | "STRICTLY_AVOID";
    description: string;
  }>;
  whatWeStillNeedToLearn: string;
  ourTakeaway: string;
}

export const SEED_EXEMPLARS: SeedScanExemplar[] = [
  {
    id: "exemplar_01_cold_chain_logistics",
    industry: "Mid-Market Specialty Logistics (Cold-Chain)",
    businessDescription: "A regional cold-chain logistics provider managing a fleet of 120 refrigerated units, delivering high-mix ambient and temperature-controlled food products to regional grocers and distribution centers.",
    whatWeHeard: [
      "Dispatch team manages constant friction between customer SLA delivery windows and real-time route disruptions.",
      "Dispatchers spend hours cross-referencing telematics dashboards with unstructured PDF dock specifications sent by new clients."
    ],
    aiJourney: "Early exploratory phase. No formal AI tools in operations, though a few back-office staff use public tools for email drafting.",
    aiCulture: "Leadership focused on efficiency but skeptical of 'black box' tools disrupting safety and compliance. Frontline dispatchers view new software as a potential distraction.",
    dataAndTechnology: "Legacy Transportation Management System (TMS) and separate telematics platform. Data is siloed. Dock specs live as unstructured PDFs in shared folders.",
    interventions: [
      {
        title: "Unstructured Document Ingestion",
        type: "AI_HIGH",
        description: "Using vision-based AI to extract dock specifications, gate codes, and delivery windows from varying customer PDFs and structuring them for your TMS."
      },
      {
        title: "Alert Triage & Summarization",
        type: "AI_MODERATE",
        description: "Using language models to summarize the daily log of telematics alerts into actionable morning briefs for fleet managers, grouping recurring issues by vehicle."
      },
      {
        title: "Route Optimization",
        type: "TRADITIONAL_AUTOMATION",
        description: "We do not recommend generative AI for route planning. Deterministic routing algorithms and traditional automation within a modern TMS are far more reliable and legally defensible."
      }
    ],
    whatWeStillNeedToLearn: "Confidence Note: Low visibility into legacy TMS API capabilities. Need to verify if it accepts structured payloads without manual human entry.",
    ourTakeaway: "The bottleneck isn't on the road; it's in the back office during customer onboarding. Focus AI on automating extraction of PDF dock constraints without touching the core routing engine."
  },
  {
    id: "exemplar_02_property_management",
    industry: "Regional Property Management Firm",
    businessDescription: "Managing 2,400 residential units across 14 multi-family properties. Handling high volumes of tenant communications, maintenance routing, and leasing cycles.",
    whatWeHeard: [
      "Leasing agents are overwhelmed by repetitive inquiries regarding rent payments, maintenance status, and amenity rules.",
      "Administrative burden contributes to staff burnout and slow response times to urgent tenant issues."
    ],
    aiJourney: "Ad-hoc usage. Some leasing agents use ChatGPT to rewrite difficult tenant emails without centralized policy, risking tenant PII leakage.",
    aiCulture: "Strong appetite for modernization at property manager level, but executive leadership requires strict adherence to Fair Housing Act regulations.",
    dataAndTechnology: "Core operations run on AppFolio as system of record. Communications are scattered across AppFolio portals, SMS systems, and shared Outlook inboxes.",
    interventions: [
      {
        title: "Maintenance Request Triage",
        type: "AI_HIGH",
        description: "Implementing an AI layer to parse incoming unstructured text messages from tenants, identify the required trade, assess urgency, and draft a work order for human approval."
      },
      {
        title: "Policy Query Assistant",
        type: "AI_MODERATE",
        description: "An internal-facing AI trained strictly on property rulebooks and lease addendums to help new staff answer tenant questions about pet policies or parking rules."
      },
      {
        title: "Lease Expiry Workflows",
        type: "TRADITIONAL_AUTOMATION",
        description: "Do not use AI to track lease renewals. The deterministic, rule-based triggers already built into AppFolio are the correct, exact tool for this job."
      }
    ],
    whatWeStillNeedToLearn: "Confidence Note: Have not yet reviewed cleanliness of historical maintenance data. Inconsistent past categorization will require preliminary data cleanup.",
    ourTakeaway: "Your most accessible opportunity is acting as a 'smart router' for tenant communications. Do not attempt to automate lease generation. Focus strictly on categorizing inbound noise."
  },
  {
    id: "exemplar_03_family_law",
    industry: "Boutique Family Law Firm",
    businessDescription: "A specialized 12-attorney law firm focusing on high-net-worth divorce, asset division, and complex probate cases.",
    whatWeHeard: [
      "Associates and paralegals spend disproportionate amounts of billable time organizing, indexing, and searching through massive financial disclosures provided during discovery."
    ],
    aiJourney: "Strictly restricted. Managing partners banned public LLMs due to attorney-client privilege concerns and hallucination risks.",
    aiCulture: "Highly skeptical and risk-averse. Technology must guarantee zero data retention by third-party models and augment rather than replace human review.",
    dataAndTechnology: "Standard legal practice management suite (Clio) and NetDocuments. Discovery data arrives as unstructured, unsearchable image-based PDFs from opposing counsel.",
    interventions: [
      {
        title: "Private Discovery Extraction",
        type: "AI_HIGH",
        description: "Deploying a ring-fenced, zero-retention AI model to run OCR and entity extraction on financial PDFs, instantly identifying hidden accounts, dates, and named assets."
      },
      {
        title: "Deposition Summarization",
        type: "AI_MODERATE",
        description: "Using secure AI to generate chronological summaries and sentiment flags from lengthy deposition transcripts."
      },
      {
        title: "Case Strategy & Brief Writing",
        type: "PROCESS_OR_HUMAN_ONLY",
        description: "We advise against using AI for drafting legal arguments or case strategy. The risk of hallucinated citations and loss of nuanced legal strategy is currently too high."
      }
    ],
    whatWeStillNeedToLearn: "Confidence Note: Need to audit NetDocuments architecture to ensure secure, API-driven connections without violating data residency compliance.",
    ourTakeaway: "AI's role in your firm should be strictly relegated to 'advanced paralegal extraction'—freeing associates to analyze data for legal leverage rather than manually keying spreadsheets."
  },
  {
    id: "exemplar_04_marketing_agency",
    industry: "Mid-Sized Creative & Marketing Agency",
    businessDescription: "A 50-person agency providing brand strategy, copywriting, and performance marketing for DTC e-commerce brands.",
    whatWeHeard: [
      "Margin compression is a major issue; clients demand more asset variations while retainers remain flat. Creatives burn out resizing and versioning ad copy."
    ],
    aiJourney: "Wild West. Creatives actively use Midjourney, ChatGPT, and Claude daily without centralized governance, raising brand consistency and copyright indemnification concerns.",
    aiCulture: "High enthusiasm but lacking governance. The team understands tools but lacks unified workflows, leading to duplicate subscription costs.",
    dataAndTechnology: "Figma, Adobe Creative Cloud, Asana, Google Workspace. Historical high-performing ad copy and brand guidelines are scattered across Google Drive.",
    interventions: [
      {
        title: "Brand-Specific Custom Models",
        type: "AI_HIGH",
        description: "Creating private fine-tuned text models loaded with client brand guidelines and historical high-performing ad copy to generate baseline variations."
      },
      {
        title: "Asset Versioning & Resizing",
        type: "TRADITIONAL_AUTOMATION",
        description: "Using script-based automation in Figma and Adobe, augmented by basic AI outpainting, to handle resizing core creative into 15 different aspect ratios."
      },
      {
        title: "Core Concept Generation",
        type: "PROCESS_OR_HUMAN_ONLY",
        description: "AI should not replace initial strategic creative ideation. Use AI to scale execution of an idea, not generate the soul of the campaign."
      }
    ],
    whatWeStillNeedToLearn: "Confidence Note: Lack visibility into client Master Service Agreements regarding AI usage and indemnification clauses.",
    ourTakeaway: "Your team doesn't need to be convinced to use AI; they need boundaries and centralized systems like an internal prompt library and fine-tuned client models."
  },
  {
    id: "exemplar_05_commercial_landscaping",
    industry: "Commercial Landscaping & Snow Removal",
    businessDescription: "A B2B commercial property maintenance service managing year-round landscaping, hardscaping, and snow removal contracts for corporate campuses and retail centers.",
    whatWeHeard: [
      "Estimating commercial bids is slow; estimators spend hours measuring square footage on Google Earth and manually cross-referencing material costs during spring bidding season."
    ],
    aiJourney: "Non-existent. Technology is viewed as a back-office necessity (accounting), while core business operates on institutional knowledge and manual measurements.",
    aiCulture: "Low digital maturity. Field teams are tactical and management is skeptical of technology that doesn't put a shovel in the ground.",
    dataAndTechnology: "Standard CRM and QuickBooks. Historical bid data stored in complex, varied Excel spreadsheets that are rarely standardized.",
    interventions: [
      {
        title: "RFP & Bid Extraction",
        type: "AI_HIGH",
        description: "Extracting key requirements (service frequency, insurance minimums, penalty clauses) from 50-page RFP documents to determine if a bid is worth pursuing."
      },
      {
        title: "Historical Bid Retrieval",
        type: "AI_MODERATE",
        description: "Implementing an internal search tool to query past spreadsheets using natural language regarding historical unit rates and mulch costs."
      },
      {
        title: "Automated Topographic Measurement",
        type: "TRADITIONAL_AUTOMATION",
        description: "Do not use standard LLMs for land measurement. Explore specialized GIS software and drone photogrammetry tools, which are deterministic technologies."
      }
    ],
    whatWeStillNeedToLearn: "Confidence Note: We do not know how standardized historical Excel estimates are; lack of consistent headers will degrade retrieval accuracy.",
    ourTakeaway: "Speed up the estimator's workflow without forcing them to learn prompt engineering. Automated breakdown of lengthy RFP documents is the lowest-friction entry point."
  },
  {
    id: "exemplar_06_credit_union",
    industry: "Regional Credit Union",
    businessDescription: "A community-focused credit union with $1.2B in Assets Under Management (AUM), specializing in auto loans, home equity lines, and retail banking.",
    whatWeHeard: [
      "Loan origination and underwriting teams are bogged down by document verification—comparing pay stubs, W-2s, and bank statements against application fields."
    ],
    aiJourney: "Highly restricted. Compliance and IT security have blocked all public AI tools over fair lending laws and algorithmic bias concerns.",
    aiCulture: "Risk management dictates culture; justified fear that AI could inadvertently introduce discriminatory lending practices.",
    dataAndTechnology: "Legacy core banking system (Fiserv). Data security is excellent but integrations are difficult. Document intake occurs via secure portal.",
    interventions: [
      {
        title: "Income Verification Extraction",
        type: "AI_HIGH",
        description: "Utilizing private, localized vision models to read applicant W-2s and paystubs, extracting gross income figures and flagging discrepancies for the human underwriter."
      },
      {
        title: "Customer Service Call Analysis",
        type: "AI_MODERATE",
        description: "Running post-call AI analysis on recorded customer support calls to categorize reasons for calling and detect early churn signals."
      },
      {
        title: "Credit Decisioning",
        type: "STRICTLY_AVOID",
        description: "Under no circumstances should generative AI be used to make lending decisions. This introduces massive regulatory risk (FCRA, ECOA). Decisioning must remain strictly rules-based."
      }
    ],
    whatWeStillNeedToLearn: "Confidence Note: Need to map data flow from secure document portal to underwriting to ensure private AI extraction layer complies with regulatory audits.",
    ourTakeaway: "Keep AI entirely out of the decision-making loop. Use it purely as a data-entry assistant for underwriters to accelerate approvals with 100% human-led compliance."
  },
  {
    id: "exemplar_07_custom_packaging",
    industry: "Custom Packaging Manufacturer",
    businessDescription: "A B2B manufacturer producing custom corrugated boxes and foam inserts for e-commerce brands and medical device companies.",
    whatWeHeard: [
      "Customer service and engineering spend excessive time playing telephone over vague email requests ('need box for 4lb bottle') needing back-and-forth CAD specs."
    ],
    aiJourney: "Exploratory. A few engineers write Python scripts for CAD tools, but no application of AI in customer-facing or front-office operations.",
    aiCulture: "Pragmatic. The team respects process and precision; tools that speed quote-to-machine-floor are welcomed, but ambiguity is rejected.",
    dataAndTechnology: "Manufacturing ERP (Epicor) and CAD software. Front-office communication relies heavily on unstructured email threads.",
    interventions: [
      {
        title: "Intake Requirement Triage",
        type: "AI_HIGH",
        description: "An AI assistant that monitors inbound sales emails and automatically drafts polite replies requesting missing constraints (dimensions, weight, drop tests)."
      },
      {
        title: "Machine Maintenance Manual Querying",
        type: "AI_MODERATE",
        description: "An internal chatbot trained exclusively on thousands of pages of PDF OEM manuals for die-cutting and printing machines to quickly surface error codes."
      },
      {
        title: "Production Scheduling",
        type: "TRADITIONAL_AUTOMATION",
        description: "Do not use AI to schedule the factory floor. Your ERP's existing deterministic scheduling logic is vastly superior to a generative model."
      }
    ],
    whatWeStillNeedToLearn: "Confidence Note: Need to assess digital availability of machine manuals; physical binders will require digitization first.",
    ourTakeaway: "Standardize the chaotic front-end intake process with AI parsing so engineers only spend time on fully scoped projects."
  },
  {
    id: "exemplar_08_it_msp",
    industry: "IT Managed Service Provider (MSP)",
    businessDescription: "An outsourced IT department for SMBs, managing endpoints, network security, and helpdesk tickets for 80 client companies.",
    whatWeHeard: [
      "Tier 1 helpdesk technicians are swamped with repetitive password resets and printer issues. Escalation to Tier 2 happens too quickly due to search friction in SOP docs."
    ],
    aiJourney: "Advanced but fragmented. Technicians use AI for PowerShell scripts and troubleshooting, but company lacks a unified AI product strategy.",
    aiCulture: "Highly enthusiastic staff; management is hyper-aware of security risks of feeding client network configurations into public models.",
    dataAndTechnology: "ConnectWise (PSA) and IT Glue (Documentation). Documentation is well-structured but vast, making quick retrieval during calls difficult.",
    interventions: [
      {
        title: "Ticket Contextualization & SOP Surfacing",
        type: "AI_HIGH",
        description: "Integrating a secure AI layer that reads incoming tickets in ConnectWise and queries IT Glue to surface the exact client-specific SOP before answering."
      },
      {
        title: "Automated Ticket Categorization",
        type: "AI_HIGH",
        description: "Using AI to analyze sentiment and content of inbound emails to automatically assign priority levels and route to specialized teams."
      },
      {
        title: "Automated Remediation / Script Execution",
        type: "PROCESS_OR_HUMAN_ONLY",
        description: "We strongly advise against allowing AI to automatically execute scripts or network changes without human approval due to catastrophic outage risks."
      }
    ],
    whatWeStillNeedToLearn: "Confidence Note: Need to evaluate API rate limits of IT Glue and ConnectWise to prevent system throttling during peak morning ticket volumes.",
    ourTakeaway: "Reduce Time to Resolution by empowering Tier 1 staff with AI that brings documentation directly to them rather than forcing manual searching."
  },
  {
    id: "exemplar_09_specialty_healthcare",
    industry: "Specialty Healthcare Clinic (Orthopedics)",
    businessDescription: "A multi-location orthopedic and sports medicine clinic employing 8 surgeons and 20 physical therapists.",
    whatWeHeard: [
      "Physician burnout is high due to clinical documentation; surgeons spend an extra 90 minutes after clinic hours dictating or typing encounter notes into EHR."
    ],
    aiJourney: "Very early. A few physicians experimented with ambient tools at conferences; IT locked down unauthorized software over HIPAA requirements.",
    aiCulture: "Physicians adopt anything that gets them home earlier without breaking eye contact. Administration is cautious regarding HIPAA liability and enterprise software costs.",
    dataAndTechnology: "Epic EHR. Patient scheduling and billing are integrated, but encounter notes are highly manual and varied by physician style.",
    interventions: [
      {
        title: "Ambient Clinical Documentation",
        type: "AI_HIGH",
        description: "Implementing specialized, HIPAA-compliant ambient AI that listens to physician-patient conversations and generates structured SOAP notes for physician review."
      },
      {
        title: "Prior Authorization Drafting",
        type: "AI_MODERATE",
        description: "Using AI to analyze patient charts and automatically draft medical necessity letters required by insurance companies for MRI approvals."
      },
      {
        title: "Diagnostic Output",
        type: "STRICTLY_AVOID",
        description: "AI should never be used to suggest diagnoses or treatment plans. Its sole purpose in your clinic should be administrative synthesis, not clinical judgment."
      }
    ],
    whatWeStillNeedToLearn: "Confidence Note: Need to confirm if Epic instance allows third-party API write-access or requires manual copy-paste of AI-generated notes.",
    ourTakeaway: "Tackling clinical documentation is the single highest-value action: directly impacting physician retention and reducing after-hours administrative work."
  },
  {
    id: "exemplar_10_event_production",
    industry: "Event Production & Staging Company",
    businessDescription: "A corporate event production company handling AV, staging, and lighting for large-scale tech conferences and trade shows.",
    whatWeHeard: [
      "Post-event debriefs and inventory reconciliation are chaotic; project managers return with hundreds of damaged gear photos and handwritten notes, taking weeks to bill overages."
    ],
    aiJourney: "Virtually zero. Team relies on WhatsApp groups, spreadsheets, and sheer adrenaline to get through event weekends.",
    aiCulture: "Fast-paced and chaotic. Field team has zero patience for heavy software; solutions must be mobile-first, instant, and require almost no training.",
    dataAndTechnology: "Flex Rental Solutions and standard accounting. Field data captured on iPhones and dumped into massive Dropbox folders.",
    interventions: [
      {
        title: "Visual Inventory Triage",
        type: "AI_HIGH",
        description: "Multimodal AI where technicians snap photos of broken fixtures and send voice notes ('lens cracked during strike') to automatically log against the event manifest."
      },
      {
        title: "Post-Event Debrief Synthesis",
        type: "AI_MODERATE",
        description: "Feeding disorganized WhatsApp chat logs, vendor emails, and Slack threads into secure AI to generate structured post-mortem reports detailing billing issues."
      },
      {
        title: "Live Show Control",
        type: "STRICTLY_AVOID",
        description: "AI has absolutely no place in live show-calling or lighting/audio board operation. Latency and unpredictability are incompatible with live production environments."
      }
    ],
    whatWeStillNeedToLearn: "Confidence Note: Need to assess how reliably Flex rental software can ingest external data via API to trigger repair tickets without manual entry.",
    ourTakeaway: "Field teams won't adopt complex forms. Turning photos and voice memos into structured data drastically reduces the time to close events and bill damages."
  }
];
