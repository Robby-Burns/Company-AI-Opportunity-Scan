import React from "react";
import path from "node:path";
import fs from "node:fs";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
  Link
} from "@react-pdf/renderer";
import type { ClientReport } from "@/lib/synthesis";
import { content } from "@/content";

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#2A2D3A",
    backgroundColor: "#FFFFFF"
  },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#BF9036",
    paddingBottom: 7,
    marginBottom: 10
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center"
  },
  logo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: 8
  },
  brandTitleBlock: {
    flexDirection: "column"
  },
  brand: {
    fontSize: 11.5,
    fontFamily: "Helvetica-Bold",
    color: "#2F3359",
    letterSpacing: 0.4
  },
  tagline: {
    fontSize: 7.5,
    color: "#6B6F7A",
    marginTop: 1
  },
  headerBadge: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#8A6A1F",
    letterSpacing: 0.8
  },
  h1: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: "#2F3359",
    marginBottom: 3,
    marginTop: 2
  },
  meta: {
    fontSize: 8,
    color: "#6B6F7A",
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#2F3359",
    marginTop: 8,
    marginBottom: 3
  },
  sectionSub: {
    fontSize: 8,
    color: "#5A5D6A",
    marginBottom: 4
  },
  subsectionTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#2F3359",
    marginTop: 5,
    marginBottom: 2
  },
  card: {
    borderWidth: 1,
    borderColor: "#E4E1DA",
    borderRadius: 4,
    padding: 7,
    marginBottom: 5,
    backgroundColor: "#FAF7F0"
  },
  cardAccent: {
    borderWidth: 1,
    borderColor: "#BF9036",
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
    backgroundColor: "#FCFAF6"
  },
  cardTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#2F3359",
    marginBottom: 2
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3
  },
  badge: {
    fontSize: 7,
    color: "#8A6A1F",
    fontFamily: "Helvetica-Bold",
    marginRight: 6
  },
  badgeNavy: {
    fontSize: 7,
    color: "#2F3359",
    fontFamily: "Helvetica-Bold",
    marginRight: 6
  },
  body: {
    fontSize: 8.5,
    lineHeight: 1.35,
    color: "#2A2D3A"
  },
  bodyMuted: {
    fontSize: 8,
    lineHeight: 1.3,
    color: "#5A5D6A",
    marginTop: 2
  },
  ev: {
    fontSize: 7,
    color: "#8A6A1F",
    marginTop: 2
  },
  bullet: {
    fontSize: 8.5,
    lineHeight: 1.3,
    color: "#3A3D4A",
    marginBottom: 2
  },
  gridTwoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  colHalf: {
    width: "48.5%"
  },
  flowStep: {
    borderLeftWidth: 2,
    borderLeftColor: "#BF9036",
    paddingLeft: 6,
    marginBottom: 4
  },
  flowStageName: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#2F3359"
  },
  flowFriction: {
    fontSize: 8,
    color: "#4A4D5A",
    marginTop: 1
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#9A9DA6",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#E4E1DA",
    paddingTop: 3
  }
});

void Font;

/**
 * Standardize Unicode characters for WinAnsi Helvetica PDF rendering.
 */
function s(value: string | undefined | null): string {
  if (value == null) return "";
  return String(value)
    .replace(/[\u2192\u279C\u2794\u25B6\u21D2\u27A4]/g, "->")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, "\"")
    .replace(/\u2026/g, "...")
    .replace(/[\u2022\u25AA\u25CF]/g, "-")
    .replace(/[\u2713\u2714\u2717\u2718]/g, "*")
    .replace(/[\u00B7]/g, "*")
    .replace(/[^\x00-\x7F]/g, "")
    .trim();
}

/**
 * Locate the Fox & Loom logo file and convert to a base64 Data URI for PDF rendering.
 */
export function getFoxAndLoomLogoBase64(): string | undefined {
  try {
    const candidates = [
      path.join(process.cwd(), "public", "logo.png"),
      path.join(process.cwd(), "logo.png")
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const data = fs.readFileSync(p);
        return `data:image/png;base64,${data.toString("base64")}`;
      }
    }
  } catch {
    // Return undefined if fs not accessible
  }
  return undefined;
}

export function ClientSummaryPdf({ report, logoSrc }: { report: ClientReport; logoSrc?: string }) {
  const date = new Date(report.generatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const logo = logoSrc ?? getFoxAndLoomLogoBase64();

  const Header = () => (
    <View style={styles.header} fixed>
      <View style={styles.headerRow}>
        <View style={styles.brandGroup}>
          {logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logo} style={styles.logo} />
          ) : null}
          <View style={styles.brandTitleBlock}>
            <Text style={styles.brand}>{s(content.orgName)}</Text>
            <Text style={styles.tagline}>Humans helping humans - foxandloom.com</Text>
          </View>
        </View>
        <Text style={styles.headerBadge}>COMPANY AI OPPORTUNITY SCAN</Text>
      </View>
    </View>
  );

  const Footer = () => (
    <Text style={styles.footer} fixed>
      {content.orgName} - {content.contactInfo.phone} - Generated {date} - Grounded in captured evidence.
    </Text>
  );

  return (
    <Document
      title={`${report.company} - Company AI Opportunity Scan`}
      author={content.orgName}
      subject="Preliminary Company AI Opportunity Scan"
    >
      {/* PAGE 1: Context & AI Readiness */}
      <Page size="A4" style={styles.page}>
        <Header />
        <Text style={styles.h1}>{s(report.headline)}</Text>
        <Text style={styles.meta}>
          Prepared for {[report.company, report.location, report.website].filter(Boolean).map((v) => s(v!)).join(" | ")} | {date}
        </Text>

        {/* 1. Your Business */}
        <Text style={styles.sectionTitle}>1. Your Business</Text>
        <Text style={styles.body}>{s(report.yourBusiness)}</Text>

        {/* 2. What We Heard */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>2. What We Heard</Text>
        {report.whatWeHeard.length === 0 ? (
          <Text style={styles.bodyMuted}>No specific operational statements were recorded during the scan.</Text>
        ) : (
          report.whatWeHeard.map((w, i) => (
            <View key={`w${i}`} style={{ marginBottom: 2.5 }}>
              <Text style={styles.bullet}>- {s(w.observation)}</Text>
              {w.evidenceIds.length > 0 ? (
                <Text style={[styles.ev, { marginLeft: 8 }]}>Evidence: {s(w.evidenceIds.join(", "))}</Text>
              ) : null}
            </View>
          ))
        )}

        {/* 3. Your AI Journey */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>3. Your AI Journey</Text>
        <View style={styles.card}>
          <Text style={styles.badge}>STAGE: {s(report.aiJourney.stage.toUpperCase())}</Text>
          <Text style={styles.body}>{s(report.aiJourney.explanation)}</Text>
        </View>

        {/* 4. AI Culture & Adoption */}
        <Text style={[styles.sectionTitle, { marginTop: 7 }]}>4. AI Culture & Adoption</Text>
        <View style={styles.gridTwoCol}>
          <View style={styles.colHalf}>
            <Text style={[styles.cardTitle, { fontSize: 8.5 }]}>What May Support Adoption</Text>
            {report.aiCulture.whatMayHelp.map((h, i) => (
              <Text key={`h${i}`} style={styles.bullet}>- {s(h)}</Text>
            ))}
          </View>
          <View style={styles.colHalf}>
            <Text style={[styles.cardTitle, { fontSize: 8.5 }]}>What May Require Care</Text>
            {report.aiCulture.whatMayMakeAdoptionHarder.map((c, i) => (
              <Text key={`c${i}`} style={styles.bullet}>- {s(c)}</Text>
            ))}
          </View>
        </View>
        <Text style={[styles.bodyMuted, { marginTop: 2 }]}>{s(report.aiCulture.whereAiMayHelp)}</Text>

        <Footer />
      </Page>

      {/* PAGE 2: Data, Systems & Where AI Could Help */}
      <Page size="A4" style={styles.page}>
        <Header />

        {/* 5. Your Data & Technology */}
        <Text style={styles.sectionTitle}>5. Your Data & Technology</Text>
        <Text style={styles.sectionSub}>Information stores, operational software, and handoffs.</Text>
        
        {report.dataAndTechnology.dataIdentified.length > 0 ? (
          <View style={{ marginBottom: 4 }}>
            <Text style={styles.subsectionTitle}>Identified Data Assets</Text>
            {report.dataAndTechnology.dataIdentified.map((d, i) => (
              <View key={`d${i}`} style={styles.card}>
                <Text style={styles.cardTitle}>{s(d.data)}</Text>
                <Text style={styles.body}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Location: </Text>{s(d.location)}
                  {d.relevance ? ` - Role: ${s(d.relevance)}` : ""}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.gridTwoCol}>
          <View style={[styles.card, styles.colHalf]}>
            <Text style={styles.cardTitle}>Identified Systems</Text>
            <Text style={styles.body}>
              {report.dataAndTechnology.systems.length > 0
                ? s(report.dataAndTechnology.systems.join(" | "))
                : "No specific commercial software platforms were named during discovery."}
            </Text>
          </View>
          <View style={[styles.card, styles.colHalf]}>
            <Text style={styles.cardTitle}>Cross-System Flows</Text>
            {report.dataAndTechnology.crossSystemFlow.length > 0 ? (
              report.dataAndTechnology.crossSystemFlow.map((f, i) => (
                <Text key={`f${i}`} style={styles.bullet}>- {s(f)}</Text>
              ))
            ) : (
              <Text style={styles.bodyMuted}>Manual or standard application usage.</Text>
            )}
          </View>
        </View>
        <Text style={[styles.bodyMuted, { marginBottom: 8 }]}>{s(report.dataAndTechnology.whyThisMatters)}</Text>

        {/* 6. Where AI Could Help */}
        <Text style={styles.sectionTitle}>6. Where AI Could Help</Text>
        <Text style={styles.sectionSub}>
          Understanding operational friction, potential leverage patterns, and distinguishing AI from automation.
        </Text>

        {/* 6A: Where the Work Gets Hard */}
        <Text style={styles.subsectionTitle}>A. Where the Work Gets Hard</Text>
        {report.whereAiCouldHelp.workflowFriction.length === 0 ? (
          <Text style={styles.bodyMuted}>Workflow details are currently limited to high-level discovery observations.</Text>
        ) : (
          report.whereAiCouldHelp.workflowFriction.map((stage, i) => (
            <View key={`stg${i}`} style={styles.flowStep}>
              <Text style={styles.flowStageName}>Stage {i + 1}: {s(stage.stage)}</Text>
              <Text style={styles.flowFriction}>{s(stage.friction)}</Text>
              {stage.evidenceIds && stage.evidenceIds.length > 0 ? (
                <Text style={styles.ev}>Evidence: {s(stage.evidenceIds.join(", "))}</Text>
              ) : null}
            </View>
          ))
        )}

        {/* 6B: What Technology Could Help */}
        {report.whereAiCouldHelp.leveragePatterns.length > 0 ? (
          <View style={{ marginTop: 4, marginBottom: 4 }}>
            <Text style={styles.subsectionTitle}>B. What Technology Could Help</Text>
            {report.whereAiCouldHelp.leveragePatterns.map((l, i) => (
              <View key={`lp${i}`} style={styles.card}>
                <Text style={styles.badge}>{s(l.category.toUpperCase())}</Text>
                <Text style={styles.body}>{s(l.observation)}</Text>
                {l.evidenceIds.length > 0 ? (
                  <Text style={styles.ev}>Evidence: {s(l.evidenceIds.join(", "))}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* 6C: Where AI Fits */}
        <Text style={styles.subsectionTitle}>C. Where AI Fits</Text>
        <View style={styles.gridTwoCol}>
          <View style={[styles.card, styles.colHalf]}>
            <Text style={styles.cardTitle}>AI Best Suited For</Text>
            {report.whereAiCouldHelp.fitBreakdown.wellSuited.length > 0 ? (
              report.whereAiCouldHelp.fitBreakdown.wellSuited.map((w, i) => (
                <Text key={`ws${i}`} style={styles.bullet}>- {s(w)}</Text>
              ))
            ) : (
              <Text style={styles.bodyMuted}>Unstructured text, doc search, variable communication.</Text>
            )}
          </View>
          <View style={[styles.card, styles.colHalf]}>
            <Text style={styles.cardTitle}>Traditional Automation</Text>
            {report.whereAiCouldHelp.fitBreakdown.traditionalAutomationSuited.length > 0 ? (
              report.whereAiCouldHelp.fitBreakdown.traditionalAutomationSuited.map((t, i) => (
                <Text key={`ta${i}`} style={styles.bullet}>- {s(t)}</Text>
              ))
            ) : (
              <Text style={styles.bodyMuted}>Deterministic calculations, fixed form transfers, scheduled jobs.</Text>
            )}
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Where Human Judgment Remains Essential</Text>
          {report.whereAiCouldHelp.fitBreakdown.humanJudgmentRequired.length > 0 ? (
            report.whereAiCouldHelp.fitBreakdown.humanJudgmentRequired.map((h, i) => (
              <Text key={`hj${i}`} style={styles.bullet}>- {s(h)}</Text>
            ))
          ) : (
            <Text style={styles.bodyMuted}>Final approvals, relationship handling, and high-impact decisions.</Text>
          )}
        </View>

        <Footer />
      </Page>

      {/* PAGE 3: Areas Worth Investigating (0-3 max) */}
      <Page size="A4" style={styles.page}>
        <Header />

        {/* 7. Areas Worth Investigating */}
        <Text style={styles.h1}>7. Areas Worth Investigating</Text>
        <Text style={styles.sectionSub}>
          Candidate opportunities grounded in discovery evidence. Preliminary hypotheses, not implementation guarantees.
        </Text>

        {report.opportunities.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Insufficient Evidence for Opportunity Hypotheses</Text>
            <Text style={styles.body}>
              The preliminary scan did not surface enough verified operational evidence to construct grounded opportunity
              hypotheses. We intentionally avoid manufacturing generic recommendations.
            </Text>
          </View>
        ) : (
          report.opportunities.map((o, i) => (
            <View key={`opp${i}`} style={styles.cardAccent}>
              <View style={styles.badgeRow}>
                <Text style={styles.badge}>OPPORTUNITY {i + 1}</Text>
                <Text style={styles.badgeNavy}>CONFIDENCE: {s(o.evidenceConfidence.toUpperCase())}</Text>
                <Text style={styles.badge}>APPROACH: {s(o.potentialApproach.toUpperCase().replace("_", " "))}</Text>
              </View>
              <Text style={styles.cardTitle}>{s(o.title)}</Text>
              <Text style={styles.body}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Why It Stood Out: </Text>{s(o.whyItStoodOut)}
              </Text>
              <Text style={[styles.body, { marginTop: 2 }]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Potential Value: </Text>{s(o.potentialValue)}
              </Text>
              {o.confidenceReason ? (
                <Text style={[styles.bodyMuted, { marginTop: 1 }]}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Confidence Rationale: </Text>{s(o.confidenceReason)}
                </Text>
              ) : null}
              {o.thingsToWatch && o.thingsToWatch.length > 0 ? (
                <View style={{ marginTop: 3 }}>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#5A5D6A" }}>Things to Watch:</Text>
                  {o.thingsToWatch.map((tw, idx) => (
                    <Text key={`tw${idx}`} style={styles.bullet}>- {s(tw)}</Text>
                  ))}
                </View>
              ) : null}
              {o.whatWeStillNeedToLearn && o.whatWeStillNeedToLearn.length > 0 ? (
                <View style={{ marginTop: 2 }}>
                  <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#5A5D6A" }}>What to investigate next:</Text>
                  {o.whatWeStillNeedToLearn.map((q, idx) => (
                    <Text key={`oq${idx}`} style={styles.bullet}>- {s(q)}</Text>
                  ))}
                </View>
              ) : null}
              {o.evidenceIds && o.evidenceIds.length > 0 ? (
                <Text style={styles.ev}>Evidence: {s(o.evidenceIds.join(", "))}</Text>
              ) : null}
            </View>
          ))
        )}

        <Footer />
      </Page>

      {/* PAGE 4: Uncertainty, Takeaway & Next Steps */}
      <Page size="A4" style={styles.page}>
        <Header />

        {/* 8. What We Still Need to Learn */}
        <Text style={styles.sectionTitle}>8. What We Still Need to Learn</Text>
        <Text style={styles.sectionSub}>Specific diagnostic questions required before determining whether to build or automate.</Text>
        {report.whatWeStillNeedToLearn.length === 0 ? (
          <Text style={styles.bodyMuted}>No open diagnostic questions recorded.</Text>
        ) : (
          report.whatWeStillNeedToLearn.map((u, i) => (
            <View key={`u${i}`} style={{ marginBottom: 4 }}>
              <Text style={styles.bullet}>- <Text style={{ fontFamily: "Helvetica-Bold" }}>{s(u.question)}</Text></Text>
              {u.whyItMatters ? (
                <Text style={[styles.bodyMuted, { marginLeft: 8 }]}>Why it matters: {s(u.whyItMatters)}</Text>
              ) : null}
              {u.evidenceNeeded ? (
                <Text style={[styles.ev, { marginLeft: 8 }]}>Evidence needed: {s(u.evidenceNeeded)}</Text>
              ) : null}
            </View>
          ))
        )}

        {/* 9. Our Takeaway */}
        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>9. Our Takeaway</Text>
        <View style={styles.card}>
          <Text style={[styles.body, { marginBottom: 3 }]}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>What We Understand: </Text>
            {s(report.ourTakeaway.whatWeUnderstand)}
          </Text>
          <Text style={[styles.body, { marginBottom: 3 }]}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>What Is Worth Exploring: </Text>
            {s(report.ourTakeaway.whatAppearsWorthExploring)}
          </Text>
          <Text style={[styles.body, { marginBottom: 3 }]}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>What May Need Improvement First: </Text>
            {s(report.ourTakeaway.whatMayNeedImprovementFirst)}
          </Text>
          <Text style={[styles.body, { marginBottom: 3 }]}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{"What We Don't Know Yet: "}</Text>
            {s(report.ourTakeaway.whatWeDontKnowYet)}
          </Text>
        </View>

        {/* Recommended Next Step */}
        <View style={styles.cardAccent}>
          <Text style={styles.cardTitle}>Recommended Next Step</Text>
          <Text style={styles.body}>{s(report.ourTakeaway.recommendedNextStep)}</Text>
        </View>

        {/* CTA */}
        <View style={{ marginTop: 8 }}>
          <Text style={styles.bodyMuted}>
            To discuss these findings or review operational workflows:{" "}
            <Link src="https://foxandloom.com/contact">foxandloom.com/contact</Link>
          </Text>
        </View>

        <Footer />
      </Page>
    </Document>
  );
}
