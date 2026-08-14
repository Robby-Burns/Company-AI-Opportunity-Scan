import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { content } from "@/content";

const p = content.pricing.implementation;

export function ImplementationSection() {
  return (
    <section aria-labelledby="impl-heading" className="border-b border-border/60">
      <div className="container py-16 md:py-20">
        <div className="max-w-3xl">
          <h2 id="impl-heading" className="font-serif text-3xl md:text-4xl font-semibold tracking-tight">
            {p.heading}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{p.body}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {p.tiers.map((tier) => (
            <Card key={tier.name} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col p-6 md:p-7">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                  {tier.name}
                </p>
                <p className="mt-3 font-serif text-3xl font-semibold tracking-tight text-foreground">
                  {tier.price}
                </p>

                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {tier.whatThisMeans}
                </p>

                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                  Included
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {tier.includes.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {"notIncluded" in tier && tier.notIncluded && (
                  <>
                    <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Not included
                    </p>
                    <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground/80">
                      {tier.notIncluded.map((item) => (
                        <li key={item} className="flex gap-2.5">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <div className="mt-7 pt-1">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={tier.cta.href}>{tier.cta.label}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
