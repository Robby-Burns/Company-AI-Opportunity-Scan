/**
 * research-scraper (spec §8.1). Scrapes the target website's public pages
 * (home, about, services, careers, contact) and related public signals, then
 * sanitizes findings into evidence. Subject to SSRF validation (spec §6.1),
 * which is enforced by the route layer before this runs.
 *
 * Graceful degradation (spec §7.1): on timeout / block / partial failure,
 * resolves with whatever evidence was collected rather than throwing — the
 * interview then leans more on questions to fill gaps.
 *
 * Implementation: Playwright (chromium) in-process, behind this interface so it
 * is swappable. Sub-tasks per spec §8.1: web-research-scrape, tech-signals-detect,
 * job-listings-fetch, review-search-fetch.
 */
import { chromium, type Browser, type Page } from "playwright";
import { addEvidence } from "@/lib/evidence/store";
import { sanitize } from "@/lib/security/sanitize";
import { assertSafeHost, isValidHttpUrl, safeFetch, type SafeFetchResult } from "@/lib/security/ssrf";

export type ProgressCb = (event: ScraperProgress) => void;

export interface ScraperProgress {
  step: "start" | "web" | "tech" | "jobs" | "reviews" | "done" | "warning" | "error";
  message: string;
  /** 0..100 within the scrape stage. */
  pct: number;
}

export interface ScraperInput {
  scanId: string;
  website: string; // already SSRF-validated URL
  timeoutMs: number;
}

export interface ScraperResult {
  evidenceCount: number;
  warnings: string[];
  pageHtml: string; // sanitized home page text, for interview context
}

const NAV_PATHS = ["", "about", "services", "careers", "contact", "team", "products", "solutions"];

/**
 * Run the scrape. Calls `onProgress` with status events for the SSE stream.
 * Never throws — failures become warnings (graceful degradation).
 */
export async function runScraper(input: ScraperInput, onProgress: ProgressCb): Promise<ScraperResult> {
  const warnings: string[] = [];
  let browser: Browser | null = null;

  onProgress({ step: "start", message: "Starting research…", pct: 5 });

  let pageText = "";
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  } catch (e) {
    warnings.push(`Could not launch browser: ${(e as Error).message}`);
    onProgress({ step: "error", message: "Scraper unavailable; proceeding with interview.", pct: 99 });
    return { evidenceCount: 0, warnings, pageHtml: "" };
  }

  // 1) web-research-scrape — visit key pages via Playwright and collect
  //    RENDERED text + links (JS-rendered sites are handled). SSRF is
  //    re-enforced on every request the browser issues (including redirects,
  //    subresources, and XHR) via page.route → assertSafeHost (spec §6.1).
  const context = await browser.newContext({
    userAgent: "FoxLoom-Opportunity-Scan/1.0 (+https://foxandloom.com)",
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(input.timeoutMs);
  installSsrfRoute(page, warnings);

  const fetched = new Map<string, string>();
  let navCount = 0;
  for (const path of NAV_PATHS) {
    if (navCount >= 4) break; // bound work
    const url = joinPath(input.website, path);
    onProgress({
      step: "web",
      message: `Reading ${labelFor(path) || "home"}…`,
      pct: 10 + Math.round((navCount / 4) * 30)
    });
    try {
      const html = await navigateForHtml(page, url, input.timeoutMs);
      const text = stripHtml(html);
      fetched.set(url, text);
      if (path === "") pageText = text;
      addEvidenceFromWeb(input.scanId, url, text);
    } catch (e) {
      warnings.push(`Skipped ${url}: ${(e as Error).message}`);
    }
    navCount += 1;
  }

  // 2) tech-signals-detect — detect tech stack signals from fetched HTML.
  onProgress({ step: "tech", message: "Detecting software systems…", pct: 50 });
  for (const [url, text] of fetched) {
    detectTech(input.scanId, url, text);
  }

  // 3) job-listings-fetch — look for a careers page and infer roles.
  onProgress({ step: "jobs", message: "Reviewing job listings…", pct: 70 });
  const careersUrl = joinPath(input.website, "careers");
  if (fetched.has(careersUrl)) {
    inferRoles(input.scanId, careersUrl, fetched.get(careersUrl) ?? "");
  }

  // 4) review-search-fetch — lightweight public-review signal via search.
  onProgress({ step: "reviews", message: "Reviewing public signals…", pct: 88 });
  try {
    await fetchReviewSignal(input.scanId, input.website);
  } catch (e) {
    warnings.push(`Reviews skipped: ${(e as Error).message}`);
  }

  await context.close().catch(() => {});
  await browser.close().catch(() => {});

  onProgress({ step: "done", message: "Research complete.", pct: 100 });

  const { listEvidence } = await import("@/lib/evidence/store");
  const evidenceCount = listEvidence(input.scanId).length;
  return { evidenceCount, warnings, pageHtml: sanitize(pageText, { tag: "homepage", maxLength: 4000 }).text };
}

function joinPath(base: string, path: string): string {
  const u = new URL(base);
  if (!path) return u.origin + u.pathname.replace(/\/$/, "");
  return u.origin + "/" + path;
}

/**
 * Per-request SSRF guard for Playwright (spec §6.1). Intercepts every request
 * the page issues (document, subresource, redirect, XHR) and aborts any whose
 * host resolves to a private/loopback/link-local/metadata range. This is the
 * browser equivalent of safeFetch's per-hop re-validation.
 *
 * A per-scan host cache avoids redundant DNS lookups for the many subresources
 * a page loads (keeps the 30–45s SLA honest).
 */
function installSsrfRoute(page: Page, warnings: string[]): void {
  const hostCache = new Map<string, boolean>(); // host → safe?
  page.route("**/*", async (route) => {
    const reqUrl = route.request().url();
    if (!isValidHttpUrl(reqUrl)) {
      try { await route.abort(); } catch { /* ignore */ }
      return;
    }
    const host = new URL(reqUrl).hostname;
    const cached = hostCache.get(host);
    if (cached === false) {
      try { await route.abort(); } catch { /* ignore */ }
      return;
    }
    if (cached === true) {
      try { await route.continue(); } catch { /* page may have moved on */ }
      return;
    }
    try {
      await assertSafeHost(host);
      hostCache.set(host, true);
    } catch (e) {
      hostCache.set(host, false);
      warnings.push(`SSRF: blocked request to ${host} (${(e as Error).message})`);
      try { await route.abort(); } catch { /* ignore */ }
      return;
    }
    try { await route.continue(); } catch { /* page may have moved on */ }
  });
}

/** Navigate to `url` with Playwright and return the rendered HTML. */
async function navigateForHtml(page: Page, url: string, timeoutMs: number): Promise<string> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  // Best-effort wait for late JS to populate content, bounded by the page timeout.
  await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 8000) }).catch(() => {});
  return page.content();
}

function labelFor(path: string): string {
  if (!path) return "homepage";
  return path.charAt(0).toUpperCase() + path.slice(1);
}

function stripHtml(html: string): string {
  // Cheap, dependency-free text extraction: drop scripts/styles/tags, collapse ws.
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/gi, " ").replace(/&/gi, "&").replace(/</gi, "<").replace(/>/gi, ">");
  t = t.replace(/\s+/g, " ").trim();
  return t.slice(0, 8000);
}

function addEvidenceFromWeb(scanId: string, url: string, text: string): void {
  if (!text) return;
  // Capture the most informative sentence(s) per page.
  const snippet = text.slice(0, 600);
  addEvidence(scanId, {
    kind: "SCRAPED_WEB",
    source: url,
    snippet,
    signal: `page:${new URL(url).pathname || "/"}`,
    confidence: "medium"
  });
}

const TECH_SIGNATURES: ReadonlyArray<{ re: RegExp; signal: string }> = [
  { re: /shopify|cdn\.shopify/i, signal: "uses:shopify" },
  { re: /woocommerce|wp-content\/plugins\/woocommerce/i, signal: "uses:woocommerce" },
  { re: /hubspot|js\.hs-scripts\.com|hs-scripts/i, signal: "uses:hubspot" },
  { re: /salesforce|force\.com|sfdc/i, signal: "uses:salesforce" },
  { re: /google-analytics|gtag\(|googletagmanager/i, signal: "uses:google-analytics" },
  { re: /segment\.com|analytics\.snplow|__SEGMENT/i, signal: "uses:segment" },
  { re: /react\.js|_next\/static|__NEXT_DATA__/i, signal: "uses:next.js" },
  { re: /wordpress|wp-content|wp-includes/i, signal: "uses:wordpress" },
  { re: /sentry|sentry-cdn/i, signal: "uses:sentry" },
  { re: /intercom|intercomcdn/i, signal: "uses:intercom" },
  { re: /zendesk|zdassets/i, signal: "uses:zendesk" },
  { re: /stripe|js\.stripe\.com/i, signal: "uses:stripe" },
  { re: /datadog|datadoghq/i, signal: "uses:datadog" },
  { re: /salesforce|marketo|pardot/i, signal: "uses:marketing-automation" }
];

function detectTech(scanId: string, url: string, html: string): void {
  const found = new Set<string>();
  for (const { re, signal } of TECH_SIGNATURES) {
    if (re.test(html)) found.add(signal);
  }
  for (const s of found) {
    addEvidence(scanId, {
      kind: "SCRAPED_TECH",
      source: url,
      snippet: `Detected ${s} on ${new URL(url).host}`,
      signal: s,
      confidence: "medium"
    });
  }
}

function inferRoles(scanId: string, url: string, text: string): void {
  const roleRe = /\b(senior |lead |staff |principal )?(engineer|developer|designer|product manager|data scientist|analyst|marketer|sales|operations|customer support|ai|ml|machine learning)[a-z ]{0,20}?(?:role|position|opening|job)/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = roleRe.exec(text)) && seen.size < 5) {
    const role = m[0].trim();
    if (role.length > 4 && !seen.has(role)) {
      seen.add(role);
      addEvidence(scanId, {
        kind: "SCRAPED_JOBS",
        source: url,
        snippet: `Hiring for: ${role}`,
        signal: `hiring:${role}`,
        confidence: "low"
      });
    }
  }
}

/** Public review signal — pragmatic: check a search result page for the domain. */
async function fetchReviewSignal(scanId: string, website: string): Promise<void> {
  const host = new URL(website).host.replace(/^www\./, "");
  const q = encodeURIComponent(`${host} reviews`);
  // Use safeFetch so SSRF rules apply even to the search endpoint.
  let res: SafeFetchResult;
  try {
    res = await safeFetch(`https://duckduckgo.com/html/?q=${q}`, {
      timeoutMs: 8000,
      acceptContentTypes: ["text/html"]
    });
  } catch {
    return; // graceful: skip reviews
  }
  const text = stripHtml(res.body);
  const mentions = (text.match(new RegExp(host.replace(/\./g, "\\."), "gi")) || []).length;
  if (mentions > 0) {
    addEvidence(scanId, {
      kind: "SCRAPED_REVIEWS",
      source: res.url,
      snippet: `Public mentions of ${host} found (${mentions}).`,
      signal: "reviews:public-mentions",
      confidence: "low"
    });
  }
}
