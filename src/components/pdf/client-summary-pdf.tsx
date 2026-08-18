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

// Use built-in Helvetica (fast + offline).
const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 10, color: "#2A2D3A" },
  header: { borderBottomWidth: 1.5, borderBottomColor: "#BF9036", paddingBottom: 10, marginBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandGroup: { flexDirection: "row", alignItems: "center" },
  logo: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  brandTitleBlock: { flexDirection: "column" },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#2F3359", letterSpacing: 0.5 },
  tagline: { fontSize: 8, color: "#6B6F7A", marginTop: 1 },
  headerBadge: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#8A6A1F", letterSpacing: 0.8 },
  h1: { fontSize: 17, fontFamily: "Helvetica-Bold", color: "#2F3359", marginBottom: 3, marginTop: 4 },
  meta: { fontSize: 8.5, color: "#6B6F7A", marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#2F3359", marginTop: 10, marginBottom: 4 },
  card: { borderWidth: 1, borderColor: "#E4E1DA", borderRadius: 4, padding: 9, marginBottom: 7, backgroundColor: "#FAF7F0" },
  cardTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: "#2F3359", marginBottom: 2 },
  badge: { fontSize: 7.5, color: "#8A6A1F", fontFamily: "Helvetica-Bold", marginBottom: 2 },
  body: { fontSize: 9.5, lineHeight: 1.45, color: "#2A2D3A" },
  bodyMuted: { fontSize: 9, lineHeight: 1.4, color: "#5A5D6A", marginTop: 2 },
  ev: { fontSize: 7.5, color: "#8A6A1F", marginTop: 3 },
  bullet: { fontSize: 9.5, lineHeight: 1.4, color: "#3A3D4A", marginBottom: 2.5 },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 7.5, color: "#9A9DA6", textAlign: "center", borderTopWidth: 1, borderTopColor: "#E4E1DA", paddingTop: 5 }
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

  return (
    <Document
      title={`${report.company} — Company AI Opportunity Scan`}
      author={content.orgName}
      subject="Company AI Opportunity Scan"
    >
      <Page size="A4" style={styles.page}>
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
            <Text style={styles.headerBadge}>AI OPPORTUNITY SCAN</Text>
          </View>
        </View>

        <Text style={styles.h1}>{s(report.headline)}</Text>
        <Text style={styles.meta}>
          Prepared for {s(report.company)} · {s(report.website)} · {date}
        </Text>

        {/* Company snapshot */}
        {report.companySnapshot ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.body}>{s(report.companySnapshot)}</Text>
          </View>
        ) : null}

        {/* 1. Opportunity Hypothesis */}
        <Text style={styles.sectionTitle}>1. Opportunity Hypothesis</Text>
        {report.hypothesis ? (
          <View style={styles.card}>
            <Text style={styles.badge}>
              CONFIDENCE (WORTH INVESTIGATING): {s(report.hypothesis.confidence.toUpperCase())}
            </Text>
            <Text style={styles.cardTitle}>{s(report.hypothesis.title)}</Text>
            <Text style={styles.body}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Process Locus: </Text>
              {s(report.hypothesis.locus)}
            </Text>
            <Text style={[styles.body, { marginTop: 3 }]}>{s(report.hypothesis.summary)}</Text>
            {report.hypothesis.evidenceIds.length > 0 ? (
              <Text style={styles.ev}>Evidence: {s(report.hypothesis.evidenceIds.join(", "))}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>
              The scan did not surface a clearly supported opportunity hypothesis. That is a valid
              and positive outcome — not every operational area needs an immediate technology intervention.
            </Text>
          </View>
        )}

        {/* 2. Why We Identified It */}
        <Text style={styles.sectionTitle}>2. Why We Identified It</Text>
        {report.whyIdentified.length === 0 ? (
          <Text style={styles.body}>Evidence captured in the scan did not indicate acute friction.</Text>
        ) : (
          report.whyIdentified.map((w, i) => (
            <View key={`w${i}`} style={{ marginBottom: 4 }}>
              <Text style={styles.bullet}>• {s(w.observation)}</Text>
              {w.evidenceIds.length > 0 ? (
                <Text style={[styles.ev, { marginLeft: 8 }]}>Evidence: {s(w.evidenceIds.join(", "))}</Text>
              ) : null}
            </View>
          ))
        )}

        {/* 3. Potential Impact */}
        <Text style={styles.sectionTitle}>3. Potential Impact (Directional)</Text>
        {report.potentialImpact.length === 0 ? (
          <Text style={styles.body}>Directional impact will be evaluated during the Deep Assessment.</Text>
        ) : (
          report.potentialImpact.map((p, i) => (
            <View key={`p${i}`} style={{ marginBottom: 4 }}>
              <Text style={styles.bullet}>
                • <Text style={{ fontFamily: "Helvetica-Bold" }}>{s(p.area)}: </Text>
                {s(p.directionalImpact)}
              </Text>
              {p.evidenceIds.length > 0 ? (
                <Text style={[styles.ev, { marginLeft: 8 }]}>Evidence: {s(p.evidenceIds.join(", "))}</Text>
              ) : null}
            </View>
          ))
        )}

        {/* 4. Additional Signals */}
        {report.additionalSignals.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>4. Additional Signals</Text>
            {report.additionalSignals.map((a, i) => (
              <View key={`a${i}`} style={{ marginBottom: 4 }}>
                <Text style={styles.bullet}>• {s(a.signal)}</Text>
                {a.evidenceIds.length > 0 ? (
                  <Text style={[styles.ev, { marginLeft: 8 }]}>Evidence: {s(a.evidenceIds.join(", "))}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* 5. What Remains Unknown */}
        {report.whatRemainsUnknown.length > 0 ? (
          <View break={report.additionalSignals.length > 2}>
            <Text style={styles.sectionTitle}>5. What Remains Unknown</Text>
            {report.whatRemainsUnknown.map((u, i) => (
              <View key={`u${i}`} style={{ marginBottom: 4 }}>
                <Text style={styles.bullet}>
                  • <Text style={{ fontFamily: "Helvetica-Bold" }}>{s(u.unknown)}: </Text>
                  {s(u.whyItMatters)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* 6. What a Deep Assessment Would Investigate */}
        {report.deepAssessmentQuestions.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>6. What a Deep Assessment Would Investigate</Text>
            {report.deepAssessmentQuestions.map((q, i) => (
              <Text key={`q${i}`} style={styles.bullet}>
                • {s(q)}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Next Steps */}
        <View style={{ marginTop: 10 }}>
          <Text style={styles.sectionTitle}>What&apos;s Next</Text>
          <Text style={styles.body}>
            {s(report.whatsNext)}{" "}
            <Link src="https://foxandloom.com/contact">foxandloom.com/contact</Link>
          </Text>
        </View>

        <Text style={styles.footer} fixed>
          {content.orgName} · {content.contactInfo.phone} · Generated {date}. Every claim in this report traces to stored
          evidence; unsupported claims are omitted.
        </Text>
      </Page>
    </Document>
  );
}
