/**
 * Facts, events, and the open-question list. Written by Anson (FR02, FR04).
 */

import type { Id, ISODate, ImpreciseDate, Money } from "./primitives";

/** Where the value came from. Exactly one applies. */
export type FactOrigin = "user_stated" | "document_extracted" | "inferred";

export const FACT_ORIGIN_LABEL: Record<FactOrigin, string> = {
  user_stated: "You told us",
  document_extracted: "From a document",
  inferred: "Worked out from other information",
};

export type FactKind =
  | "party"
  | "agreement"
  | "promised_performance"
  | "event"
  | "payment"
  | "loss"
  | "attempted_resolution"
  | "other_party_response"
  | "desired_outcome";

export interface Fact {
  readonly id: Id;
  kind: FactKind;
  /** Plain language, shown as-is. */
  statement: string;
  /** Structured value where one applies. Amount calculations only read `amount`. */
  amount?: Money;
  date?: ImpreciseDate;

  origin: FactOrigin;

  /**
   * The user has explicitly confirmed this.
   *
   * FR04: this is deliberately NOT part of `origin`. A user confirming their own
   * recollection does not turn it into independent corroboration, so a fact can
   * be `user_stated` + `confirmedByUser` and still have no supporting evidence.
   */
  confirmedByUser: boolean;

  /** Contradicted by other material. Coexists with confirmedByUser — both can be true. */
  disputed: boolean;

  /** Asked about, and the user said they do not know. Not the same as never asked. */
  unknown: boolean;

  /** Excerpts backing this fact. Empty for a purely user-stated fact. */
  excerptIds: Id[];

  /** Bumped case version at which this fact last changed materially. */
  lastChangedAtVersion: number;
  updatedAt: ISODate;
}

/** The FR02 unresolved-information list, verbatim from the PRD. */
export type QuestionTopic =
  | "parties"
  | "agreement"
  | "promised_performance"
  | "events"
  | "payment"
  | "loss"
  | "attempted_resolution"
  | "other_party_response"
  | "desired_outcome";

export type QuestionStatus = "open" | "answered" | "dont_know" | "skipped";

export interface OpenQuestion {
  readonly id: Id;
  topic: QuestionTopic;
  /** One main question at a time. Neutral phrasing — never leads toward a helpful answer. */
  question: string;
  /** FR02 requires we explain why it matters, in the same breath as asking. */
  whyItMatters: string;
  status: QuestionStatus;
  /** Set when status is "answered". */
  answeredFactId: Id | null;
  askedAt: ISODate | null;
}
