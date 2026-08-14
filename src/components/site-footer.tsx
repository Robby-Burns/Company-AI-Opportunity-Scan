import Link from "next/link";
import { content } from "@/content";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-secondary/30">
      <div className="container flex flex-col gap-4 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-base font-semibold text-foreground">{content.orgName}</p>
          <p className="text-sm text-muted-foreground">{content.footer.tagline}</p>
        </div>
        <nav aria-label="Footer" className="flex gap-4 text-sm text-muted-foreground">
          {content.nav.items.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
          <a href={`tel:${content.contact.phone.replace(/[.\s]/g, "")}`} className="hover:text-foreground">
            {content.contact.phone}
          </a>
        </nav>
      </div>
    </footer>
  );
}
