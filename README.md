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

## Architecture (spec §7.1)

```
[Form /api/scan] → [SSE /api/scan/[id]/events → research-scraper]
                 → [Interview /api/interview/[id]/{next,answer}]
                 → [Synthesis + /api/report/[id]/download + email-dispatch]
```

- **Evidence store** (`lib/evidence/store.ts`): every claim in both reports
  traces to a stored `evidence_id`; claims without supporting evidence are
  **omitted, not guessed** (enforced in `lib/synthesis.ts`).
- **Interview bounds**: hard stop at 12 questions, can finish early at 8
  (`lib/orchestrator.ts`).
- **Multi-perspective interview**: a Coordinator selects 2–3 specialist
  lenses per turn (Operations, Technology, Data, Business, Risk & People);
  personas generate candidate questions in parallel; deterministic scoring
  picks the best. Personas retain perspective state across the interview,
  which becomes the report's "What each perspective sees" section
  (`lib/interview/`). Modeled on the paid Deep Assessment dimensions.
- **Graceful degradation**: scraper failure/timeout proceeds to the interview
  with partial evidence; synthesis failure falls back to a minimal
  evidence-backed report.
- **Prospect-reported answers supersede scraped inferences** on conflict.

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
