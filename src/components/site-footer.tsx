import Link from "next/link";
import Image from "next/image";
import { content } from "@/content";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-secondary/30">
      <div className="container flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Image
            src="/logo.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover ring-1 ring-accent/30"
          />
          <div>
            <p className="font-serif text-base font-semibold tracking-[0.14em] uppercase text-foreground">
              The Fox & Loom
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{content.footer.tagline}</p>
          </div>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-2 text-sm text-muted-foreground md:items-end">
          {content.nav.items.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground w-fit">
              {item.label}
            </Link>
          ))}
          <Link href={content.nav.cta.href} className="mt-1 text-accent hover:underline w-fit">
            {content.nav.cta.label}
          </Link>
        </nav>
      </div>
      <div className="border-t border-border/50">
        <div className="container py-5 text-xs text-muted-foreground">
          {content.footer.note}
        </div>
      </div>
    </footer>
  );
}
