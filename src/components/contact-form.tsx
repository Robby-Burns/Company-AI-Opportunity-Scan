"use client";
import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { content } from "@/content";

export function ContactForm() {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "submitting" | "done">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, company, email, website, topic, message })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast({ title: "Couldn't send", description: data.error, variant: "destructive" });
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      toast({ title: "Network error", variant: "destructive" });
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-serif text-xl font-semibold tracking-tight text-foreground">
            {content.contact.successTitle}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {content.contact.successBody}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Start the conversation</CardTitle>
        <CardDescription>
          Tell us a little about what&apos;s going on. We read every message.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-name">{content.contact.fields.name}</Label>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                maxLength={120}
                disabled={status === "submitting"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-company">{content.contact.fields.company}</Label>
              <Input
                id="c-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={120}
                autoComplete="organization"
                disabled={status === "submitting"}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-email">{content.contact.fields.email}</Label>
              <Input
                id="c-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                maxLength={160}
                disabled={status === "submitting"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-website">{content.contact.fields.website}</Label>
              <Input
                id="c-website"
                type="url"
                inputMode="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourcompany.com"
                autoComplete="url"
                maxLength={300}
                disabled={status === "submitting"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-topic">{content.contact.fields.topicLabel}</Label>
            <select
              id="c-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              disabled={status === "submitting"}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>
                Select a topic…
              </option>
              {content.contact.topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-message">{content.contact.fields.topicOther}</Label>
            <Textarea
              id="c-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              maxLength={4000}
              rows={5}
              disabled={status === "submitting"}
            />
          </div>

          <Button type="submit" variant="accent" size="lg" disabled={status === "submitting"} className="w-full sm:w-auto">
            {status === "submitting" ? "Sending…" : content.contact.fields.cta}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
