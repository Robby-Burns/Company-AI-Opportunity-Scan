import Image from "next/image";
import { content } from "@/content";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Compass, Wrench } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="container py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <Image
          src="/logo.png"
          alt=""
          width={72}
          height={72}
          className="mx-auto mb-6 h-18 w-18 rounded-xl object-cover"
        />
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{content.about.coreMessage}</h1>
        <p className="mt-6 text-lg md:text-xl leading-relaxed text-muted-foreground">{content.about.body}</p>
      </div>

      <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-3">
        <PrincipleCard
          icon={<Heart className="h-6 w-6" />}
          title="Humans first"
          body="We remove friction for real people. AI is a tool, not a religion."
        />
        <PrincipleCard
          icon={<Compass className="h-6 w-6" />}
          title="Grounded"
          body="Every recommendation traces to evidence. No magic, no hand-waving."
        />
        <PrincipleCard
          icon={<Wrench className="h-6 w-6" />}
          title="Practical"
          body="If AI isn't the right fit, we tell you — and save you the spend."
        />
      </div>

      <div className="mx-auto mt-16 max-w-3xl text-center">
        <p className="text-lg font-medium">Curious where AI fits in your business?</p>
        <Button asChild variant="accent" size="lg" className="mt-4">
          <Link href="/#scan">Start your free scan</Link>
        </Button>
      </div>
    </div>
  );
}

function PrincipleCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
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
