import { OpportunityScanFunnel } from "@/components/opportunity-scan-funnel";

export const metadata = { title: "AI Opportunity Scan", robots: { index: false, follow: false } };

/**
 * Preserved internal Company Opportunity Scan experience.
 *
 * The public site uses the human-led Free AI Readiness Review instead. This
 * route keeps the automated research + interview + report machinery functional
 * and available for later wiring, but is intentionally not linked from the
 * marketing navigation.
 */
export default function ScanPage() {
  return (
    <div className="container py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight">
          AI Opportunity Scan
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          An automated, self-service scan of public information followed by a
          short adaptive interview. You get an instant downloadable summary.
        </p>
      </div>
      <div className="mt-10">
        <OpportunityScanFunnel />
      </div>
    </div>
  );
}
