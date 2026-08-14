/**
 * Interview endpoints (Phase 2, spec §7.1).
 *   GET  /api/interview/[id]/next  → { question } | { finished: true }
 *   POST /api/interview/[id]/answer { questionId, answer } → { ok, asked, finished }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getScan } from "@/lib/evidence/store";
import { getInterviewState, initInterview, nextQuestion } from "@/lib/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = getScan(id);
  if (!scan) return NextResponse.json({ error: "Scan not found." }, { status: 404 });

  let st = getInterviewState(id);
  if (!st) st = initInterview(id);

  try {
    const q = await nextQuestion(id);
    if (!q) return NextResponse.json({ finished: true, asked: st.asked, max: st.maxQuestions });
    return NextResponse.json({ question: q, asked: st.asked, max: st.maxQuestions, min: st.minQuestions });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
