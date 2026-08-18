/**
 * Fox & Loom Opportunity Scan — Evaluation Rubric (Derived from Dataset B Standards).
 *
 * Epistemic Rules:
 * 1. Hard mechanical pass/fail rules (H1-H7) prevent fabricated quotes, ROI, contamination, forced AI, or material inferences as facts.
 * 2. Criterion weights are the single source of truth; total possible penalty is computed at runtime.
 * 3. PASS = 0 penalty, PARTIAL = 0.5 * weight penalty, FAIL = 1 * weight penalty.
 * 4. Overall Penalty % = (totalPenalty / totalPossiblePoints) * 100.
 */

import type { CriterionDefinition } from "./types";

export const EVALUATION_RULES = {
  mechanical: {
    // Zero tolerance for invented ROI, payback periods, or dollar savings (H2)
    forbiddenRoiPatterns: [
      /\$\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:k|m|billion|million|thousand)?/i,
      /\b(?:ROI|payback period|annual savings of|save \$\d+)\b/i,
      /\b\d+(?:\.\d+)?\s*%\s*(?:savings|revenue increase|cost reduction)\b/i
    ],
    // Zero tolerance for numerical 1-5 maturity ratings (H2)
    forbiddenMaturityScores: [
      /\b[1-5](?:\.\d+)?\s*\/\s*5\b/,
      /\bscore of [1-5]\b/i,
      /\bmaturity score\b/i
    ],
    // Synthetic exemplar names from Dataset B that must NOT leak into client company reports (H6)
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
    ],
    // Terms indicating unverified inferences presented as facts (H7)
    unverifiedInferencePatterns: [
      /\bemployees? (?:probably|likely|must|almost certainly) (?:spend|waste|struggle)\b/i,
      /\bit is obvious that workers\b/i,
      /\bpresumably the team\b/i
    ]
  }
};

export const CRITERIA: CriterionDefinition[] = [
  // Evidence (E)
  { id: "E1", description: "No fabricated company evidence (covers H1)", weight: 5, dimension: "Evidence" },
  { id: "E2", description: "Every meaningful claim has traceable provenance", weight: 4, dimension: "Evidence" },
  { id: "E3", description: "No confusion of industry pattern with company-specific evidence", weight: 3, dimension: "Evidence" },
  { id: "E4", description: "Public vs. interview evidence clearly distinguished", weight: 3, dimension: "Evidence" },
  { id: "E6", description: "Client-facing attribution (Source: …) present for each claim", weight: 2, dimension: "Evidence" },
  { id: "E7", description: "Material assumptions are explicitly identified", weight: 3, dimension: "Evidence" },

  // Reasoning (R)
  { id: "R1", description: "Conclusions logically follow from evidence", weight: 5, dimension: "Reasoning" },
  { id: "R2", description: "No jump from observation straight to a solution", weight: 4, dimension: "Reasoning" },
  { id: "R3", description: "Contradictory evidence is acknowledged and addressed", weight: 4, dimension: "Reasoning" },
  { id: "R4", description: "Alternative explanations are explored", weight: 3, dimension: "Reasoning" },
  { id: "R5", description: "Disconfirmation paths are considered", weight: 3, dimension: "Reasoning" },
  { id: "R6", description: "No implication of a specific outcome when only potential benefit is supported", weight: 4, dimension: "Reasoning" },

  // AI Fit (AI)
  { id: "AI1", description: "AI is appropriately suited to the problem compared with deterministic automation, process change, or human-led work", weight: 5, dimension: "AI Fit" },
  { id: "AI2", description: "Where multiple intervention types are plausible, the report distinguishes AI from automation, process change, and human-led alternatives", weight: 4, dimension: "AI Fit" },
  { id: "AI3", description: "Process change as an alternative is evaluated where appropriate", weight: 4, dimension: "AI Fit" },
  { id: "AI4", description: "No forced AI recommendation (covers H5)", weight: 5, dimension: "AI Fit" },
  { id: "AI5", description: "Proposed AI role is specific enough without detailed implementation specs", weight: 3, dimension: "AI Fit" },
  { id: "AI6", description: "Material risks & human-review requirements identified proportionally", weight: 3, dimension: "AI Fit" },

  // Client Value (CV)
  { id: "CV1", description: "Client gains clearer business understanding through the lens", weight: 4, dimension: "Client Value" },
  { id: "CV2", description: "AI fit vs. non-AI fit is explicit", weight: 4, dimension: "Client Value" },
  { id: "CV3", description: "Current state (“today”) and improvement needs are clear", weight: 4, dimension: "Client Value" },
  { id: "CV4", description: "New insight or previously-unconsidered opportunity is presented", weight: 3, dimension: "Client Value" },
  { id: "CV5", description: "Actionable next-steps are listed", weight: 3, dimension: "Client Value" },
  { id: "CV6", description: "Report explains what must be true for AI to work (data, tech, people)", weight: 5, dimension: "Client Value" },

  // Uncertainty (U)
  { id: "U1", description: "Unknowns are clearly identified", weight: 4, dimension: "Uncertainty" },
  { id: "U2", description: "Each material opportunity has an appropriate evidence-confidence assessment", weight: 3, dimension: "Uncertainty" },
  { id: "U3", description: "Fake precision is avoided", weight: 4, dimension: "Uncertainty" },
  { id: "U4", description: "Uncertainties described honestly without invented numerical precision", weight: 3, dimension: "Uncertainty" },

  // Business Impact (B)
  { id: "B1", description: "No unsupported hard ROI numbers (covers H2)", weight: 4, dimension: "Business Impact" },
  { id: "B2", description: "Financial figures are grounded or presented qualitatively", weight: 3, dimension: "Business Impact" },
  { id: "B3", description: "Potential value is explained without pretending exact dollars are known", weight: 3, dimension: "Business Impact" },

  // Report Quality (Q)
  { id: "Q1", description: "Concise – no filler", weight: 2, dimension: "Report Quality" },
  { id: "Q2", description: "No repetition of claims", weight: 2, dimension: "Report Quality" },
  { id: "Q3", description: "Every section has a purpose", weight: 3, dimension: "Report Quality" },
  { id: "Q4", description: "Narrative is coherent (evidence → reasoning → recommendation)", weight: 4, dimension: "Report Quality" },
  { id: "Q5", description: "Feels like a genuine business assessment", weight: 5, dimension: "Report Quality" },
  { id: "Q6", description: "Visuals/tables add clarity", weight: 2, dimension: "Report Quality" },
  { id: "Q7", description: "Balanced tone", weight: 3, dimension: "Report Quality" },

  // Foundations (F)
  { id: "F1", description: "Where supported by available evidence, relevant data limitations are identified", weight: 5, dimension: "Foundations" },
  { id: "F2", description: "Where supported by available evidence, workflow/process limitations are identified", weight: 5, dimension: "Foundations" },
  { id: "F3", description: "Where supported by available evidence, technology/integration limitations are identified", weight: 5, dimension: "Foundations" },
  { id: "F4", description: "Where supported by available evidence, people/adoption considerations are identified", weight: 5, dimension: "Foundations" },
  { id: "F5", description: "Distinguishes “needs improvement” from “confirmed blocker”", weight: 5, dimension: "Foundations" },
  { id: "F6", description: "Avoids turning scan into a full technical readiness assessment", weight: 5, dimension: "Foundations" },

  // Opportunity Count (O)
  { id: "O1", description: "The report presents 0–3 opportunities based on surviving evidence-supported hypotheses and does not pad to a target count", weight: 5, dimension: "Opportunity Count" }
];
