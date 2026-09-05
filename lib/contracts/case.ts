/**
 * The case aggregate. This is what `GET /api/case` returns.
 *
 * Owned jointly — see SHARED-CONTRACT.md §2. Anson writes the top block,
 * Clarence writes the bottom block, both append verification events.
 */

import type { Id, ISODate } from "./primitives";
import type { Document, Excerpt } from "./documents";
import type { Fact, OpenQuestion } from "./facts";
import type { Contradiction, IssueAssessment } from "./assessment";
import type { DraftField, RouteScreening, Source, Task } from "./handoff";
import type { VerificationEvent } from "./verification";

/** The six journey stages in PRD §3. */
export type Stage =
  | "explain"
  | "clarify_upload"
  | "confirm"
  | "review_support"
  | "choose_step"
  | "prepare_handoff";

export const STAGES: readonly Stage[] = [
  "explain",
  "clarify_upload",
  "confirm",
  "review_support",
  "choose_step",
  "prepare_handoff",
] as const;

export const STAGE_LABEL: Record<Stage, string> = {
  explain: "Explain",
  clarify_upload: "Clarify and upload",
  confirm: "Confirm",
  review_support: "Review support",
  choose_step: "Choose a next step",
  prepare_handoff: "Prepare and hand off",
};

export type StageStatus = "not_started" | "in_progress" | "needs_review" | "reviewed";

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  needs_review: "Needs review",
  reviewed: "Reviewed",
};

export type ClaimCategory = "goods" | "services" | "goods_and_services" | "other" | "unknown";

export type PartyRole = "claimant" | "respondent";
export type PartyKind = "individual" | "business" | "unknown";

export interface Party {
  readonly id: Id;
  role: PartyRole;
  name: string | null;
  kind: PartyKind;
  /** Drives the conditional ACRA profile in the CJTS checklist (S3). */
  acraProfileNeeded: boolean;
  inSingapore: boolean | null;
  notes: string | null;
}

export interface CaseMeta {
  readonly id: Id;

  /**
   * The staleness clock (SHARED-CONTRACT §4).
   *
   * Anson bumps it on any material fact change. Clarence compares it against
   * `sourceCaseVersion` on his derived objects and shows "Needs review" when
   * they differ. Readonly here on purpose: only `caseStore.bumpVersion()` writes
   * it, and it does so through an internal cast. Nothing else in the app may.
   */
  readonly version: number;

  ownerId: string;
  stage: Stage;
  stageStatus: Record<Stage, StageStatus>;
  claimCategory: ClaimCategory;
  /** What the user says they want. Their words, not a legal remedy label. */
  requestedOutcome: string | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface CaseRecord {
  case: CaseMeta;
  parties: Party[];

  // ---- Anson writes ----
  documents: Document[];
  excerpts: Excerpt[];
  facts: Fact[];
  openQuestions: OpenQuestion[];
  issues: IssueAssessment[];
  contradictions: Contradiction[];

  // ---- Clarence writes ----
  sources: Source[];
  route: RouteScreening | null;
  tasks: Task[];
  draftFields: DraftField[];

  // ---- Both append ----
  verificationEvents: VerificationEvent[];
}

/**
 * True when a derived object was built from an older case version and needs
 * re-review. The whole staleness mechanism, in one function.
 */
export function isStale(
  derived: { sourceCaseVersion: number },
  caseMeta: CaseMeta,
): boolean {
  return derived.sourceCaseVersion !== caseMeta.version;
}
