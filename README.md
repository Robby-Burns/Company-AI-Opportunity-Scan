# Company Opportunity Scan (COS)

An automated, self-service web experience for **Fox & Loom** prospects. A
prospect enters company info, the app researches public signals in real time
(with a live progress UI), runs an 8–12 question adaptive AI interview, then
delivers an instant downloadable Client AI Opportunity Summary while emailing
a detailed Sales Intelligence Brief to the Fox & Loom team.

Built against `Project_Spec__Company_Opportunity_Scan_V2.md` (v3.0). See
`build_log.md` for material implementation decisions and `self_improve.md` for
process notes.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **React 19** (spec §9.3 mandate)
- **Tailwind CSS v3** + **shadcn/ui** component pattern (source-owned) + **Lucide** icons
- **@react-pdf/renderer** for the Client Summary PDF (no headless browser → <10s SLA)
- **Playwright (chromium)** for the `research-scraper` (spec §8.1)
- **OpenRouter** (OpenAI-compatible) for the LLM — already in the environment
- **Email**: thin swappable interface (`console` default, `resend` when keyed)
- **Vitest** for the security + contract test suite

## Quick start

```bash
npm install
npx playwright install chromium      # one-time browser download
cp .env.example .env                 # then edit values
npm run dev                          # http://localhost:3000
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint (next + TS) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (security + contracts) |
| `npm run test:watch` | Vitest watch mode |
| `npm run playwright:install` | Download chromium |

## Environment

See `.env.example` for the full list with defaults. Required for full
functionality:

- `OPENROUTER_API_KEY` — LLM for interview + synthesis (present in build env)
- `CONTACT_EMAIL` — where the contact form routes (default `hello@foxandloom.com`)
- `SALES_BRIEF_TO` — Sales Brief recipient (default/example `marcus@foxandloom.com`; **not** hardcoded in logic)
- `EMAIL_PROVIDER` — `console` (default, logs) or `resend` (needs `RESEND_API_KEY`)

## Security & trust boundaries (spec §6)

These are hard requirements, not optional. Implemented in `src/lib/security/`:

| Boundary | Module | Notes |
| --- | --- | --- |
| SSRF guard | `ssrf.ts` | URL validation, DNS resolve, reject private/loopback/link-local/metadata on **every redirect hop** |
| Ownership signal | `ownership.ts` | Email-domain ↔ website-domain match, else explicit confirmation |
| Rate limiting | `rateLimit.ts` | Per-IP + per-session token bucket (in-memory; Redis before scale) |
| Prompt-injection sanitization | `sanitize.ts` | Applies to **all** free text: scraped content, notes, interview answers |
| Data retention | `retention.ts` | Sweep at `RETENTION_SCRAPED_DAYS` / `RETENTION_PROSPECT_ANSWERS_DAYS` |

## Data retention (spec §6.5)

Defaults (configurable via env):

- Scraped company data: **90 days**
- Prospect answers: **365 days**

A scheduled sweep (`lib/retention.ts`) deletes expired scans. MVP uses an
in-memory store; a real DB is a flagged follow-up before scale (see
`build_log.md`).

## Architecture & 5-Stage Product Lifecycle

The Company AI Opportunity Scan is the entry stage of the Fox & Loom product lifecycle:

1. **Opportunity Scan** (*"Is there something here worth investigating?"*) — Identify credible opportunities from limited evidence.
2. **Deep Assessment** (*"What opportunities actually matter, and is one worth pursuing?"*) — Investigate the business across 6 dimensions, validate bottlenecks, evaluate feasibility/value/risk, and prioritize.
3. **Build Decision** (*"What should we build?"*) — Choose the implementation path (build vs. buy vs. process change vs. do nothing).
4. **Atlas** (*"What is the evidence-supported specification?"*) — Translate the decision into an approved specification.
5. **Shipyard** (*"Can we build and deploy it correctly?"*) — Engineer, test, secure, deploy, and document with Deployment Assurance.

```
[Form /api/scan] → [SSE /api/scan/[id]/events → research-scraper]
                 → [Interview /api/interview/[id]/{next,answer}]
                 → [Synthesis + /api/report/[id]/download + email-dispatch]
```

### Report Structure (6 Sections)
1. **Opportunity Hypothesis** — specific operational locus and confidence worth investigating (or graceful null if no opportunity emerged).
2. **Why We Identified It** — direct observations citing valid `evidence_id`s.
3. **Potential Impact** — directional operational magnitude grounded strictly in prospect-reported evidence (no fabricated ROI).
4. **Additional Signals** — secondary opportunities or friction points without forced single-winner ranking.
5. **What Remains Unknown** — key operational, technical, and data blindspots.
6. **What a Deep Assessment Would Investigate** — strictly diagnostic questions (prohibiting task/audit checklists).

### Invariants & Ingestion Contracts
- **Governing Rule**: *"Specific enough that the prospect recognizes a real opportunity in their business, but incomplete enough that determining whether that opportunity is valuable, feasible, safe, and worth pursuing remains the purpose of the Deep Assessment."*
- **Information Budget (8–12 questions)**: Dynamic stopping starting at Q8 once a credible hypothesis is established. Never continues merely to exhaust budget; hard stop at 12.
- **Evidence store** (`lib/evidence/store.ts`): every claim in both reports traces to a stored `evidence_id`; unsupported claims are omitted.
- **Prospect-reported answers supersede scraped inferences** on conflict.
- **Deep Assessment Intake Package** (`lib/synthesis.ts` / `createIntakePackage()`): exports structured payload for seamless handoff to the Deep Assessment.

## Testing

The suite targets the tier-1 invariants (spec §6) and the evidence/bounds
contracts (§7.1):

- `ssrf.test.ts` — URL + IP-range validation
- `ownership.test.ts` — domain-match / confirmation gate
- `rateLimit.test.ts` — per-IP and per-session throttling
- `sanitize.test.ts` — injection-phrase stripping + delimiting
- `evidence/store.test.ts` — `evidence_id` assignment + retention timestamps
- `orchestrator-synthesis.test.ts` — 12-question hard stop, early-finish,
  LLM-failure fallback, and the "omit unsupported claims" invariant

Run: `npm test`.

## Known limitations (v1)

Flagged in `build_log.md` / `self_improve.md`, not blocking MVP:

- In-memory rate limit + evidence store (swap for Redis/DB before scale)
- Single Sales Brief recipient (`SALES_BRIEF_TO`), no CRM integration
- `console` email provider by default (set `RESEND_API_KEY` for real delivery)
- MVP bot-challenge is a nonce, not a full CAPTCHA (swappable behind the gate)
- Visual + WCAG 2.1 AA audit pending human review of the rendered funnel
