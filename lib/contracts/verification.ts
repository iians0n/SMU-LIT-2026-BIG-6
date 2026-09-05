/**
 * The review record. FR11.
 *
 * Appended by BOTH of us — Anson from the intake and assessment pipeline,
 * Clarence from drafting. Clarence owns the store and the export.
 *
 * Append-only. Nothing in the app edits or deletes an event.
 */

import type { Id, ISODate } from "./primitives";

export type VerificationEventKind =
  | "ai_drafted"
  | "ai_extracted"
  | "ai_suggested"
  | "user_corrected"
  | "user_confirmed"
  | "user_reviewed"
  | "assertion_withheld";

export const VERIFICATION_EVENT_LABEL: Record<VerificationEventKind, string> = {
  ai_drafted: "AI drafted",
  ai_extracted: "AI extracted from a document",
  ai_suggested: "AI suggested",
  user_corrected: "You corrected",
  user_confirmed: "You confirmed",
  user_reviewed: "You reviewed",
  assertion_withheld: "Withheld — no supporting source",
};

export interface VerificationEvent {
  readonly id: Id;
  kind: VerificationEventKind;
  /** What this event is about, e.g. "fact:f_003" or "draftField:claim_summary". */
  affectedOutput: string;
  /** Facts and sources the AI contribution relied on. */
  usedFactIds: Id[];
  usedSourceIds: Id[];
  /** Plain-language note, e.g. the text of a withheld assertion and why. */
  note: string | null;
  at: ISODate;
  caseVersion: number;
}
