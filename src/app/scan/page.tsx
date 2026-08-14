import { OpportunityScanFunnel } from "@/components/opportunity-scan-funnel";

export const metadata = { title: "AI Readiness Review", robots: { index: false, follow: false } };

/**
 * Preserved internal automated review experience (noindex, unlinked from nav).
 *
 * The public homepage now runs this same funnel as the Free AI Readiness
 * Review. This route keeps the automated research + interview + report
 * machinery independently reachable for testing and later wiring, but is
 * intentionally not linked from the marketing navigation.
 */
export default function ScanPage() {
  return (
    <div className="container py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <OpportunityScanFunnel />
      </div>
    </div>
  );
}
