/**
 * LLM client (spec §9.3 "thin swappable interface").
 *
 * Uses OpenRouter (OpenAI-compatible HTTP). Chosen because OPENROUTER_API_KEY is
 * already in the environment, so no new credential is introduced (spec §12.3).
 * The provider is swappable: replace `complete()` to point elsewhere.
 *
 * Robustness: prefers JSON-mode requests and validates the parsed shape; falls
 * back to a fenced-JSON extractor if the model wraps output in prose.
 */
import { env } from "@/lib/env";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompleteOptions {
  model?: string;
  temperature?: number;
  /** Request JSON-mode output and parse. */
  json?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LlmResult {
  text: string;
  /** Present when `json: true` and parsing succeeded. */
  json: unknown | null;
  tokensIn: number;
  tokensOut: number;
}

export class LlmError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "LlmError";
  }
}

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export async function complete(messages: LlmMessage[], opts: LlmCompleteOptions = {}): Promise<LlmResult> {
  if (!env.openRouterApiKey) {
    throw new LlmError("OPENROUTER_API_KEY is not set (required for the AI interview + synthesis).");
  }
  const model = opts.model ?? env.openRouterModel;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30000);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.openRouterApiKey}`,
        "HTTP-Referer": env.appUrl,
        "X-Title": "Fox & Loom Opportunity Scan"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.json ? { response_format: { type: "json_object" } } : {})
      })
    });
  } catch (e) {
    clearTimeout(timer);
    throw new LlmError(`LLM request failed: ${(e as Error).message}`);
  }
  clearTimeout(timer);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LlmError(`LLM HTTP ${res.status}: ${body.slice(0, 300)}`, res.status);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  let parsed: unknown | null = null;
  if (opts.json) {
    parsed = extractJson(text);
  }
  return {
    text,
    json: parsed,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0
  };
}

/** Parse JSON, tolerating fenced ```json blocks or trailing prose. */
export function extractJson(text: string): unknown | null {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      /* give up */
    }
  }
  return null;
}
