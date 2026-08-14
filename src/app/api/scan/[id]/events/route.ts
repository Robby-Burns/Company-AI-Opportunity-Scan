/**
 * GET /api/scan/[id]/events — Server-Sent Events stream of scraper progress.
 *
 * Owns the scrape run (spec §7.1): on first connect, launches the scraper and
 * streams ProgressEvents to the client in near-real-time. On completion or
 * graceful degradation, emits a terminal `result` event and closes.
 *
 * Event shape (JSON, one per line as SSE `data:`):
 *   { type: "progress", step, message, pct }
 *   { type: "warning", message }
 *   { type: "result", evidenceCount, warnings, ready: true }
 *   { type: "error", message }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getScan } from "@/lib/evidence/store";
import { runScraper } from "@/lib/scraper";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-scan single-flight: only one SSE connection drives the scrape.
const INFLIGHT = new Map<string, Promise<void>>();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = getScan(id);
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (obj: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      const runOnce = async () => {
        // Single-flight: dedupe concurrent SSE connections for the same scan.
        let job = INFLIGHT.get(id);
        if (!job) {
          job = (async () => {
            try {
              const result = await runScraper(
                { scanId: id, website: scan.website, timeoutMs: env.scraperTimeoutMs },
                (p) => send(p)
              );
              for (const w of result.warnings) send({ type: "warning", message: w });
              send({ type: "result", evidenceCount: result.evidenceCount, warnings: result.warnings, ready: true });
            } catch (e) {
              // Should not happen (scraper degrades gracefully), but handle anyway.
              send({ type: "error", message: (e as Error).message });
            } finally {
              INFLIGHT.delete(id);
            }
          })();
          INFLIGHT.set(id, job);
        }
        await job;
        if (!closed) {
          send({ type: "done" });
          controller.close();
          closed = true;
        }
      };

      runOnce().catch((e) => {
        try {
          send({ type: "error", message: (e as Error).message });
        } catch {
          /* ignore */
        }
        if (!closed) controller.close();
        closed = true;
      });
    },
    cancel() {
      /* client disconnected; scraper continues to populate evidence store */
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    }
  });
}
