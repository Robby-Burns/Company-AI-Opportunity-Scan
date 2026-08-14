/** POST /api/contact → routes the contact form to CONTACT_EMAIL (spec §9.2). */
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
  topic?: string;
  message?: string;
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
  const topic = (body.topic ?? "").trim();
  const message = (body.message ?? "").trim();

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Message too long (max 4000 chars)." }, { status: 400 });
  }

  const dispatcher = createEmailDispatcher();
  const res = await dispatcher.send({
    to: env.contactEmail,
    from: env.contactFromEmail, // verified sending domain for the contact form
    subject: `New contact message from ${name}${company ? ` (${company})` : ""}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company || "(none)"}`,
      `Website: ${website || "(none)"}`,
      `Topic: ${topic || "(none)"}`,
      "",
      "Message:",
      message
    ].join("\n")
  });

  return NextResponse.json({ ok: res.ok, detail: res.detail });
}
