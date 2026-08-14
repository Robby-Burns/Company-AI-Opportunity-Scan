import Link from "next/link";
import { content } from "@/content";
import { ContactForm } from "@/components/contact-form";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="container py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight">
          {content.contact.heading}
        </h1>
        <div className="mt-6 h-px w-16 bg-accent" aria-hidden="true" />
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          {content.contact.body}
        </p>

        <div className="mt-10">
          <ContactForm />
        </div>

        <div className="mt-10 rounded-xl border border-border bg-secondary/30 p-6 text-center">
          <p className="text-base font-medium text-foreground">
            {content.contact.secondaryQuestion}
          </p>
          <Link
            href={content.nav.cta.href}
            className="mt-4 inline-flex h-11 items-center rounded-lg bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {content.contact.secondaryCta}
          </Link>
        </div>
      </div>
    </div>
  );
}
