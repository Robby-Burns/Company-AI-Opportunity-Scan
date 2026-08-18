"use client";
import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { content } from "@/content";

type Step = "input" | "research" | "interview" | "results";

interface Question {
  id: string;
  text: string;
  kind?: "short" | "long" | "choice";
  choices?: string[];
  lens?: string;
}

type ProgressEvent =
  | { type: "progress"; step: string; message: string; pct: number }
  | { type: "warning"; message: string }
  | { type: "result"; evidenceCount: number; warnings: string[]; ready: boolean }
  | { type: "done" }
  | { type: "error"; message: string };

interface ScanStatus {
  step: Step;
  scanId: string | null;
  pct: number;
  message: string;
  warnings: string[];
  // interview
  question?: Question | null;
  asked: number;
  min: number;
  max: number;
  finished: boolean;
  // results
  downloadUrl?: string;
  reportReady?: boolean;
}

const INITIAL: ScanStatus = {
  step: "input",
  scanId: null,
  pct: 0,
  message: "",
  warnings: [],
  asked: 0,
  min: content.interview.minQuestions,
  max: content.interview.maxQuestions,
  finished: false
};

export function OpportunityScanFunnel() {
  const { toast } = useToast();
  const [st, setSt] = React.useState<ScanStatus>(INITIAL);
  const [submitting, setSubmitting] = React.useState(false);

  // ── Step 1: submit input ─────────────────────────────────────────────
  const [company, setCompany] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [challenge, setChallenge] = React.useState(""); // MVP bot-challenge token

  // Generate a client-side challenge token (spec §6.3 MVP: nonce ≥ 8 chars).
  React.useEffect(() => {
    setChallenge(`cx_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`);
  }, []);

  async function startScan(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || !email.trim()) {
      toast({ title: "Please provide your company name and email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company, location, website, email, notes, confirmed, challenge })
      });
      const data = (await res.json()) as { scanId?: string; error?: string; remaining?: number };
      if (!res.ok || !data.scanId) {
        toast({ title: "Couldn't start your scan", description: data.error ?? "Please try again.", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      const scanId = data.scanId;
      setSt((s) => ({ ...s, step: "research", scanId, pct: 2 }));
      streamResearch(scanId);
    } catch {
      toast({ title: "Network error", description: "Check your connection and try again.", variant: "destructive" });
      setSubmitting(false);
    }
  }

  // ── Step 2: SSE research progress ────────────────────────────────────
  function streamResearch(scanId: string) {
    const es = new EventSource(`/api/scan/${scanId}/events`);
    es.onmessage = (ev) => {
      let msg: ProgressEvent;
      try {
        msg = JSON.parse(ev.data) as ProgressEvent;
      } catch {
        return;
      }
      if (msg.type === "progress") {
        setSt((s) => ({ ...s, pct: msg.pct, message: msg.message }));
      } else if (msg.type === "warning") {
        setSt((s) => ({ ...s, warnings: [...s.warnings, msg.message] }));
      } else if (msg.type === "result" || msg.type === "done") {
        es.close();
        setSt((s) => ({ ...s, step: "interview", pct: 0, message: "", asked: 0 }));
        loadNextQuestion(scanId);
      } else if (msg.type === "error") {
        // Graceful degradation: proceed to interview even on scrape error.
        es.close();
        toast({ title: "Research incomplete", description: msg.message, variant: "destructive" });
        setSt((s) => ({ ...s, step: "interview", pct: 0, asked: 0 }));
        loadNextQuestion(scanId);
      }
    };
    es.onerror = () => {
      es.close();
      // If we never reached "interview", degrade to it rather than hang.
      setSt((s) => {
        if (s.step !== "research") return s;
        return { ...s, step: "interview", pct: 0, asked: 0 };
      });
      loadNextQuestion(scanId);
    };
  }

  // ── Step 3: interview ────────────────────────────────────────────────
  const [answer, setAnswer] = React.useState("");
  const [questionLoading, setQuestionLoading] = React.useState(false);
  const [answerSubmitting, setAnswerSubmitting] = React.useState(false);

  async function loadNextQuestion(scanId: string) {
    setQuestionLoading(true);
    setAnswer("");
    try {
      const res = await fetch(`/api/interview/${scanId}/next`);
      const data = (await res.json()) as {
        question?: Question;
        finished?: boolean;
        asked?: number;
        max?: number;
        min?: number;
        error?: string;
      };
      if (!res.ok) {
        toast({ title: "Question failed", description: data.error, variant: "destructive" });
        return;
      }
      if (data.finished) {
        // Interview done → go to results and kick synthesis via the answer route
        // (already started server-side). Poll the report endpoint.
        setSt((s) => ({ ...s, step: "results", question: null, finished: true, asked: data.asked ?? s.asked, max: data.max ?? s.max }));
        waitForReport(scanId);
        return;
      }
      setSt((s) => ({
        ...s,
        question: data.question ?? null,
        asked: data.asked ?? s.asked,
        min: data.min ?? s.min,
        max: data.max ?? s.max
      }));
    } catch {
      toast({ title: "Network error", description: "Couldn't load the next question.", variant: "destructive" });
    } finally {
      setQuestionLoading(false);
    }
  }

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!st.scanId || !st.question) return;
    if (!answer.trim()) {
      toast({ title: "Please add an answer", variant: "destructive" });
      return;
    }
    setAnswerSubmitting(true);
    try {
      const res = await fetch(`/api/interview/${st.scanId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: st.question.id, answer })
      });
      const data = (await res.json()) as { ok?: boolean; finished?: boolean; asked?: number; max?: number; error?: string };
      if (!res.ok || !data.ok) {
        toast({ title: "Couldn't save answer", description: data.error, variant: "destructive" });
        setAnswerSubmitting(false);
        return;
      }
      if (data.finished) {
        setSt((s) => ({ ...s, step: "results", question: null, finished: true, asked: data.asked ?? s.asked, max: data.max ?? s.max }));
        waitForReport(st.scanId);
      } else {
        setSt((s) => ({ ...s, asked: data.asked ?? s.asked, max: data.max ?? s.max }));
        loadNextQuestion(st.scanId);
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setAnswerSubmitting(false);
    }
  }

  // ── Step 4: results ──────────────────────────────────────────────────
  function waitForReport(scanId: string) {
    setSt((s) => ({ ...s, reportReady: false, downloadUrl: `/api/report/${scanId}/download` }));
    let tries = 0;
    const poll = async () => {
      tries += 1;
      try {
        const res = await fetch(`/api/report/${scanId}`);
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean };
          if (data.ok) {
            setSt((s) => ({ ...s, reportReady: true }));
            return;
          }
        }
      } catch {
        /* keep polling */
      }
      if (tries < 60) {
        setTimeout(poll, 800);
      } else {
        setSt((s) => ({ ...s, reportReady: true })); // let them try the download button anyway
      }
    };
    poll();
  }

  function downloadReport() {
    if (st.scanId) window.location.href = `/api/report/${st.scanId}/download`;
  }

  function restart() {
    setSt(INITIAL);
    setCompany("");
    setLocation("");
    setWebsite("");
    setEmail("");
    setNotes("");
    setConfirmed(false);
    setAnswer("");
  }

  // ── render ───────────────────────────────────────────────────────────
  return (
    <section id="scan" aria-label="Free AI Readiness Review">
      {st.step === "input" && (
        <Card className="mx-auto max-w-2xl animate-fade-in-up">
          <CardHeader>
            <CardTitle>{content.review.heading}</CardTitle>
            <CardDescription>{content.review.body}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={startScan} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="company">Company name</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={120} autoComplete="organization" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location (City, State / Region)</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="e.g. Austin, TX or Chicago, IL (optional)" autoComplete="address-level2" />
                <p className="text-xs text-muted-foreground">
                  Helps us understand your operating area, especially if you don&apos;t have a website.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Company website (optional)</Label>
                <Input id="website" type="url" inputMode="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourcompany.com (optional)" autoComplete="url" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Your work email</Label>
                <Input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                <p className="text-xs text-muted-foreground">
                  Where we&apos;ll send your summary and follow-up notes.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Anything we should know? (optional)</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="E.g. 'We're a 12-person logistics firm exploring automation.'" />
              </div>
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-input accent-[hsl(var(--accent))]"
                />
                <span>I represent this company and authorize this review of its public information.</span>
              </label>
              {/* Hidden MVP bot-challenge token (spec §6.3). Real CAPTCHA can swap in here. */}
              <input type="hidden" name="challenge" value={challenge} aria-hidden="true" />
              <Button type="submit" variant="accent" size="lg" disabled={submitting} className="w-full">
                {submitting ? "Starting…" : content.review.cta}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {content.review.support}
              </p>
            </form>
          </CardContent>
        </Card>
      )}

      {st.step === "research" && (
        <Card className="mx-auto max-w-2xl animate-fade-in-up">
          <CardHeader>
            <CardTitle>Researching {company || "your company"}…</CardTitle>
            <CardDescription>This usually takes about 30 seconds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Progress value={st.pct} aria-label="Research progress" />
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium" aria-live="polite">
                {st.message || content.scanStatusMessages[0]}
              </span>
              <span className="tabular-nums text-muted-foreground">{Math.round(st.pct)}%</span>
            </div>
            {st.warnings.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1" aria-label="Notes">
                {st.warnings.slice(0, 4).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              You can stay right here — questions start automatically when research wraps up.
            </p>
          </CardContent>
        </Card>
      )}

      {st.step === "interview" && (
        <Card className="mx-auto max-w-2xl animate-fade-in-up">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{content.interview.intro}</CardTitle>
              <Badge variant="accent">
                Question {Math.min(st.asked + 1, st.max)} of {st.max}
              </Badge>
            </div>
            <Progress value={(st.asked / st.max) * 100} className="mt-2" aria-label="Interview progress" />
            {/* Five-perspectives hook (spec §9.1 tone: human, not a questionnaire) */}
            {st.asked === 0 && (
              <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-4">
                <p className="text-sm font-medium">{content.perspectives.intro}</p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {content.perspectives.lenses.map((l) => (
                    <li key={l.id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{l.label}:</span> {l.prompt}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {questionLoading ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Thinking up the next question…
              </p>
            ) : st.question ? (
              <form onSubmit={submitAnswer} className="space-y-4">
                {st.question.lens && (
                  <Badge variant="outline" className="mb-1">
                    {content.perspectives.lenses.find((l) => l.id === st.question?.lens)?.label ?? st.question.lens} perspective
                  </Badge>
                )}
                <fieldset className="space-y-3">
                  <legend className="text-base font-medium leading-relaxed">{st.question.text}</legend>
                  {st.question.kind === "choice" && st.question.choices ? (
                    <div className="grid gap-2">
                      {st.question.choices.map((c) => (
                        <label key={c} className="flex items-center gap-3 rounded-md border border-input p-3 text-sm cursor-pointer hover:bg-accent/10">
                          <input
                            type="radio"
                            name="answer-choice"
                            value={c}
                            checked={answer === c}
                            onChange={() => setAnswer(c)}
                            className="h-4 w-4 accent-[hsl(var(--accent))]"
                          />
                          <span>{c}</span>
                        </label>
                      ))}
                      <Textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        maxLength={4000}
                        placeholder="Or add your own answer…"
                        className="mt-2"
                      />
                    </div>
                  ) : (
                    <Textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      maxLength={4000}
                      autoFocus
                      placeholder="Type your answer…"
                      aria-label="Your answer"
                    />
                  )}
                </fieldset>
                <div className="flex items-center justify-between">
                  <Button type="button" variant="ghost" onClick={restart}>
                    Start over
                  </Button>
                  <Button type="submit" variant="accent" disabled={answerSubmitting || answer.trim().length === 0}>
                    {answerSubmitting ? "Saving…" : "Next"}
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </CardContent>
        </Card>
      )}

      {st.step === "results" && (
        <Card className="mx-auto max-w-2xl animate-fade-in-up">
          <CardHeader>
            <CardTitle>Your Opportunity Scan summary is ready</CardTitle>
            <CardDescription>Download it now — it&apos;s yours to keep.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {st.reportReady === false ? (
              <div className="space-y-3" aria-live="polite">
                <Progress value={70} className="animate-pulse" />
                <p className="text-sm text-muted-foreground">Synthesizing your opportunity hypothesis brief…</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Button variant="accent" size="lg" className="w-full" onClick={downloadReport}>
                  Download my Opportunity Scan summary (PDF)
                </Button>
                <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm">
                  <p className="font-medium">Ready for the Deep Assessment?</p>
                  <p className="mt-1 text-muted-foreground">
                    Connect with our human team to evaluate this opportunity, validate workflows and systems, and determine whether it&apos;s worth pursuing.
                  </p>
                  <Button asChild variant="outline" className="mt-3">
                    <a href="/contact">Schedule a discussion</a>
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={restart}>
                  Start another scan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
