/**
 * Route screening, tasks, drafts, and the official source library.
 * Written by Clarence (FR06, FR07, FR08, FR09).
 */

import type { Id, ISODate, ImpreciseDate, Money } from "./primitives";

/** An official passage we are allowed to rely on. FR09. */
export interface Source {
  readonly id: Id;
  /** S2..S6 in PRD §11. */
  sourceKey: string;
  title: string;
  url: string;
  /**
   * The passage that actually addresses the proposition.
   *
   * FR09: a working URL alone establishes nothing. The grounding gate checks
   * this text, not the link.
   */
  passage: string;
  retrievedAt: ISODate;
  version: string | null;
  lastReviewedAt: ISODate;
}

export type RouteOutcome =
  | "within_supported_route"
  | "more_information_needed"
  | "outside_supported_route";

export const ROUTE_OUTCOME_LABEL: Record<RouteOutcome, string> = {
  within_supported_route: "Appears within supported route",
  more_information_needed: "More information needed",
  outside_supported_route: "Outside supported route",
};

export interface RouteScreeningInputs {
  claimType: string | null;
  amount: Money | null;
  /** The event creating the cause of action. Precision is preserved, never assumed. */
  causeOfActionDate: ImpreciseDate | null;
  respondentInSingapore: boolean | null;
  /** Both parties' consent, for the raised limit. Never assumed — null means not established. */
  bothPartiesConsent: boolean | null;
  exceptionalCircumstances: string[];
}

export interface RouteScreening {
  readonly id: Id;
  outcome: RouteOutcome;
  inputs: RouteScreeningInputs;
  /** Plain-language reasons, each tied to a rule and a source. */
  reasons: Array<{ text: string; ruleId: string; sourceIds: Id[] }>;
  /** Which inputs are still missing or imprecise. Drives "more information needed". */
  unresolvedInputs: string[];
  rulesVersion: string;
  sourceCaseVersion: number;
  screenedAt: ISODate;
}

export type TaskStatus = "not_started" | "in_progress" | "blocked" | "done";

export interface Task {
  readonly id: Id;
  title: string;
  /** FR07: purpose, source, required material, dependency, completion status. */
  purpose: string;
  sourceIds: Id[];
  requiredMaterial: string[];
  dependsOn: Id[];
  status: TaskStatus;
  /** Set when the backing source is stale or unavailable — shown BEFORE the instruction. */
  sourceLimitation: string | null;
  sourceCaseVersion: number;
}

export type SourceRef =
  | { readonly kind: "fact"; readonly factId: Id }
  | { readonly kind: "excerpt"; readonly excerptId: Id }
  | { readonly kind: "source"; readonly sourceId: Id };

interface DraftFieldBase {
  readonly id: Id;
  fieldKey: string;
  label: string;
  required: boolean;
  sourceCaseVersion: number;
}

/**
 * A field in the CJTS worksheet.
 *
 * Modelled as a union so that a populated field WITHOUT provenance is not
 * representable. FR08 requires every populated field to link to a confirmed
 * fact or document; enforcing it in the type means the drafting service cannot
 * forget, and there is no "TODO: add source" state to leak into an export.
 */
export type DraftField =
  | (DraftFieldBase & {
      state: "populated";
      proposedValue: string;
      /** Non-empty by construction. */
      sourceRefs: readonly [SourceRef, ...SourceRef[]];
      reviewed: boolean;
    })
  | (DraftFieldBase & {
      state: "blank";
      /** Why it is blank. Missing required inputs stay blank and get listed. */
      missingReason: string;
    });

export function isPopulated(
  field: DraftField,
): field is Extract<DraftField, { state: "populated" }> {
  return field.state === "populated";
}
