# Self-Improve — Company AI Opportunity Scan (COS)

Process notes and improvements discovered during the build, per spec §12.2/§12.4.
This is *not* a feature log; it captures what to do better next time.

## 2026-08-14 — Initial build (in progress)

### Observations
- The environment exposes `OPENROUTER_API_KEY` but no email-provider key. When a
  product fundamentally needs a paid external service, defaulting to a
  no-op/console implementation behind a thin interface (rather than blocking) let
  the build proceed without violating the "no new paid service" autonomy rule.
  Pattern to reuse: thin provider interface + console default + gated real
  provider.
- Could not visually preview rendered UI in this environment. Mitigation:
  drive design from structured CSS tokens extracted from the logo, keep
  components simple and accessible, and rely on `tsc`/`eslint`/`next build`
  passing. Flag for human visual QA before sign-off (spec §13 WCAG spot-check).
- The spec's §8 vs §11 naming inconsistency (resolved in the spec edit before
  build) would have caused an implementer to guess interface names. Lesson:
  resolve cross-section naming *in the spec* before coding, not during.

### TODO before scale (flagged, not blocking MVP)
- Replace in-memory rate limit + evidence store with Redis (Upstash) for
  multi-instance correctness.
- Move Sales Brief recipient list from single `SALES_BRIEF_TO` to a CRM/queue
  (spec §10 notes single-recipient is a v1 limitation).
- Add real email provider key + verified sending domain.
- Add persistence (DB) for evidence and audit trail; retention sweep currently
  only covers in-memory store.
- Visual + WCAG 2.1 AA audit by a human on the rendered funnel.
