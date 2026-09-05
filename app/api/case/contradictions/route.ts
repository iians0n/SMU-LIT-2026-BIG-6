/**
 * GET /api/case/contradictions — SHARED-CONTRACT §3.
 *
 * Owned by Anson. Clarence's drafting service consumes this so a narrative
 * cannot be assembled without seeing what works against the claim (FR10).
 *
 * Detection is deterministic, so this cannot fail for want of an API key. A
 * drafting service that received an empty list because a key was missing would
 * quietly produce a one-sided draft, which is the exact failure the
 * confirmation-bias gate exists to prevent.
 */

import { detectContradictions } from "@/lib/assessment/contradictions";
import { getCase } from "@/lib/store";

export async function GET() {
  const record = getCase();
  return Response.json({
    caseVersion: record.case.version,
    contradictions: detectContradictions(record),
  });
}
