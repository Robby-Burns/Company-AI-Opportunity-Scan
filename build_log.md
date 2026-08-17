# Build Log — Company AI Opportunity Scan (COS)

Living log of material implementation decisions (per spec §12.3). Routine
choices (file layout, names) are not logged here. Newest entries at the top.

## 2026-08-17 — Company AI Opportunity Scan Architecture & 6-Section Synthesis Alignment

Locked in the 5-stage product lifecycle and aligned Tier 0 (Opportunity Scan) coordinator and synthesis with the official source of truth:

### 1. 5-Stage Product Lifecycle
* **1. Opportunity Scan**: *"Is there something here worth investigating?"* — Identify credible opportunities from limited evidence.
* **2. Deep Assessment**: *"What opportunities actually matter, and is one worth pursuing?"* — Investigate, evaluate, and prioritize across 6 dimensions.
* **3. Build Decision**: *"What should we build?"* — Implementation pathway decision.
* **4. Atlas**: *"What is the evidence-supported specification?"* — Evidence-backed specification.
* **5. Shipyard**: *"Can we build and deploy it correctly?"* — Deployment assurance execution.

### 2. Governing Rule & Epistemic Boundary
*"Specific enough that the prospect recognizes a real opportunity in their business, but incomplete enough that determining whether that opportunity is valuable, feasible, safe, and worth pursuing remains the purpose of the Deep Assessment."*

### 3. Synthesis Engine & 6-Section Report Structure
Transitioned from the 5-dimension readiness table to the 6-part executive brief:
1. **Opportunity Hypothesis** (specific operational locus + confidence worth investigating).
2. **Why We Identified It** (cited evidence from conversation/research).
3. **Potential Impact** (directional operational magnitude, grounded in evidence; no ROI fabrication).
4. **Additional Signals** (secondary opportunities or friction points).
5. **What Remains Unknown** (structural, operational, and system blindspots).
6. **What a Deep Assessment Would Investigate** (strictly diagnostic questions, prohibiting task/audit checklists).

### 4. Coordinator Stopping Rule (Information Budget)
* The 8–12 turn range is an information budget, not a conversational script.
* At Question 8 (minimum threshold), evaluates whether evidence is sufficient to articulate a credible Opportunity Hypothesis; continues if significant uncertainty remains, and stops immediately once the hypothesis is backed. Hard stop at 12.

### 5. Blast Radius & Downstream Integrations
* Updated `ClientReport` and `SalesBrief` data contracts (`synthesis.ts`).
* Updated `ClientSummaryPdf` (`client-summary-pdf.tsx`) to render the 6 structured sections with WinAnsi Helvetica safety.
* Updated Sales Intelligence Brief text and HTML renderers (`email.ts`).
* Updated Deep Assessment intake package payload (`createIntakePackage()`).
* Added automated Boundary-Leakage (no vendors, architecture, or tasks) and Anti-Vagueness regression test suites.

## 2026-08-14 — Multi-perspective interview architecture (coordinator + specialist personas)

Replaced the single-agent adaptive interview loop with a multi-perspective
architecture modeled on the six dimensions of the paid Deep Assessment
(Workflow, Technology, Data, Business Value, Risk). This is a product/sales
decision, not a cost-optimization one: the free scan's job is to make the
prospect think "they actually understand my business," not to ask a generic
adaptive questionnaire. The extra inference cost is acceptable for a
lead-gen mechanism feeding a $1,480–$3,480 assessment.

### Architecture (spec §7.2 — framework choice left to implementer)
Per turn:
1. **Coordinator** (one LLM call) — reviews evidence + answers + per-lens
   perspective states, selects the 2–3 lenses with the highest current
   information value, assigns scoring weights, and may signal `complete`.
2. **Specialist personas** (2–3 parallel LLM calls) — each reviews the current
   context + its own prior perspective and proposes a candidate question, an
   updated perspective, and a self-scored rubric. Lenses: Operations, Systems,
   Data, Business, Risk.
3. **Deterministic scoring** (no LLM) — weighted sum picks the best candidate;
   ties break by the coordinator's lens order. No second coordinator call per
   turn (per the product lead's adjustment).

### Persona perspective memory
Each lens keeps `beliefs / uncertainties / potentialOpportunity / evidenceRefs`
across the whole interview, stored in `InterviewState.perspectives`. When a
lens is re-consulted it receives its prior state; otherwise it persists
unchanged. At synthesis, the final perspectives become the report's "What each
perspective sees" section (e.g. "Operations Perspective: ..."), making the
report feel like a consulting product rather than a chatbot transcript.

### Bounds (unchanged invariant)
8–12 questions, hard stop at max enforced in code (the model cannot exceed it).
Goal reframed: the FEWEST questions necessary to establish a compelling
opportunity hypothesis — the coordinator signals `complete` at >= min when a
hypothesis is established (HD: reduce uncertainty with the smallest effort).

### Graceful degradation
Coordinator failure → scripted fallback questions. All-persona failure →
fallback. The interview always completes (bounded) and the report always
generates. No fake readiness score (per the existing methodology: "No maturity
score. No six-framework matrix").

### Report changes (blast radius)
- `ClientReport` and `SalesBrief` gained a `perspectives: PerspectiveView[]`
  field; `OpportunityArea` gained an optional `lens`.
- Synthesis prompt now consumes the interview's perspective states and asks for
  per-lens views; unsupported perspectives are omitted (same evidence
  invariant as areas).
- PDF (`client-summary-pdf.tsx`) renders a "What each perspective sees"
  section.
- Email brief (text + HTML) includes the perspectives.
- Report route JSON exposes `perspectives`.

### UI hook (spec §9.1)
The interview step shows a "Your company is being looked at from five
different angles" panel on the first question, listing all five lenses with
their framing prompts. Each question shows a lens badge (e.g. "Operations
perspective") so the prospect feels the multi-perspective assessment.

### Files
- New: `src/lib/interview/types.ts`, `personas.ts`, `coordinator.ts`.
- Rewritten: `src/lib/orchestrator.ts` (public API preserved: `nextQuestion`,
  `ingestResponse`, `initInterview`, `isInterviewFinished`, `clearInterviewState`,
  `getInterviewState` all unchanged signatures).
- Updated: `src/lib/synthesis.ts`, `src/content.ts` (perspectives copy),
  `src/components/opportunity-scan-funnel.tsx`, `src/components/pdf/client-summary-pdf.tsx`,
  `src/lib/email.ts`, `src/app/api/report/[id]/route.ts`.
- Removed: the old single-agent `SYSTEM_PROMPT` and inline `nextQuestion` body.

### Tests
- `orchestrator-synthesis.test.ts` rewritten to mock the multi-call pattern
  (1 coordinator + N personas per turn). New tests: coordinator selects lenses,
  scoring picks best, novelty wins under equal weights, perspective state
  persists across turns, question carries its lens, perspectives survive
  synthesis with evidence backing, unsupported perspectives dropped.
- Preserved: hard-stop at 12, early finish via coordinator `complete`, fallback
  on coordinator failure, fallback on all-persona failure, evidence invariant.
- Suite: 42 -> 46 tests, all green; typecheck/lint/build all green.

## 2026-08-14 — Railway deployment hardening

Reviewed the codebase against the deployment target (Railway: long-running Node,
not serverless) and fixed real issues found, in blast-radius order.

### Memory leaks on long-running server (HIGH — real bug)
On a persistent Node process (Railway, not Vercel serverless), three
module-level Maps grew without bound because the retention sweep only cleared
`SCANS`:
- `STATE` (orchestrator.ts) — interview state per scan, never cleared.
- `REPORTS` (synthesis-queue.ts) — generated client reports, never cleared
  (`SYNTH` already self-cleaned after 5min, but `REPORTS` didn't).
- Fix: exported `clearInterviewState(scanId)` and `clearSynthesisState(scanId)`;
the retention sweep now calls both in its full-delete branch (when the answer
window expires). The per-class purge branch (scraped window only) correctly
keeps prospect data. New test verifies both maps are cleared on sweep.
- Blast radius: orchestrator + synthesis-queue + retention. Cleanup-path only;
tests use unique IDs so unaffected. 42 tests green.

### Playwright chromium on Railway (HIGH — functional)
Railway's default nixpacks Node build does not install chromium's system
dependencies. The scraper's graceful-degradation path would have silently
returned zero evidence on every scan (no tech signals, no web content) rather
than crashing — a significant product regression, not a visible error.
- Fix: added a `Dockerfile` (two-stage, `node:20-bookworm-slim`) that downloads
the chromium browser at build time (`npx playwright install chromium`) and
installs its shared-library deps at runtime via Playwright's own
`npx playwright install-deps chromium` command — more reliable than
hand-maintaining apt package names across Debian revisions. The browser binary
lives under `/app/.pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH`) so it is copied
from build to runtime with the app.
- Pinned `playwright` to exact `1.62.1` (was `^1.49.1`) so the browser binary
downloaded at build time matches the library at runtime. Moved `playwright`
from devDependencies to dependencies — the scraper imports it at runtime, so it
is a real production dependency (any platform that prunes devDeps would break
the scraper otherwise).
- `.dockerignore` excludes `.env`, `node_modules/`, `.next/`, logs, editor
files — secrets are never baked into the image.
- Could not build the image locally (Docker Desktop daemon returning 500s); the
Dockerfile follows the official Playwright-in-Docker pattern and will be
validated by Railway's build.
- Blast radius: new files (`Dockerfile`, `.dockerignore`) + package.json
categorization. No app logic changed.

### Minor correctness fixes (LOW)
- `metadataBase` in `layout.tsx` was hardcoded to `http://localhost:3000`;
now reads `process.env.NEXT_PUBLIC_APP_URL` (with the localhost fallback) so
production metadata resolves correctly.
- Removed dead `void sanitized` in `orchestrator.ingestResponse` — it computed
a sanitized string then discarded it (the raw answer is stored for display and
re-sanitized at LLM-consumption time in `sanitizeAnswers`). No behavior change.
- Added `GET /api/health` endpoint + a Docker `HEALTHCHECK` so Railway can
probe readiness without hitting the LLM/browser.

## 2026-08-14 — Dependency security hardening (Railway deploy gate)

Railway blocked deployment on 4 CVEs in `next@15.1.6` (incl. CRITICAL
CVE-2025-66478). Resolution:

- **Bumped `next` 15.1.6 → 15.5.23** (latest 15.x, within the `^15.1.11`
  range Railway required). Did NOT jump to Next 16 — that's a breaking major
  bump; 15.5.x resolves all four flagged CVEs while staying on the same major.
- **`eslint-config-next` bumped to match** (15.5.23) so the lint preset stays
  in sync with the runtime.
- **Transitive vuln cleanup via `npm overrides`** (the 3 highs that remained
  after the next bump were in deps Next bundles internally):
  - `postcss` forced to `^8.5.26` — fixes path-traversal / arbitrary-file-read
    via `sourceMappingURL` (GHSA-6g55-p6wh-862q, -fxqj-rqcc-2cmp, -r28c-9q8g-f849)
    in the nested `postcss@8.4.31` Next was shipping. Also bumped our own
    `postcss` devDep to `^8.5.26` so the override doesn't conflict with the
    direct dependency (npm rejects conflicting overrides).
  - `sharp` forced to `^0.35.3` — fixes libvips CVEs (GHSA-f88m-g3jw-g9cj)
    in the nested `sharp@0.34.5` Next uses for image optimization.
- Verified all nested copies dedupe to the fixed versions (`npm ls --all`).
- `npm audit` now reports **0 vulnerabilities**. All gates still green:
  typecheck / lint / 41 tests / `next build`.

## 2026-08-14 — Hardening pass (gaps closed against spec acceptance criteria)

### Scraper now actually drives Playwright (spec §1.1, §8.1)
- **Before:** `runScraper` launched chromium, created a context/page, then
  fetched every page with plain `safeFetch` and never used the browser. The
  Playwright process did no work, JS-rendered sites were not rendered, and the
  acceptance criterion ("Parallel scraping via Playwright across pages") was
  not genuinely satisfied.
- **After:** navigation goes through `page.goto` + `page.content()`, so
  JS-rendered content is captured. SSRF is still enforced on **every** request
  the browser issues (document, subresource, redirect, XHR) via a `page.route`
  interceptor that calls the newly-exported `assertSafeHost` (DNS resolve +
  private/loopback/link-local/metadata block). This is the Playwright
  equivalent of `safeFetch`'s per-hop re-validation (spec §6.1) — redirects
  inside the browser are re-validated too, since each redirect is a new routed
  request.
- `assertSafeHost` was extracted from `ssrf.ts` (renamed from the private
  `resolveAndCheck`) and exported so the scraper can reuse the exact same host
  check without duplicating the CIDR/range logic.

### Optional operational `notes` now enter the pipeline (spec §6.4, §7.1)
- **Before:** the funnel sent `notes`, the route typed it, but it was never read
  or stored — silently dropped, violating §6.4 (all free text must pass
  guardrails and enter the pipeline).
- **After:** `POST /api/scan` trims + caps (2000 chars) the notes, sanitizes
  them via `sanitize({tag:"notes"})`, stores the sanitized text on the
  `ScanRecord.notes` field, AND adds them as `PROSPECT_REPORTED` evidence
  (`signal: notes:operational`, confidence high) with an `evidence_id` so
  synthesis can cite them (§7.1 traceability). The orchestrator also includes
  the sanitized notes in the question-generation context so interview
  questions can target gaps the prospect already hinted at.

### Per-class data retention (spec §6.5)
- **Before:** the sweep only deleted whole scans at the longer (answers) window;
  scraped evidence was never purged at its shorter 90-day window. The spec
  wants a defined window + deletion path *per data class*.
- **After:** `runRetentionSweep` now (a) purges `SCRAPED_*` evidence via the new
  `purgeScrapedEvidence()` (keeps `PROSPECT_REPORTED`) when the scraped window
  expires but the answer window hasn't, and (b) deletes the whole record once
  the answer window also passes. Returns `{ purgedScraped, deletedScans }` for
  audit. New test file `retention.test.ts` covers both branches.

### Contact form `from` address (spec §9.3 provider swappability)
- **Before:** the contact route used `env.contactEmail` as both `to` and
  `from`. Resend (and most providers) require a verified sending domain, so
  real delivery would fail unless `CONTACT_EMAIL` happened to be on a verified
  domain.
- **After:** added `CONTACT_FROM_EMAIL` env (falls back to `CONTACT_EMAIL`),
  documented in `.env.example`, and the contact route sends from it. Keeps the
  recipient (`to`) configurable separately from the sending identity.

### Test additions
- `ssrf.test.ts`: +3 tests for `assertSafeHost` (blocks private IP literals,
  metadata hosts; allows public IP).
- `store.test.ts`: +2 tests (notes stored on record; `purgeScrapedEvidence`
  keeps PROSPECT_REPORTED).
- `retention.test.ts` (new): per-class purge vs. full-delete branches.
- Suite: 34 → 41 tests, all green; typecheck/lint/build all green.

## 2026-08-14 — Initial scaffold

### Stack decisions (all logged under spec §12.3 tier 8, except where noted)

- **Frontend: Next.js 15 (App Router) + TypeScript + React 19.** Mandated by
  spec §9.3 ("real constraint — keep").
- **Styling: Tailwind CSS v3.4.** Chose v3.4 over v4 for proven, stable
  integration with shadcn/ui patterns and broad tooling support. CSS variables
  (`--brand-*`) mapped to the logo palette (extracted programmatically from
  `logo.png`):
  - Primary navy/indigo: `#2F3359` (shades `#202246` / `#4A4F7A`)
  - Accent gold/amber: `#BF9036` (highlight `#F0D070`, deep `#8A6A1F`)
  - Warm neutral surfaces (cream `#FAF7F0`) for the friendly/human tone in §9.1.
- **UI components: shadcn/ui component pattern.** Per spec §9.3 shadcn/ui is
  required for accessible forms/dialogs/progress/buttons. Components are
  authored as source files in `src/components/ui` following shadcn conventions
  (Radix primitives + Tailwind), not installed via the CLI, for version
  stability and control. Lucide icons (permissive) for iconography.
- **LLM: OpenRouter** (OpenAI-compatible HTTP API, no SDK dependency). Chosen
  because `OPENROUTER_API_KEY` is already present in the environment, so no new
  external credential is introduced (spec §12.3 blocked condition avoided).
  Model is configurable via `OPENROUTER_MODEL`; default
  `openai/gpt-4o-mini` for cost/latency on the bounded interview. The LLM client
  sits behind a thin interface (`llm.complete`) so the provider is swappable.
- **Email dispatch: thin interface** with two providers:
  - `console` (default) — writes the Sales Brief to server logs. Used when no
    provider key is set, so the app runs without a new credential (spec §12.3).
  - `resend` — active when `RESEND_API_KEY` is set.
  Provider swappability satisfies spec §9.3 ("provider swappable behind a thin
  interface"). Add `sendgrid`/`postmark` later by implementing the same
  interface.
- **Scraper: Playwright (chromium) in-process**, behind a `Scraper` interface
  (spec §8.1 `research-scraper` external capability). Sub-tasks
  (`web-research-scrape`, `tech-signals-detect`, `job-listings-fetch`,
  `review-search-fetch`) are implemented as steps within one scraper module
  sharing a browser context. Run in parallel where independent. Chosen
  in-process (Node) rather than a separate Python MCP to keep a single stack;
  the interface keeps it swappable.
- **PDF: `@react-pdf/renderer`** for the Client Summary. Renders React
  components to a PDF buffer server-side; fast enough for the <10s delivery SLA
  (spec §3) without a headless browser. Logs synthesis latency is the main risk;
  see mitigation in the report route.
- **Streaming: Server-Sent Events (SSE)** from a Route Handler
  (`src/app/api/scan/route.ts`) for scraper progress (spec §9.3 implementer's
  choice). Chosen over websockets for one-way server→client progress and
  simpler infra.
- **Rate limiting: in-memory token-bucket per IP + per session.** Caveat:
  in-memory state does not survive serverless cold-starts / multi-instance
  deployments; acceptable for MVP single-instance. Flagged for follow-up
  (Upstash Redis) before scale.
- **Evidence store: in-memory per scan** keyed by `scan_id`, with a retention
  sweep. Persisted shape documented; a real DB is a follow-up (spec §6.5
  requires a defined retention window + deletion path, which is implemented as
  a scheduled sweep, not a DB).

### Security boundaries (spec §6) — implementation notes
- SSRF: `lib/security/ssrf.ts` — URL validation, DNS resolve, reject
  private/loopback/link-local/metadata ranges, re-check on every redirect hop
  with manual fetch redirect handling.
- Ownership signal: `lib/security/ownership.ts` — registrable-domain match
  between submitter email and target website (via `tldts`), plus an explicit "I
  represent this company" confirmation as the fallback path (spec §6.2
  "confirmation step").
- Rate limiting + bot challenge: `lib/security/rateLimit.ts` + a CAPTCHA-style
  challenge gate before scrape (spec §6.3).
- Prompt-injection sanitization: `lib/security/sanitize.ts` — applies to all
  free text entering the agent pipeline (scraped content, optional notes,
  interview answers). Defense-in-depth: delimiting + instruction stripping + a
  system-prompt directive to treat all content as untrusted data. (Full
  prevention is an open research problem; this is a reasonable defensive layer,
  not a guarantee.)
- Retention: `lib/retention.ts` — default 90d scraped / 12mo prospect answers,
  with a deletion path. Documented in README.

### Blocked / not-yet-done
- Logo palette extracted programmatically; visual design polish pending real
  browser preview (cannot view rendered UI in this environment — will rely on
  type/lint/build passing and structured CSS tokens).
- Email provider keys not present; `console` provider used. Not blocked — by
  design.
