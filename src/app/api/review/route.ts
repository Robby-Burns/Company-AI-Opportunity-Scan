/**
 * POST /api/review → routes a Free AI Readiness Review intake to the Fox & Loom
 * team via the email dispatcher.
 *
 * This is the simple, human-led public entry point. It captures basic company
 * information; a Fox & Loom person then reviews public information and conducts
 * a short conversation. It intentionally does NOT launch the internal
 * automated scan/interview pipeline (`/api/scan*`) — that machinery can be
 * wired in later as an optional enhancement.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createEmailDispatcher } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  name?: string;
  email?: string;
  company?: string;
  website?: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const company = (body.company ?? "").trim();
  const website = (body.website ?? "").trim();

  if (!name || !email || !company || !website) {
    return NextResponse.json({ error: "Name, work email, company, and website are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid work email is required." }, { status: 400 });
  }
  if (name.length > 120 || company.length > 120 || website.length > 300) {
    return NextResponse.json({ error: "A field is too long." }, { status: 400 });
  }

  const dispatcher = createEmailDispatcher();
  const res = await dispatcher.send({
    to: env.salesBriefTo,
    from: env.salesBriefFrom,
    subject: `New Free AI Readiness Review request — ${company}`,
    text: [
      `Fox & Loom — Free AI Readiness Review request`,
      ``,
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company}`,
      `Website: ${website}`,
      ``,
      `Next step: review publicly available information, then schedule the short conversation.`
    ].join("\n")
  });

  return NextResponse.json({ ok: res.ok, detail: res.detail });
}
