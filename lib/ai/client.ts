/**
 * OpenAI-compatible model client. Server-only.
 *
 * Deliberately provider-agnostic: everything is driven by OPENAI_BASE_URL, so
 * the same code runs against OpenAI, OpenRouter, Together, Groq, vLLM, Ollama,
 * or an internal gateway. PRD §8 requires choosing a vendor only after checking
 * privacy controls, cost, and accuracy on the demo corpus — so the code must
 * not hardcode that decision before it has been made.
 *
 * Two tiers, because the work is not uniform:
 *   FAST  — extraction, labelling, classification. High volume, low judgement.
 *   HEAVY — issue assessment, contradiction analysis, drafting. Low volume,
 *           high consequence.
 */

import OpenAI from "openai";

if (typeof window !== "undefined") {
  // Case content must never reach a model from the browser, and the key must
  // never reach the browser at all (PRD §8 privacy requirements).
  throw new Error("lib/ai/client is server-only — call it from a route handler.");
}

export interface ModelConfig {
  baseUrl: string;
  fastModel: string;
  heavyModel: string;
  configured: boolean;
}

export function modelConfig(): ModelConfig {
  return {
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    fastModel: process.env.OPENAI_MODEL_FAST ?? "gpt-4o-mini",
    heavyModel: process.env.OPENAI_MODEL ?? "gpt-4o",
    configured: Boolean(process.env.OPENAI_API_KEY),
  };
}

let cached: OpenAI | null = null;

function client(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new ModelUnavailableError(
      "No OPENAI_API_KEY is set. Copy .env.example to .env.local and add a key.",
    );
  }
  if (!cached) {
    const cfg = modelConfig();
    cached = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: cfg.baseUrl,
      timeout: 60_000,
      maxRetries: 2,
    });
  }
  return cached;
}

/**
 * Thrown when the model cannot be reached or returns something unusable.
 *
 * Callers must surface this rather than falling back to a plausible answer.
 * PRD §8: "No module may silently substitute a confident answer when OCR or
 * retrieval fails."
 */
export class ModelUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ModelUnavailableError";
  }
}

/**
 * A chat turn that may call tools.
 *
 * Exposed separately from complete() because the agent needs the raw message
 * objects back - tool calls have to be appended to the transcript and answered
 * before the next turn, and flattening them to a string would lose that.
 */
export async function chatWithTools(params: {
  messages: unknown[];
  tools: unknown[];
  tier?: "fast" | "heavy";
  temperature?: number;
  maxTokens?: number;
}): Promise<{ message: { role: string; content: string | null; tool_calls?: unknown[] } }> {
  const cfg = modelConfig();
  const model = params.tier === "fast" ? cfg.fastModel : cfg.heavyModel;
  try {
    const res = await client().chat.completions.create({
      model,
      temperature: params.temperature ?? 0.3,
      max_tokens: params.maxTokens ?? 900,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: params.messages as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: params.tools as any,
    });
    const message = res.choices[0]?.message;
    if (!message) throw new ModelUnavailableError(`${model} returned no message`);
    return { message: message as { role: string; content: string | null; tool_calls?: unknown[] } };
  } catch (err) {
    if (err instanceof ModelUnavailableError) throw err;
    throw new ModelUnavailableError(`${model} request failed`, err);
  }
}

export interface CompleteOptions {
  /** Which tier. Default "fast". */
  tier?: "fast" | "heavy";
  /** Instructions. Never put untrusted document text here — see lib/processing/envelope. */
  system: string;
  /** The request. Untrusted content must already be enveloped. */
  user: string;
  /** Low by default: this is an extraction and analysis tool, not a writing aid. */
  temperature?: number;
  maxTokens?: number;
}

export async function complete(opts: CompleteOptions): Promise<string> {
  const cfg = modelConfig();
  const model = opts.tier === "heavy" ? cfg.heavyModel : cfg.fastModel;

  try {
    const res = await client().chat.completions.create({
      model,
      temperature: opts.temperature ?? 0,
      max_tokens: opts.maxTokens ?? 2048,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    });
    const text = res.choices[0]?.message?.content;
    if (!text) throw new ModelUnavailableError(`${model} returned no content`);
    return text;
  } catch (err) {
    if (err instanceof ModelUnavailableError) throw err;
    throw new ModelUnavailableError(`${model} request failed`, err);
  }
}

/**
 * Same, but the reply must parse as JSON.
 *
 * Returns the parsed value and leaves validation to the caller — a model
 * returning well-formed JSON says nothing about whether the contents are
 * usable, and callers here have real schemas to check against.
 */
export async function completeJson<T>(
  opts: CompleteOptions & { validate: (value: unknown) => T },
): Promise<T> {
  const cfg = modelConfig();
  const model = opts.tier === "heavy" ? cfg.heavyModel : cfg.fastModel;

  let raw: string;
  try {
    const res = await client().chat.completions.create({
      model,
      temperature: opts.temperature ?? 0,
      max_tokens: opts.maxTokens ?? 2048,
      // Widely supported across OpenAI-compatible providers. json_schema is not,
      // so we ask for an object and validate it ourselves.
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    });
    raw = res.choices[0]?.message?.content ?? "";
  } catch (err) {
    throw new ModelUnavailableError(`${model} request failed`, err);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ModelUnavailableError(`${model} returned content that is not JSON`);
  }

  try {
    return opts.validate(parsed);
  } catch (err) {
    throw new ModelUnavailableError(
      `${model} returned JSON that does not match the expected shape`,
      err,
    );
  }
}
