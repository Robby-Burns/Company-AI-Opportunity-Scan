import { content } from "@/content";
import { env } from "@/lib/env";
import { ContactForm } from "@/components/contact-form";
import { Phone, Mail } from "lucide-react";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  const phoneHref = `tel:${content.contact.phone.replace(/[.\s]/g, "")}`;
  const email = env.contactEmail;
  const emailHref = `mailto:${email}`;
  return (
    <div className="container py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Let&apos;s talk</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Questions about your scan, or want to book a deeper strategy session? Reach us directly or send a note below.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a
            href={phoneHref}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-accent/10 transition-colors"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Phone className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xs text-muted-foreground">Call</span>
              <span className="font-medium">{content.contact.phone}</span>
            </span>
          </a>
          <a
            href={emailHref}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-accent/10 transition-colors"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Mail className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xs text-muted-foreground">Email</span>
              <span className="font-medium">{email}</span>
            </span>
          </a>
        </div>

        <div className="mt-10">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
