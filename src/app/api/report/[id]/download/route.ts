/** GET /api/report/[id]/download → Client Summary PDF (application/pdf). */
import { type NextRequest } from "next/server";
import { getScan } from "@/lib/evidence/store";
import { getSynthesisPromise } from "@/lib/synthesis-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = getScan(id);
  if (!scan) return new Response("Not found", { status: 404 });

  const p = getSynthesisPromise(id);
  if (!p) {
    // Direct download without a started synthesis → redirect to the report
    // endpoint which will start it.
    return new Response(null, {
      status: 307,
      headers: { location: `/api/report/${id}` }
    });
  }
  let result;
  try {
    result = await p;
  } catch (e) {
    return new Response(`Report failed: ${(e as Error).message}`, { status: 500 });
  }
  const safeCompany = scan.company.replace(/[^\w .-]/g, "_");
  return new Response(result.pdfBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="AI-Opportunity-Summary-${safeCompany}.pdf"`,
      "cache-control": "no-store"
    }
  });
}
