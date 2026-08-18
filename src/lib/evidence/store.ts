/**
 * Evidence store (spec §7.1, §13). In-memory, keyed by scan_id. Holds all
 * evidence used in both reports so every claim can trace to an `evidence_id`.
 *
 * Retention: per spec §6.5, a defined window + deletion path is implemented in
 * `lib/retention.ts` (sweeps this store). A real DB is a follow-up before scale
 * (logged in build_log.md).
 */

export type EvidenceKind =
  | "SCRAPED_WEB" // from research-scraper
  | "SCRAPED_TECH"
  | "SCRAPED_JOBS"
  | "SCRAPED_REVIEWS"
  | "PROSPECT_REPORTED" // from interview answers
  | "SEARCH_SNIPPET_VERIFIED"; // instantly verified candidate metadata from autonomous search

export interface DisambiguationCandidate {
  id: string;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  locationSnippet?: string;
  score: number;
  isAggregator: boolean;
}

export interface Evidence {
  readonly id: string; // evidence_id
  readonly scanId: string;
  kind: EvidenceKind;
  source: string; // URL or "interview"
  snippet: string; // sanitized, human-readable excerpt
  signal: string; // short tag, e.g. "uses:hubspot"
  confidence: "low" | "medium" | "high";
  createdAt: number;
}

export interface ScanRecord {
  readonly id: string;
  company: string;
  website?: string;
  location?: string;
  email: string;
  /** Sanitized optional operational notes (spec §6.4 — prospect free text). */
  notes: string;
  evidence: Map<string, Evidence>;
  answers: Map<string, string>; // questionId -> answer
  disambiguationCandidates?: DisambiguationCandidate[];
  disambiguationResolved?: boolean;
  status: "scraping" | "interviewing" | "synthesizing" | "complete" | "failed";
  createdAt: number;
  expiresAt: number; // scraped-data expiry
  answersExpireAt: number; // prospect-answers expiry (longer)
}

interface GlobalScanStore {
  __COMPANY_AI_SCANS__?: Map<string, ScanRecord>;
}

const globalStore = globalThis as unknown as GlobalScanStore;
const SCANS: Map<string, ScanRecord> =
  globalStore.__COMPANY_AI_SCANS__ ?? (globalStore.__COMPANY_AI_SCANS__ = new Map<string, ScanRecord>());

export function createScan(params: {
  id: string;
  company: string;
  website?: string;
  location?: string;
  email: string;
  notes?: string;
  retentionScrapedDays: number;
  retentionAnswersDays: number;
}): ScanRecord {
  const now = Date.now();
  const rec: ScanRecord = {
    id: params.id,
    company: params.company,
    website: params.website ?? "",
    location: params.location ?? "",
    email: params.email,
    notes: params.notes ?? "",
    evidence: new Map(),
    answers: new Map(),
    status: "scraping",
    createdAt: now,
    expiresAt: now + params.retentionScrapedDays * 86400_000,
    answersExpireAt: now + params.retentionAnswersDays * 86400_000
  };
  SCANS.set(params.id, rec);
  return rec;
}

export function getScan(id: string): ScanRecord | undefined {
  return SCANS.get(id);
}

export function addEvidence(scanId: string, e: Omit<Evidence, "id" | "scanId" | "createdAt">): Evidence | null {
  const rec = SCANS.get(scanId);
  if (!rec) return null;
  const id = `ev_${scanId}_${rec.evidence.size + 1}`;
  const full: Evidence = { ...e, id, scanId, createdAt: Date.now() };
  rec.evidence.set(id, full);
  return full;
}

export function recordAnswer(scanId: string, questionId: string, answer: string): boolean {
  const rec = SCANS.get(scanId);
  if (!rec) return false;
  rec.answers.set(questionId, answer);
  return true;
}

export function setStatus(scanId: string, status: ScanRecord["status"]): void {
  const rec = SCANS.get(scanId);
  if (rec) rec.status = status;
}

export function setDisambiguationCandidates(scanId: string, candidates: DisambiguationCandidate[]): void {
  const rec = SCANS.get(scanId);
  if (rec) {
    rec.disambiguationCandidates = candidates;
    rec.disambiguationResolved = false;
  }
}

export function getDisambiguationCandidates(scanId: string): DisambiguationCandidate[] | undefined {
  return SCANS.get(scanId)?.disambiguationCandidates;
}

export function clearDisambiguationCandidates(scanId: string): void {
  const rec = SCANS.get(scanId);
  if (rec) {
    rec.disambiguationCandidates = undefined;
    rec.disambiguationResolved = true;
  }
}

export function updateScanWebsite(scanId: string, website: string): void {
  const rec = SCANS.get(scanId);
  if (rec) rec.website = website;
}

export function listEvidence(scanId: string): Evidence[] {
  return Array.from(SCANS.get(scanId)?.evidence.values() ?? []);
}

/** Remove a scan entirely (deletion path, spec §6.5). */
export function deleteScan(id: string): boolean {
  return SCANS.delete(id);
}

/** Remove scraped evidence while keeping PROSPECT_REPORTED answers (spec §6.5 per-class retention). */
export function purgeScrapedEvidence(scanId: string): number {
  const rec = SCANS.get(scanId);
  if (!rec) return 0;
  let removed = 0;
  for (const [id, ev] of rec.evidence) {
    if (ev.kind !== "PROSPECT_REPORTED") {
      rec.evidence.delete(id);
      removed += 1;
    }
  }
  return removed;
}

/** All scans (for retention sweep + tests). */
export function allScans(): ScanRecord[] {
  return Array.from(SCANS.values());
}
