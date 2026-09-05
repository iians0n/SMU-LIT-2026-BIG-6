/**
 * Preparation checklist for a goods or services contract dispute.
 *
 * ⚠ NOT LEGALLY REVIEWED. FR05 is explicit: "This is a proposed product
 * checklist; it must be legally reviewed before being presented as the
 * applicable legal elements." Until a suitably qualified reviewer approves it
 * (a stated pre-pilot decision, PRD §10), every surface that renders these
 * items must also render `CHECKLIST_REVIEW_NOTICE`.
 *
 * This is a list of things worth having straight before filing. It is not a
 * legal test, and satisfying every row is not a prediction of any outcome.
 */

import type { ChecklistItem, Id } from "@/lib/contracts";

export const CHECKLIST_VERSION = "goods-services-v1-draft";

export const CHECKLIST_REVIEW_NOTICE =
  "This checklist is a working draft prepared by the product team. It has not been reviewed by a qualified lawyer and does not set out the legal elements of a claim.";

export interface ChecklistItemDef extends ChecklistItem {
  order: number;
  /** Ordinary-language prompt shown as the row heading in the evidence matrix. */
  label: string;
  /** One sentence on what this row is for. */
  description: string;
  /** What material usually speaks to this, phrased for someone with no legal training. */
  typicalEvidence: string[];
  /**
   * Neutral prompts to offer when support is thin.
   *
   * FR02: these must test the account rather than suggest a favourable answer.
   * Nothing here may be phrased so that agreeing with it helps the claimant.
   */
  probes: string[];
}

export const goodsServicesChecklistV1: readonly ChecklistItemDef[] = [
  {
    id: "agreement_and_terms",
    order: 1,
    label: "What was agreed, and on what terms",
    description:
      "What the two of you actually agreed to — the work or goods, the price, and any conditions attached.",
    typicalEvidence: [
      "A quote, order form, or written agreement",
      "Messages settling the price or the scope",
      "An invoice describing what was being paid for",
    ],
    probes: [
      "Was anything agreed verbally that is not written down anywhere?",
      "Were there terms and conditions attached to the quote or invoice?",
      "Did the scope or the price change after you first agreed?",
    ],
  },
  {
    id: "your_performance",
    order: 2,
    label: "What you did under the agreement",
    description:
      "What you were meant to do — usually paying — and what the record shows you actually did.",
    typicalEvidence: [
      "Receipts, bank transfers, or payment confirmations",
      "Messages acknowledging payment",
      "Records of access, deposits, or materials you provided",
    ],
    probes: [
      "Was the full amount paid, or part of it?",
      "Was anything paid in cash, or to someone other than the business?",
      "Was there anything you were meant to do that has not been done yet?",
    ],
  },
  {
    id: "their_performance",
    order: 3,
    label: "What the other side did, and by when",
    description:
      "What the other side was meant to deliver, by what date, and what the record shows actually happened.",
    typicalEvidence: [
      "The agreed delivery or completion date",
      "Messages about progress, delays, or changes to the date",
      "Delivery notes, handover records, or photographs",
    ],
    probes: [
      "Was a completion or delivery date ever changed, by either side?",
      "Was any part of the work or the order completed?",
      "Did the other side give a reason for any delay?",
    ],
  },
  {
    id: "alleged_failure",
    order: 4,
    label: "What went wrong",
    description:
      "The specific thing you say the other side did not do, or did badly — stated precisely enough to be checked.",
    typicalEvidence: [
      "Photographs or an inspection of the goods or the work",
      "Messages where you raised the problem at the time",
      "A second opinion, report, or quote to put it right",
    ],
    probes: [
      "When did you first tell the other side there was a problem?",
      "Is there anything recording the state of the goods or work at that point?",
      "Would the other side describe what happened differently?",
    ],
  },
  {
    id: "claimed_loss_and_remedy",
    order: 5,
    label: "What you lost, and what you are asking for",
    description:
      "The amount you are out of pocket and how you arrive at it — including anything already refunded or recovered.",
    typicalEvidence: [
      "Invoices or receipts for putting the problem right",
      "Bank records showing what was paid and what came back",
      "A calculation showing how the figure is built up",
    ],
    probes: [
      "Has any amount been refunded, credited, or returned to you?",
      "Does the figure include anything you would have had to pay anyway?",
      "Can each part of the amount be traced to a record?",
    ],
  },
  {
    id: "contrary_explanations",
    order: 6,
    label: "What the other side might say",
    description:
      "The account the other side is likely to give, drawn only from material actually in the record.",
    typicalEvidence: [
      "Their messages explaining delays or refusing a request",
      "Terms in the agreement that work in their favour",
      "Any offer to fix, replace, refund, or settle",
    ],
    probes: [
      "Did the other side ever offer to put things right?",
      "Is there anything in the agreement that supports their position?",
      "Has anything been agreed or accepted since the problem arose?",
    ],
  },
] as const;

export const CHECKLIST_ITEM_IDS: readonly Id[] = goodsServicesChecklistV1.map((i) => i.id);

export function checklistItem(id: Id): ChecklistItemDef | undefined {
  return goodsServicesChecklistV1.find((i) => i.id === id);
}
