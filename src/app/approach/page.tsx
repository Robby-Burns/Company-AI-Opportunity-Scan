import { content } from "@/content";

export const metadata = { title: "Approach" };

export default function ApproachPage() {
  return (
    <div>
      {/* Intro */}
      <section className="border-b border-border/60">
        <div className="container py-16 md:py-24">
          <div className="max-w-3xl">
            <h1 className="font-serif text-4xl md:text-5xl font-semibold leading-[1.1] tracking-tight">
              {content.approach.lead}
              <br />
              {content.approach.leadLine2}
            </h1>
            <div className="mt-6 h-px w-16 bg-accent" aria-hidden="true" />
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              {content.approach.intro}
            </p>
          </div>
        </div>
      </section>

      {/* Plain-English process */}
      <section aria-labelledby="plain-process-heading" className="border-b border-border/60">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <h2 id="plain-process-heading" className="font-serif text-2xl md:text-3xl font-semibold tracking-tight">
              How we work
            </h2>
            <ol className="mt-8 divide-y divide-border/70">
              {content.approach.plainSteps.map((step, i) => (
                <li key={step.title} className="grid grid-cols-[auto_1fr] gap-x-5 py-5">
                  <span className="font-serif text-base font-semibold text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{step.title}</p>
                    <p className="mt-1 text-muted-foreground leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Hypothesis Delta */}
      <section aria-labelledby="hd-heading" className="border-b border-border/60">
        <div className="container py-16 md:py-24">
          <div className="max-w-3xl">
            <h2 id="hd-heading" className="font-serif text-3xl md:text-4xl font-semibold tracking-tight">
              {content.approach.framework.heading}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              {content.approach.framework.lead}
            </p>

            {/* Simple visual: hypotheses with evidence gates */}
            <div className="mt-10 space-y-0">
              {content.approach.framework.flow.map((label, i) => (
                <div key={label}>
                  <div className="rounded-lg border border-border bg-card px-5 py-4">
                    <p className="font-medium text-foreground">{label}</p>
                  </div>
                  {i < content.approach.framework.flow.length - 1 && (
                    <div className="flex flex-col items-center py-2" aria-hidden="true">
                      <span className="h-4 w-px bg-accent/50" />
                      <span className="my-1 rounded-full border border-accent/40 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-accent">
                        {content.approach.framework.gateLabel}
                      </span>
                      <span className="h-4 w-px bg-accent/50" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-8 text-base leading-relaxed text-muted-foreground">
              {content.approach.framework.deltasNote}
            </p>
          </div>
        </div>
      </section>

      {/* Atlas */}
      <section aria-labelledby="atlas-heading">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <h2 id="atlas-heading" className="font-serif text-xl md:text-2xl font-semibold tracking-tight text-accent">
              {content.approach.atlas.heading}
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
              {content.approach.atlas.body}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
