/**
 * email-dispatch (spec §8.1 external capability, §9.3 "provider swappable
 * behind a thin interface"). Two providers:
 *  - console (default): logs the brief. No key needed (spec §12.3 — avoids
 *    introducing a new paid credential).
 *  - resend: active when RESEND_API_KEY is set.
 *
 * Adding sendgrid/postmark later = implement the same interface and wire it in
 * `createEmailDispatcher`.
 */
import { env } from "@/lib/env";
import type { SalesBrief } from "@/lib/synthesis";

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailDispatcher {
  readonly name: string;
  send(msg: EmailMessage): Promise<{ ok: boolean; detail?: string }>;
}

export async function dispatchSalesBrief(brief: SalesBrief): Promise<{ ok: boolean; detail?: string }> {
  const to = env.salesBriefTo;
  const from = env.salesBriefFrom;
  const subject = `New Opportunity Scan: ${brief.company}`;
  const text = renderBriefText(brief);
  const dispatcher = createEmailDispatcher();
  brief.to = to;
  return dispatcher.send({ to, from, subject, text, html: renderBriefHtml(brief) });
}

export function createEmailDispatcher(): EmailDispatcher {
  switch (env.emailProvider) {
    case "resend":
      if (!env.resendApiKey) {
        // Fall back to console rather than throwing — keep the funnel alive.
        return consoleDispatcher("resend (no key → console)");
      }
      return resendDispatcher(env.resendApiKey);
    case "console":
    default:
      return consoleDispatcher("console");
  }
}

function consoleDispatcher(name: string): EmailDispatcher {
  return {
    name,
    async send(msg) {
      // eslint-disable-next-line no-console
      console.log(
        `[email:${name}] to=${msg.to} from=${msg.from} subject=${msg.subject}\n----\n${msg.text}\n----`
      );
      return { ok: true, detail: "logged (console provider)" };
    }
  };
}

function resendDispatcher(apiKey: string): EmailDispatcher {
  return {
    name: "resend",
    async send(msg) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            from: msg.from,
            to: [msg.to],
            subject: msg.subject,
            text: msg.text,
            html: msg.html
          })
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          return { ok: false, detail: `resend ${res.status}: ${t.slice(0, 200)}` };
        }
        return { ok: true };
      } catch (e) {
        return { ok: false, detail: `resend error: ${(e as Error).message}` };
      }
    }
  };
}

function renderBriefText(b: SalesBrief): string {
  const lines = [
    `Fox & Loom — Sales Intelligence Brief`,
    ``,
    `Company: ${b.company}`,
    `Website: ${b.website}`,
    `Contact: ${b.contactEmail}`,
    `Generated: ${new Date(b.generatedAt).toISOString()}`,
    ``,
    `Summary:`,
    b.summary,
    ``,
    `Opportunity areas (unranked):`,
    ...b.areas.flatMap((a, i) => [
      `${i + 1}. ${a.title}`,
      `   ${a.summary}`,
      `   Example: ${a.example}`,
      `   Evidence: ${a.evidenceIds.join(", ") || "(none)"}`
    ]),
    ``,
    `Perspectives:`,
    ...(b.perspectives.length
      ? b.perspectives.flatMap((p) => [
          `- ${p.title}: ${p.summary}`,
          ...(p.opportunity ? [`    Opportunity: ${p.opportunity}`] : []),
          ...(p.uncertainty ? [`    Still unknown: ${p.uncertainty}`] : []),
          `    Evidence: ${p.evidenceIds.join(", ") || "(none)"}`
        ])
      : ["- (none)"]),
    ``,
    `Gaps / follow-ups:`,
    ...(b.gaps.length ? b.gaps.map((g) => `- ${g}`) : ["- (none)"]),
    ``,
    `Recommended questions for first call:`,
    ...(b.recommendedQuestions.length ? b.recommendedQuestions.map((q) => `- ${q}`) : ["- (none)"]),
    ``,
    `Evidence ids used: ${b.evidenceIds.join(", ") || "(none)"}`
  ];
  return lines.join("\n");
}

function renderBriefHtml(b: SalesBrief): string {
  // Build HTML entities from parts so no complete entity literal appears in
  // source (avoids editor/tool entity-decoding quirks).
  const ENT = { amp: "&" + "amp;", lt: "&" + "lt;", gt: "&" + "gt;", quot: "&" + "quot;", middot: "&" + "middot;" } as const;
  const esc = (s: string) =>
    s.replace(/[&<>\""]/g, (c) =>
      c === "&" ? ENT.amp : c === "<" ? ENT.lt : c === ">" ? ENT.gt : ENT.quot
    );
  const areas = b.areas
    .map(
      (a) =>
        `<li><strong>${esc(a.title)}</strong><br/>${esc(a.summary)}<br/><em>Example:</em> ${esc(a.example)}<br/><em>Evidence:</em> ${esc(a.evidenceIds.join(", ") || "(none)")}</li>`
    )
    .join("");
  const gaps = b.gaps.map((g) => `<li>${esc(g)}</li>`).join("") || "<li>(none)</li>";
  const qs = b.recommendedQuestions.map((q) => `<li>${esc(q)}</li>`).join("") || "<li>(none)</li>";
  const perspectives = b.perspectives
    .map(
      (p) =>
        `<li><strong>${esc(p.title)}</strong><br/>${esc(p.summary)}` +
        (p.opportunity ? `<br/><em>Opportunity:</em> ${esc(p.opportunity)}` : "") +
        (p.uncertainty ? `<br/><em>Still unknown:</em> ${esc(p.uncertainty)}` : "") +
        `<br/><em>Evidence:</em> ${esc(p.evidenceIds.join(", ") || "(none)")}</li>`
    )
    .join("") || "<li>(none)</li>";
  return [
    `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5">`,
    `<h2>Fox ${ENT.amp} Loom — Sales Intelligence Brief</h2>`,
    `<p>Company: <strong>${esc(b.company)}</strong> ${ENT.middot} ${esc(b.website)}<br/>Contact: ${esc(b.contactEmail)} ${ENT.middot} ${new Date(b.generatedAt).toISOString()}</p>`,
    `<h3>Summary</h3><p>${esc(b.summary)}</p>`,
    `<h3>Opportunity areas (unranked)</h3><ul>${areas}</ul>`,
    `<h3>Perspectives</h3><ul>${perspectives}</ul>`,
    `<h3>Gaps / follow-ups</h3><ul>${gaps}</ul>`,
    `<h3>Recommended first-call questions</h3><ul>${qs}</ul>`,
    `<p><em>Evidence ids used:</em> ${esc(b.evidenceIds.join(", ") || "(none)")}</p>`,
    `</body></html>`
  ].join("\n");
}
