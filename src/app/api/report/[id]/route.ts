/**
 * Report endpoints (Phase 3).
 *   GET /api/report/[id]         → on-screen preview metadata (after synthesis).
 *   GET /api/report/[id]/download → the Client Summary PDF (application/pdf).
 *
 * If synthesis hasn't been started (e.g. user navigated directly), these
 * endpoints will start it on demand. This keeps the <10s delivery SLA (spec
 * §3) honest: the thank-you screen fetches /download, which awaits the
 * in-flight synthesis that was kicked off when the interview finished.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getScan } from "@/lib/evidence/store";
import { getClientReport, getSynthesisPromise } from "@/lib/synthesis-queue";
import { synthesizeReports, createIntakePackage } from "@/lib/synthesis";
import { dispatchSalesBrief } from "@/lib/email";
import { renderClientSummaryPdf } from "@/lib/pdf";
import { startSynthesis } from "@/lib/synthesis-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureSynthesis(id: string): Promise<void> {
  if (getSynthesisPromise(id)) return;
  // Started on demand (direct navigation). Run the full Phase 3 pipeline.
  startSynthesis(
    id,
    (async () => {
      const { client, sales } = await synthesizeReports(id);
      const emailRes = await dispatchSalesBrief(sales).catch((e) => ({ ok: false, detail: (e as Error).message }));
      (getScan(id) as unknown as { intakePackage?: unknown }).intakePackage = createIntakePackage(id, client, sales);
      const pdfBytes = await renderClientSummaryPdf(client);
      return { pdfBytes, emailOk: emailRes.ok, clientReport: client };
    })()
  );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = getScan(id);
  if (!scan) return NextResponse.json({ error: "Scan not found." }, { status: 404 });

  await ensureSynthesis(id);
  const p = getSynthesisPromise(id);
  if (!p) return NextResponse.json({ error: "Report unavailable." }, { status: 500 });
  try {
    await p;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  const report = getClientReport(id);
  if (!report) return NextResponse.json({ error: "Report not ready." }, { status: 500 });
  return NextResponse.json({
    ok: true,
    company: report.company,
    website: report.website,
    location: report.location,
    headline: report.headline,
    yourBusiness: report.yourBusiness,
    whatWeHeard: report.whatWeHeard,
    aiJourney: report.aiJourney,
    aiCulture: report.aiCulture,
    yourData: report.yourData,
    opportunityMap: report.opportunityMap,
    aiLeverage: report.aiLeverage,
    aiFit: report.aiFit,
    technologyEnvironment: report.technologyEnvironment,
    opportunities: report.opportunities,
    whatWeStillNeedToLearn: report.whatWeStillNeedToLearn,
    analystView: report.analystView,
    evidenceIds: report.evidenceIds,
    generatedAt: report.generatedAt,
    downloadUrl: `/api/report/${id}/download`
  });
}
