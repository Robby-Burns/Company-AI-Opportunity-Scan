/**
 * Prompt-injection sanitization (spec §6.4).
 *
 * Applies to ALL free text entering the agent pipeline: scraped external
 * content, the prospect's optional operational notes, and interview answers.
 *
 * Defense-in-depth, not a complete guarantee (full prevention is an open
 * research problem). Layers:
 *  1. Strip common instruction markers / override phrasings.
 *  2. Collapse control / zero-width characters that can hide instructions.
 *  3. Wrap content in unambiguous delimiters.
 *  4. The LLM system prompt (see lib/llm) directs the model to treat all
 *     delimited content as untrusted DATA, never as instructions.
 */
const INJECTION_PATTERNS: readonly RegExp[] = [
  /\bignore (all |previous |prior )?(instructions?|prompts?|rules?|system)\b/gi,
  /\b(disregard|forget|override|discard) (all |the |any )?(prior|previous|above|system|original) instructions?\b/gi,
  /\byou are (now )?(a |an )?[a-z ]{0,40}?(developer|admin|root|jailbreak|dan|unrestricted)\b/gi,
  /\bsystem prompt\b/gi,
  /\bnew instructions?:\b/gi,
  /<\/?system>/gi,
  /```system/gi,
  /\b(execute|run|eval|evaluate|call|invoke) (the )?following\b/gi
];

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/g;

const MAX_LEN = 16000; // hard cap per field to bound cost/abuse

export interface SanitizeOptions {
  maxLength?: number;
  /** Tag embedded in the delimiters so the model knows the source. */
  tag?: string;
}

export interface SanitizedText {
  text: string;
  truncated: boolean;
  stripped: number;
}

/** Sanitize a single free-text field. Returns the wrapped, neutralized text. */
export function sanitize(text: string, opts: SanitizeOptions = {}): SanitizedText {
  const max = opts.maxLength ?? MAX_LEN;
  const tag = opts.tag ?? "content";

  let out = text ?? "";
  out = out.replace(CONTROL_CHARS, " ");
  let stripped = 0;
  for (const re of INJECTION_PATTERNS) {
    out = out.replace(re, () => {
      stripped += 1;
      return "[redacted]";
    });
  }
  const truncated = out.length > max;
  if (truncated) out = out.slice(0, max);

  // Wrap in delimiters + a framing note the model is told (via system prompt) to
  // treat as data.
  const framed =
    `\n\n<<<UNTRUSTED_${tag.toUpperCase()}_BEGIN>>>\n${out}\n<<<UNTRUSTED_${tag.toUpperCase()}_END>>>\n\n`;
  return { text: framed, truncated, stripped };
}

/** Sanitize many fields at once, returning a merged, delimited block. */
export function sanitizeFields(fields: Record<string, string>, opts: SanitizeOptions = {}): SanitizedText {
  let merged = "";
  let stripped = 0;
  let truncated = false;
  for (const [k, v] of Object.entries(fields)) {
    const r = sanitize(v, { ...opts, tag: opts.tag ? `${opts.tag}.${k}` : k });
    merged += r.text;
    stripped += r.stripped;
    truncated = truncated || r.truncated;
  }
  return { text: merged, truncated, stripped };
}
