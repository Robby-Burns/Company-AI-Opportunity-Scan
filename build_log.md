# Build Log — Company AI Opportunity Scan (COS)

Living log of material implementation decisions (per spec §12.3). Routine
choices (file layout, names) are not logged here. Newest entries at the top.

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
