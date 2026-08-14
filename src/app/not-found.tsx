import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container py-24 text-center">
      <p className="text-6xl font-bold text-gradient-gold">404</p>
      <h1 className="mt-4 text-2xl font-semibold">We couldn&apos;t find that page.</h1>
      <p className="mt-2 text-muted-foreground">It may have moved, or never existed.</p>
      <Button asChild variant="accent" className="mt-6">
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
