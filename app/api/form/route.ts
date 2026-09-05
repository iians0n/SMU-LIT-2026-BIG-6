/**
 * GET /api/form — the CJTS claim form as it currently stands. FR08.
 *
 * Derived fresh from the case record on every read, so it always reflects the
 * conversation rather than a snapshot that could drift from it.
 */

import { deriveForm } from "@/lib/cjts/form";
import { getCase } from "@/lib/store";

export async function GET() {
  return Response.json(deriveForm(getCase()));
}
