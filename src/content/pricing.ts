/**
 * Pricing content for the public Fox & Loom website.
 *
 * Fixed, transparent pricing (NOT SaaS plans). All figures and tier
 * definitions are sourced from the Fox & Loom business/pricing document.
 *
 * Terminology that must stay consistent:
 *  - Free offering:        "Free AI Readiness Review"
 *  - Paid assessment:      "Company AI Readiness & Opportunity Assessment"
 *  - Implementation tiers: "Single Workflow" / "Connected Operations" /
 *                           "Operations Network"  (never Starter/Pro/Enterprise)
 *
 * Do not relabel the tiers — that would make this look like SaaS pricing.
 */
export const pricing = {
  coreMessage: "Clear scope. Clear price. No mystery proposal.",
  intro:
    "Fox & Loom is a consulting and implementation company. The prices below are fixed, so you don't have to request a mysterious custom quote to know what things cost.",

  assessment: {
    heading: "Start with understanding.",
    body:
      "Before recommending that anything be built, we need to understand what's actually happening.",
    productName: "Company AI Readiness & Opportunity Assessment",
    cards: [
      {
        name: "Small Company",
        price: "$1,480",
        fit: "For smaller organizations and relatively contained operational environments.",
        includes: [
          "Executive Overview",
          "Current Operating Environment",
          "Workflow investigation",
          "Systems review",
          "Data readiness",
          "People & Process readiness",
          "Business value",
          "Risk",
          "Opportunity analysis",
          "Prioritization",
          "Recommended next step",
          "Remaining uncertainty"
        ],
        cta: { label: "Talk About an Assessment", href: "/contact" }
      },
      {
        name: "Mid-Size / Complex",
        price: "$3,480",
        fit: "For larger organizations or more complex operational environments. The same core assessment dimensions, with greater depth and complexity appropriate to the engagement.",
        includes: [
          "Executive Overview",
          "Current Operating Environment",
          "Workflow investigation",
          "Systems review",
          "Data readiness",
          "People & Process readiness",
          "Business value",
          "Risk",
          "Opportunity analysis",
          "Prioritization",
          "Recommended next step",
          "Remaining uncertainty"
        ],
        cta: { label: "Talk About an Assessment", href: "/contact" }
      }
    ],
    credit: {
      question: "Decide to build?",
      headline: "50% of your assessment fee is credited toward implementation.",
      body:
        "If you proceed with an implementation package within the defined period, 50% of your assessment fee is applied toward the implementation."
    }
  },

  implementation: {
    heading: "If it's worth building, we build it.",
    body:
      "Implementation is priced around the scope and outcome of the work—not an arbitrary number of systems or AI agents.",
    tiers: [
      {
        name: "Single Workflow",
        price: "$7,480",
        whatThisMeans:
          "One defined business process automated from trigger to outcome. It can involve multiple steps and multiple systems working together to accomplish one defined business outcome.",
        example: {
          label: "Example",
          title: "Estimate Follow-Up",
          flow: [
            "Estimate sent",
            "Customer receives follow-up",
            "Follow-up occurs according to defined rules",
            "Customer responds / declines / books / opportunity closes"
          ],
          note: "That is one workflow, even if it touches CRM, email, SMS, calendar, and AI reasoning."
        },
        otherExamples: [
          "Missed-call recovery",
          "Estimate follow-up",
          "Appointment reminders",
          "Customer review requests",
          "Invoice reminders"
        ],
        includes: [
          "One defined business workflow",
          "Workflow design",
          "Required integrations for that workflow",
          "AI and/or deterministic logic",
          "Testing",
          "Deployment",
          "Documentation",
          "Training",
          "Operations Diagnostic",
          "60-Day Deployment Assurance"
        ],
        notIncluded: [
          "A second unrelated workflow",
          "A new business process",
          "A new unrelated integration",
          "Business-process redesign outside the agreed workflow",
          "Additional features that change the agreed outcome"
        ],
        important:
          "One workflow does not mean one software system. A Single Workflow can connect to multiple systems when those systems are necessary to accomplish the defined business outcome.",
        cta: { label: "Talk About a Single Workflow", href: "/contact" }
      },
      {
        name: "Connected Operations",
        price: "$14,850",
        whatThisMeans:
          "Multiple workflows that are directly related and operate together as part of the same operational process. The key word is connected—these are not simply several unrelated automations purchased together.",
        examples: [
          {
            title: "Lead → Estimate → Follow-Up → Booking",
            flows: [
              "Workflow 1: Lead captured",
              "Workflow 2: Estimate created/sent",
              "Workflow 3: Follow-up initiated",
              "Workflow 4: Customer books"
            ],
            note: "Because these workflows are directly connected and form one operational chain, they can be treated as Connected Operations."
          },
          {
            title: "Completed Job → Invoice → Payment Follow-Up → Customer Communication",
            flows: [],
            note: "Again, multiple related workflows operating together."
          }
        ],
        includes: [
          "Multiple related workflows",
          "Multiple systems as reasonably required",
          "Required integrations",
          "Orchestration between workflows",
          "State management where required",
          "AI and/or deterministic logic",
          "Testing",
          "Deployment",
          "Documentation",
          "Training",
          "Operations Diagnostic",
          "60-Day Deployment Assurance"
        ],
        notIncluded: [
          "Completely unrelated business processes",
          "A separate workflow that has no meaningful relationship to the agreed operational chain",
          "Major expansion into another operational department",
          "New scope added after the project is defined"
        ],
        definitions: [
          {
            term: "Orchestration",
            body:
              "Coordinating multiple workflows or system actions so they operate together in the correct sequence. For example: lead created → estimate generated → estimate sent → follow-up begins → customer responds → booking workflow starts. The system coordinates the transitions rather than treating each automation as an isolated process."
          },
          {
            term: "State management",
            body:
              "Keeping track of where something currently is in a workflow. For example, a customer might be: Estimate Sent → Follow-Up 1 → Follow-Up 2 → Responded → Booked. The system needs to know the current state so it doesn't send the wrong message or repeat an action."
          }
        ],
        important:
          "Connected Operations is about relatedness, not simply counting workflows. There is no rule such as 'three workflows equals Connected Operations.' The determining question is: are these workflows tightly connected and being designed as one operational system?",
        cta: { label: "Talk About Connected Operations", href: "/contact" }
      },
      {
        name: "Operations Network",
        price: "$24,800+",
        whatThisMeans:
          "Multiple operational areas working together across a broader portion of the business. This is not simply 'more workflows'—it is a broader operational system involving multiple areas of the business.",
        example: {
          label: "Example",
          title: "Sales + Estimating + Dispatch + Customer Communication + Accounting",
          flow: [
            "Sales — lead capture and qualification",
            "Estimating — estimate creation and follow-up",
            "Dispatch — scheduling and job coordination",
            "Customer Communication — reminders, updates, follow-up",
            "Accounting — invoice and payment workflows"
          ],
          note: "That is an Operations Network because multiple operational areas are connected."
        },
        includes: [
          "Multiple workflows",
          "Multiple operational areas",
          "Multiple agents where appropriate",
          "Complex orchestration",
          "Multi-location support where applicable",
          "Broader architecture",
          "Multiple interconnected systems",
          "Testing",
          "Deployment",
          "Documentation",
          "Training",
          "Operations Diagnostic",
          "60-Day Deployment Assurance"
        ],
        definitions: [
          {
            term: "Multi-location",
            body:
              "A workflow operating across multiple branches, offices, stores, service areas, or other distinct operating locations—for example, one workflow architecture supporting 20 service locations. Multi-location support does not automatically mean Operations Network; it is one factor considered when determining scope."
          },
          {
            term: "Multiple agents",
            body:
              "Multiple AI/software components performing different reasoning or action responsibilities within the broader operational system. Agents are not the unit of pricing—the business scope and complexity determine the tier."
          }
        ],
        priceNote:
          "The '+' applies when a project materially exceeds standard Operations Network scope. It is not an excuse for arbitrary pricing.",
        cta: { label: "Talk About an Operations Network", href: "/contact" }
      }
    ],

    whatDeterminesTier: {
      heading: "What determines the tier?",
      lines: [
        "Not the number of AI agents.",
        "Not the number of software subscriptions.",
        "Not the number of API calls."
      ],
      body:
        "We scope the work around the business outcome and workflow complexity.",
      workflowDefinition:
        "A workflow is a repeatable business process that starts with a trigger and produces a defined outcome.",
      workflowExamples: [
        "When an estimate is sent, follow up with the customer until they respond or the opportunity is closed.",
        "When a job is completed, send the appropriate invoice and initiate the customer payment follow-up process."
      ]
    },

    everyImplementation: {
      heading: "What every implementation includes.",
      items: [
        { title: "Design", body: "We define how the workflow should work." },
        { title: "Integration", body: "We connect the systems required for the workflow." },
        { title: "Build", body: "We implement the appropriate AI and/or deterministic automation." },
        { title: "Testing", body: "We test the workflow before deployment." },
        { title: "Deployment", body: "We put it into operation." },
        { title: "Documentation & Training", body: "Your team knows how it works and how to use it." },
        { title: "Operations Diagnostic", body: "You receive the diagnostic artifact documenting the delivered system." },
        { title: "60-Day Deployment Assurance", body: "We stand behind the deployed workflow for the defined assurance period." }
      ]
    },

    terminology: {
      heading: "How we define scope.",
      intro:
        "The tier names alone aren't enough. Here's exactly what we mean by the words we use, so you can tell which tier fits your project without speaking to anyone.",
      items: [
        {
          term: "What do we mean by \"workflow\"?",
          body:
            "A workflow is a repeatable business process that starts with a trigger and produces a defined outcome.",
          examples: [
            "When an estimate is sent, follow up with the customer until they respond or the opportunity is closed. That is one workflow.",
            "When a job is completed, send the appropriate invoice and initiate the customer payment follow-up process. That is one workflow."
          ],
          note: "A workflow is about the business process being automated, not the number of software tools involved."
        },
        {
          term: "What is a system?",
          body:
            "A system is a software platform or service that participates in the workflow.",
          examples: [
            "CRM, estimating software, accounting software, email, SMS, payment systems, internal databases.",
            "From our architecture: ServiceTitan, Jobber, QuickBooks, Google Workspace, Microsoft 365, Twilio, Stripe, and a customer's internal database."
          ]
        },
        {
          term: "What is an integration?",
          body:
            "An integration is the connection that allows the workflow to exchange information with another system.",
          examples: [
            "Estimate created in CRM → automation receives the event → customer receives SMS."
          ],
          note: "The number of integrations does not automatically determine the tier. A single workflow can require multiple integrations."
        },
        {
          term: "What is an agent?",
          body:
            "An agent is an AI/software component that performs reasoning or actions within a workflow. Not every workflow requires an AI agent.",
          examples: [
            "Fox & Loom may use deterministic automation, traditional software logic, AI, AI agents, or a combination—based on what the workflow actually requires."
          ],
          note: "More agents does not mean a better solution."
        }
      ]
    },

    whichTier: {
      heading: "Which one is right for me?",
      items: [
        {
          name: "Single Workflow",
          youHave: "One defined business process you want to improve.",
          example: "\"We want to automate estimate follow-up.\""
        },
        {
          name: "Connected Operations",
          youHave: "Several related processes that need to work together.",
          example: "\"We want to connect our lead, estimating, follow-up, and booking processes.\""
        },
        {
          name: "Operations Network",
          youHave: "Multiple operational areas that need to work together.",
          example: "\"We want to connect sales, estimating, dispatch, customer communication, and accounting.\""
        }
      ]
    },

    notPricedByAgents: {
      heading: "We don't price by the number of AI agents.",
      body: "You shouldn't have to count agents to understand what you're buying.",
      factorsLabel: "We price based on:",
      factors: [
        "Business outcome",
        "Workflow scope",
        "Operational relationships",
        "Systems involved",
        "Integration requirements",
        "Complexity",
        "Risk"
      ]
    },

    comparison: {
      heading: "A simple comparison.",
      note: "These are scope categories, not a feature-counting system. Nothing here is a hard numerical limit.",
      columns: ["Single Workflow", "Connected Operations", "Operations Network"],
      rows: [
        { label: "Defined workflows", values: ["One", "Multiple related", "Multiple"] },
        { label: "Business area", values: ["One", "One or closely related", "Multiple"] },
        { label: "Systems", values: ["As required", "Multiple as required", "Multiple / interconnected"] },
        { label: "Integrations", values: ["Required for workflow", "Multiple as required", "Multiple / interconnected"] },
        { label: "Orchestration", values: ["Simple", "Yes", "Complex"] },
        { label: "State management", values: ["When required", "When required", "As required"] },
        { label: "AI agents", values: ["When appropriate", "When appropriate", "Multiple when appropriate"] },
        { label: "Locations", values: ["Standard", "Standard", "Multi-location where applicable"] },
        { label: "Price", values: ["$7,480", "$14,850", "$24,800+"] }
      ]
    },

    projectChanges: {
      heading: "What happens if the project changes?",
      body: "The price covers the agreed scope. New workflows, new integrations, unrelated business processes, or substantial changes to the agreed outcome are new scope.",
      examples: [
        {
          q: "Can you also automate invoice reminders?",
          a: "If the original project was estimate follow-up, that is a new workflow."
        },
        {
          q: "Can you also connect our new inventory system?",
          a: "That is a new integration if it wasn't part of the agreed implementation."
        },
        {
          q: "Can you redesign this completely different business process?",
          a: "That is new scope."
        }
      ]
    }
  },

  transparency: {
    heading: "We'd rather tell you not to build it.",
    body:
      "Our job isn't to convince you that you need AI. If the evidence doesn't support an implementation, we'll tell you. If the problem is better solved through a process change, a simpler automation, better data, or nothing at all, that's a valid outcome."
  },

  faq: {
    heading: "Pricing FAQ.",
    items: [
      {
        q: "Is the assessment required?",
        a: "The assessment is the normal path when an opportunity needs investigation before implementation. Its purpose is to reduce uncertainty and determine what is actually worth building. It isn't a legal requirement, and it isn't universally mandatory—but when there's real uncertainty, it's how we avoid building the wrong thing."
      },
      {
        q: "Is implementation fixed price?",
        a: "Yes. Implementation packages are defined around scope and outcome."
      },
      {
        q: "What if my project doesn't fit one of the tiers?",
        a: "The Operations Network tier is designed for greater complexity. If the scope genuinely falls outside the standard packages, we'll discuss the engagement directly rather than pretending a standard tier applies. We won't slap a generic \"custom pricing\" label on everything."
      },
      {
        q: "What happens if you decide AI isn't the answer?",
        a: "That's okay. The assessment is intended to help determine whether pursuing the opportunity makes sense. Sometimes the right answer is a process change, a simpler automation, better data, or nothing at all."
      },
      {
        q: "What happens after implementation?",
        a: "Testing, deployment, documentation, training, the Operations Diagnostic, and 60-Day Deployment Assurance are all included in the implementation packages."
      },
      {
        q: "Does the assessment fee apply to implementation?",
        a: "Yes. 50% of the assessment fee is credited toward implementation if you proceed within the defined period."
      }
    ]
  },

  finalCta: {
    question: "Not sure where to start?",
    lead: "Start with the Free AI Readiness Review.",
    body:
      "We'll have a short conversation, look at your company, and help you understand whether there's something worth exploring.",
    cta: "Start Your Free AI Readiness Review",
    support: "Free. No obligation. No AI sales pitch."
  }
} as const;

export type Pricing = typeof pricing;
