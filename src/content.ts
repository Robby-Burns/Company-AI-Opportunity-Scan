/**
 * Editable copy for the public Fox & Loom website.
 *
 * Pure content — no behavior. The brand line is "Humans helping humans." and
 * must not be amended to add "with AI" / "through AI" / etc. (see brand guide).
 *
 * The internal Company Opportunity Scan machinery (API routes, the adaptive
 * interview funnel) is intentionally NOT surfaced here. The Free AI Readiness
 * Review is a simple, human-led intake that can later be wired into that
 * workflow.
 */
import { pricing } from "@/content/pricing";

export const content = {
  orgName: "The Fox & Loom",
  orgNameCompact: "Fox & Loom",
  brandLine: "Humans helping humans.",

  nav: {
    // The crest/wordmark links home; nav lists the three content pages.
    items: [
      { label: "About", href: "/about" },
      { label: "Approach", href: "/approach" },
      { label: "Pricing", href: "/pricing" },
      { label: "Contact", href: "/contact" }
    ],
    // The primary CTA scrolls to the hero review card on the homepage.
    cta: { label: "Start Your Free AI Readiness Review", href: "/#review" }
  },

  hero: {
    headline: "Humans helping humans.",
    lead: "We help companies figure out where AI can actually make their work better.",
    qualifier: "If AI isn't the answer, we'll tell you that too.",
    cta: "Start Your Free AI Readiness Review",
    ctaSupport: "Free. No obligation. No AI sales pitch."
  },

  review: {
    heading: "Start Your Free AI Readiness Review",
    body:
      "Tell us a little about your company. We'll review what we can learn publicly, have a short conversation about how you work, and give you a practical assessment of your AI readiness.",
    fields: {
      name: "Name",
      email: "Work Email",
      company: "Company",
      website: "Company Website"
    },
    cta: "Start My Free Review",
    support: "Free. No obligation. No AI sales pitch.",
    successTitle: "Thanks — we'll be in touch.",
    successBody:
      "We'll review what's publicly available, then reach out to schedule a short conversation about how you work. You'll get a practical read on your AI readiness — no pressure, no sales pitch."
  },

  painPoints: {
    heading: "We help solve real pain points.",
    items: [
      {
        title: "Wasted Time",
        body: "Manual work, handoffs, and rework slow everything down."
      },
      {
        title: "Disconnected Systems",
        body: "Your tools don't talk to each other or to your data."
      },
      {
        title: "The Boring Stuff",
        body: "If a task is too tedious, it's a sign that something needs to change."
      },
      {
        title: "Opportunity Lost",
        body: "Leads, follow-ups, and revenue opportunities falling through the cracks."
      },
    ]
  },

  philosophy: {
    heading: ["We don't start with AI.", "We start with the pain points."],
    body: "Before we recommend anything, we want to understand how your company actually operates.",
    lines: [
      "Sometimes AI is the answer.",
      "Sometimes it's a process problem.",
      "And sometimes it's nothing at all."
    ],
    closer: "That's okay."
  },

  process: {
    heading: "How it works.",
    steps: [
      {
        n: "01",
        tag: "Readiness",
        tagNote: "Free",
        title: "Start with the Free AI Readiness Review",
        body: "A practical read on where you stand today and whether a deeper look is worth it."
      },
      {
        n: "02",
        tag: "Assess",
        tagNote: "Paid",
        title: "Investigate what's actually there",
        body: "We look at workflows, data, technology, people, business value, and risk."
      },
      {
        n: "03",
        tag: "Decide",
        tagNote: "",
        title: "Determine what's worth pursuing",
        body: "We separate the real opportunities from the noise and tell you when the answer is to do nothing."
      },
      {
        n: "04",
        tag: "Build",
        tagNote: "Paid",
        title: "Build only when it makes sense",
        body: "If the evidence supports it, we design, integrate, test, and deploy.  Each system comes with a 60-Day Deployment Assurance."
      },
      {
        n: "05",
        tag: "Own",
        tagNote: "",
        title: "You own the result",
        body: "The delivered system are yours."
      }
    ]
  },

  trust: {
    heading: "We don't sell AI for the sake of AI.",
    body: "Our job is to give you clarity.",
    lines: [
      "Sometimes that means AI.",
      "Sometimes it means automation.",
      "Sometimes it means fixing the process.",
      "And sometimes it means doing nothing."
    ],
    closer: "We'd rather tell you that than sell you something you don't need."
  },

  finalCta: {
    question: "Curious whether AI could actually help your business?",
    lead: "Start with the Free AI Readiness Review.",
    cta: "Start Your Free Review",
    support: "We'll talk to a human. No obligation. No AI sales pitch."
  },

  about: {
    lead: "Humans helping humans.",
    body:
      "We believe technology should make people's work better, not make companies more complicated. Fox & Loom works alongside the people actually doing the work.",
    positioning:
      "We're not an AI company trying to find problems for our AI to solve. We're problem solvers who know how to use AI when it makes sense.",
    principles: [
      {
        title: "Start with people.",
        body: "Technology should serve the people doing the work."
      },
      {
        title: "Evidence before commitment.",
        body: "We don't recommend building something simply because it's possible."
      },
      {
        title: "AI isn't always the answer.",
        body: "Sometimes it's AI. Sometimes it's a process change. Sometimes it's nothing."
      },
      {
        title: "Be honest about uncertainty.",
        body: "If we don't know yet, we'll tell you what we need to learn."
      }
    ],
    closingCtaQuestion: "Want to see how we'd look at your company?",
    closingCta: "Start Your Free AI Readiness Review"
  },

  approach: {
    lead: "We don't start with technology.",
    leadLine2: "We start with understanding.",
    intro:
      "Here's how we actually work, in plain English.",
    plainSteps: [
      {
        title: "Listen",
        body: "Talk to the people doing the work. Understand what actually happens, rather than what the process diagram says should happen."
      },
      {
        title: "Gather evidence",
        body: "Separate what we know from what we think."
      },
      {
        title: "Find the uncertainty",
        body: "Identify assumptions, unknowns, and unanswered questions."
      },
      {
        title: "Decide",
        body: "Determine whether there is something worth pursuing."
      },
      {
        title: "Build only when it makes sense",
        body: "If the evidence supports moving forward, design and build the appropriate solution."
      },
      {
        title: "Make sure it works",
        body: "Test, deploy, document, train, and provide the defined Deployment Assurance."
      },
      {
        title: "Hand it over",
        body: "The client owns the resulting system."
      }
    ],
    framework: {
      heading: "Hypothesis Delta",
      lead: "Hypothesis Delta is how we make better decisions when uncertainty matters.",
      deltas: ["Discover", "Define", "Develop", "Deliver"],
      flow: [
        "Problem Hypothesis: What problem do we believe we're solving?\n" +
          "Our best evidence-based explanation of who is experiencing the problem, what is happening, and why it matters.\n" +
          "We don't assume the problem is real just because someone says it is. We test our understanding against customer evidence and observation.\n\n" +
          "In plain English: Are we solving a real problem, for the right people?",
        "Value Hypothesis: What value do we believe solving the problem will create?\n" +
          "Our hypothesis about what will improve if we solve the problem—for the customer, the business, or both.\n\n" +
          "This gives us something measurable to validate rather than simply assuming that solving a problem automatically creates value.\n\n" +
          "In plain English: If we solve this problem, will it actually matter?",
        "Solution Hypothesis: What do we believe could solve the problem and create the expected value?\n" +
          "Our best evidence-based explanation of how we will address the problem and create value.\n\n" +
          "In plain English: How will we solve this problem, and what will it take to make it work?",
        "Decision Hypothesis: What do we believe we should do based on the evidence?\n" +
          "Our evidence-based hypothesis about the decision the team should make after validation.\n\n" +
          "At Delta 4, the team evaluates the evidence and determines whether to:\n\n" +
          "Persevere — continue with the direction\n" +
          "Pivot — change the direction based on what we learned\n" +
          "Kill — stop pursuing the idea\n\n" +
          "In plain English: Now that we've learned something, what should we do?"
      ],
      gateLabel: "Evidence Gate",
      deltasNote:
        "The framework's four Deltas are: Discover → Define → Develop → Deliver."
    },
    atlas: {
      heading: "Atlas is the AI facilitator behind our methodology.",
      body:
        "Atlas helps organize evidence, surface assumptions, challenge unsupported reasoning, and preserve decisions. Humans make the decisions."
    }
  },

  contact: {
    heading: "Let's talk.",
    body:
      "Whether you're curious about AI, already have a problem in mind, or simply don't know where to start, tell us a little about what's going on.",
    fields: {
      name: "Name",
      company: "Company",
      email: "Work Email",
      website: "Website",
      topicLabel: "What would you like to talk about?",
      topicOther: "Tell us a little more",
      cta: "Start the Conversation"
    },
    topics: [
      "I'm curious whether AI could help",
      "We have a workflow that's painful",
      "Our systems don't work well together",
      "We're already using AI and want to improve it",
      "Something else"
    ],
    secondaryQuestion: "Prefer to start with something more structured?",
    secondaryCta: "Start the Free AI Readiness Review",
    successTitle: "Thanks for reaching out.",
    successBody: "We read every message and reply within one business day."
  },

  footer: {
    tagline: "Humans helping humans.",
    note: "Helping companies figure out where AI and automation can actually make their work better."
  },

  // Pricing content lives in src/content/pricing.ts (sourced from the Fox &
  // Loom business/pricing document) and is attached here so the whole site
  // reads from a single content model.
  pricing,

  contactInfo: {
    phone: "509.302.9850",
    // Read from env at runtime; documented fallback below.
    emailEnvVar: "CONTACT_EMAIL",
    emailFallback: "burns.robby@outlook.com"
  },

  internalRecipient: {
    // Recipient read from process.env at runtime. Do not hardcode in logic.
    salesBriefToEnvVar: "SALES_BRIEF_TO",
    salesBriefFromEnvVar: "SALES_BRIEF_FROM",
    salesBriefToFallback: "burns.robby@outlook.com",
    salesBriefFromFallback: "burns.robby@outlook.com",
    note:
      "Single recipient is a known v1 limitation, not a CRM integration. Fine for MVP; flag for follow-up before scale."
  },

  // ── Internal Company Opportunity Scan content ──────────────────────────
  // These power the preserved automated funnel (/scan) and server libs
  // (orchestrator, personas, PDF). They are intentionally NOT surfaced in the
  // public marketing experience, which uses the human-led Free AI Readiness
  // Review instead. Kept here so the internal machinery stays functional.
  scanStatusMessages: [
    "Analyzing website structure...",
    "Detecting software systems...",
    "Reviewing public signals...",
    "Almost there..."
  ],
  interview: {
    intro: "A few quick questions about your business",
    minQuestions: 8,
    maxQuestions: 12
  },
  perspectives: {
    intro: "We're building a picture of your whole company across five areas.",
    lenses: [
      { id: "business", label: "Business Context", prompt: "What does the company do, and who does it serve?" },
      { id: "operations", label: "Operations", prompt: "How does the work actually get done?" },
      { id: "systems", label: "Systems & Technology", prompt: "What systems support the work?" },
      { id: "data", label: "Data", prompt: "Where does the information live?" },
      { id: "people", label: "People & Work", prompt: "Who does the work, and how?" }
    ]
  }
} as const;

export type Content = typeof content;
