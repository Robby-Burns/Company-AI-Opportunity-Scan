import { content } from "@/content";

const p = content.pricing.implementation;

export function ScopeSections() {
  return (
    <>
      {/* ── What determines the tier ────────────────────────────── */}
      <section aria-labelledby="determines-heading" className="border-b border-border/60">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <h2 id="determines-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
              {p.whatDeterminesTier.heading}
            </h2>
            <ul className="mt-6 space-y-1.5 text-lg text-foreground/90">
              {p.whatDeterminesTier.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              {p.whatDeterminesTier.body}
            </p>
            <p className="mt-6 text-base leading-relaxed text-foreground">
              {p.whatDeterminesTier.workflowDefinition}
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {p.whatDeterminesTier.workflowExamples.map((ex) => (
                <li key={ex} className="flex gap-2.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span>{ex}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Every implementation includes ───────────────────────── */}
      <section aria-labelledby="every-heading" className="border-b border-border/60 bg-secondary/30">
        <div className="container py-16 md:py-20">
          <div className="max-w-4xl">
            <h2 id="every-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
              {p.everyImplementation.heading}
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2">
              {p.everyImplementation.items.map((item) => (
                <li key={item.title}>
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── How we define scope (terminology) ───────────────────── */}
      <section aria-labelledby="scope-heading" className="border-b border-border/60">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <h2 id="scope-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
              {p.terminology.heading}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {p.terminology.intro}
            </p>

            <dl className="mt-10 divide-y divide-border/70">
              {p.terminology.items.map((item) => (
                <div key={item.term} className="py-6">
                  <dt className="font-serif text-lg font-semibold text-foreground">{item.term}</dt>
                  <dd className="mt-2 text-base leading-relaxed text-muted-foreground">{item.body}</dd>
                  {"examples" in item && item.examples && (
                    <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                      {item.examples.map((ex) => (
                        <li key={ex} className="flex gap-2.5">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {"note" in item && item.note && (
                    <p className="mt-3 text-sm italic text-muted-foreground">{item.note}</p>
                  )}
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Tier details: examples & definitions ────────────────── */}
      <section aria-labelledby="tier-details-heading" className="border-b border-border/60">
        <div className="container py-16 md:py-20">
          <div className="max-w-4xl">
            <h2 id="tier-details-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
              What each tier really means.
            </h2>
            <div className="mt-10 space-y-12">
              {p.tiers.map((tier) => (
                <div key={tier.name} className="border-l-2 border-accent/40 pl-5 md:pl-7">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                    {tier.name} · {tier.price}
                  </p>

                  {"example" in tier && tier.example && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {tier.example.label}
                      </p>
                      <p className="mt-1 font-medium text-foreground">{tier.example.title}</p>
                      <ol className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                        {tier.example.flow.map((step, i) => (
                          <li key={step} className="flex gap-3">
                            <span className="font-serif text-accent">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-3 text-sm italic text-muted-foreground">{tier.example.note}</p>
                    </div>
                  )}

                  {"examples" in tier && tier.examples && (
                    <div className="mt-4 space-y-5">
                      {tier.examples.map((ex) => (
                        <div key={ex.title}>
                          <p className="font-medium text-foreground">{ex.title}</p>
                          {ex.flows.length > 0 && (
                            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                              {ex.flows.map((f) => (
                                <li key={f} className="flex gap-2.5">
                                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <p className="mt-2 text-sm italic text-muted-foreground">{ex.note}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {"otherExamples" in tier && tier.otherExamples && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Other examples
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {tier.otherExamples.join(" · ")}
                      </p>
                    </div>
                  )}

                  {"definitions" in tier && tier.definitions && tier.definitions.length > 0 && (
                    <dl className="mt-5 space-y-4">
                      {tier.definitions.map((d) => (
                        <div key={d.term}>
                          <dt className="text-sm font-semibold text-foreground">
                            What does &ldquo;{d.term}&rdquo; mean?
                          </dt>
                          <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{d.body}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {"important" in tier && tier.important && (
                    <p className="mt-5 rounded-lg border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-foreground">
                      {tier.important}
                    </p>
                  )}

                  {"priceNote" in tier && tier.priceNote && (
                    <p className="mt-4 text-sm italic text-muted-foreground">{tier.priceNote}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Which tier is right for me ──────────────────────────── */}
      <section aria-labelledby="which-heading" className="border-b border-border/60 bg-secondary/30">
        <div className="container py-16 md:py-20">
          <div className="max-w-4xl">
            <h2 id="which-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
              {p.whichTier.heading}
            </h2>
            <ul className="mt-8 grid gap-6 md:grid-cols-3">
              {p.whichTier.items.map((item) => (
                <li key={item.name} className="rounded-xl border border-border bg-card p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                    {item.name}
                  </p>
                  <p className="mt-3 text-sm font-medium text-foreground">You have:</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.youHave}</p>
                  <p className="mt-3 text-sm italic text-foreground/80">{item.example}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Not priced by agents ────────────────────────────────── */}
      <section aria-labelledby="notpriced-heading" className="border-b border-border/60">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <h2 id="notpriced-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
              {p.notPricedByAgents.heading}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              {p.notPricedByAgents.body}
            </p>
            <p className="mt-6 text-sm font-semibold text-foreground">
              {p.notPricedByAgents.factorsLabel}
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {p.notPricedByAgents.factors.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Comparison table ────────────────────────────────────── */}
      <section aria-labelledby="compare-heading" className="border-b border-border/60 bg-secondary/30">
        <div className="container py-16 md:py-20">
          <div className="max-w-4xl">
            <h2 id="compare-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
              {p.comparison.heading}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.comparison.note}</p>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Implementation tier comparison</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-3 pr-4 text-left font-semibold text-foreground">
                      &nbsp;
                    </th>
                    {p.comparison.columns.map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="py-3 px-3 text-left font-semibold text-foreground align-bottom"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.comparison.rows.map((row, idx) => (
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
        </div>
      </section>

      {/* ── What happens if the project changes ─────────────────── */}
      <section aria-labelledby="changes-heading" className="border-b border-border/60">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <h2 id="changes-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
              {p.projectChanges.heading}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {p.projectChanges.body}
            </p>
            <dl className="mt-8 divide-y divide-border/70">
              {p.projectChanges.examples.map((ex) => (
                <div key={ex.q} className="py-5">
                  <dt className="font-medium text-foreground">{ex.q}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{ex.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
