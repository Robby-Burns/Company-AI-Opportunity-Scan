/**
 * Explicit Evaluation Rubric (Derived from Dataset B Standards).
 *
 * Epistemic Rules:
 * 1. Hard mechanical pass/fail rules (provenance, ROI exclusion, synthetic name leakage).
 * 2. Qualitative criteria for authentic company specificity, reasoning, restraint, and teaching value.
 * 3. Section integrity enforcement (ensuring observations, tech facts, unknowns, and takeaways stay in their correct sections).
 */

export const EVALUATION_RULES = {
  mechanical: {
    // Zero tolerance for invented ROI, payback periods, or dollar savings
    forbiddenRoiPatterns: [
      /\$\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:k|m|billion|million|thousand)?/i,
      /\b(?:ROI|payback period|annual savings of|save \$\d+)\b/i,
      /\b\d+(?:\.\d+)?\s*%\s*(?:savings|revenue increase|cost reduction)\b/i
    ],
    // Zero tolerance for numerical 1-5 maturity ratings
    forbiddenMaturityScores: [
      /\b[1-5](?:\.\d+)?\s*\/\s*5\b/,
      /\bscore of [1-5]\b/i,
      /\bmaturity score\b/i
    ],
    // Synthetic exemplar names from Dataset B that must NOT leak into client company reports
    syntheticExemplarSignatures: [
      "Mid-Market Specialty Logistics",
      "Regional Property Management Firm",
      "Boutique Family Law Firm",
      "Commercial Landscaping & Snow Removal",
      "Regional Credit Union",
      "Custom Packaging Manufacturer",
      "IT Managed Service Provider",
      "Specialty Healthcare Clinic (Orthopedics)",
      "Event Production & Staging Company"
    ]
  },

  qualitative: {
    dimensions: [
      {
        name: "companySpecificity",
        description: "The report cites actual tools (e.g. Epicor, NetDocuments, AppFolio), real staff roles, and concrete operational workflows.",
        failingIndicator: "Generic consulting advice that could apply to any business without mention of their specific systems or workflow."
      },
      {
        name: "reasoningRigor",
        description: "Clear logical bridge from observed friction -> root cause -> intervention choice.",
        failingIndicator: "Jumping directly from a buzzword to an AI tool without explaining why it fits the workflow."
      },
      {
        name: "appropriateAiFit",
        description: "Cleanly separates AI opportunities from deterministic automation, process fixes, and human judgment. Identifies non-AI fits where appropriate.",
        failingIndicator: "Treating every problem as an LLM opportunity or recommending GenAI for deterministic routing/scheduling."
      },
      {
        name: "intellectualHonesty",
        description: "Transparently identifies missing evidence, API limitations, and data cleanliness questions in What We Still Need to Learn.",
        failingIndicator: "Presenting preliminary scan observations as certified or audited facts."
      },
      {
        name: "clientTeachingValue",
        description: "Teaches the client why a technology does or does not make sense for their specific operating model.",
        failingIndicator: "Surface-level list of AI tool names without explaining the underlying operational mechanism."
      },
      {
        name: "sectionIntegrity",
        description: "Facts in What We Heard, tech stack in Data & Tech, interventions in Where AI Could Help, unknowns in What We Still Need to Learn.",
        failingIndicator: "Putting recommendations in What We Heard or stating assumptions in Data & Tech."
      }
    ]
  }
};
