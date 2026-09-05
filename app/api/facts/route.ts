/**
 * POST /api/facts — confirm, dispute, correct, or mark unknown. FR04.
 *
 * Owned by Anson. This is where the staleness clock is wound: a material change
 * bumps case.version, and everything Clarence derives compares its
 * sourceCaseVersion against it (SHARED-CONTRACT §4).
 *
 * "Confirming" is deliberately not the same as "supported". A user confirming
 * their own recollection sets confirmedByUser and nothing else — it does not
 * add an excerpt, and it cannot turn a user-stated fact into corroboration.
 */

import type { Fact, VerificationEvent } from "@/lib/contracts";
import { bumpVersion, getCase, patchCase } from "@/lib/store";

type Action = "confirm" | "unconfirm" | "dispute" | "resolve_dispute" | "correct" | "unknown";

interface Body {
  factId: string;
  action: Action;
  /** For "correct" only. */
  statement?: string;
  amountCents?: number | null;
  date?: string | null;
}

const MATERIAL: ReadonlySet<Action> = new Set([
  "confirm",
  "unconfirm",
  "dispute",
  "resolve_dispute",
  "correct",
  "unknown",
]);

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("The request could not be read.");
  }
  if (!body?.factId || !body?.action) return bad("A fact and an action are required.");

  const record = getCase();
  const fact = record.facts.find((f) => f.id === body.factId);
  if (!fact) return bad("That fact is no longer in the case record.", 404);

  const before: Fact = structuredClone(fact);
  const now = new Date().toISOString();

  switch (body.action) {
    case "confirm":
      fact.confirmedByUser = true;
      fact.unknown = false;
      break;
    case "unconfirm":
      fact.confirmedByUser = false;
      break;
    case "dispute":
      fact.disputed = true;
      break;
    case "resolve_dispute":
      fact.disputed = false;
      break;
    case "unknown":
      fact.unknown = true;
      fact.confirmedByUser = false;
      break;
    case "correct": {
      if (typeof body.statement === "string" && body.statement.trim()) {
        fact.statement = body.statement.trim();
      }
      if (body.amountCents !== undefined) {
        fact.amount =
          body.amountCents === null
            ? undefined
            : { currencyCode: "SGD", minorUnits: Math.round(body.amountCents) };
      }
      if (body.date !== undefined) {
        fact.date =
          body.date === null ? undefined : { value: body.date, precision: "exact" };
      }
      // A corrected value is the user's own account of it now, whatever its
      // origin was. It stays confirmed only if they say so separately.
      fact.origin = "user_stated";
      fact.confirmedByUser = false;
      fact.unknown = false;
      break;
    }
    default:
      return bad("That action is not recognised.");
  }

  const changed = JSON.stringify(before) !== JSON.stringify(fact);
  if (!changed) {
    return Response.json({ caseVersion: record.case.version, changed: false, fact });
  }

  const version = MATERIAL.has(body.action) ? bumpVersion(`fact ${fact.id} ${body.action}`) : record.case.version;

  const event: VerificationEvent = {
    id: `ve_${fact.id}_${Date.now()}`,
    kind: body.action === "correct" ? "user_corrected" : "user_confirmed",
    affectedOutput: `fact:${fact.id}`,
    usedFactIds: [fact.id],
    usedSourceIds: [],
    note:
      body.action === "correct"
        ? `Corrected from “${before.statement}” to “${fact.statement}”.`
        : `Marked ${body.action.replace("_", " ")}.`,
    at: now,
    caseVersion: version,
  };

  patchCase((draft) => {
    draft.facts = draft.facts.map((f) => (f.id === fact.id ? { ...fact, lastChangedAtVersion: version, updatedAt: now } : f));
    draft.verificationEvents.push(event);
    // A confirmed record that has since moved needs looking at again.
    draft.case.stageStatus.confirm = "needs_review";
  });

  return Response.json({ caseVersion: version, changed: true, fact: getCase().facts.find((f) => f.id === fact.id) });
}
