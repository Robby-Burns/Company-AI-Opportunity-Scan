/**
 * Autonomous Search Discovery & Match Confidence Scoring Engine.
 *
 * When prospects enter a company name and location without a direct website URL,
 * this module autonomously searches public search results, extracts candidates,
 * computes weighted match heuristics, and classifies confidence tiers:
 *
 * 1. HIGH_CONFIDENCE (Score >= 0.85 and top-runner delta >= 0.15):
 *    Silently scrape top candidate and seed evidence.
 * 2. AMBIGUOUS_CANDIDATES (Score >= 0.35 or delta < 0.15):
 *    Quarantine unverified data and stage candidates for conversational Q1 disambiguation.
 * 3. NO_MATCH (Score < 0.35 or search error/timeout):
 *    Gracefully fallback to zero-hallucination first-party interview mode.
 */
import { safeFetch } from "@/lib/security/ssrf";
import type { DisambiguationCandidate } from "@/lib/evidence/store";

export interface SearchInput {
  scanId: string;
  company: string;
  location?: string;
  notes?: string;
  timeoutMs?: number;
}

export type SearchConfidenceTier = "HIGH_CONFIDENCE" | "AMBIGUOUS_CANDIDATES" | "NO_MATCH";

export interface SearchDiscoveryResult {
  tier: SearchConfidenceTier;
  topMatch?: DisambiguationCandidate;
  candidates: DisambiguationCandidate[];
  reason: string;
}

const AGGREGATOR_HOSTS = new Set([
  "yelp.com",
  "facebook.com",
  "yellowpages.com",
  "bbb.org",
  "linkedin.com",
  "manta.com",
  "mapquest.com",
  "tripadvisor.com",
  "zoominfo.com",
  "dnb.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "superpages.com",
  "chamberofcommerce.com",
  "angis.com",
  "angi.com",
  "houzz.com"
]);

const STATE_MAP: Record<string, string> = {
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california",
  co: "colorado", ct: "connecticut", de: "delaware", fl: "florida", ga: "georgia",
  hi: "hawaii", id: "idaho", il: "illinois", in: "indiana", ia: "iowa",
  ks: "kansas", ky: "kentucky", la: "louisiana", me: "maine", md: "maryland",
  ma: "massachusetts", mi: "michigan", mn: "minnesota", ms: "mississippi", mo: "missouri",
  mt: "montana", ne: "nebraska", nv: "nevada", nh: "new hampshire", nj: "new jersey",
  nm: "new mexico", ny: "new york", nc: "north carolina", nd: "north dakota", oh: "ohio",
  ok: "oklahoma", or: "oregon", pa: "pennsylvania", ri: "rhode island", sc: "south carolina",
  sd: "south dakota", tn: "tennessee", tx: "texas", ut: "utah", vt: "vermont",
  va: "virginia", wa: "washington", wv: "west virginia", wi: "wisconsin", wy: "wyoming"
};

/**
 * Execute autonomous web search with strict 4s timeout and heuristic scoring.
 * Never throws — on network error, rate limit, or timeout, gracefully returns NO_MATCH.
 */
export async function searchCompany(input: SearchInput): Promise<SearchDiscoveryResult> {
  const company = (input.company ?? "").trim();
  const location = (input.location ?? "").trim();
  const notes = (input.notes ?? "").trim();
  const timeoutMs = Math.min(input.timeoutMs ?? 4000, 5000);

  if (!company) {
    return { tier: "NO_MATCH", candidates: [], reason: "No company name provided" };
  }

  // Formulate query: "<Company>" "<Location>"
  const queryParts = [`"${company}"`];
  if (location) queryParts.push(location);
  const q = encodeURIComponent(queryParts.join(" "));

  let rawCandidates: Array<{ title: string; url: string; snippet: string }> = [];
  try {
    const res = await safeFetch(`https://duckduckgo.com/html/?q=${q}`, {
      timeoutMs,
      acceptContentTypes: ["text/html"]
    });
    rawCandidates = parseSearchResults(res.body);
  } catch {
    // Graceful fallback on rate-limit / block / network timeout
    return {
      tier: "NO_MATCH",
      candidates: [],
      reason: "Public search endpoint unavailable or timed out; falling back to direct interview"
    };
  }

  if (rawCandidates.length === 0) {
    return {
      tier: "NO_MATCH",
      candidates: [],
      reason: "No public search results found for query"
    };
  }

  // Score all candidate results
  const scored = rawCandidates
    .map((c, idx) => {
      const score = calculateMatchScore(c, { company, location, notes });
      const domain = getDomain(c.url);
      const isAggregator = isAggregatorDomain(domain);
      return {
        id: `cand_${idx + 1}`,
        title: c.title,
        url: c.url,
        snippet: c.snippet,
        domain,
        locationSnippet: extractLocationSnippet(c.snippet, location),
        score,
        isAggregator
      };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { tier: "NO_MATCH", candidates: [], reason: "No candidates met evaluation criteria" };
  }

  const top = scored[0]!;
  const runnerUp = scored[1];
  const delta = runnerUp ? top.score - runnerUp.score : 1.0;

  // 1. High confidence tier with sibling delta rule (§1 Edge Case 1)
  if (top.score >= 0.85) {
    if (delta >= 0.15) {
      return {
        tier: "HIGH_CONFIDENCE",
        topMatch: top,
        candidates: scored.slice(0, 3),
        reason: `High confidence match (${(top.score * 100).toFixed(0)}%, delta ${(delta * 100).toFixed(0)}%)`
      };
    } else {
      // Sibling Score Proximity trap: demote to Ambiguous Quick-Select
      return {
        tier: "AMBIGUOUS_CANDIDATES",
        candidates: scored.slice(0, 3),
        reason: `Close sibling matches detected (${(top.score * 100).toFixed(0)}% vs ${((runnerUp?.score ?? 0) * 100).toFixed(0)}%); demoting to quick-select`
      };
    }
  }

  // 2. Ambiguous confidence tier
  if (top.score >= 0.35) {
    return {
      tier: "AMBIGUOUS_CANDIDATES",
      candidates: scored.slice(0, 3),
      reason: `Ambiguous match score (${(top.score * 100).toFixed(0)}%); staging for conversational confirmation`
    };
  }

  // 3. No match tier (< 0.35)
  return {
    tier: "NO_MATCH",
    candidates: [],
    reason: `Top candidate score too low (${(top.score * 100).toFixed(0)}%); proceeding in first-party baseline mode`
  };
}

/**
 * Weighted heuristic match calculation (0.0 to 1.0):
 * - Exact Name Match (35%)
 * - Geo-Proximity Match (30%)
 * - Industry / Context Fit (20%)
 * - Domain Authority & Direct Match (15%)
 */
export function calculateMatchScore(
  candidate: { title: string; url: string; snippet: string },
  context: { company: string; location?: string; notes?: string }
): number {
  const nameScore = scoreNameMatch(candidate, context.company);
  const geoScore = scoreGeoProximity(candidate, context.location);
  const industryScore = scoreIndustryFit(candidate, context.company, context.notes);
  const domainScore = scoreDomainAuthority(candidate.url, context.company);

  let weighted = nameScore * 0.35 + geoScore * 0.30 + industryScore * 0.20 + domainScore * 0.15;

  // If a location was explicitly provided and has zero match, penalize cross-market homonyms
  if (context.location && geoScore === 0.0) {
    weighted *= 0.75;
  }

  return Math.max(0, Math.min(1, Math.round(weighted * 100) / 100));
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(incorporated|corporation|company|services|solutions|group|holdings|associates|consulting|enterprises|inc\.?|llc\.?|ltd\.?|corp\.?|co\.?)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreNameMatch(candidate: { title: string; url: string; snippet: string }, company: string): number {
  const normTarget = normalizeCompanyName(company);
  if (!normTarget) return 0.5;

  const targetTokens = new Set(normTarget.split(" ").filter((t) => t.length > 1));
  if (targetTokens.size === 0) return 0.5;

  const textToSearch = `${candidate.title} ${candidate.url}`.toLowerCase();
  const normText = normalizeCompanyName(textToSearch);
  const candidateTokens = new Set(normText.split(" ").filter((t) => t.length > 1));

  // 1. Direct substring match
  if (textToSearch.includes(normTarget)) {
    return 1.0;
  }

  // 2. Token overlap (Jaccard)
  let intersection = 0;
  for (const t of targetTokens) {
    if (candidateTokens.has(t) || textToSearch.includes(t)) {
      intersection += 1;
    }
  }

  const overlap = intersection / targetTokens.size;
  return Math.min(1.0, overlap * 0.95);
}

function scoreGeoProximity(candidate: { title: string; url: string; snippet: string }, location?: string): number {
  const loc = (location ?? "").trim().toLowerCase();
  if (!loc) return 0.5; // neutral if no location provided

  const searchBlob = `${candidate.title} ${candidate.snippet} ${candidate.url}`.toLowerCase();

  // Extract location components (e.g. "Austin, TX" -> city="austin", state="tx")
  const parts = loc.split(/[,/\s]+/).map((p) => p.trim()).filter((p) => p.length > 1);
  if (parts.length === 0) return 0.5;

  let matchedParts = 0;
  for (const part of parts) {
    const fullState = STATE_MAP[part];
    if (searchBlob.includes(part) || (fullState && searchBlob.includes(fullState))) {
      matchedParts += 1;
    }
  }

  const ratio = matchedParts / parts.length;
  if (ratio >= 1.0) return 1.0;
  if (ratio >= 0.5) return 0.75;
  return 0.0; // 0 matches -> complete geo mismatch
}

function scoreIndustryFit(
  candidate: { title: string; url: string; snippet: string },
  company: string,
  notes?: string
): number {
  const rawContext = `${company} ${notes ?? ""}`.toLowerCase();
  const searchBlob = `${candidate.title} ${candidate.snippet}`.toLowerCase();

  // Extract candidate industry keywords (> 3 chars, not standard stop words)
  const stopWords = new Set(["with", "from", "that", "this", "have", "were", "what", "your", "their", "about", "contact", "home"]);
  const contextWords = rawContext
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  if (contextWords.length === 0) return 0.6; // neutral

  let matched = 0;
  for (const w of contextWords) {
    if (searchBlob.includes(w)) matched += 1;
  }

  const ratio = matched / Math.min(contextWords.length, 6);
  return Math.min(1.0, 0.4 + ratio * 0.6);
}

function scoreDomainAuthority(url: string, company: string): number {
  const domain = getDomain(url);
  const isAggregator = isAggregatorDomain(domain);
  if (isAggregator) return 0.3; // penalized

  const normCompany = normalizeCompanyName(company).replace(/\s+/g, "");
  const cleanDomain = domain.replace(/[^a-z0-9]/g, "");

  if (normCompany && cleanDomain.includes(normCompany)) {
    return 1.0;
  }

  return 0.65;
}

export function isAggregatorDomain(domain: string): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "");
  for (const agg of AGGREGATOR_HOSTS) {
    if (d === agg || d.endsWith("." + agg)) return true;
  }
  return false;
}

function getDomain(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function extractLocationSnippet(snippet: string, location?: string): string | undefined {
  if (!location) return undefined;
  const locLower = location.toLowerCase();
  const sentences = snippet.split(/[.!?]\s+/);
  for (const s of sentences) {
    if (s.toLowerCase().includes(locLower)) return s.trim();
  }
  return undefined;
}

function parseSearchResults(html: string): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const seenUrls = new Set<string>();

  // DuckDuckGo HTML layout regex parser
  const resultBlockRe = /<div[^>]*class="[^"]*result__body[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = resultBlockRe.exec(html)) && results.length < 5) {
    const block = match[0];

    // Extract Title & URL
    const linkMatch = /<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"[\s\S]*?>([\s\S]*?)<\/a>/i.exec(block) ||
      /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*href="([^"]+)"/i.exec(block) ||
      /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);

    const titleMatch = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const snippetMatch = /<(?:div|a)[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:div|a)>/i.exec(block);

    if (linkMatch && titleMatch) {
      let rawUrl = linkMatch[1] ?? "";
      // Clean DuckDuckGo uddg redirect URLs if present
      if (rawUrl.includes("uddg=")) {
        const uParam = new URL("https://duckduckgo.com" + rawUrl).searchParams.get("uddg");
        if (uParam) rawUrl = decodeURIComponent(uParam);
      }

      if (rawUrl.startsWith("//")) rawUrl = "https:" + rawUrl;

      if (!seenUrls.has(rawUrl) && (rawUrl.startsWith("http://") || rawUrl.startsWith("https://"))) {
        seenUrls.add(rawUrl);
        results.push({
          title: cleanHtmlText(titleMatch[1] ?? ""),
          url: rawUrl,
          snippet: cleanHtmlText(snippetMatch ? snippetMatch[1] ?? "" : "")
        });
      }
    }
  }

  // Fallback: general anchor parser if duckduckgo class names changed
  if (results.length === 0) {
    const fallbackLinkRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = fallbackLinkRe.exec(html)) && results.length < 5) {
      const url = match[1]!;
      const title = cleanHtmlText(match[2]!);
      if (
        !url.includes("duckduckgo.com") &&
        !url.includes("javascript:") &&
        !seenUrls.has(url) &&
        title.length > 3
      ) {
        seenUrls.add(url);
        results.push({ title, url, snippet: "" });
      }
    }
  }

  return results;
}

function cleanHtmlText(html: string): string {
  let t = html.replace(/<[^>]+>/g, " ");
  t = t.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ");
  return t.replace(/\s+/g, " ").trim().slice(0, 300);
}
