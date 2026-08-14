import Image from "next/image";
import Link from "next/link";
import { content } from "@/content";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div>
      {/* Intro */}
      <section className="border-b border-border/60">
        <div className="container py-16 md:py-24">
          <div className="max-w-3xl">
            <Image
              src="/logo.png"
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-full object-cover ring-1 ring-accent/30"
            />
            <h1 className="mt-8 font-serif text-4xl md:text-5xl font-semibold tracking-tight">
              {content.about.lead}
            </h1>
            <div className="mt-6 h-px w-16 bg-accent" aria-hidden="true" />
            <p className="mt-6 text-lg md:text-xl leading-relaxed text-muted-foreground">
              {content.about.body}
            </p>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section aria-labelledby="principles-heading" className="border-b border-border/60">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <h2 id="principles-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
              What we believe
            </h2>
            <ul className="mt-8 divide-y divide-border/70">
              {content.about.principles.map((p) => (
                <li key={p.title} className="py-5">
                  <p className="font-serif text-lg font-semibold text-foreground">{p.title}</p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Positioning */}
      <section className="bg-primary text-primary-foreground">
        <div className="container py-20 md:py-24 text-center">
          <p className="mx-auto max-w-3xl font-serif text-2xl md:text-3xl font-medium leading-snug">
            {content.about.positioning}
          </p>
        </div>
      </section>

      {/* Closing CTA */}
      <section aria-label="Start your free review">
        <div className="container py-16 md:py-24 text-center">
          <p className="font-serif text-xl md:text-2xl font-medium text-foreground">
            {content.about.closingCtaQuestion}
          </p>
          <Link
            href={content.nav.cta.href}
            className="mt-6 inline-flex h-12 items-center rounded-lg bg-accent px-7 text-base font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {content.about.closingCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
