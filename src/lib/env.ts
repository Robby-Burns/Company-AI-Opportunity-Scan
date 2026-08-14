/**
 * Centralized, typed environment access. Reads once and validates.
 * Throws on missing *required* values at first use (not at import) so partial
 * configs (e.g. running tests) don't crash the module graph.
 */
import { content } from "@/content";

function required(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.trim() !== "") return v.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${name}`);
}

export const env = {
  appUrl: required("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  contactEmail: required(content.contactInfo.emailEnvVar, content.contactInfo.emailFallback),
  contactFromEmail: required("CONTACT_FROM_EMAIL", content.contactInfo.emailFallback),
  salesBriefTo: required(
    content.internalRecipient.salesBriefToEnvVar,
    content.internalRecipient.salesBriefToFallback
  ),
  salesBriefFrom: required(
    content.internalRecipient.salesBriefFromEnvVar,
    content.internalRecipient.salesBriefFromFallback
  ),
  emailProvider: (process.env.EMAIL_PROVIDER ?? "console").toLowerCase(),
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
  rateLimitPerHour: Number(process.env.RATE_LIMIT_PER_HOUR ?? 3),
  scraperTimeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS ?? 40000),
  retentionScrapedDays: Number(process.env.RETENTION_SCRAPED_DAYS ?? 90),
  retentionProspectAnswersDays: Number(process.env.RETENTION_PROSPECT_ANSWERS_DAYS ?? 365),
  nodeEnv: process.env.NODE_ENV ?? "development"
} as const;

export type Env = typeof env;

/** Re-read env (used by tests / after setting process.env). */
export function loadEnv(): Env {
  return { ...env } as Env;
}
