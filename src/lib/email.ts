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
  const subject = `New Company AI Opportunity Scan: ${brief.company}`;
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
    `Fox & Loom — Sales Intelligence Brief (Company AI Opportunity Scan)`,
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
    `1. Opportunity Hypothesis:`,
    b.hypothesis
      ? [
          `   Title: ${b.hypothesis.title}`,
          `   Process Locus: ${b.hypothesis.locus}`,
          `   Confidence (Worth Investigating): ${b.hypothesis.confidence}`,
          `   Summary: ${b.hypothesis.summary}`,
          `   Evidence: ${b.hypothesis.evidenceIds.join(", ") || "(none)"}`
        ].join("\n")
      : `   (No clear operational opportunity hypothesis identified)`,
    ``,
    `2. Why We Identified It:`,
    ...(b.whyIdentified.length
      ? b.whyIdentified.map((w) => `   - ${w.observation} [Evidence: ${w.evidenceIds.join(", ") || "(none)"}]`)
      : ["   - (none)"]),
    ``,
    `3. Potential Impact (Directional):`,
    ...(b.potentialImpact.length
      ? b.potentialImpact.map((p) => `   - ${p.area}: ${p.directionalImpact} [Evidence: ${p.evidenceIds.join(", ") || "(none)"}]`)
      : ["   - (none)"]),
    ``,
    `4. Additional Signals:`,
    ...(b.additionalSignals.length
      ? b.additionalSignals.map((a) => `   - ${a.signal} [Evidence: ${a.evidenceIds.join(", ") || "(none)"}]`)
      : ["   - (none)"]),
    ``,
    `5. What Remains Unknown:`,
    ...(b.whatRemainsUnknown.length
      ? b.whatRemainsUnknown.map((u) => `   - ${u.unknown}: ${u.whyItMatters}`)
      : ["   - (none)"]),
    ``,
    `6. What a Deep Assessment Would Investigate:`,
    ...(b.deepAssessmentQuestions.length
      ? b.deepAssessmentQuestions.map((q) => `   - ${q}`)
      : ["   - (none)"]),
    ``,
    `Contradictions (public vs stakeholder):`,
    ...(b.contradictions.length ? b.contradictions.map((c) => `- ${c}`) : ["- (none)"]),
    ``,
    `Evidence ids used: ${b.evidenceIds.join(", ") || "(none)"}`
  ];
  return lines.join("\n");
}

function renderBriefHtml(b: SalesBrief): string {
  const ENT = { amp: "&" + "amp;", lt: "&" + "lt;", gt: "&" + "gt;", quot: "&" + "quot;", middot: "&" + "middot;" } as const;
  const esc = (s: string) =>
    s.replace(/[&<>\""]/g, (c) =>
      c === "&" ? ENT.amp : c === "<" ? ENT.lt : c === ">" ? ENT.gt : ENT.quot
    );

  const hypHtml = b.hypothesis
    ? `<div style="background:#FAF7F0;border:1px solid #E4E1DA;border-radius:6px;padding:12px;">` +
      `<strong>${esc(b.hypothesis.title)}</strong><br/>` +
      `<em>Process Locus:</em> ${esc(b.hypothesis.locus)}<br/>` +
      `<em>Confidence (Worth Investigating):</em> ${esc(b.hypothesis.confidence.toUpperCase())}<br/>` +
      `<p>${esc(b.hypothesis.summary)}</p>` +
      `<small>Evidence: ${esc(b.hypothesis.evidenceIds.join(", ") || "(none)")}</small>` +
      `</div>`
    : `<p><em>No clear operational opportunity hypothesis identified.</em></p>`;

  const whyHtml = b.whyIdentified.length
    ? b.whyIdentified.map((w) => `<li>${esc(w.observation)} <small>(Evidence: ${esc(w.evidenceIds.join(", "))})</small></li>`).join("")
    : `<li>(none)</li>`;

  const impactHtml = b.potentialImpact.length
    ? b.potentialImpact.map((p) => `<li><strong>${esc(p.area)}:</strong> ${esc(p.directionalImpact)} <small>(Evidence: ${esc(p.evidenceIds.join(", "))})</small></li>`).join("")
    : `<li>(none)</li>`;

  const signalsHtml = b.additionalSignals.length
    ? b.additionalSignals.map((a) => `<li>${esc(a.signal)} <small>(Evidence: ${esc(a.evidenceIds.join(", "))})</small></li>`).join("")
    : `<li>(none)</li>`;

  const unknownsHtml = b.whatRemainsUnknown.length
    ? b.whatRemainsUnknown.map((u) => `<li><strong>${esc(u.unknown)}:</strong> ${esc(u.whyItMatters)}</li>`).join("")
    : `<li>(none)</li>`;

  const questionsHtml = b.deepAssessmentQuestions.length
    ? b.deepAssessmentQuestions.map((q) => `<li>${esc(q)}</li>`).join("")
    : `<li>(none)</li>`;

  const contraHtml = b.contradictions.length
    ? b.contradictions.map((c) => `<li>${esc(c)}</li>`).join("")
    : `<li>(none)</li>`;

  return [
    `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5">`,
    `<h2>Fox ${ENT.amp} Loom — Sales Intelligence Brief</h2>`,
    `<p>Company: <strong>${esc(b.company)}</strong> ${ENT.middot} ${esc(b.website)}<br/>Contact: ${esc(b.contactEmail)} ${ENT.middot} ${new Date(b.generatedAt).toISOString()}</p>`,
    `<h3>Summary</h3><p>${esc(b.summary)}</p>`,
    `<h3>Company snapshot</h3><p>${esc(b.companySnapshot || "(none)")}</p>`,
    `<h3>1. Opportunity Hypothesis</h3>${hypHtml}`,
    `<h3>2. Why We Identified It</h3><ul>${whyHtml}</ul>`,
    `<h3>3. Potential Impact (Directional)</h3><ul>${impactHtml}</ul>`,
    `<h3>4. Additional Signals</h3><ul>${signalsHtml}</ul>`,
    `<h3>5. What Remains Unknown</h3><ul>${unknownsHtml}</ul>`,
    `<h3>6. What a Deep Assessment Would Investigate</h3><ul>${questionsHtml}</ul>`,
    `<h3>Contradictions (public vs stakeholder)</h3><ul>${contraHtml}</ul>`,
    `<p><em>Evidence ids used:</em> ${esc(b.evidenceIds.join(", ") || "(none)")}</p>`,
    `</body></html>`
  ].join("\n");
}
