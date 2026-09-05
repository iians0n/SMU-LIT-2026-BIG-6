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
  transcribeModel: string;
  configured: boolean;
}

export function modelConfig(): ModelConfig {
  return {
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    fastModel: process.env.OPENAI_MODEL_FAST ?? "gpt-4o-mini",
    heavyModel: process.env.OPENAI_MODEL ?? "gpt-4o",
    transcribeModel: process.env.OPENAI_MODEL_TRANSCRIBE ?? "whisper-1",
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
 * Send a completion, dropping parameters the model rejects and retrying.
 *
 * Model families disagree about their own API. gpt-5.6-luna wants
 * `max_completion_tokens` not `max_tokens`, refuses any `temperature` other
 * than the default, and will not accept function tools unless
 * `reasoning_effort` is "none". gpt-4o accepts all of them. Hardcoding a table
 * of which model tolerates what would be stale within weeks, and the PRD
 * deliberately leaves the vendor choice open - so the client reads the error,
 * removes the parameter the API names, and tries again.
 *
 * Only ever removes optional tuning parameters, so a retry cannot change what
 * was asked, just how it was framed.
 */
const DROPPABLE = new Set(["temperature", "reasoning_effort", "max_completion_tokens", "top_p"]);

async function createCompletion(
  body: Record<string, unknown>,
  model: string,
): Promise<{ role: string; content: string | null; tool_calls?: unknown[] }> {
  const attempt = { ...body };

  for (let i = 0; i <= DROPPABLE.size; i++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await client().chat.completions.create(attempt as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = (res as any).choices?.[0]?.message;
      if (!message) throw new ModelUnavailableError(`${model} returned no message`);
      return message;
    } catch (err) {
      const detail = err as { status?: number; param?: string; error?: { param?: string; message?: string }; message?: string };
      const param = detail.param ?? detail.error?.param;
      const text = detail.error?.message ?? detail.message ?? "";

      // "use X instead" - swap rather than drop, so the request still carries a limit.
      if (param === "max_tokens" && /max_completion_tokens/.test(text)) {
        attempt.max_completion_tokens = attempt.max_tokens;
        delete attempt.max_tokens;
        continue;
      }
      // The reasoning-plus-tools restriction names the fix in its message.
      if (/reasoning_effort to 'none'/.test(text)) {
        attempt.reasoning_effort = "none";
        continue;
      }
      if (param && DROPPABLE.has(param) && param in attempt) {
        delete attempt[param];
        continue;
      }
      if (err instanceof ModelUnavailableError) throw err;
      throw new ModelUnavailableError(`${model} request failed: ${text.slice(0, 200)}`, err);
    }
  }
  throw new ModelUnavailableError(`${model} rejected every parameter combination tried`);
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
  const message = await createCompletion(
    {
      model,
      messages: params.messages,
      tools: params.tools,
      temperature: params.temperature ?? 0.3,
      max_completion_tokens: params.maxTokens ?? 4000,
    },
    model,
  );
  return { message };
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
    const message = await createCompletion(
      {
        model,
        temperature: opts.temperature ?? 0,
        max_completion_tokens: opts.maxTokens ?? 2048,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      },
      model,
    );
    if (!message.content) throw new ModelUnavailableError(`${model} returned no content`);
    return message.content;
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
    const message = await createCompletion(
      {
        model,
        temperature: opts.temperature ?? 0,
        max_completion_tokens: opts.maxTokens ?? 2048,
        // Widely supported across OpenAI-compatible providers. json_schema is not,
        // so we ask for an object and validate it ourselves.
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      },
      model,
    );
    raw = message.content ?? "";
  } catch (err) {
    if (err instanceof ModelUnavailableError) throw err;
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


/**
 * Speech to text.
 *
 * This sends the recording to the model provider, which is a real change from
 * doing it in the browser: the audio leaves the device. FR01 requires the user
 * to be told what happens to a recording BEFORE the microphone is activated, so
 * the consent wording says so plainly rather than claiming it stays local.
 *
 * The audio is not retained by us. It is sent, transcribed, and dropped — only
 * the text is kept, and the user edits that text before anything is recorded.
 */
export async function transcribeAudio(file: File): Promise<string> {
  const cfg = modelConfig();
  try {
    const result = await client().audio.transcriptions.create({
      file,
      model: cfg.transcribeModel,
      // Singapore English. Naming it improves accuracy on local names and
      // amounts, which are the values most costly to get wrong.
      language: "en",
    });
    return (result as unknown as { text?: string }).text?.trim() ?? "";
  } catch (err) {
    throw new ModelUnavailableError(
      `${cfg.transcribeModel} could not transcribe that recording`,
      err,
    );
  }
}
