"use client";
import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { content } from "@/content";

type Status = "idle" | "submitting" | "done";

/**
 * Free AI Readiness Review intake.
 *
 * This is the simple, human-led entry point: a few fields, then a short
 * follow-up conversation. It deliberately does NOT launch the internal
 * automated research/interview machinery — that can be wired in later.
 */
export function ReviewForm() {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, company, website })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast({ title: "Couldn't start your review", description: data.error ?? "Please try again.", variant: "destructive" });
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      toast({ title: "Network error", description: "Check your connection and try again.", variant: "destructive" });
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm" aria-live="polite">
        <p className="font-serif text-xl font-semibold tracking-tight text-foreground">
          {content.review.successTitle}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {content.review.successBody}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="r-name">{content.review.fields.name}</Label>
        <Input
          id="r-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          autoComplete="name"
          disabled={status === "submitting"}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-email">{content.review.fields.email}</Label>
        <Input
          id="r-email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={status === "submitting"}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-company">{content.review.fields.company}</Label>
        <Input
          id="r-company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
          maxLength={120}
          autoComplete="organization"
          disabled={status === "submitting"}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-website">{content.review.fields.website}</Label>
        <Input
          id="r-website"
          type="url"
          inputMode="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          required
          placeholder="https://yourcompany.com"
          autoComplete="url"
          disabled={status === "submitting"}
        />
      </div>
      <Button type="submit" variant="accent" size="lg" disabled={status === "submitting"} className="w-full">
        {status === "submitting" ? "Starting…" : content.review.cta}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{content.review.support}</p>
    </form>
  );
}
