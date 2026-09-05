/**
 * POST /api/case/reset — clear the case back to empty.
 *
 * Owned by Anson. The store lives in memory for the life of the server, so
 * anything typed or spoken stays until the process restarts. That is fine for
 * P0, and awkward for a demo you want to run more than once — hence a reset
 * that does not require restarting anything.
 *
 * Destructive and irreversible, so the UI confirms first.
 */

import { getCase, resetCase } from "@/lib/store";

export async function POST() {
  const before = getCase();
  const cleared = resetCase();
  return Response.json({
    cleared: true,
    // Reported so the UI can say what was actually discarded rather than
    // claiming success over an already-empty case.
    discarded: {
      facts: before.facts.length,
      documents: before.documents.length,
      parties: before.parties.length,
    },
    caseVersion: cleared.case.version,
  });
}
