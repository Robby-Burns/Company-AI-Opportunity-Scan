import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
  Link
} from "@react-pdf/renderer";
import type { ClientReport } from "@/lib/synthesis";
import { content } from "@/content";

// Use built-in Helvetica (no external font fetch → fast + offline). The friendly
// tone comes from layout/copy, not font choice.
const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 11, color: "#2A2D3A" },
  header: { borderBottomWidth: 2, borderBottomColor: "#BF9036", paddingBottom: 12, marginBottom: 20 },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#2F3359" },
  tagline: { fontSize: 9, color: "#6B6F7A", marginTop: 2 },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#2F3359", marginBottom: 6 },
  meta: { fontSize: 9, color: "#6B6F7A", marginBottom: 18 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#2F3359", marginTop: 14, marginBottom: 6 },
  area: { borderWidth: 1, borderColor: "#E4E1DA", borderRadius: 6, padding: 12, marginBottom: 10, backgroundColor: "#FAF7F0" },
  areaTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#2F3359", marginBottom: 4 },
  body: { fontSize: 10.5, lineHeight: 1.5 },
  example: { fontSize: 10, color: "#5A5D6A", marginTop: 4, fontStyle: "italic" },
  ev: { fontSize: 8, color: "#8A6A1F", marginTop: 6 },
  perspective: { borderWidth: 1, borderColor: "#E4E1DA", borderRadius: 6, padding: 10, marginBottom: 8, backgroundColor: "#FFFFFF" },
  perspectiveTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#2F3359", marginBottom: 3 },
  perspectiveBody: { fontSize: 10, lineHeight: 1.45, color: "#3A3D4A" },
  perspectiveUncertainty: { fontSize: 9.5, color: "#6B6F7A", marginTop: 2, fontStyle: "italic" },
  note: { fontSize: 10, color: "#5A5D6A", marginBottom: 4 },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 8, color: "#9A9DA6", textAlign: "center", borderTopWidth: 1, borderTopColor: "#E4E1DA", paddingTop: 8 }
});

void Font; // Font kept available for future custom-font swap; built-in used now.

/**
 * The PDF uses the built-in Helvetica (PDF standard-14 font, WinAnsiEncoding
 * only). LLM-generated text can contain characters outside that set
 * (e.g. "→", "✓", emoji), which crash @react-pdf/renderer's text engine
 * ("Cannot read properties of undefined (reading 'S')"). This normalizes
 * common Unicode punctuation to ASCII and strips anything else outside
 * ASCII so the PDF always renders, regardless of model output.
 */
function s(value: string | undefined | null): string {
  if (value == null) return "";
  return String(value)
    .replace(/[\u2192\u279C\u2794\u25B6\u21D2\u27A4]/g, "->")
    .replace(/[\u2014\u2013]/g, "-") // em/en dash
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, "\"")
    .replace(/\u2026/g, "...") // ellipsis
    .replace(/[\u2022\u25AA\u25CF]/g, "-") // bullet
    .replace(/[\u2713\u2714\u2717\u2718]/g, "*") // check / cross
       .replace(/[\u00B7]/g, "·") // middle dot is WinAnsi-safe; keep
    .replace(/[^\x00-\x7F\u00B7]/g, "") // strip remaining non-ASCII
    .trim();
}

export function ClientSummaryPdf({ report }: { report: ClientReport }) {
  const date = new Date(report.generatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  return (
    <Document
      title={`${report.company} — AI Readiness Summary`}
      author={content.orgName}
      subject="Client AI Readiness Summary"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>{s(content.orgName)}</Text>
          <Text style={styles.tagline}>Humans helping humans · foxandloom.com</Text>
        </View>

        <Text style={styles.h1}>{s(report.headline)}</Text>
        <Text style={styles.meta}>
          Prepared for {s(report.company)} · {s(report.website)} · {date}
        </Text>

        {/* Company snapshot */}
        {report.companySnapshot ? (
          <>
            <Text style={styles.sectionTitle}>Company snapshot</Text>
            <Text style={styles.body}>{s(report.companySnapshot)}</Text>
          </>
        ) : null}

        {/* What we learned — dimension table */}
        <Text style={styles.sectionTitle}>What we learned</Text>
        {report.dimensionsLearned.length === 0 ? (
          <Text style={styles.body}>
            We did not capture enough supported detail across the five discovery
            dimensions to summarize here. A short call would help us learn more.
          </Text>
        ) : (
          report.dimensionsLearned.map((d, i) => (
            <View key={`d${i}`} style={styles.area}>
              <Text style={styles.areaTitle}>
                {d.label} · confidence: {d.confidence}
              </Text>
              <Text style={styles.body}>{s(d.whatWeLearned)}</Text>
              {d.evidenceIds.length > 0 ? (
                <Text style={styles.ev}>Evidence: {s(d.evidenceIds.join(", "))}</Text>
              ) : null}
            </View>
          ))
        )}

        {/* Potential opportunity areas */}
        <View break={report.dimensionsLearned.length >= 3}>
          <Text style={styles.sectionTitle}>Potential opportunity areas (unranked)</Text>
          {report.opportunities.length === 0 ? (
            <Text style={styles.body}>
              The interview did not surface a clearly supported opportunity worth deeper
              investigation. That is a valid outcome — not every company needs AI or
              automation right now.
            </Text>
          ) : (
            report.opportunities.map((o, i) => (
              <View key={`o${i}`} style={styles.area} break={i > 0 && i % 2 === 0}>
                <Text style={styles.areaTitle}>
                  {i + 1}. {s(o.name)}
                </Text>
                <Text style={styles.body}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>What we heard: </Text>
                  {s(o.whatWeHeard)}
                </Text>
                <Text style={styles.body}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Why it may matter: </Text>
                  {s(o.whyItMayMatter)}
                </Text>
                <Text style={styles.ev}>Evidence: {s(o.evidenceIds.join(", "))}</Text>
                {o.whatRemainsUnknown.length > 0 ? (
                  <Text style={styles.example}>
                    What remains unknown: {s(o.whatRemainsUnknown.join("; "))}
                  </Text>
                ) : null}
                {o.recommendedDeeperInvestigation.length > 0 ? (
                  <Text style={styles.example}>
                    Recommended deeper investigation: {s(o.recommendedDeeperInvestigation.join("; "))}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* Questions worth investigating */}
        {report.questionsWorthInvestigating.length > 0 ? (
          <View break={report.opportunities.length >= 2}>
            <Text style={styles.sectionTitle}>Questions worth investigating</Text>
            {report.questionsWorthInvestigating.map((q, i) => (
              <Text key={`q${i}`} style={styles.note}>
                • {s(q)}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Remaining uncertainty */}
        {report.remainingUncertainty.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Remaining uncertainty</Text>
            {report.remainingUncertainty.map((u, i) => (
              <View key={`u${i}`} style={styles.perspective}>
                <Text style={styles.perspectiveTitle}>Unknown: {s(u.unknown)}</Text>
                <Text style={styles.perspectiveBody}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Why it matters: </Text>
                  {s(u.whyItMatters)}
                </Text>
                <Text style={styles.perspectiveBody}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Evidence needed: </Text>
                  {s(u.evidenceNeeded)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>What&apos;s next</Text>
        <Text style={styles.body}>
          {s(report.whatsNext)}{" "}
          <Link src="https://foxandloom.com/contact">foxandloom.com/contact</Link>
        </Text>

        <Text style={styles.footer} fixed>
          {content.orgName} · {content.contactInfo.phone} · Generated {date}. Every claim in this report is traced to stored
          evidence; unsupported claims are omitted.
        </Text>
      </Page>
    </Document>
  );
}
