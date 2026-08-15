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
    `Company snapshot:`,
    b.companySnapshot || "(none)",
    ``,
    `What we learned (by dimension):`,
    ...(b.dimensionsLearned.length
      ? b.dimensionsLearned.flatMap((d) => [
          `- ${d.label}: ${d.whatWeLearned} (confidence: ${d.confidence})`,
          `    Evidence: ${d.evidenceIds.join(", ") || "(none)"}`
        ])
      : ["- (none)"]),
    ``,
    `Potential opportunity areas (unranked):`,
    ...(b.opportunities.length
      ? b.opportunities.flatMap((o, i) => [
          `${i + 1}. ${o.name}`,
          `   What we heard: ${o.whatWeHeard}`,
          `   Why it may matter: ${o.whyItMayMatter}`,
          `   Evidence: ${o.evidenceIds.join(", ") || "(none)"}`,
          `   What remains unknown: ${o.whatRemainsUnknown.join("; ") || "(none)"}`,
          `   Recommended deeper investigation: ${o.recommendedDeeperInvestigation.join("; ") || "(none)"}`
        ])
      : ["- (none — no supported opportunity identified)"]),
    ``,
    `Questions worth investigating:`,
    ...(b.questionsWorthInvestigating.length ? b.questionsWorthInvestigating.map((q) => `- ${q}`) : ["- (none)"]),
    ``,
    `Remaining uncertainty:`,
    ...(b.remainingUncertainty.length
      ? b.remainingUncertainty.flatMap((u) => [
          `- Unknown: ${u.unknown}`,
          `    Why it matters: ${u.whyItMatters}`,
          `    Evidence needed: ${u.evidenceNeeded}`
        ])
      : ["- (none)"]),
    ``,
    `Contradictions (public vs stakeholder):`,
    ...(b.contradictions.length ? b.contradictions.map((c) => `- ${c}`) : ["- (none)"]),
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
  const dims = b.dimensionsLearned
    .map((d) => `<li><strong>${esc(d.label)}</strong> <em>(${d.confidence})</em><br/>${esc(d.whatWeLearned)}<br/><em>Evidence:</em> ${esc(d.evidenceIds.join(", ") || "(none)")}</li>`)
    .join("") || "<li>(none)</li>";
  const opps = b.opportunities.length
    ? b.opportunities
        .map(
          (o) =>
            `<li><strong>${esc(o.name)}</strong><br/><em>What we heard:</em> ${esc(o.whatWeHeard)}<br/><em>Why it may matter:</em> ${esc(o.whyItMayMatter)}<br/><em>Evidence:</em> ${esc(o.evidenceIds.join(", ") || "(none)")}<br/><em>What remains unknown:</em> ${esc(o.whatRemainsUnknown.join("; ") || "(none)")}<br/><em>Recommended deeper investigation:</em> ${esc(o.recommendedDeeperInvestigation.join("; ") || "(none)")}</li>`
        )
        .join("")
    : "<li>(none — no supported opportunity identified)</li>";
  const qs = b.questionsWorthInvestigating.map((q) => `<li>${esc(q)}</li>`).join("") || "<li>(none)</li>";
  const unc = b.remainingUncertainty.length
    ? b.remainingUncertainty
        .map((u) => `<li><strong>${esc(u.unknown)}</strong><br/><em>Why it matters:</em> ${esc(u.whyItMatters)}<br/><em>Evidence needed:</em> ${esc(u.evidenceNeeded)}</li>`)
        .join("")
    : "<li>(none)</li>";
  const contra = b.contradictions.map((c) => `<li>${esc(c)}</li>`).join("") || "<li>(none)</li>";
  return [
    `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5">`,
    `<h2>Fox ${ENT.amp} Loom — Sales Intelligence Brief</h2>`,
    `<p>Company: <strong>${esc(b.company)}</strong> ${ENT.middot} ${esc(b.website)}<br/>Contact: ${esc(b.contactEmail)} ${ENT.middot} ${new Date(b.generatedAt).toISOString()}</p>`,
    `<h3>Summary</h3><p>${esc(b.summary)}</p>`,
    `<h3>Company snapshot</h3><p>${esc(b.companySnapshot || "(none)")}</p>`,
    `<h3>What we learned (by dimension)</h3><ul>${dims}</ul>`,
    `<h3>Potential opportunity areas (unranked)</h3><ul>${opps}</ul>`,
    `<h3>Questions worth investigating</h3><ul>${qs}</ul>`,
    `<h3>Remaining uncertainty</h3><ul>${unc}</ul>`,
    `<h3>Contradictions (public vs stakeholder)</h3><ul>${contra}</ul>`,
    `<p><em>Evidence ids used:</em> ${esc(b.evidenceIds.join(", ") || "(none)")}</p>`,
    `</body></html>`
  ].join("\n");
}
