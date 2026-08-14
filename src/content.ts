/**
 * Editable copy (spec §10). Pure content — no behavior. Changing values here
 * does not require touching spec logic. Lifted into a single module so copy
 * changes don't force a logic redeploy beyond a normal build.
 */
export const content = {
  orgName: "Fox & Loom",
  orgShortName: "Fox & Loom",

  hero: {
    headline: "Humans Helping Humans With AI",
    subheadline:
      "Our process starts right here. Complete our interactive intake below—our AI assistant will ask a few tailored questions about your company. Once complete, you'll receive an instant, free high-level assessment of where your business stands on its AI journey. From there, you can book an in-depth strategy session with our human team, and we can build custom agents to tackle your specific bottlenecks."
  },

  scanStatusMessages: [
    "Analyzing website structure...",
    "Detecting software systems...",
    "Reviewing public signals...",
    "Almost there..."
  ],

  scan: {
    timerSeconds: 30,
    steps: [
      { id: "validate", label: "Verifying your request" },
      { id: "scrape", label: "Researching your company" },
      { id: "interview", label: "Tailoring questions" }
    ]
  },

  interview: {
    intro: "A few quick questions about your business",
    minQuestions: 8,
    maxQuestions: 12
  },

  about: {
    coreMessage: "Honest, grounded, practical AI advisory.",
    body:
      "We are humans helping humans. We're an easygoing team passionate about removing friction for real people inside growing businesses. We don't believe AI is a magic fix for everything, but we excel at finding the exact places where it truly moves the needle. And if AI turns out not to be the right solution for your problem? We'll tell you upfront—saving you from sinking money into tech you'll never use."
  },

  contact: {
    phone: "509.302.9850",
    // Read from env at runtime (spec §10); this is the documented fallback.
    emailEnvVar: "CONTACT_EMAIL",
    emailFallback: "hello@foxandloom.com"
  },

  internalRecipient: {
    // Recipient read from process.env.SALES_BRIEF_TO at runtime (spec §10).
    // Do not hardcode in logic. Documented default/example below.
    salesBriefToEnvVar: "SALES_BRIEF_TO",
    salesBriefFromEnvVar: "SALES_BRIEF_FROM",
    salesBriefToFallback: "marcus@foxandloom.com",
    salesBriefFromFallback: "briefs@foxandloom.com",
    note:
      "Single recipient is a known v1 limitation, not a CRM integration. Fine for MVP; flag for follow-up before scale."
  },

  nav: {
    items: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" }
    ]
  },

  footer: {
    tagline: "Honest, grounded, practical AI advisory."
  }
} as const;

export type Content = typeof content;
