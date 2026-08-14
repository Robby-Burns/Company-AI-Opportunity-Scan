import { NextResponse, type NextRequest } from "next/server";
import { getScan } from "@/lib/evidence/store";
import { getInterviewState, initInterview, ingestResponse, isInterviewFinished } from "@/lib/orchestrator";
import { synthesizeReports, createIntakePackage } from "@/lib/synthesis";
import { dispatchSalesBrief } from "@/lib/email";
import { renderClientSummaryPdf } from "@/lib/pdf";
import { startSynthesis } from "@/lib/synthesis-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = getScan(id);
  if (!scan) return NextResponse.json({ error: "Scan not found." }, { status: 404 });

  let body: { questionId?: string; answer?: string };
  try {
    body = (await req.json()) as { questionId?: string; answer?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { questionId, answer } = body;
  if (!questionId || typeof answer !== "string" || answer.trim().length === 0) {
    return NextResponse.json({ error: "questionId and a non-empty answer are required." }, { status: 400 });
  }
  if (answer.length > 4000) {
    return NextResponse.json({ error: "Answer is too long (max 4000 chars)." }, { status: 400 });
  }

  let st = getInterviewState(id);
  if (!st) st = initInterview(id);

  const ok = await ingestResponse(id, questionId, answer);
  if (!ok) return NextResponse.json({ error: "Could not record answer." }, { status: 400 });

  const finished = isInterviewFinished(id);

  // When finished, kick off synthesis + email + PDF in the background.
  if (finished) {
    startSynthesis(
      id,
      (async () => {
        const { client, sales } = await synthesizeReports(id);
        const emailRes = await dispatchSalesBrief(sales).catch(
          (e) => ({ ok: false, detail: (e as Error).message })
        );
        (getScan(id) as unknown as { intakePackage?: unknown }).intakePackage = createIntakePackage(id, client, sales);
        const pdfBytes = await renderClientSummaryPdf(client);
        return { pdfBytes, emailOk: emailRes.ok, clientReport: client };
      })()
    );
  }

  return NextResponse.json({ ok: true, asked: st.asked, max: st.maxQuestions, finished });
}
