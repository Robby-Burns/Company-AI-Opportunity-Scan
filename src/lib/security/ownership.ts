/**
 * Ownership-plausibility signal (spec §6.2).
 *
 * Not cryptographically strong. Raises the bar above "type in any competitor's
 * URL" by requiring either:
 *  (a) a registrable-domain match between the submitter's email and the target
 *      website, OR
 *  (b) an explicit "I represent this company" confirmation by the submitter.
 *
 * (a) and (b) are OR'd: either satisfies the gate. (b) alone is weaker, so it is
 * logged for audit; (a) is the strong path.
 */
import { getDomain } from "tldts";

export interface OwnershipInput {
  email: string;
  website: string;
  /** Submitter checked "I represent this company". */
  confirmed: boolean;
}

export interface OwnershipResult {
  ok: boolean;
  reason: "domain-match" | "confirmed" | "mismatch";
  emailDomain: string | null;
  websiteDomain: string | null;
}

function registrable(value: string): string | null {
  if (!value) return null;
  const d = getDomain(value);
  return d ? d.toLowerCase() : null;
}

export function checkOwnership(input: OwnershipInput): OwnershipResult {
  const email = input.email.trim().toLowerCase();
  const website = input.website.trim().toLowerCase();

  const emailDomain = email.includes("@") ? registrable(email.split("@")[1] ?? "") : null;
  const websiteHost = (() => {
    try {
      return new URL(website).hostname;
    } catch {
      return website;
    }
  })();
  const websiteDomain = registrable(websiteHost);

  if (emailDomain && websiteDomain && emailDomain === websiteDomain) {
    return { ok: true, reason: "domain-match", emailDomain, websiteDomain };
  }
  if (input.confirmed) {
    return { ok: true, reason: "confirmed", emailDomain, websiteDomain };
  }
  return { ok: false, reason: "mismatch", emailDomain, websiteDomain };
}
