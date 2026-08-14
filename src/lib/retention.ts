/**
 * Data retention sweep (spec §6.5). Deletes expired scraped data and prospect
 * answers. Documented policy lives in README + .env.example.
 *
 * In MVP this sweeps the in-memory store on a timer; a real DB would use the
 * same thresholds.
 */
import { allScans, deleteScan, purgeScrapedEvidence } from "@/lib/evidence/store";
import { clearInterviewState } from "@/lib/orchestrator";
import { clearSynthesisState } from "@/lib/synthesis-queue";
import { env } from "@/lib/env";

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly
let timer: NodeJS.Timeout | null = null;

/**
 * Per-class retention sweep (spec §6.5):
 *  - Scraped company data is purged at RETENTION_SCRAPED_DAYS (default 90),
 *    while PROSPECT_REPORTED answers are kept until RETENTION_PROSPECT_ANSWERS_DAYS.
 *  - Once the answer window also passes, the whole scan record is deleted.
 * Returns counts for audit/log.
 */
export function runRetentionSweep(now = Date.now()): { purgedScraped: number; deletedScans: number } {
  let purgedScraped = 0;
  let deletedScans = 0;
  for (const s of allScans()) {
    if (now > s.expiresAt && now <= s.answersExpireAt) {
      // Scraped window expired but answers still in window → drop scraped only.
      purgedScraped += purgeScrapedEvidence(s.id);
    } else if (now > s.answersExpireAt) {
      // Fully expired — clear all derived state to prevent unbounded map
      // growth on a long-running server, then delete the scan record.
      clearInterviewState(s.id);
      clearSynthesisState(s.id);
      deleteScan(s.id);
      deletedScans += 1;
    }
  }
  return { purgedScraped, deletedScans };
}

export function startRetentionSweep(): void {
  if (timer) return;
  // Configured windows from env (documented parity); actual expiry is set
  // per-scan at creation (see store.createScan).
  void env.retentionScrapedDays;
  void env.retentionProspectAnswersDays;
  timer = setInterval(() => {
    try {
      runRetentionSweep();
    } catch {
      /* swallow; never crash the process on a sweep */
    }
  }, SWEEP_INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
}

export function stopRetentionSweep(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
