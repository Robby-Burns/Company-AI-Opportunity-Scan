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
    paddingTop: 36,
    paddingBottom: 44,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#2A2D3A",
    backgroundColor: "#FFFFFF"
  },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#BF9036",
    paddingBottom: 8,
    marginBottom: 12
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
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8
  },
  brandTitleBlock: {
    flexDirection: "column"
  },
  brand: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#2F3359",
    letterSpacing: 0.5
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
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#2F3359",
    marginBottom: 3,
    marginTop: 2
  },
  meta: {
    fontSize: 8.5,
    color: "#6B6F7A",
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#2F3359",
    marginTop: 8,
    marginBottom: 4
  },
  sectionSub: {
    fontSize: 8.5,
    color: "#5A5D6A",
    marginBottom: 5
  },
  card: {
    borderWidth: 1,
    borderColor: "#E4E1DA",
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
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
    fontSize: 10,
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
    fontSize: 7.5,
    color: "#8A6A1F",
    fontFamily: "Helvetica-Bold",
    marginRight: 8
  },
  body: {
    fontSize: 9,
    lineHeight: 1.4,
    color: "#2A2D3A"
  },
  bodyMuted: {
    fontSize: 8.5,
    lineHeight: 1.35,
    color: "#5A5D6A",
    marginTop: 2
  },
  ev: {
    fontSize: 7.5,
    color: "#8A6A1F",
    marginTop: 2
  },
  bullet: {
    fontSize: 9,
    lineHeight: 1.35,
    color: "#3A3D4A",
    marginBottom: 2
  },
  gridTwoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  colHalf: {
    width: "48%"
  },
  flowStep: {
    borderLeftWidth: 2,
    borderLeftColor: "#BF9036",
    paddingLeft: 8,
    marginBottom: 6
  },
  flowStageName: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: "#2F3359"
  },
  flowFriction: {
    fontSize: 8.5,
    color: "#4A4D5A",
    marginTop: 1
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: "#9A9DA6",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#E4E1DA",
    paddingTop: 4
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
    .replace(/[\u00B7]/g, "·")
    .replace(/[^\x00-\x7F\u00B7]/g, "")
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
            <Text style={styles.tagline}>Humans helping humans · foxandloom.com</Text>
          </View>
        </View>
        <Text style={styles.headerBadge}>PRELIMINARY AI OPPORTUNITY SCAN</Text>
      </View>
    </View>
  );

  const Footer = () => (
    <Text style={styles.footer} fixed>
      {content.orgName} · {content.contactInfo.phone} · Generated {date} · Every claim in this report traces to stored evidence.
    </Text>
  );

  return (
    <Document
      title={`${report.company} — Company AI Opportunity Scan`}
      author={content.orgName}
      subject="Preliminary Company AI Opportunity Scan & Map"
    >
      {/* PAGE 1: Context & Discovery */}
      <Page size="A4" style={styles.page}>
        <Header />
        <Text style={styles.h1}>{s(report.headline)}</Text>
        <Text style={styles.meta}>
          Prepared for {[report.company, report.location, report.website].filter(Boolean).map((v) => s(v!)).join(" · ")} · {date}
        </Text>

        {/* 1. Your Business */}
        <Text style={styles.sectionTitle}>1. Your Business</Text>
        <Text style={styles.body}>{s(report.yourBusiness)}</Text>

        {/* 2. What We Heard */}
        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>2. What We Heard</Text>
        {report.whatWeHeard.length === 0 ? (
          <Text style={styles.bodyMuted}>No specific operational statements were recorded during the scan.</Text>
        ) : (
          report.whatWeHeard.map((w, i) => (
            <View key={`w${i}`} style={{ marginBottom: 3 }}>
              <Text style={styles.bullet}>• {s(w.observation)}</Text>
              {w.evidenceIds.length > 0 ? (
                <Text style={[styles.ev, { marginLeft: 8 }]}>Evidence: {s(w.evidenceIds.join(", "))}</Text>
              ) : null}
            </View>
          ))
        )}

        {/* 3. Where You Are on Your AI Journey */}
        <Text style={[styles.sectionTitle, { marginTop: 10 }]}>3. Where You Are on Your AI Journey</Text>
        <View style={styles.card}>
          <Text style={styles.badge}>STAGE: {s(report.aiJourney.stage.toUpperCase())}</Text>
          <Text style={styles.body}>{s(report.aiJourney.explanation)}</Text>
        </View>

        {/* 4. AI Culture & Adoption Considerations */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>4. AI Culture & Adoption Considerations</Text>
        <View style={styles.gridTwoCol}>
          <View style={styles.colHalf}>
            <Text style={[styles.cardTitle, { fontSize: 9 }]}>What May Support Adoption</Text>
            {report.aiCulture.whatMayHelp.map((h, i) => (
              <Text key={`h${i}`} style={styles.bullet}>• {s(h)}</Text>
            ))}
          </View>
          <View style={styles.colHalf}>
            <Text style={[styles.cardTitle, { fontSize: 9 }]}>What May Require Care</Text>
            {report.aiCulture.whatMayMakeAdoptionHarder.map((c, i) => (
              <Text key={`c${i}`} style={styles.bullet}>• {s(c)}</Text>
            ))}
          </View>
        </View>
        <Text style={[styles.bodyMuted, { marginTop: 3 }]}>{s(report.aiCulture.whereAiMayHelp)}</Text>

        <Footer />
      </Page>

      {/* PAGE 2: Information & Technology Landscape */}
      <Page size="A4" style={styles.page}>
        <Header />

        {/* 5. Your Data */}
        <Text style={styles.sectionTitle}>5. Your Data</Text>
        <Text style={styles.sectionSub}>Understanding where information lives across workflows and files.</Text>
        {report.yourData.dataIdentified.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.body}>Insufficient evidence to map specific operational data stores.</Text>
          </View>
        ) : (
          report.yourData.dataIdentified.map((d, i) => (
            <View key={`d${i}`} style={styles.card}>
              <Text style={styles.cardTitle}>{s(d.data)}</Text>
              <Text style={styles.body}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Location: </Text>{s(d.location)}
              </Text>
              {d.relevance ? (
                <Text style={styles.bodyMuted}>Role: {s(d.relevance)}</Text>
              ) : null}
            </View>
          ))
        )}
        <Text style={[styles.body, { marginTop: 4, marginBottom: 12 }]}>{s(report.yourData.whyThisMatters)}</Text>

        {/* 9. Your Technology Environment */}
        <Text style={styles.sectionTitle}>9. Your Technology Environment</Text>
        <Text style={styles.sectionSub}>Platforms, tools, and cross-system handoffs identified.</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Identified Systems</Text>
          <Text style={styles.body}>
            {report.technologyEnvironment.systems.length > 0
              ? s(report.technologyEnvironment.systems.join(" · "))
              : "No specific commercial software platforms were named during discovery."}
          </Text>
        </View>
        {report.technologyEnvironment.crossSystemFlow.length > 0 ? (
          <View style={{ marginTop: 4 }}>
            <Text style={[styles.cardTitle, { fontSize: 9.5 }]}>Cross-System Information Flow</Text>
            {report.technologyEnvironment.crossSystemFlow.map((f, i) => (
              <Text key={`f${i}`} style={styles.bullet}>• {s(f)}</Text>
            ))}
          </View>
        ) : null}

        <Footer />
      </Page>

      {/* PAGE 3: Operational Flow & Opportunity Map */}
      <Page size="A4" style={styles.page}>
        <Header />

        {/* 6. AI Opportunity Map */}
        <Text style={styles.h1}>6. AI Opportunity Map</Text>
        <Text style={styles.sectionSub}>
          How work moves across the organization, highlighting where handoffs or repetitive friction occur.
        </Text>

        {report.opportunityMap.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.body}>
              Insufficient operational detail to construct a full workflow map from current evidence.
            </Text>
          </View>
        ) : (
          report.opportunityMap.map((stage, i) => (
            <View key={`stg${i}`} style={styles.flowStep}>
              <Text style={styles.flowStageName}>Stage {i + 1}: {s(stage.stage)}</Text>
              <Text style={styles.flowFriction}>{s(stage.friction)}</Text>
              {stage.evidenceIds && stage.evidenceIds.length > 0 ? (
                <Text style={styles.ev}>Evidence: {s(stage.evidenceIds.join(", "))}</Text>
              ) : null}
            </View>
          ))
        )}

        <Footer />
      </Page>

      {/* PAGE 4: Work Patterns & Intervention Fit */}
      <Page size="A4" style={styles.page}>
        <Header />

        {/* 7. Where AI May Help */}
        <Text style={styles.sectionTitle}>7. Where AI May Help</Text>
        <Text style={styles.sectionSub}>Identifying specific repetitive, administrative, or coordination areas where AI may assist.</Text>
        {report.aiLeverage.length === 0 ? (
          <Text style={styles.bodyMuted}>No specific repetitive friction patterns met the evidence threshold.</Text>
        ) : (
          report.aiLeverage.map((l, i) => (
            <View key={`l${i}`} style={styles.card}>
              <Text style={styles.badge}>{s(l.category.toUpperCase())}</Text>
              <Text style={styles.body}>{s(l.observation)}</Text>
              {l.evidenceIds.length > 0 ? (
                <Text style={styles.ev}>Evidence: {s(l.evidenceIds.join(", "))}</Text>
              ) : null}
            </View>
          ))
        )}

        {/* 8. Where AI Fits */}
        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>8. Where AI Fits</Text>
        <Text style={styles.sectionSub}>Comparing AI, traditional automation, and human judgment.</Text>
        <View style={styles.gridTwoCol}>
          <View style={[styles.card, styles.colHalf]}>
            <Text style={styles.cardTitle}>Where AI Fits</Text>
            {report.aiFit.wellSuited.length > 0 ? (
              report.aiFit.wellSuited.map((w, i) => <Text key={`ws${i}`} style={styles.bullet}>• {s(w)}</Text>)
            ) : (
              <Text style={styles.bodyMuted}>Unstructured text, doc search, variable communication.</Text>
            )}
          </View>
          <View style={[styles.card, styles.colHalf]}>
            <Text style={styles.cardTitle}>Traditional Automation</Text>
            {report.aiFit.traditionalAutomationSuited.length > 0 ? (
              report.aiFit.traditionalAutomationSuited.map((t, i) => <Text key={`ta${i}`} style={styles.bullet}>• {s(t)}</Text>)
            ) : (
              <Text style={styles.bodyMuted}>Deterministic calculations, fixed form transfers.</Text>
            )}
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Where Human Judgment Remains Essential</Text>
          {report.aiFit.humanJudgmentRequired.length > 0 ? (
            report.aiFit.humanJudgmentRequired.map((h, i) => <Text key={`hj${i}`} style={styles.bullet}>• {s(h)}</Text>)
          ) : (
            <Text style={styles.bodyMuted}>Final quote approvals, customer relationships, complex custom design decisions.</Text>
          )}
        </View>

        <Footer />
      </Page>

      {/* PAGE 5: Priority Opportunities */}
      <Page size="A4" style={styles.page}>
        <Header />

        {/* 10. Areas Worth Investigating */}
        <Text style={styles.h1}>10. Areas Worth Investigating</Text>
        <Text style={styles.sectionSub}>
          Candidate opportunities grounded in discovery evidence.
        </Text>

        {report.opportunities.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Insufficient Evidence for Opportunity Hypotheses</Text>
            <Text style={styles.body}>
              The scan did not surface enough detailed operational evidence to form high-confidence opportunity
              hypotheses. We intentionally avoid manufacturing generic recommendations.
            </Text>
          </View>
        ) : (
          report.opportunities.map((o, i) => (
            <View key={`opp${i}`} style={styles.cardAccent}>
              <View style={styles.badgeRow}>
                <Text style={styles.badge}>OPPORTUNITY {i + 1}</Text>
                <Text style={[styles.badge, { color: "#2F3359" }]}>SUPPORT: {s(o.evidenceStrength.toUpperCase())}</Text>
                <Text style={styles.badge}>FIT: {s(o.interventionFit.toUpperCase())}</Text>
              </View>
              <Text style={styles.cardTitle}>{s(o.title)}</Text>
              <Text style={styles.body}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Observation: </Text>{s(o.observation)}
              </Text>
              <Text style={[styles.body, { marginTop: 2 }]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Why It Matters: </Text>{s(o.whyItMatters)}
              </Text>
              <Text style={[styles.body, { marginTop: 2 }]}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>AI / Automation Role: </Text>{s(o.whereAiFits)}
              </Text>
              {o.whatWeStillNeedToLearn.length > 0 ? (
                <View style={{ marginTop: 3 }}>
                  <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#5A5D6A" }}>What to investigate next:</Text>
                  {o.whatWeStillNeedToLearn.map((q, idx) => (
                    <Text key={`oq${idx}`} style={styles.bullet}>• {s(q)}</Text>
                  ))}
                </View>
              ) : null}
              {o.evidenceIds.length > 0 ? (
                <Text style={styles.ev}>Evidence: {s(o.evidenceIds.join(", "))}</Text>
              ) : null}
            </View>
          ))
        )}

        <Footer />
      </Page>

      {/* PAGE 6: Diagnostic Roadmap & Next Steps */}
      <Page size="A4" style={styles.page}>
        <Header />

        {/* 11. What We Still Need to Learn */}
        <Text style={styles.sectionTitle}>11. What We Still Need to Learn</Text>
        <Text style={styles.sectionSub}>Specific diagnostic questions required to evaluate feasibility and impact.</Text>
        {report.whatWeStillNeedToLearn.length === 0 ? (
          <Text style={styles.bodyMuted}>No open diagnostic questions recorded.</Text>
        ) : (
          report.whatWeStillNeedToLearn.map((u, i) => (
            <View key={`u${i}`} style={{ marginBottom: 5 }}>
              <Text style={styles.bullet}>• <Text style={{ fontFamily: "Helvetica-Bold" }}>{s(u.question)}</Text></Text>
              {u.whyWeNeedToKnow ? (
                <Text style={[styles.bodyMuted, { marginLeft: 8 }]}>Why we need to know: {s(u.whyWeNeedToKnow)}</Text>
              ) : null}
            </View>
          ))
        )}

        {/* 12. Preliminary AI Analyst View */}
        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>12. Preliminary AI Analyst View</Text>
        <View style={styles.card}>
          <Text style={styles.body}>{s(report.analystView.summary)}</Text>
          <Text style={[styles.body, { marginTop: 6, fontFamily: "Helvetica-Bold" }]}>
            {s(report.analystView.deepAssessmentRecommendation)}
          </Text>
        </View>

        {/* CTA */}
        <View style={{ marginTop: 12 }}>
          <Text style={styles.body}>
            To review this opportunity map or schedule the full Deep Assessment:{" "}
            <Link src="https://foxandloom.com/contact">foxandloom.com/contact</Link>
          </Text>
        </View>

        <Footer />
      </Page>
    </Document>
  );
}
