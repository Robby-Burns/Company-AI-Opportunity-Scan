/**
 * GET /api/health — lightweight readiness probe for Railway / load balancers.
 * Returns 200 when the Node process is up and env is loaded. Does NOT hit the
 * LLM, DB, or browser — those are checked lazily by the routes that use them.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, ts: Date.now() }, { status: 200 });
}
