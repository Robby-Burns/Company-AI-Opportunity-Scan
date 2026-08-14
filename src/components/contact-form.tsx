"use client";
import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ContactForm() {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, company, message })
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast({ title: "Couldn't send", description: data.error, variant: "destructive" });
        setSubmitting(false);
        return;
      }
      toast({ title: "Message sent", description: "We'll be in touch shortly.", variant: "success" });
      setName("");
      setEmail("");
      setCompany("");
      setMessage("");
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send us a note</CardTitle>
        <CardDescription>We read every message and reply within one business day.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" maxLength={160} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-company">Company (optional)</Label>
            <Input id="c-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} autoComplete="organization" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-message">Message</Label>
            <Textarea id="c-message" value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={4000} rows={5} />
          </div>
          <Button type="submit" variant="accent" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? "Sending…" : "Send message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
