# Project Spec: Company AI Opportunity Scan

**Version:** 3.0 | **Generated:** August 14, 2026
**Framework:** Atlas Guides v1.0
**Change from v2.1:** Added mandatory security/consent boundary, abuse protection, broadened prompt-injection scope, loosened prescribed frontend libraries and orchestration implementation to goals/constraints, separated all editable copy into Section 10, added failure-path and data-retention requirements.

---

# 1. Summary

The Company AI Opportunity Scan is an automated, self-service web experience for Fox & Loom prospects. A prospect enters their company information, which triggers real-time public research accompanied by a visual progress timer/status indicator. The prospect then completes an 8–12 question adaptive AI opportunity interview. Upon completion, the prospect immediately receives their downloadable Client AI Opportunity Summary, while a detailed internal Sales Intelligence Brief is automatically emailed to Fox & Loom.

# 2. Problem Statement

Manual prospect research for Fox & Loom sales consultants takes significant time and yields inconsistent preparation. Conversely, prospects dislike waiting for manual approvals or gatekeepers before receiving insights.

This project automates the entire discovery funnel: capturing inputs, scraping public data, conducting an adaptive interview, and delivering immediate value to the prospect while equipping Fox & Loom with an internal brief — without any manual intervention bottleneck, but **without opening an unauthenticated scraping or profiling service against arbitrary third parties.**

# 3. Success Metrics

* **Instant Delivery SLA:** Client report generated and presented for immediate download within < 10 seconds of interview completion.
* **Research Speed & Transparency:** Scraper completes within 30–45 seconds typical SLA, while displaying dynamic real-time progress indicators to the user.
* **Traceability:** 100% of discovery signals map to valid `evidence_id` references; claims without sufficient evidence are omitted rather than guessed.
* **Automated Sales Delivery:** 100% of completed scans trigger an automated internal brief email to Fox & Loom.
* **Abuse Containment:** No unauthenticated request can trigger more than N scans per IP/session per hour (implementer sets N; default suggestion 3), and no scrape target resolves to a private/internal network range.

# 4. Personas

## Prospect (Alice / Web User)
* **Role:** Business owner, manager, or decision-maker visiting the Fox & Loom site.
* **Goal:** Submit company info, complete a quick interactive AI interview, and immediately get a customized AI Opportunity report.
* **Pain Point:** Doesn't want to wait for manual sales approvals or sales pitches before seeing useful business insights.
* **Technical Level:** Business / Non-technical.

## Marcus — Fox & Loom Sales Consultant (Internal)
* **Role:** Sales consultant who receives intake briefs.
* **Goal:** Automatically receive a detailed Sales Intelligence Brief in his inbox whenever a prospect completes a scan.
* **Pain Point:** Spending hours manually researching companies before first calls.

## Anti-Personas
* **Enterprise IT Compliance Auditor:** Seeking formal legal, SOC 2, or cybersecurity compliance audits.
* **Bulk Scrape/Spam Bot:** Seeking autonomous mass cold-outreach or third-party profiling. (See Section 5 — this anti-persona must be actively defended against, not just named.)

# 5. What This Is NOT

* Not a deep workflow audit, SOC 2 review, or financial ROI calculation engine.
* Not a gated or multi-step *approval* workflow requiring manual review prior to report delivery.
* Does not rank opportunities, generate primary hypotheses, or make binding software build decisions.
* **Not an open scraping endpoint.** The submitter must be scanning a company they plausibly represent, not an arbitrary third-party target (see Section 6).

# 6. Non-Negotiable Security & Trust Boundaries

These are hard requirements, not implementation suggestions. Any build that omits these is not done, regardless of how the rest of the pipeline performs.

1. **URL validation before fetch:** The submitted `website` value must be validated as a well-formed `http(s)` URL. Resolve DNS and reject/refuse to fetch if the resolved address falls in a private, loopback, link-local, or cloud-metadata range (e.g. `169.254.169.254`, `10.0.0.0/8`, `127.0.0.0/8`, etc.), including after redirects. Re-check on every redirect hop, not just the initial URL.
2. **Plausible ownership signal:** Before a scan runs, require some signal that the submitter represents the company being scanned — at minimum, matching the submitter's email domain against the submitted website's domain, or a confirmation step ("I represent this company"). This does not need to be cryptographically strong; it needs to raise the bar above "type in any competitor's URL."
3. **Rate limiting & abuse protection:** Per-IP and per-session throttling on scan submissions. A bot-detection step (e.g. CAPTCHA or equivalent challenge) before the scraper is invoked, since each scan has real compute/API cost.
4. **Prompt injection guardrails apply to *all* free text entering the agent pipeline** — both scraped external content and the prospect's own "optional operational notes" field and interview answers. Sanitize/neutralize instruction-like content from every source, not only scraped pages.
5. **Data retention:** Define and document a retention window for scraped company data and prospect answers, and a deletion path. Do not treat this as an unlimited-retention profile store by default.

# 7. Architecture

## 7.1 Orchestration Shape

The experience is a **linear interactive pipeline** with four stages. The stage sequence and data contracts between stages are fixed; the internal implementation of each stage is an implementation decision, not a specification requirement (see 7.2).

```
[Prospect Web Form]
       │
       ▼
[Parallel Research Scraper] ─── (Real-time UI Progress + Status Updates)
       │
       ▼
[Adaptive AI Interview Agent] (8–12 Bounded Questions)
       │
       ▼
[Re-Analysis & Synthesis Engine]
       │
       ├────────────────────────────────────────┐
       ▼                                        ▼
[Client Summary Report]              [Internal Sales Brief]
(Immediate UI Download)              (Automated Email to Fox & Loom)
```

**Required properties of the implementation** (the "what," left open on the "how"):
* Interview length is deterministically bounded between 8 and 12 questions — hard stop, no exceptions.
* Every claim in both output reports traces to a stored `evidence_id`; claims without adequate evidence are omitted, not invented.
* Prospect-reported answers supersede scraped inferences when they conflict.
* Progress state streams to the client in near-real-time during the scrape stage.
* If the scraper fails, times out, or is blocked by the target site (common for headless browsers — many sites block or CAPTCHA them), the pipeline degrades gracefully: proceed to the interview with whatever partial evidence exists, and lean more on interview questions to fill gaps, rather than hard-failing the whole flow.

## 7.2 Framework Choice — left to implementer

Prior versions of this spec prescribed a hand-rolled Python asyncio state machine. That is **not required.** Choose whatever state-management approach reliably delivers the bounded, traceable, streaming behavior above — a state machine, an existing agent-orchestration library, or another approach. If you deviate from a simple approach, leave a one-paragraph note on why.

# 8. Component Infrastructure & Function Model

This section distinguishes **external capabilities** (MCPs / third-party services the application calls) from **internal application functions** (logic the application owns). Only the external capabilities are infrastructure the implementer must provision; the internal functions are packaging decisions left to the implementer. Identifier names below are reference handles for cross-referencing the user stories in Section 11, not prescribed interfaces — the implementer may implement them as functions, modules, services, or MCPs as fits the architecture, except that the two external capabilities must remain externalized/swappable.

## 8.1 External Capabilities (MCPs / services)

| Capability | Type | Purpose | Risk | Required |
|---|---|---|---|---|
| research-scraper | Scraper MCP | Scrapes target website pages (home, services, careers, contact) and related public signals — subject to Section 6 validation. Encompasses the Phase 1 research sub-tasks: `web-research-scrape`, `tech-signals-detect`, `job-listings-fetch`, `review-search-fetch` | MED | YES |
| email-dispatch | Platform service / MCP | Automatically emails the Fox & Loom internal team the Sales Intelligence Brief. Provider must be swappable behind a thin interface (see 9.3) | LOW | YES |

## 8.2 Internal Application Functions (not MCPs)

The following are application-internal functions referenced by the user stories in Section 11. They are **not** MCPs and are not infrastructure. Their packaging is an implementation decision; the names are reference identifiers only.

* `generate-next-question` — produces the next bounded interview question (Phase 2)
* `ingest-response` — converts a prospect answer into `PROSPECT_REPORTED` evidence (Phase 2)
* `export-client-summary` — synthesizes the Client AI Opportunity Summary for PDF generation (Phase 3)
* `export-sales-brief` — synthesizes the internal Sales Intelligence Brief payload handed to `email-dispatch` (Phase 3)
* `create-intake-package` — assembles the Deep Assessment intake package JSON (Phase 3)

> Implementation flexibility note: the spec intentionally does not prescribe whether these internal functions live in the orchestrator, a library, or MCP wrappers. If an implementer chooses to expose any of them as MCPs, that is permitted but not required, and must not introduce a hard external dependency.

# 9. Front End

## 9.1 Aesthetic & UX Goal
Build a modern, responsive, human-centered website for an approachable AI consulting firm.
* **Design System:** Base the entire color palette, accents, and typography hierarchy on the provided logo file.
* **Tone & Feel:** Friendly, transparent, approachable, human-first — avoid sterile, overly corporate, or hyper-futuristic tech tropes.
* **UX Goal:** Guide visitors smoothly through discovery, live scanning, and adaptive intake before offering paid deep dives.

## 9.2 Page Structure & Requirements (behavior only — copy lives in Section 10)

### Page 1: Home / Landing Page & Interactive Funnel
* **Hero & Value Proposition:** see `content.hero` in Section 10.
* **Interactive Scan & Funnel Components:**
  * **Step 1 (Input):** Company name, website URL, optional operational notes. Include the ownership-signal check from Section 6.
  * **Step 2 (Live Research UI):** Real-time progress bar, dynamic status text (see `content.scan_status_messages`), estimated 30s timer.
  * **Step 3 (Adaptive Interview UI):** 8–12 bounded questions with visual counter ("Question 4 of 10").
  * **Step 4 (Results / Download):** Instant Client Summary PDF download trigger and deep-dive assessment CTA.

### Page 2: About Us
* Body copy: see `content.about`.

### Page 3: Contact Page
* Contact info: see `content.contact`.
* Contact Form: Name, Email, Company, Message.
* **Configurable Backend:** Form routing configurable via `process.env.CONTACT_EMAIL` (do not hardcode).

## 9.3 Tech Stack & Frontend Deliverables

* **Framework:** Next.js (App Router) with TypeScript. *(A real constraint — keep.)*
* **Styling:** Tailwind CSS with CSS variables mapped to the logo palette.
* **UI Components:** Use `shadcn/ui` for accessible forms, dialogs, progress bars, and buttons — this one matters for accessibility and consistency, keep it. For hero transitions, interactive cards, and status loaders, **use your judgment on current, well-maintained component libraries** that fit the friendly/human tone in 9.1 — don't feel locked into a specific named library; note what you chose and why.
* **Icons:** Any consistent, MIT/permissive-licensed icon set (Lucide is a fine default).
* **Real-Time Streaming & Reporting:** Server→client streaming for scraper status events (SSE, websockets, or framework-native streaming — implementer's choice). PDF generation for the Client Summary must hit the <10s SLA — pick whatever serverless/library approach gets there reliably.
* **Email Dispatch:** Route handlers send internal Sales Briefs via an email provider — Resend/SendGrid/Postmark are all acceptable; pick one and keep the provider swappable behind a thin interface.
* **Accessibility:** WCAG 2.1 AA on the funnel flow at minimum — this is the primary acquisition surface.

# 10. Content & Copy (editable — does not change behavior)

> Everything in this section is content, not logic. Edit freely without touching the spec above. Consider lifting this into a `content.ts` / CMS entry / `.env` values at build time so copy changes don't require a redeploy of logic.

```yaml
content:
  hero:
    headline: "Humans Helping Humans With AI"
    subheadline: >
      Our process starts right here. Complete our interactive intake below—our AI
      assistant will ask a few tailored questions about your company. Once complete,
      you'll receive an instant, free high-level assessment of where your business
      stands on its AI journey. From there, you can book an in-depth strategy session
      with our human team, and we can build custom agents to tackle your specific
      bottlenecks.

  scan_status_messages:
    - "Analyzing website structure..."
    - "Detecting software systems..."
    - "Reviewing public signals..."
    - "Almost there..."

  about:
    core_message: "Honest, grounded, practical AI advisory."
    body: >
      We are humans helping humans. We're an easygoing team passionate about removing
      friction for real people inside growing businesses. We don't believe AI is a
      magic fix for everything, but we excel at finding the exact places where it
      truly moves the needle. And if AI turns out not to be the right solution for
      your problem? We'll tell you upfront—saving you from sinking money into tech
      you'll never use.

  contact:
    phone: "509.302.9850"
    email_env_var: "CONTACT_EMAIL"

  internal_recipient:
    sales_brief_to_env_var: "SALES_BRIEF_TO"
    # The Sales Brief recipient is read from process.env.SALES_BRIEF_TO at runtime.
    # Do NOT hardcode the recipient into application logic.
    # Default/example value (documented only; implementer may use as a fallback
    # when SALES_BRIEF_TO is unset): marcus@foxandloom.com
    # NOTE: single recipient is a known v1 limitation, not a CRM integration.
    # Fine for MVP; flag for follow-up before scale.
```

# 11. Build Phases & User Stories

## Phase 1: Input Form, Scraper Engine & Real-Time Progress UI

* **Goal:** Capture prospect website inputs, validate/authorize the target (Section 6), execute parallel scraping adapters, sanitize findings into evidence, and stream dynamic progress indicators to the user UI.
* **Exit Condition:** Web scraper fetches public signals within 30–45s typical SLA while frontend displays continuous progress feedback, and no request bypasses the Section 6 validation gate.

### Story 1.1: Web Input & Parallel Public Research Scraper
* **Persona:** Prospect (Alice)
* **User Story:** As a prospect visiting the website, I want to submit my company details and see live feedback on the research progress, so that I know the system is actively working on my scan.
* **Features:**
  * Form accepting `company_name`, `website`, and optional notes.
  * Ownership-signal check (Section 6.2) before scan starts.
  * Rate limiting / bot challenge (Section 6.3) before scan starts.
  * Animated progress bar and estimated countdown timer (30s).
  * Live status indicator text updates (see `content.scan_status_messages`).
  * Parallel scraping via Playwright across home, about, services, and career pages.
* **Acceptance Criteria:**
  * [ ] Accepts required form inputs and initializes pseudonymous scan ID.
  * [ ] Rejects/blocks submitted URLs resolving to private, loopback, or metadata IP ranges — including after redirects.
  * [ ] Enforces an ownership-plausibility check before scraping begins.
  * [ ] Rate limiting prevents more than N scans per IP/session per hour.
  * [ ] Scraper executes in parallel and completes within 30–45s SLA, or degrades gracefully per Section 7.1 on failure/timeout.
  * [ ] Visual progress indicator updates continuously during execution.
  * [ ] All external content and user-submitted free text passes sanitization guardrails to prevent prompt injection.
* **Verification Method:** Integration Test
* **Risk:** MED
* **Layers Touched:** UI, Agent, MCP, Infrastructure
* **Tools Used:** `research-scraper` MCP (sub-tasks: `web-research-scrape`, `tech-signals-detect`, `job-listings-fetch`, `review-search-fetch`) — see Section 8.1

## Phase 2: Adaptive AI Opportunity Interview

* **Goal:** Conduct a dynamic 8–12 question discovery conversation to collect prospect-reported context and resolve information gaps.
* **Exit Condition:** Interview completes within bounded 8–12 questions and converts responses to `PROSPECT_REPORTED` evidence.

### Story 2.1: Dynamic Interview & Context Gathering
* **Persona:** Prospect (Alice)
* **User Story:** As a prospect, I want to answer a short series of relevant, plain-English questions about my operations, so that Fox & Loom understands my business context without making false assumptions.
* **Features:**
  * Adaptive question generation targeting unresolved information gaps.
  * Visual interview progress counter (e.g. "Question 4 of 10").
  * Deterministic hard stop bounded between 8–12 questions.
  * Immediate conversion of answers to `PROSPECT_REPORTED` evidence.
* **Acceptance Criteria:**
  * [ ] Asks plain-English business questions based on scraped context.
  * [ ] Displays clear progress numbers on screen.
  * [ ] Enforces hard stop when target question count is reached.
  * [ ] Prospect responses supersede public web inferences where contradictions occur.
  * [ ] Interview answer text passes the same prompt-injection guardrails as scraped content.
* **Verification Method:** E2E Test
* **Risk:** MED
* **Layers Touched:** UI, Agent, Orchestration
* **Functions Used:** `generate-next-question`, `ingest-response` (internal — see Section 8.2)

## Phase 3: Instant Dual Report Delivery

* **Goal:** Instantly generate and present the Client Report for download while dispatching the internal brief via email.
* **Exit Condition:** Client can click download immediately on screen; Fox & Loom receives internal brief email.

### Story 3.1: Client Report Download & Automatic Sales Dispatch
* **Persona:** Prospect (Alice) & Sales Consultant (Marcus)
* **User Story:** As a prospect, I want to download my customized AI Opportunity report immediately after the interview, and as Marcus, I want an internal brief emailed to me automatically so I can follow up effectively.
* **Features:**
  * Instant PDF generation for the Client AI Opportunity Summary.
  * Thank-you screen with immediate download button.
  * Background email dispatch of internal Sales Intelligence Brief to the address configured in `process.env.SALES_BRIEF_TO` (see `content.internal_recipient` in Section 10).
  * Creation of Deep Assessment intake package JSON.
* **Acceptance Criteria:**
  * [ ] Client PDF report available on screen within 10 seconds of interview end.
  * [ ] Client report contains 2–4 unranked opportunity areas, practical examples, non-accusatory language, and every claim traces to an `evidence_id`.
  * [ ] Claims lacking sufficient evidence are omitted rather than guessed at.
  * [ ] Detailed Sales Brief emailed automatically to the address in `process.env.SALES_BRIEF_TO` (default/example value documented in `content.internal_recipient`, Section 10); the recipient must not be hardcoded into application logic.
  * [ ] No manual review gate bottlenecks exist (Gate 1 and Gate 2 removed) — this applies to *review of report content before send*, not to the Section 6 pre-scrape validation gates, which remain mandatory.
* **Verification Method:** Integration / Contract Test
* **Risk:** HIGH
* **Layers Touched:** UI, Agent, MCP, Infrastructure
* **Functions Used:** `export-client-summary`, `export-sales-brief`, `create-intake-package` (internal — see Section 8.2); `email-dispatch` MCP (external — see Section 8.1)

# 12. Agent Execution Contract

This section governs how an autonomous coding agent (Claude Code, Cursor, Antigravity, etc.) should operate against this spec. It exists to prevent two opposite failure modes: stalling on trivial approval requests, and quietly overstepping boundaries that were never meant to be negotiable.

## 12.1 Specification Authority (Decision Order)

When something is unclear or two valid paths exist, resolve in this order. Higher tiers are never overridden by lower ones — in particular, **tier 1 is never subject to "agent implementation judgment" (tier 8) or to the Autonomy Rule in 12.3.**

1. Security / trust boundaries (Section 6)
2. Explicit requirements
3. Acceptance criteria
4. Data contracts
5. Success metrics
6. Existing repository conventions
7. Existing architecture
8. Agent implementation judgment

## 12.2 Authorized Actions

The coding agent is authorized, without asking, to:

* inspect the repository
* create and modify files
* install required dependencies
* choose implementation details not constrained by this specification
* run tests
* run lint/type checks
* run the application locally
* diagnose failures
* make corrective changes
* iterate until acceptance criteria are met
* update `build_log.md`
* update `self-improve.md`
* refactor when required to satisfy the specification

## 12.3 Autonomy Rule — Do Not Ask Unless Blocked

**Do not ask the user to choose between reasonable implementation alternatives.** Make the decision using Section 12.1's order, repository conventions, and engineering judgment.

**"Blocked" means the agent cannot proceed at all without the missing input** — not that two or more valid approaches exist. Ask the user only when proceeding would require:

* changing an explicit product requirement
* crossing a security boundary (Section 6)
* a new external credential
* a new paid service or one with a cost implication
* a destructive operation (data loss, irreversible migration, production impact)
* a materially ambiguous business decision the spec genuinely doesn't answer

When a material implementation decision is made under tier 8 (agent implementation judgment) — one that affects architecture, dependencies, data flow, security, performance, maintainability, or future extensibility — log the decision and reasoning in `build_log.md`, not just the outcome, so a human or another agent can audit it later. Routine choices (variable names, file layout, minor refactors) do not need an entry.

**Runaway-loop guard:** If the same substantive failure remains after three distinct corrective attempts, stop iterating on that failure. Report what was tried, what remains failing, and why. Classify the task as blocked rather than continuing to guess indefinitely.

## 12.4 Build Loop

```
Inspect → Plan → Build → Test → Diagnose → Fix → Verify → Log → Improve → Continue
```

The agent must not stop merely because the requested code has been written. **It stops when the Definition of Done (Section 13) has been demonstrated**, not when a first pass compiles or a happy-path test passes.

## 12.5 Change Management (Blast Radius)

Before modifying existing functionality, the agent must:

1. Identify dependencies on the component.
2. Identify tests covering the component.
3. Identify downstream consumers.
4. Determine potential blast radius.
5. Make the smallest change that satisfies the requirement.
6. Run affected tests.
7. Run the broader test suite before declaring completion.

## 12.6 Verification Integrity

The agent must verify that tests meaningfully exercise the implemented behavior. It must not modify, weaken, delete, skip, or narrowly scope tests solely to make an implementation pass. **A passing test suite does not override an unmet specification requirement** — tests are evidence that a requirement is satisfied, not a substitute for satisfying it. If a test seems wrong given the spec, fix the test openly (and note why in `build_log.md`), rather than quietly loosening it to get to green. A test may be changed only when the agent can demonstrate that the existing test conflicts with the specification or intended behavior — an implementation failing a test is not, by itself, sufficient justification to change that test.

## 12.7 The Agent MUST NOT

* weaken security requirements
* remove acceptance criteria
* silently change product behavior
* introduce unnecessary infrastructure
* mark incomplete work complete
* hide test failures
* replace a failing implementation with a mocked implementation merely to pass tests
* modify, weaken, delete, or skip a test solely to make a failing implementation pass

# 13. Definition of Done

The project is complete when:

* [ ] All Section 6 security/trust boundaries are implemented and tested (URL validation, ownership signal, rate limiting, full-scope prompt-injection sanitization, retention policy documented).
* [ ] All 3 build phases and user stories meet acceptance criteria.
* [ ] Scraper and UI progress indicators function smoothly together, including graceful degradation on scrape failure.
* [ ] 8–12 question interview completes and triggers synthesis.
* [ ] Client PDF is downloadable on the thank-you screen.
* [ ] Sales Brief is emailed to Fox & Loom automatically.
* [ ] Funnel flow passes a WCAG 2.1 AA spot check.
* [ ] `build_log.md` and `self-improve.md` are up to date.
