import Link from "next/link";
import { Button } from "@/components/ui/button";
import { content } from "@/content";

const p = content.pricing.assessment;

export function AssessmentSection() {
  return (
    <section aria-labelledby="assessment-heading" className="border-b border-border/60">
      <div className="container py-16 md:py-20">
        {/* Heading + product */}
        <div className="max-w-3xl">
          <h2 id="assessment-heading" className="font-serif text-3xl md:text-4xl font-semibold tracking-tight">
            {p.heading}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{p.body}</p>
          <p className="mt-6 font-serif text-xl font-semibold text-foreground">{p.productName}</p>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">{p.productBlurb}</p>
        </div>

        {/* Prominent: both are full-company assessments */}
        <p className="mt-8 rounded-lg border border-accent/40 bg-accent/5 px-5 py-4 text-base font-medium text-foreground md:max-w-3xl">
          {p.bothFullCompany}
        </p>

        {/* Matrix: two engagement levels */}
        <div className="mt-12 max-w-3xl">
          <h3 className="font-serif text-xl md:text-2xl font-semibold tracking-tight">
            {p.matrix.heading}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.matrix.note}</p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Assessment engagement levels — Standard and Comprehensive</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-3 pr-4 text-left font-semibold text-foreground">
                    &nbsp;
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-3 text-left font-semibold text-accent align-bottom w-40"
                  >
                    {p.levels[0].name}
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-3 text-left font-semibold text-accent align-bottom w-40"
                  >
                    {p.levels[1].name}
                  </th>
                </tr>
                <tr className="border-b border-border/70">
                  <th scope="row" className="py-2 pr-4 text-left font-medium text-muted-foreground">
                    Price
                  </th>
                  <td className="py-2 px-3 font-serif text-lg font-semibold text-foreground">
                    {p.levels[0].price}
                  </td>
                  <td className="py-2 px-3 font-serif text-lg font-semibold text-foreground">
                    {p.levels[1].price}
                  </td>
                </tr>
              </thead>
              <tbody>
                {p.matrix.rows.map((row, idx) => (
                  <tr key={row.label} className={idx % 2 === 0 ? "bg-background/40" : ""}>
                    <th scope="row" className="py-3 pr-4 text-left font-medium text-foreground">
                      {row.label}
                    </th>
                    {row.values.map((v, vi) => (
                      <td key={vi} className="py-3 px-3 text-muted-foreground align-top">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* What's the difference? */}
        <div className="mt-12 max-w-3xl">
          <h3 className="font-serif text-xl md:text-2xl font-semibold tracking-tight">
            {p.whatDifferent.heading}
          </h3>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {p.whatDifferent.body}
          </p>
          <dl className="mt-8 grid gap-6 md:grid-cols-2">
            {p.whatDifferent.levels.map((lvl) => (
              <div key={lvl.name} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                  {lvl.name}
                </p>
                <p className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground">
                  {lvl.price}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{lvl.bestFor}</p>
              </div>
            ))}
          </dl>
        </div>

        {/* CTA */}
        <div className="mt-10 md:max-w-3xl">
          <Button asChild variant="accent" size="lg">
            <Link href={p.cta.href}>{p.cta.label}</Link>
          </Button>
        </div>

        {/* Assessment credit */}
        <div className="mt-8 rounded-xl border border-accent/40 bg-accent/5 p-6 md:p-8 md:max-w-3xl">
          <p className="font-serif text-xl md:text-2xl font-semibold text-foreground">
            <span className="text-accent">{p.credit.question}</span> {p.credit.headline}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.credit.body}</p>
        </div>
      </div>
    </section>
  );
}
