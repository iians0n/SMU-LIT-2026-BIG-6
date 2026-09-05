/**
 * The conversation loop.
 *
 * The assistant talks, records what it is told, and reads documents. Everything
 * that constitutes a judgement — whether evidence supports a point, whether the
 * claim fits the tribunal, what the amount is — runs as rules over the record
 * afterwards. Keeping that boundary is the whole design: the model is good at
 * language and unreliable at gates, so it only does the first.
 */

import { ModelUnavailableError, chatWithTools, modelConfig } from "@/lib/ai/client";
import { getCase } from "@/lib/store";
import { detectContradictions } from "@/lib/assessment/contradictions";
import { deriveForm } from "@/lib/cjts/form";
import { planIntakeProgress, type IntakeNextStep } from "./intake";
import { SYSTEM_PROMPT, caseContext } from "./prompt";
import { TOOLS, runTool } from "./tools";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TurnResult {
  reply: string;
  /** True when the case record changed, so the UI refreshes the panels beside the chat. */
  mutated: boolean;
  /** Named for the transcript so a user can see what the assistant did, not just what it said. */
  actions: string[];
  /** Direct destinations shown only after the intake has ended. */
  nextSteps: IntakeNextStep[];
}

/** Enough for read-then-record. A normal answer returns after one model call. */
const MAX_TOOL_ROUNDS = 3;

/**
 * What the assistant already knows, so it does not ask about it.
 *
 * Deliberately terse. The point is to prevent re-asking, not to hand the model
 * the whole record to reason over — the record is large and most of it is not
 * conversational context.
 */
function summariseCase(): string {
  const record = getCase();
  const lines: string[] = [];

  const parties = record.parties.filter((p) => p.name);
  if (parties.length) {
    lines.push(`Parties: ${parties.map((p) => `${p.name} (${p.role})`).join(", ")}`);
  }

  const facts = record.facts.filter((f) => !f.unknown);
  if (facts.length) {
    lines.push("Already recorded:");
    for (const f of facts.slice(0, 25)) {
      const flags = [
        f.confirmedByUser ? "confirmed" : "not yet confirmed",
        f.disputed ? "CONFLICTS with a document" : null,
      ].filter(Boolean).join(", ");
      lines.push(`  - [${f.id}] ${f.statement} (${flags})`);
    }
  }

  const asked = record.openQuestions.filter((q) => q.status !== "open");
  if (asked.length) {
    lines.push(`Already asked and set aside: ${asked.map((q) => q.question).join(" | ")}`);
  }

  const docs = record.documents;
  if (docs.length) {
    lines.push(
      `Documents: ${docs.map((d) => `${d.fileName}${d.processingStatus === "failed" ? " (could not be read)" : ""}`).join(", ")}`,
    );
  }

  // Surfaced so the assistant can raise them in conversation. It did not find
  // them and cannot add to them — the detector is deterministic.
  const conflicts = detectContradictions(record);
  if (conflicts.length) {
    lines.push("Conflicts the rules have already found (raise these, do not invent others):");
    for (const c of conflicts) lines.push(`  - ${c.description}`);
  }

  // What the form still needs, so the conversation has a destination. Without
  // it the assistant asks reasonable questions in no useful order.
  const form = deriveForm(record);
  if (form.outstanding.length) {
    lines.push(
      `Still needed for the claim form: ${form.outstanding.join("; ")}.`,
      "Extract every supplied item now. After saving, the app will group all remaining fields into one short follow-up. Never ask for the pre-filing assessment number - CJTS issues that.",
    );
  } else if (record.facts.length) {
    lines.push("The claim form has everything it needs. Do not ask another intake question.");
  }

  return lines.length ? lines.join("\n") : "Nothing recorded yet. This is the start of the conversation.";
}

export function agentAvailable(): boolean {
  return modelConfig().configured;
}

export async function runTurn(history: ChatMessage[]): Promise<TurnResult> {
  if (!agentAvailable()) {
    throw new ModelUnavailableError(
      "No model is configured, so the assistant cannot reply. Copy .env.example to .env.local and add an OPENAI_API_KEY.",
    );
  }

  const messages: unknown[] = [
    { role: "system", content: SYSTEM_PROMPT + caseContext(summariseCase()) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const actions: string[] = [];
  let mutated = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const { message } = await chatWithTools({
      messages,
      tools: TOOLS as unknown as unknown[],
      tier: "fast",
      maxTokens: 1800,
    });
    messages.push(message);

    const calls = (message.tool_calls ?? []) as Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;

    if (calls.length === 0) {
      return { reply: message.content?.trim() ?? "", mutated, actions, nextSteps: [] };
    }

    const readDocuments = calls.some((call) => call.function.name === "read_documents");
    let changedThisRound = false;

    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // A malformed call is told so and retried rather than crashing the turn.
        messages.push({ role: "tool", tool_call_id: call.id, content: "Those arguments were not valid JSON." });
        continue;
      }

      const result = await runTool(call.function.name, args);
      mutated = mutated || result.mutated;
      changedThisRound = changedThisRound || result.mutated;
      if (result.mutated) {
        // Every tool needs its own line here. The fallback used to catch
        // record_party and set_claim_type and label both "Recorded as not
        // known", so the transcript said the opposite of what had happened.
        const describe: Record<string, () => string> = {
          record_fact: () => `Noted: ${String(args.statement ?? "").slice(0, 90)}`,
          correct_fact: () => "Corrected an earlier note",
          record_party: () =>
            `Added to the form: ${args.role === "respondent" ? "who you are claiming against" : "your details"} — ${String(args.name ?? "")}`,
          set_claim_type: () => `Set the nature of the dispute`,
          note_unknown: () => "Recorded as not known",
        };
        actions.push(describe[call.function.name]?.() ?? `Updated the case`);
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: result.content });
    }

    // A document read needs one more model pass so its contents can be used.
    // Ordinary intake answers stop here: rules generate the grouped follow-up,
    // saving a second (previously heavy-model) round trip on every answer.
    if (changedThisRound && !readDocuments) {
      const intake = planIntakeProgress(getCase());
      const compactActions =
        actions.length > 3 ? [`Saved ${actions.length} details to your worksheet`] : actions;
      return {
        reply: intake.reply,
        mutated,
        actions: compactActions,
        nextSteps: intake.nextSteps,
      };
    }
  }

  // Ran out of rounds. Say so rather than returning silence.
  return {
    reply:
      "Sorry — I got tangled up there. Could you tell me that again, or ask me something more specific?",
    mutated,
    actions,
    nextSteps: [],
  };
}
