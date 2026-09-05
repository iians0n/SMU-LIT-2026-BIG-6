/**
 * A blank case. This is what the app boots with.
 *
 * The demo fixture used to seed the running app, which meant anyone opening it
 * landed in the middle of a stranger's dispute with seven documents already
 * uploaded. For a live demo that is worse than useless — you cannot show the
 * assistant gathering a case if the case is already gathered.
 *
 * The fixtures are still the test oracle and still exercise every failure mode;
 * they simply no longer leak into the product. `resetCase(demoCase)` loads the
 * worked example when a test or the rehearsal script wants it.
 */

import type { CaseRecord } from "@/lib/contracts";

export function emptyCase(ownerId = "user_demo"): CaseRecord {
  const now = new Date().toISOString();
  return {
    case: {
      id: `case_${Date.now().toString(36)}`,
      version: 1,
      ownerId,
      stage: "explain",
      stageStatus: {
        explain: "not_started",
        clarify_upload: "not_started",
        confirm: "not_started",
        review_support: "not_started",
        choose_step: "not_started",
        prepare_handoff: "not_started",
      },
      claimCategory: "unknown",
      requestedOutcome: null,
      createdAt: now,
      updatedAt: now,
    },
    // No placeholder parties. An empty name would render as a blank row that
    // looks like a bug, and the assistant asks who the other side is anyway.
    parties: [],
    documents: [],
    excerpts: [],
    facts: [],
    openQuestions: [],
    issues: [],
    contradictions: [],
    sources: [],
    route: null,
    tasks: [],
    draftFields: [],
    verificationEvents: [],
  };
}
