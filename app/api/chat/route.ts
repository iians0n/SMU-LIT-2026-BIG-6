/**
 * POST /api/chat — one turn of the conversation.
 *
 * Owned by Anson. The assistant runs server-side only: the key never reaches
 * the browser, and case content never leaves it by that route.
 */

import { ModelUnavailableError } from "@/lib/ai/client";
import { agentAvailable, runTurn, type ChatMessage } from "@/lib/agent";
import { getCase } from "@/lib/store";

export async function GET() {
  return Response.json({ available: agentAvailable() });
}

export async function POST(request: Request) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request could not be read." }, { status: 400 });
  }

  const messages = (body.messages ?? []).filter(
    (m): m is ChatMessage =>
      (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string",
  );
  if (messages.length === 0) {
    return Response.json({ error: "There is nothing to reply to." }, { status: 400 });
  }

  try {
    const result = await runTurn(messages.slice(-24));
    return Response.json({ ...result, caseVersion: getCase().case.version });
  } catch (error) {
    // Never substitute a plausible-sounding reply for a failed call. The user
    // is told the assistant is unavailable, and their typing is not lost.
    if (error instanceof ModelUnavailableError) {
      return Response.json({ error: error.message, unavailable: true }, { status: 503 });
    }
    return Response.json(
      { error: "Something went wrong on our side. Your answers are still saved." },
      { status: 500 },
    );
  }
}
