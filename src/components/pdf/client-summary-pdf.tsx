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
  note: { fontSize: 10, color: "#5A5D6A", marginBottom: 4 },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, fontSize: 8, color: "#9A9DA6", textAlign: "center", borderTopWidth: 1, borderTopColor: "#E4E1DA", paddingTop: 8 }
});

void Font; // Font kept available for future custom-font swap; built-in used now.

export function ClientSummaryPdf({ report }: { report: ClientReport }) {
  const date = new Date(report.generatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  return (
    <Document
      title={`${report.company} — AI Opportunity Summary`}
      author={content.orgName}
      subject="Client AI Opportunity Summary"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>{content.orgName}</Text>
          <Text style={styles.tagline}>Humans helping humans with AI · foxandloom.com</Text>
        </View>

        <Text style={styles.h1}>{report.headline}</Text>
        <Text style={styles.meta}>
          Prepared for {report.company} · {report.website} · {date}
        </Text>

        <Text style={styles.sectionTitle}>Your AI opportunity areas (unranked)</Text>
        {report.areas.length === 0 ? (
          <Text style={styles.body}>
            We couldn&apos;t surface enough supported opportunity areas from the available evidence. We&apos;d love to learn more
            in a short call.
          </Text>
        ) : (
          report.areas.map((a, i) => (
            <View key={i} style={styles.area} break={i > 0 && i % 2 === 0}>
              <Text style={styles.areaTitle}>
                {i + 1}. {a.title}
              </Text>
              <Text style={styles.body}>{a.summary}</Text>
              {a.example ? <Text style={styles.example}>For example: {a.example}</Text> : null}
              <Text style={styles.ev}>Evidence: {a.evidenceIds.join(", ")}</Text>
            </View>
          ))
        )}

        {report.notReadyNotes.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Where AI may not be the fit (yet)</Text>
            {report.notReadyNotes.map((n, i) => (
              <Text key={i} style={styles.note}>
                • {n}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>What&apos;s next</Text>
        <Text style={styles.body}>
          This is a high-level snapshot, not a build plan. Book a free strategy session with our human team and we&apos;ll dig
          into the specifics — and tell you honestly where AI won&apos;t help.{" "}
          <Link src="https://foxandloom.com/contact">foxandloom.com/contact</Link>
        </Text>

        <Text style={styles.footer} fixed>
          {content.orgName} · {content.contact.phone} · Generated {date}. Every claim in this report is traced to stored
          evidence; unsupported claims are omitted.
        </Text>
      </Page>
    </Document>
  );
}
