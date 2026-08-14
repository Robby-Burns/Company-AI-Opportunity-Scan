import Image from "next/image";
import { content } from "@/content";
import { OpportunityScanFunnel } from "@/components/opportunity-scan-funnel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, ShieldCheck, Clock, FileDown } from "lucide-react";

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-gradient text-primary-foreground" aria-labelledby="hero-heading">
        <div className="container relative z-10 py-20 md:py-28 text-center">
          <Image
            src="/logo.png"
            alt=""
            width={96}
            height={96}
            className="mx-auto mb-6 h-24 w-24 rounded-2xl object-cover shadow-lg ring-2 ring-accent/40"
            priority
          />
          <h1 id="hero-heading" className="mx-auto max-w-3xl text-4xl md:text-6xl font-bold tracking-tight text-balance">
            {content.hero.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl text-primary-foreground/85 leading-relaxed">
            {content.hero.subheadline}
          </p>
          <a
            href="#scan"
            className="mt-8 inline-flex h-12 items-center rounded-lg bg-accent px-8 text-base font-semibold text-accent-foreground hover:bg-accent/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            Start your free scan
          </a>
        </div>
        {/* subtle gold glow */}
        <div className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
      </section>

      {/* Value props */}
      <section className="container py-16 md:py-20" aria-label="How it works">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<Clock className="h-6 w-6" />}
            title="~2 minutes"
            body="A few tailored questions about your business. No calls, no waiting on a gatekeeper."
          />
          <FeatureCard
            icon={<FileDown className="h-6 w-6" />}
            title="Instant PDF report"
            body="Download your AI opportunity summary the moment you finish — it's yours to keep."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Honest, by design"
            body="We only surface claims we can support with evidence. If AI isn't the fit, we say so."
          />
        </div>
      </section>

      {/* Funnel */}
      <section className="container pb-24 md:pb-28">
        <OpportunityScanFunnel />
      </section>

      {/* Trust / honest framing */}
      <section className="bg-secondary/40 border-y border-border/60">
        <div className="container py-16 md:py-20 text-center">
          <Sparkles className="mx-auto mb-4 h-8 w-8 text-accent" aria-hidden="true" />
          <p className="mx-auto max-w-2xl text-lg md:text-xl font-medium leading-relaxed">
            {content.about.coreMessage}
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground leading-relaxed">{content.about.body}</p>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent/15 text-accent">
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base leading-relaxed">{body}</CardDescription>
      </CardContent>
    </Card>
  );
}
