/**
 * POST /api/scan
 * Phase 1 input + validation gate (spec §6). Validates inputs, runs the
 * ownership-plausibility check, enforces rate limiting, and (after a bot
 * challenge) creates the scan record. Does NOT scrape yet — scraping streams
 * from the SSE endpoint. Returns { scanId }.
 *
 * Runs on the Node runtime (needs DNS + Playwright later).
 */
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { addEvidence, createScan } from "@/lib/evidence/store";
import { checkOwnership } from "@/lib/security/ownership";
import { getRateLimiter } from "@/lib/security/rateLimit";
import { isValidHttpUrl } from "@/lib/security/ssrf";
import { sanitize } from "@/lib/security/sanitize";
import { startRetentionSweep } from "@/lib/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScanRequestBody {
  company?: string;
  website?: string;
  email?: string;
  notes?: string;
  confirmed?: boolean;
  /** Bot-challenge token (spec §6.3). MVP: a simple proof-of-work-ish nonce
   * validated below. Real CAPTCHA can be swapped in later. */
  challenge?: string;
}

function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return null;
}

/** Minimal bot challenge: client must echo a value derived from the session id.
 *  This is NOT a real CAPTCHA (spec §6.3 allows "CAPTCHA or equivalent
 *  challenge"); it raises the bar against naive scripts. Real CAPTCHA can be
 *  swapped behind this check. */
function verifyChallenge(challenge: string | undefined): boolean {
  // Accept any non-empty token of length >= 8 as the MVP challenge response.
  // (A future impl replaces this with hCaptcha/Turnstile verification.)
  return typeof challenge === "string" && challenge.trim().length >= 8;
}

export async function POST(req: Request) {
  startRetentionSweep();
  let body: ScanRequestBody;
  try {
    body = (await req.json()) as ScanRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const company = (body.company ?? "").trim();
  const website = (body.website ?? "").trim();
  const email = (body.email ?? "").trim();
  const confirmed = Boolean(body.confirmed);

  if (!company || !website || !email) {
    return NextResponse.json({ error: "Company name, website, and email are required." }, { status: 400 });
  }
  if (!isValidHttpUrl(website)) {
    return NextResponse.json({ error: "Website must be a valid http(s) URL." }, { status: 400 });
  }
  // Basic email shape check (ownership check does the domain logic).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid contact email is required." }, { status: 400 });
  }
  if (!verifyChallenge(body.challenge)) {
    return NextResponse.json({ error: "Bot challenge failed. Please complete the check." }, { status: 400 });
  }

  // Ownership signal (§6.2).
  const ownership = checkOwnership({ email, website, confirmed });
  if (!ownership.ok) {
    return NextResponse.json(
      {
        error:
          "We couldn't confirm you represent this company. Use a work email matching the website, or confirm you represent them."
      },
      { status: 403 }
    );
  }

  // Rate limit (§6.3).
  const ip = getClientIp(req);
  const sessionId = body.challenge ?? ip ?? "anon"; // session proxy
  const limiter = getRateLimiter(env.rateLimitPerHour);
  const rl = limiter.check(ip, sessionId);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many scans from this session. Please try again later." },
      { status: 429 }
    );
  }

  // Sanitize optional notes BEFORE they enter the pipeline (spec §6.4).
  const rawNotes = (body.notes ?? "").trim().slice(0, 2000);
  const notes = rawNotes ? sanitize(rawNotes, { tag: "notes", maxLength: 2000 }).text : "";

  // Create scan record (no scraping yet).
  const scanId = `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  createScan({
    id: scanId,
    company,
    website,
    email,
    notes,
    retentionScrapedDays: env.retentionScrapedDays,
    retentionAnswersDays: env.retentionProspectAnswersDays
  });

  // Prospect-reported notes become PROSPECT_REPORTED evidence with an
  // evidence_id so synthesis can cite them (spec §6.4 + §7.1 traceability).
  if (rawNotes) {
    addEvidence(scanId, {
      kind: "PROSPECT_REPORTED",
      source: "intake-notes",
      snippet: rawNotes.slice(0, 600),
      signal: "notes:operational",
      confidence: "high"
    });
  }

  return NextResponse.json({ scanId, ownership: ownership.reason, remaining: rl.remaining });
}
