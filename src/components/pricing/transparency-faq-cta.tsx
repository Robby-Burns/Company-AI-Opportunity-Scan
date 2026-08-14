import Link from "next/link";
import { content } from "@/content";

const p = content.pricing;

export function TransparencyFaqCta() {
  return (
    <>
      {/* ── Transparency (navy) ─────────────────────────────────── */}
      <section aria-labelledby="transparency-heading" className="bg-primary text-primary-foreground">
        <div className="container py-20 md:py-24 text-center">
          <h2
            id="transparency-heading"
            className="mx-auto max-w-2xl font-serif text-3xl md:text-4xl font-semibold tracking-tight"
          >
            {p.transparency.heading}
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-primary-foreground/80">
            {p.transparency.body}
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section aria-labelledby="faq-heading" className="border-b border-border/60">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <h2 id="faq-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
              {p.faq.heading}
            </h2>
            <dl className="mt-8 divide-y divide-border/70">
              {p.faq.items.map((item) => (
                <div key={item.q} className="py-6">
                  <dt className="font-serif text-lg font-semibold text-foreground">{item.q}</dt>
                  <dd className="mt-2 text-base leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section aria-label="Start your free review">
        <div className="container py-16 md:py-24 text-center">
          <p className="mx-auto max-w-2xl font-serif text-2xl md:text-3xl font-medium leading-snug text-foreground">
            {p.finalCta.question}
          </p>
          <p className="mt-3 text-lg text-muted-foreground">{p.finalCta.lead}</p>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            {p.finalCta.body}
          </p>
          <Link
            href="/#review"
            className="mt-7 inline-flex h-12 items-center rounded-lg bg-accent px-7 text-base font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {p.finalCta.cta}
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">{p.finalCta.support}</p>
        </div>
      </section>
    </>
  );
}
