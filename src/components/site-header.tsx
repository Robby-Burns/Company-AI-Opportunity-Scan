"use client";
import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { content } from "@/content";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold" aria-label={`${content.orgName} home`}>
          <Image src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
          <span className="text-lg tracking-tight">{content.orgName}</span>
        </Link>

        <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
          {content.nav.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/10"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/#scan"
            className="ml-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90"
          >
            Start your scan
          </Link>
        </nav>

        <button
          type="button"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent/10"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <nav
        id="mobile-nav"
        aria-label="Mobile"
        className={cn(
          "md:hidden overflow-hidden border-t border-border/60 bg-background transition-[max-height] duration-300",
          open ? "max-h-72" : "max-h-0"
        )}
      >
        <div className="container flex flex-col py-2">
          {content.nav.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-3 text-base font-medium hover:bg-accent/10"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/#scan"
            className="rounded-md bg-accent px-3 py-3 my-2 text-center text-base font-semibold text-accent-foreground"
            onClick={() => setOpen(false)}
          >
            Start your scan
          </Link>
        </div>
      </nav>
    </header>
  );
}
