import { content } from "@/content";
import { AssessmentSection } from "@/components/pricing/assessment-section";
import { ImplementationSection } from "@/components/pricing/implementation-section";
import { ScopeSections } from "@/components/pricing/scope-sections";
import { TransparencyFaqCta } from "@/components/pricing/transparency-faq-cta";

export const metadata = { title: "Pricing" };

const p = content.pricing;

export default function PricingPage() {
  return (
    <div>
      {/* Core message */}
      <section className="border-b border-border/60">
        <div className="container py-16 md:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Pricing</p>
            <h1 className="mt-4 font-serif text-4xl md:text-5xl font-semibold leading-[1.08] tracking-tight">
              {p.coreMessage}
            </h1>
            <div className="mt-6 h-px w-16 bg-accent" aria-hidden="true" />
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{p.intro}</p>
          </div>
        </div>
      </section>

      <AssessmentSection />
      <ImplementationSection />
      <ScopeSections />
      <TransparencyFaqCta />
    </div>
  );
}
