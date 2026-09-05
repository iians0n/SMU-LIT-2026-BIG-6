/**
 * POST /api/intake — the user's opening account, spoken or typed. FR01.
 *
 * Owned by Anson. Stored as the user's own words, as a user_stated fact that is
 * NOT pre-confirmed: FR01 requires the interface to distinguish what the user
 * said from any summary of it, and auto-confirming would erase that line before
 * they had a chance to read it back.
 */

import { bumpVersion, getCase, patchCase } from "@/lib/store";

export async function POST(request: Request) {
  let body: { account?: string; source?: "voice" | "text" };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request could not be read." }, { status: 400 });
  }

  const account = body.account?.trim();
  if (!account) return Response.json({ error: "Nothing was recorded." }, { status: 400 });

  const now = new Date().toISOString();
  const id = `f_account_${Date.now().toString(36)}`;

  patchCase((draft) => {
    draft.facts.push({
      id,
      kind: "event",
      statement: account,
      origin: "user_stated",
      confirmedByUser: false,
      disputed: false,
      unknown: false,
      excerptIds: [],
      lastChangedAtVersion: draft.case.version + 1,
      updatedAt: now,
    });
    draft.verificationEvents.push({
      id: `ve_intake_${Date.now()}`,
      kind: "user_reviewed",
      affectedOutput: `fact:${id}`,
      usedFactIds: [id],
      usedSourceIds: [],
      note: `Account given by ${body.source === "voice" ? "voice" : "typing"} and kept as written.`,
      at: now,
      caseVersion: draft.case.version,
    });
    draft.case.stageStatus.explain = "in_progress";
  });

  const version = bumpVersion("opening account recorded");
  return Response.json({ caseVersion: version, factId: id, caseId: getCase().case.id });
}
