/**
 * Issue assessment and contradictions. Written by Anson (FR05, FR10).
 * Read by Clarence's drafting service.
 */

import type { Id, ISODate } from "./primitives";

/**
 * Evidence support for ONE factual point.
 *
 * Not a merits assessment, not a win probability, and never a summary of the
 * whole claim. PRD §1 is explicit about this and the demo depends on it.
 */
export type SupportStatus =
  | "supported"
  | "partial_or_disputed"
  | "missing"
  | "not_assessed";

/**
 * Every status ships with its text label. Colour is supplementary (PRD §3), so
 * `components/ui/StatusBadge` takes the label as a required prop and reads it
 * from here — there is no code path that renders colour alone.
 */
export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  supported: "Supported",
  partial_or_disputed: "Partial or disputed",
  missing: "Support missing",
  not_assessed: "Not assessed",
};

export const SUPPORT_STATUS_MEANING: Record<SupportStatus, string> = {
  supported:
    "Material we found directly supports this specific point, and we did not detect a conflict. This does not certify that it is true or legally sufficient.",
  partial_or_disputed:
    "Support is incomplete, indirect, ambiguous, or contradicted by other material.",
  missing:
    "We have not identified supporting material for this point. That does not mean the point is false.",
  not_assessed:
    "We could not assess this — processing failed, there is not enough information, or it falls outside what this tool covers.",
};

/** Why a row is grey. Three different situations, three different next steps. */
export type NotAssessedReason =
  | "processing_failed"
  | "insufficient_information"
  | "outside_supported_scope";

export interface ChecklistItem {
  readonly id: Id;
  /** Ordinary language, not legal terminology. */
  label: string;
  description: string;
}

export interface IssueAssessment {
  readonly id: Id;
  issueId: Id;
  /** Which checklist version produced this. Pending legal review — surfaced in the UI. */
  checklistVersion: string;
  label: string;

  factIds: Id[];
  supportingExcerptIds: Id[];
  /** Kept separate and always displayed alongside supporting material (FR05). */
  conflictingExcerptIds: Id[];

  supportStatus: SupportStatus;
  notAssessedReason: NotAssessedReason | null;

  /** Why it got that status, in plain language. Required — a bare badge is not enough. */
  reason: string;

  /** The next useful question for this row. Null once nothing more would help. */
  nextQuestion: string | null;

  /**
   * FR05: every assessment states possible contrary explanations, or says none
   * were identified in the reviewed material. Empty array means "none identified"
   * and the UI must say so explicitly rather than rendering nothing.
   */
  contraryExplanations: string[];

  sourceCaseVersion: number;
  assessedAt: ISODate;
}

/** What FR10 scans for before any issue review or narrative draft is generated. */
export type ContradictionKind =
  | "inconsistent_date"
  | "inconsistent_amount"
  | "partial_performance"
  | "changed_terms"
  | "refund"
  | "settlement_attempt"
  | "adverse_document";

export const CONTRADICTION_KIND_LABEL: Record<ContradictionKind, string> = {
  inconsistent_date: "Dates do not agree",
  inconsistent_amount: "Amounts do not agree",
  partial_performance: "Work may have been partly done",
  changed_terms: "Terms may have changed",
  refund: "A refund may have been given",
  settlement_attempt: "Settlement may have been discussed",
  adverse_document: "A document may work against the claim",
};

export interface Contradiction {
  readonly id: Id;
  kind: ContradictionKind;
  description: string;
  /** Always cite the specific source. FR10 forbids a vague concern. */
  excerptIds: Id[];
  factIds: Id[];
  /**
   * Where more than one reading remains plausible, both are listed with the fact
   * that would tell them apart. Not the tool's job to pick one.
   */
  alternatives: Array<{ reading: string; distinguishingFact: string }>;
  sourceCaseVersion: number;
}
