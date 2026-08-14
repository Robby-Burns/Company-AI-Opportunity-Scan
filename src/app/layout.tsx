import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/toast";
import { content } from "@/content";

export const metadata: Metadata = {
  title: {
    default: `${content.orgName} — ${content.brandLine}`,
    template: `%s — ${content.orgName}`
  },
  description:
    "Fox & Loom helps companies figure out where AI and automation can actually make their work better. If AI isn't the answer, we'll tell you that too.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-sans">
        <Toaster>
          <a href="#main" className="skip-link">
            Skip to main content
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </Toaster>
      </body>
    </html>
  );
}
