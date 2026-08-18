import type { ClientReport } from "@/lib/synthesis";

/**
 * In-flight synthesis queue, keyed by scanId. The answer route starts
 * synthesis when the interview finishes; the report route awaits it so the
 * <10s delivery SLA (spec §3) hides LLM latency behind the thank-you transition.
 */
export interface SynthResult {
  pdfBytes: Uint8Array;
  emailOk: boolean;
  clientReport: ClientReport;
}

interface GlobalSynthStore {
  __COMPANY_AI_SYNTH__?: Map<string, Promise<SynthResult>>;
  __COMPANY_AI_REPORTS__?: Map<string, ClientReport>;
}

const globalSynthStore = globalThis as unknown as GlobalSynthStore;
const SYNTH: Map<string, Promise<SynthResult>> =
  globalSynthStore.__COMPANY_AI_SYNTH__ ??
  (globalSynthStore.__COMPANY_AI_SYNTH__ = new Map<string, Promise<SynthResult>>());
const REPORTS: Map<string, ClientReport> =
  globalSynthStore.__COMPANY_AI_REPORTS__ ??
  (globalSynthStore.__COMPANY_AI_REPORTS__ = new Map<string, ClientReport>());

export function startSynthesis(id: string, p: Promise<SynthResult>): void {
  if (SYNTH.has(id)) return;
  SYNTH.set(id, p);
  p.then((r) => REPORTS.set(id, r.clientReport)).catch(() => {});
  p.finally(() => setTimeout(() => SYNTH.delete(id), 5 * 60 * 1000));
}

export function getSynthesisPromise(id: string): Promise<SynthResult> | undefined {
  return SYNTH.get(id);
}

export function getClientReport(id: string): ClientReport | undefined {
  return REPORTS.get(id);
}

/**
 * Clear synthesis state for a scan (called by the retention sweep when a scan
 * is fully expired). Prevents unbounded growth of the REPORTS map on a
 * long-running server. The SYNTH map already self-cleans after 5min.
 */
export function clearSynthesisState(id: string): void {
  SYNTH.delete(id);
  REPORTS.delete(id);
}
