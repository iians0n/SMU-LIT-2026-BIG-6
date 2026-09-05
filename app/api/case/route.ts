/**
 * GET /api/case — the full case record. SHARED-CONTRACT §3.
 *
 * Owned by Anson. Clarence reads this; he does not edit this file.
 * Thin on purpose: the store is the thing, this just exposes it.
 */

import { currentCaseWithDerivedState } from "@/lib/workflow";

export async function GET() {
  return Response.json(currentCaseWithDerivedState());
}
