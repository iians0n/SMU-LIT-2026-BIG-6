/**
 * POST /api/transcribe — speech to text. FR01.
 *
 * Owned by Anson. The recording is relayed to the provider and dropped; nothing
 * is written to disk and nothing enters the case record here. The transcript
 * comes back to the user's input box where they can correct it before sending,
 * because "the interface distinguishes the user's spoken account from the AI's
 * summary" starts with letting them read what was heard.
 */

import { ModelUnavailableError, modelConfig, transcribeAudio } from "@/lib/ai/client";
import { isLikelySilenceHallucination } from "@/lib/voice/transcript";

/** A minute of speech is plenty for one answer, and caps what a bad request costs. */
const MAX_BYTES = 25 * 1024 * 1024;

export async function GET() {
  const cfg = modelConfig();
  return Response.json({ available: cfg.configured, model: cfg.transcribeModel });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "The recording could not be read." }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: "No recording was received." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return Response.json(
      { error: "That recording is too long. Try again in shorter pieces." },
      { status: 413 },
    );
  }

  try {
    const text = await transcribeAudio(audio);
    if (!text || isLikelySilenceHallucination(text)) {
      // Silence is not an error, but it must not look like one either.
      return Response.json({ text: "", empty: true });
    }
    return Response.json({ text });
  } catch (error) {
    if (error instanceof ModelUnavailableError) {
      return Response.json(
        { error: "We could not turn that recording into text. You can type instead.", unavailable: true },
        { status: 503 },
      );
    }
    return Response.json({ error: "Something went wrong. You can type instead." }, { status: 500 });
  }
}
