import Image from "next/image";
import { content } from "@/content";
import { ReviewForm } from "@/components/review-form";

export default function HomePage() {
  return (
    <div>
      {/* ───────────────────────── HERO ───────────────────────── */}
      <section
        id="hero"
        className="relative overflow-hidden border-b border-border/60"
        aria-labelledby="hero-heading"
      >
        <div className="container grid gap-12 py-16 md:py-24 lg:grid-cols-2 lg:gap-16 lg:items-center">
          {/* Hero copy */}
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 rounded-full object-cover ring-1 ring-accent/30"
                priority
              />
              <span className="font-serif text-sm font-semibold tracking-[0.22em] uppercase text-muted-foreground">
                The Fox & Loom
              </span>
            </div>

            <h1
              id="hero-heading"
              className="mt-8 font-serif text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight text-balance"
            >
              {content.hero.headline}
            </h1>
            <div className="mt-6 h-px w-16 bg-accent" aria-hidden="true" />

            <p className="mt-6 text-lg md:text-xl leading-relaxed text-foreground/90">
              {content.hero.lead}
            </p>
            <p className="mt-3 text-base md:text-lg leading-relaxed text-muted-foreground">
              {content.hero.qualifier}
            </p>

            <div className="mt-8 flex flex-col items-start gap-2">
              <a
                href="#review"
                className="inline-flex h-12 items-center rounded-lg bg-accent px-7 text-base font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {content.hero.cta}
              </a>
              <p className="text-sm text-muted-foreground">{content.hero.ctaSupport}</p>
            </div>
          </div>

          {/* Review card — immediately visible beside the hero copy */}
          <div id="review" className="scroll-mt-24">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
              <p className="font-serif text-2xl font-semibold tracking-tight text-foreground">
                {content.review.heading}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {content.review.body}
              </p>
              <div className="mt-6">
                <ReviewForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────── PAIN POINTS ───────────────────── */}
      <section aria-labelledby="pain-heading" className="border-b border-border/60">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <h2 id="pain-heading" className="font-serif text-3xl md:text-4xl font-semibold tracking-tight">
              {content.painPoints.heading}
            </h2>
            <ul className="mt-8 divide-y divide-border/70">
              {content.painPoints.items.map((item) => (
                <li key={item.title} className="flex gap-4 py-5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-muted-foreground leading-relaxed">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────────────── PHILOSOPHY ───────────────────── */}
      <section
        aria-labelledby="philosophy-heading"
        className="bg-primary text-primary-foreground"
      >
        <div className="container py-20 md:py-28 text-center">
          <h2
            id="philosophy-heading"
            className="mx-auto max-w-3xl font-serif text-4xl md:text-5xl font-semibold leading-[1.1] tracking-tight"
          >
            {content.philosophy.heading[0]}
            <br />
            {content.philosophy.heading[1]}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-primary-foreground/80">
            {content.philosophy.body}
          </p>
          <ul className="mx-auto mt-8 max-w-md space-y-2 text-lg text-primary-foreground/90">
            {content.philosophy.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-8 font-serif text-2xl text-accent">{content.philosophy.closer}</p>
        </div>
      </section>

      {/* ───────────────────── PROCESS ───────────────────── */}
      <section aria-labelledby="process-heading" className="border-b border-border/60">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <h2 id="process-heading" className="font-serif text-3xl md:text-4xl font-semibold tracking-tight">
              {content.process.heading}
            </h2>
            <ol className="mt-8 divide-y divide-border/70">
              {content.process.steps.map((step) => (
                <li key={step.n} className="grid grid-cols-[auto_1fr] gap-x-5 py-6">
                  <div className="flex flex-col items-center">
                    <span className="font-serif text-lg font-semibold text-accent">{step.n}</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
                        {step.tag}
                      </span>
                      {step.tagNote && (
                        <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-accent">
                          {step.tagNote}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-base font-medium text-foreground">{step.title}</p>
                    <p className="mt-1 text-muted-foreground leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ───────────────────── TRUST ───────────────────── */}
      <section aria-labelledby="trust-heading" className="border-b border-border/60">
        <div className="container py-16 md:py-24 text-center">
          <h2 id="trust-heading" className="mx-auto max-w-2xl font-serif text-3xl md:text-4xl font-semibold tracking-tight">
            {content.trust.heading}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {content.trust.body}
          </p>
          <ul className="mx-auto mt-6 max-w-md space-y-2 text-lg text-foreground/90">
            {content.trust.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-muted-foreground">
            {content.trust.closer}
          </p>
        </div>
      </section>

      {/* ───────────────────── FINAL CTA ───────────────────── */}
      <section aria-label="Start your free review">
        <div className="container py-16 md:py-24 text-center">
          <p className="mx-auto max-w-2xl font-serif text-2xl md:text-3xl font-medium leading-snug text-foreground">
            {content.finalCta.question}
          </p>
          <p className="mt-3 text-lg text-muted-foreground">{content.finalCta.lead}</p>
          <a
            href="#review"
            className="mt-7 inline-flex h-12 items-center rounded-lg bg-accent px-7 text-base font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {content.finalCta.cta}
          </a>
          <p className="mt-4 text-sm text-muted-foreground">{content.finalCta.support}</p>
        </div>
      </section>
    </div>
  );
}
