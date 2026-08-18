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
  const cr = b.clientReport;
  const lines = [
    `Fox & Loom — Sales Intelligence Brief (Company AI Opportunity Scan)`,
    ``,
    `Company: ${b.company}`,
    ...(b.location ? [`Location: ${b.location}`] : []),
    `Website: ${b.website || "(none provided)"}`,
    `Contact: ${b.contactEmail}`,
    `Generated: ${new Date(b.generatedAt).toISOString()}`,
    ``,
    `Sales Summary:`,
    b.summary,
    ``,
    `1. Your Business:`,
    cr.yourBusiness,
    ``,
    `2. What We Heard:`,
    ...(cr.whatWeHeard.length
      ? cr.whatWeHeard.map((w) => `   - ${w.observation} [Evidence: ${w.evidenceIds.join(", ") || "(none)"}]`)
      : ["   - (none recorded)"]),
    ``,
    `3. AI Journey Stage: ${cr.aiJourney.stage}`,
    `   ${cr.aiJourney.explanation}`,
    ``,
    `4. AI Culture & Adoption:`,
    `   - What may help: ${cr.aiCulture.whatMayHelp.join(", ") || "(none)"}`,
    `   - What may make adoption harder: ${cr.aiCulture.whatMayMakeAdoptionHarder.join(", ") || "(none)"}`,
    `   - Where AI may help: ${cr.aiCulture.whereAiMayHelp}`,
    ``,
    `5. Data & Technology Environment:`,
    ...(cr.dataAndTechnology.dataIdentified.length
      ? cr.dataAndTechnology.dataIdentified.map((d) => `   - Data: ${d.data} (lives in: ${d.location})${d.relevance ? ` — ${d.relevance}` : ""}`)
      : ["   - Data: (none identified)"]),
    `   - Systems: ${cr.dataAndTechnology.systems.join(", ") || "(none identified)"}`,
    ...(cr.dataAndTechnology.crossSystemFlow.length
      ? cr.dataAndTechnology.crossSystemFlow.map((f) => `   - Cross-System Flow: ${f}`)
      : []),
    `   - Context: ${cr.dataAndTechnology.whyThisMatters}`,
    ``,
    `6. Where AI Could Help:`,
    `   A. Workflow Friction:`,
    ...(cr.whereAiCouldHelp.workflowFriction.length
      ? cr.whereAiCouldHelp.workflowFriction.map((o) => `      - ${o.stage}: ${o.friction}`)
      : ["      - (no friction points mapped)"]),
    `   B. Technology / Leverage Patterns:`,
    ...(cr.whereAiCouldHelp.leveragePatterns.length
      ? cr.whereAiCouldHelp.leveragePatterns.map((l) => `      - [${l.category}] ${l.observation} [Evidence: ${l.evidenceIds.join(", ")}]`)
      : ["      - (none identified)"]),
    `   C. AI vs. Automation vs. Human Judgment Fit:`,
    `      - AI Suited: ${cr.whereAiCouldHelp.fitBreakdown.wellSuited.join("; ") || "(none)"}`,
    `      - Traditional Automation Suited: ${cr.whereAiCouldHelp.fitBreakdown.traditionalAutomationSuited.join("; ") || "(none)"}`,
    `      - Human Judgment Required: ${cr.whereAiCouldHelp.fitBreakdown.humanJudgmentRequired.join("; ") || "(none)"}`,
    ``,
    `7. Areas Worth Investigating (0-3 max):`,
    ...(cr.opportunities.length
      ? cr.opportunities.map((o, idx) =>
          [
            `   Opportunity ${idx + 1}: ${o.title} (${o.status} | Confidence: ${o.evidenceConfidence} | Approach: ${o.potentialApproach})`,
            `   - Why It Stood Out: ${o.whyItStoodOut}`,
            `   - Potential Value: ${o.potentialValue}`,
            `   - Confidence Rationale: ${o.confidenceReason}`,
            ...(o.thingsToWatch?.length ? [`   - Things to Watch: ${o.thingsToWatch.join("; ")}`] : []),
            ...(o.whatWeStillNeedToLearn?.length ? [`   - What to Investigate Next: ${o.whatWeStillNeedToLearn.join("; ")}`] : []),
            `   - Evidence: ${o.evidenceIds.join(", ") || "(none)"}`
          ].join("\n")
        )
      : ["   (No clear operational opportunity hypothesis identified with available evidence)"]),
    ``,
    `8. What We Still Need to Learn (Diagnostic Questions):`,
    ...(cr.whatWeStillNeedToLearn.length
      ? cr.whatWeStillNeedToLearn.map((q) => `   - ${q.question} [Why: ${q.whyItMatters}]${q.evidenceNeeded ? ` (Needed: ${q.evidenceNeeded})` : ""}`)
      : ["   - (none)"]),
    ``,
    `9. Our Takeaway:`,
    `   - What We Understand: ${cr.ourTakeaway.whatWeUnderstand}`,
    `   - Worth Exploring: ${cr.ourTakeaway.whatAppearsWorthExploring}`,
    `   - Improvement First: ${cr.ourTakeaway.whatMayNeedImprovementFirst}`,
    `   - Unknowns: ${cr.ourTakeaway.whatWeDontKnowYet}`,
    `   - Recommended Next Step: ${cr.ourTakeaway.recommendedNextStep}`,
    ``,
    `Contradictions (public vs stakeholder):`,
    ...(b.contradictions.length ? b.contradictions.map((c) => `- ${c}`) : ["- (none)"]),
    ``,
    `Evidence ids used: ${b.evidenceIds.join(", ") || "(none)"}`
  ];
  return lines.join("\n");
}

function renderBriefHtml(b: SalesBrief): string {
  const cr = b.clientReport;
  const ENT = { amp: "&" + "amp;", lt: "&" + "lt;", gt: "&" + "gt;", quot: "&" + "quot;", middot: "&" + "middot;" } as const;
  const esc = (s: string) =>
    s.replace(/[&<>\""]/g, (c) =>
      c === "&" ? ENT.amp : c === "<" ? ENT.lt : c === ">" ? ENT.gt : ENT.quot
    );

  const oppsHtml = cr.opportunities.length
    ? cr.opportunities
        .map(
          (o, idx) =>
            `<div style="background:#FAF7F0;border:1px solid #E4E1DA;border-radius:6px;padding:10px;margin-bottom:8px;">` +
            `<strong>Opportunity ${idx + 1}: ${esc(o.title)}</strong><br/>` +
            `<small>Status: ${esc(o.status)} | Confidence: ${esc(o.evidenceConfidence)} | Approach: ${esc(o.potentialApproach)}</small><br/>` +
            `<p style="margin:4px 0;"><strong>Why It Stood Out:</strong> ${esc(o.whyItStoodOut)}</p>` +
            `<p style="margin:4px 0;"><strong>Potential Value:</strong> ${esc(o.potentialValue)}</p>` +
            `<p style="margin:4px 0;"><strong>Confidence Reason:</strong> ${esc(o.confidenceReason)}</p>` +
            `<small>Evidence: ${esc(o.evidenceIds.join(", ") || "(none)")}</small>` +
            `</div>`
        )
        .join("")
    : `<p><em>No clear operational opportunity identified with available evidence.</em></p>`;

  const whyHtml = cr.whatWeHeard.length
    ? cr.whatWeHeard.map((w) => `<li>${esc(w.observation)} <small>(Evidence: ${esc(w.evidenceIds.join(", "))})</small></li>`).join("")
    : `<li>(none)</li>`;

  const questionsHtml = cr.whatWeStillNeedToLearn.length
    ? cr.whatWeStillNeedToLearn.map((q) => `<li><strong>${esc(q.question)}</strong> — <em>${esc(q.whyItMatters)}</em>${q.evidenceNeeded ? ` <small>(Needed: ${esc(q.evidenceNeeded)})</small>` : ""}</li>`).join("")
    : `<li>(none)</li>`;

  const contraHtml = b.contradictions.length
    ? b.contradictions.map((c) => `<li>${esc(c)}</li>`).join("")
    : `<li>(none)</li>`;

  const companyLine = [
    `<strong>${esc(b.company)}</strong>`,
    b.location ? esc(b.location) : "",
    b.website ? esc(b.website) : "(no website)"
  ].filter(Boolean).join(` ${ENT.middot} `);

  return [
    `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#2A2D3A;">`,
    `<h2>Fox ${ENT.amp} Loom — Sales Intelligence Brief</h2>`,
    `<p>Company: ${companyLine}<br/>Contact: ${esc(b.contactEmail)} ${ENT.middot} ${new Date(b.generatedAt).toISOString()}</p>`,
    `<h3>Sales Summary</h3><p>${esc(b.summary)}</p>`,
    `<h3>1. Your Business</h3><p>${esc(cr.yourBusiness)}</p>`,
    `<h3>2. What We Heard</h3><ul>${whyHtml}</ul>`,
    `<h3>3. AI Journey Stage</h3><p><strong>${esc(cr.aiJourney.stage)}:</strong> ${esc(cr.aiJourney.explanation)}</p>`,
    `<h3>5. Data & Technology</h3><p><strong>Systems:</strong> ${esc(cr.dataAndTechnology.systems.join(", ") || "(none)")}</p><p>${esc(cr.dataAndTechnology.whyThisMatters)}</p>`,
    `<h3>7. Areas Worth Investigating</h3>${oppsHtml}`,
    `<h3>8. What We Still Need to Learn</h3><ul>${questionsHtml}</ul>`,
    `<h3>9. Our Takeaway</h3>`,
    `<p><strong>What We Understand:</strong> ${esc(cr.ourTakeaway.whatWeUnderstand)}</p>`,
    `<p><strong>Worth Exploring:</strong> ${esc(cr.ourTakeaway.whatAppearsWorthExploring)}</p>`,
    `<p><strong>Recommended Next Step:</strong> ${esc(cr.ourTakeaway.recommendedNextStep)}</p>`,
    `<h3>Contradictions (public vs stakeholder)</h3><ul>${contraHtml}</ul>`,
    `<p><em>Evidence ids used:</em> ${esc(b.evidenceIds.join(", ") || "(none)")}</p>`,
    `</body></html>`
  ].join("\n");
}
