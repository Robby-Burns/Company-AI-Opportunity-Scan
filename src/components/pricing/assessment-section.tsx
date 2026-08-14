import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { content } from "@/content";

const p = content.pricing.assessment;

export function AssessmentSection() {
  return (
    <section aria-labelledby="assessment-heading" className="border-b border-border/60">
      <div className="container py-16 md:py-20">
        <div className="max-w-3xl">
          <h2 id="assessment-heading" className="font-serif text-3xl md:text-4xl font-semibold tracking-tight">
            {p.heading}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{p.body}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {p.cards.map((card) => (
            <Card key={card.name} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col p-6 md:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {card.name}
                </p>
                <p className="mt-3 font-serif text-4xl font-semibold tracking-tight text-foreground">
                  {card.price}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground/80">{p.productName}</p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{card.fit}</p>

                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                  Included
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {card.includes.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 pt-2">
                  <Button asChild variant="accent" className="w-full">
                    <Link href={card.cta.href}>{card.cta.label}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Assessment credit */}
        <div className="mt-8 rounded-xl border border-accent/40 bg-accent/5 p-6 md:p-8">
          <p className="font-serif text-xl md:text-2xl font-semibold text-foreground">
            <span className="text-accent">{p.credit.question}</span> {p.credit.headline}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:max-w-2xl">{p.credit.body}</p>
        </div>
      </div>
    </section>
  );
}
