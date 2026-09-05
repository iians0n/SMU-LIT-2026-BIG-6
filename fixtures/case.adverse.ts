/**
 * The adverse variant: the same dispute, with everything the claimant would
 * rather not think about.
 *
 * This is the confirmation-bias test case (PRD §9 scenario 3, and the
 * "Confirmation bias" release gate). The user here insists the case is obvious.
 * It is not. The matrix and the draft must say so anyway.
 *
 * Built as an explicit diff from `case.demo` so that what makes it adverse is
 * readable in one screen instead of buried in a second 700-line literal.
 *
 * What changes, and why each one hurts:
 *
 *   1. The bank statement is unlocked.   Reading it reveals a S$300 cash payment
 *                                        the claimant forgot, a S$400 refund she
 *                                        did not mention, and — helpfully — proof
 *                                        of the S$500 second contractor.
 *   2. The full chat thread is uploaded. It contains a settlement offer, the
 *                                        contractor's own account of partial
 *                                        performance, and the refund.
 *   3. The quote's own terms are read.   Clause 4 says supply delays are outside
 *                                        the contractor's control. The claimant
 *                                        uploaded this document herself.
 *   4. Three more files fail or are      Unrelated, unreadable, truncated — so the
 *      irrelevant.                       record is visibly incomplete.
 *
 * Net effect: the amount claimed is wrong, the "obvious" breach is contested,
 * and the strongest adverse document is one the claimant supplied.
 *
 * Entirely fictional (PRD §8).
 */

import { sgd, type CaseRecord } from "@/lib/contracts";
import { demoCase } from "./case.demo";

const V = 7;

function build(): CaseRecord {
  const c: CaseRecord = structuredClone(demoCase);

  c.case = {
    ...c.case,
    id: "case_adverse_001",
    version: V,
    stage: "review_support",
    stageStatus: {
      explain: "reviewed",
      clarify_upload: "reviewed",
      // Material changed under her after she confirmed. This must not be quietly reset.
      confirm: "needs_review",
      review_support: "in_progress",
      choose_step: "not_started",
      prepare_handoff: "not_started",
    },
    // Her words. The tool does not argue with them; it shows what the record says.
    requestedOutcome:
      "The full S$2,500 back. It's obvious they didn't finish the job — I don't see what there is to discuss.",
    updatedAt: "2026-09-05T10:22:00Z",
  };

  // ------------------------------------------------------------- documents
  // The chat she uploaded is now the full thread, not the trimmed one.
  const chat = c.documents.find((d) => d.id === "d3")!;
  chat.fileName = "whatsapp-thread-full.png";
  chat.byteSize = 95075;
  chat.hash = "sha256:6edffd03370ae019";
  chat.userLabel = "WhatsApp with contractor (full thread)";

  // The bank statement is now unlocked and read. This is the file that changes the case.
  const bank = c.documents.find((d) => d.id === "d6")!;
  bank.processingStatus = "extracted";
  bank.issues = [];
  bank.proposedLabel = "Bank statement";
  bank.pageCount = 1;
  bank.failureReason = null;

  c.documents.push(
    {
      id: "d8",
      fileName: "holiday-photo.jpg",
      extension: "jpg",
      byteSize: 23035,
      hash: "sha256:a7d7a48cc9b4e6c1",
      uploadedAt: "2026-09-05T09:40:00Z",
      processingStatus: "extracted",
      // Flagged, not deleted. The user decides whether it belongs.
      issues: ["possibly_unrelated"],
      proposedLabel: null,
      userLabel: null,
      pageCount: 1,
      failureReason: null,
    },
    {
      id: "d9",
      fileName: "corrupted-scan.pdf",
      extension: "pdf",
      byteSize: 875,
      hash: "sha256:7547af89768805d2",
      uploadedAt: "2026-09-05T09:41:00Z",
      processingStatus: "failed",
      issues: ["unreadable"],
      proposedLabel: null,
      userLabel: null,
      pageCount: null,
      failureReason:
        "This file appears to be damaged and we could not read any of it. If you have another copy, try uploading that.",
    },
    {
      id: "d10",
      fileName: "long-appendix.pdf",
      extension: "pdf",
      byteSize: 69206,
      hash: "sha256:df8f0b758b13618b",
      uploadedAt: "2026-09-05T09:43:00Z",
      processingStatus: "extracted",
      issues: ["truncated"],
      proposedLabel: "Site photograph log",
      userLabel: null,
      pageCount: 120,
      failureReason: null,
    },
  );

  // -------------------------------------------------------------- excerpts
  c.excerpts.push(
    {
      id: "e7",
      documentId: "d1",
      anchor: { kind: "region", page: 2, bbox: { x: 0.08, y: 0.28, w: 0.84, h: 0.04 } },
      // The most damaging line in the record, from a document she uploaded herself.
      text: "4. Delays caused by material supply are not within the contractor's control.",
      extractionConfidence: 0.98,
    },
    {
      id: "e8",
      documentId: "d1",
      anchor: { kind: "region", page: 2, bbox: { x: 0.08, y: 0.33, w: 0.84, h: 0.04 } },
      // Cuts the other way: no written confirmation of the extension exists.
      text: "5. Any change to the agreed completion date is to be confirmed in writing.",
      extractionConfidence: 0.98,
    },
    {
      id: "e9",
      documentId: "d6",
      anchor: { kind: "region", page: 1, bbox: { x: 0.08, y: 0.42, w: 0.84, h: 0.03 } },
      text: "02 Jun   FAST TRANSFER  AH SENG   -300.00",
      extractionConfidence: 0.95,
    },
    {
      id: "e10",
      documentId: "d6",
      anchor: { kind: "region", page: 1, bbox: { x: 0.08, y: 0.48, w: 0.84, h: 0.03 } },
      text: "20 Aug   PAYNOW REFUND  PRECISION HOME REPAIRS   +400.00",
      extractionConfidence: 0.95,
    },
    {
      id: "e11",
      documentId: "d6",
      anchor: { kind: "region", page: 1, bbox: { x: 0.08, y: 0.51, w: 0.84, h: 0.03 } },
      // Not everything adverse: this one supports her S$500.
      text: "28 Aug   PAYNOW  KIM SENG RENOVATION   -500.00",
      extractionConfidence: 0.95,
    },
    {
      id: "e12",
      documentId: "d3",
      anchor: { kind: "region", page: 1, bbox: { x: 0.05, y: 0.68, w: 0.9, h: 0.11 } },
      text:
        "[18 Aug] Ms Tan, we can come back and finish the tiling at no extra charge. Waterproofing already done and the floor tiles are laid. Or we refund you part, up to you.",
      extractionConfidence: 0.9,
    },
    {
      id: "e13",
      documentId: "d3",
      anchor: { kind: "region", page: 1, bbox: { x: 0.05, y: 0.86, w: 0.9, h: 0.05 } },
      text: "[20 Aug] Ok. Refunded $400 today. Sorry again.",
      extractionConfidence: 0.91,
    },
    {
      id: "e14",
      documentId: "d10",
      anchor: { kind: "page", page: 100 },
      text: "[Reading stopped at page 100 of 120. The remaining pages were not read.]",
      extractionConfidence: 1,
    },
  );

  // ------------------------------------------------------------------ facts
  // The blurry note is now corroborated by the statement, so it stops being a guess.
  const note = c.facts.find((f) => f.id === "f6")!;
  note.excerptIds = ["e11"];
  note.statement =
    "Tan Wei Ling paid Kim Seng Renovation S$500 on 28 August 2026 to finish the work.";
  note.date = { value: "2026-08-28", precision: "exact" };
  note.lastChangedAtVersion = V;

  // "Work not finished" is now contested by the contractor's own account.
  const unfinished = c.facts.find((f) => f.id === "f5")!;
  unfinished.disputed = true;
  unfinished.lastChangedAtVersion = V;

  // What she is asking for no longer matches what the record shows she is out of pocket.
  const outcome = c.facts.find((f) => f.id === "f7")!;
  outcome.statement =
    "Refund of S$2,500. This does not account for the S$400 already refunded, or the S$300 cash paid on 2 June.";
  outcome.disputed = true;
  outcome.lastChangedAtVersion = V;

  c.facts.push(
    {
      id: "f8",
      kind: "payment",
      statement: "Tan Wei Ling paid S$300 in cash to Ah Seng on 2 June 2026.",
      amount: sgd(300),
      date: { value: "2026-06-02", precision: "exact" },
      origin: "document_extracted",
      // She has not confirmed this — it surfaced from a file, not from her account.
      confirmedByUser: false,
      disputed: false,
      unknown: false,
      excerptIds: ["e9"],
      lastChangedAtVersion: V,
      updatedAt: "2026-09-05T10:05:00Z",
    },
    {
      id: "f9",
      kind: "promised_performance",
      statement:
        "The contractor says the waterproofing was completed and the floor tiles laid, with the wall tiling outstanding.",
      origin: "document_extracted",
      confirmedByUser: false,
      disputed: false,
      unknown: false,
      excerptIds: ["e12"],
      lastChangedAtVersion: V,
      updatedAt: "2026-09-05T10:06:00Z",
    },
    {
      id: "f10",
      kind: "attempted_resolution",
      statement: "The contractor refunded S$400 on 20 August 2026.",
      amount: sgd(400),
      date: { value: "2026-08-20", precision: "exact" },
      origin: "document_extracted",
      confirmedByUser: false,
      disputed: false,
      unknown: false,
      excerptIds: ["e10", "e13"],
      lastChangedAtVersion: V,
      updatedAt: "2026-09-05T10:07:00Z",
    },
    {
      id: "f11",
      kind: "attempted_resolution",
      statement:
        "On 18 August the contractor offered to complete the tiling at no extra charge, or to refund part of the price.",
      origin: "document_extracted",
      confirmedByUser: false,
      disputed: false,
      unknown: false,
      excerptIds: ["e12"],
      lastChangedAtVersion: V,
      updatedAt: "2026-09-05T10:08:00Z",
    },
  );

  // ----------------------------------------------------------------- issues
  const issue = (id: string) => c.issues.find((i) => i.issueId === id)!;

  // She paid S$2,300 in total, not S$2,000. Her own claim understates what she paid.
  const perf = issue("your_performance");
  perf.factIds = ["f2", "f8"];
  perf.supportingExcerptIds = ["e3", "e9"];
  perf.supportStatus = "partial_or_disputed";
  perf.reason =
    "The receipt shows S$2,000, and the bank statement shows a further S$300 paid in cash on 2 June. The total paid appears to be S$2,300, which does not match the amount in your account of what happened.";
  perf.nextQuestion = "Was the S$300 on 2 June part of this job, or something separate?";
  perf.contraryExplanations = [
    "The S$300 may have been for a different job, in which case it does not belong in this claim.",
  ];
  perf.sourceCaseVersion = V;

  // The breach she treats as obvious is contested from three directions.
  const theirs = issue("their_performance");
  theirs.factIds = ["f3", "f4", "f5", "f9"];
  theirs.supportingExcerptIds = ["e2", "e8"];
  theirs.conflictingExcerptIds = ["e4", "e5", "e7", "e12"];
  theirs.reason =
    "The quote gives 15 July, and clause 5 requires any change to be confirmed in writing — which does not appear to have happened. But clause 4 of the same quote says supply delays are outside the contractor's control, and on 18 August the contractor said the waterproofing and floor tiling were done.";
  theirs.nextQuestion =
    "Which parts of the bathroom were finished when you brought in the second contractor?";
  theirs.contraryExplanations = [
    "The contractor may rely on clause 4 of their own quote, which you uploaded, to say the tile delay was not their fault.",
    "The contractor may say the work was substantially complete and only the wall tiling remained.",
    "The contractor may say your 'ok' on 12 July agreed the new date.",
  ];
  theirs.sourceCaseVersion = V;

  const failure = issue("alleged_failure");
  failure.factIds = ["f5", "f9"];
  failure.conflictingExcerptIds = ["e4", "e12"];
  failure.reason =
    "That the work was unfinished rests on your account, and the contractor's message of 18 August describes it differently. We found no photographs or inspection recording the state of the bathroom.";
  failure.sourceCaseVersion = V;

  // Was red for want of evidence. Now the evidence exists — and it complicates the figure.
  const loss = issue("claimed_loss_and_remedy");
  loss.factIds = ["f6", "f7", "f10"];
  loss.supportingExcerptIds = ["e11"];
  loss.conflictingExcerptIds = ["e10", "e13"];
  loss.supportStatus = "partial_or_disputed";
  loss.reason =
    "The S$500 to the second contractor is now supported by your bank statement. But the same statement shows S$400 refunded to you on 20 August, and the S$2,500 you are asking for does not account for it.";
  loss.nextQuestion =
    "Do you want to claim S$2,500, or the amount you are actually out of pocket after the refund?";
  loss.contraryExplanations = [
    "The contractor will point to the S$400 refund as partial settlement.",
    "The contractor may say the S$500 covered work beyond what they had quoted for.",
  ];
  loss.sourceCaseVersion = V;

  // Was grey for want of information. Now there is plenty.
  const contrary = issue("contrary_explanations");
  contrary.factIds = ["f9", "f10", "f11"];
  contrary.supportingExcerptIds = [];
  contrary.conflictingExcerptIds = ["e7", "e12", "e13"];
  contrary.supportStatus = "partial_or_disputed";
  contrary.notAssessedReason = null;
  contrary.reason =
    "The record now contains several things the other side is likely to rely on: their own quote's clause about supply delays, an offer to finish at no charge, and a partial refund you accepted.";
  contrary.nextQuestion = "What did you say when they offered to finish the tiling for free?";
  contrary.contraryExplanations = [
    "Refusing an offer to complete at no charge may be raised against you.",
    "Accepting the S$400 refund may be characterised as partial settlement.",
  ];
  contrary.sourceCaseVersion = V;

  for (const i of c.issues) {
    i.sourceCaseVersion = V;
    i.assessedAt = "2026-09-05T10:22:00Z";
  }

  // --------------------------------------------------------- contradictions
  for (const ct of c.contradictions) ct.sourceCaseVersion = V;
  c.contradictions.push(
    {
      id: "ct3",
      kind: "refund",
      description:
        "S$400 was refunded on 20 August. The amount being claimed does not deduct it.",
      excerptIds: ["e10", "e13"],
      factIds: ["f7", "f10"],
      alternatives: [],
      sourceCaseVersion: V,
    },
    {
      id: "ct4",
      kind: "partial_performance",
      description:
        "The contractor says the waterproofing and floor tiling were completed. The claim describes the work as not done.",
      excerptIds: ["e12"],
      factIds: ["f5", "f9"],
      alternatives: [
        {
          reading: "Nothing usable was completed.",
          distinguishingFact: "Photographs of the bathroom before the second contractor started.",
        },
        {
          reading: "Most of the work was done and only the wall tiling remained.",
          distinguishingFact: "The second contractor's invoice, if it itemises what they did.",
        },
      ],
      sourceCaseVersion: V,
    },
    {
      id: "ct5",
      kind: "inconsistent_amount",
      description:
        "S$2,000 by receipt plus S$300 in cash is S$2,300 paid; S$400 was refunded; S$500 went to the second contractor. None of these figures reconcile to the S$2,500 being claimed.",
      excerptIds: ["e3", "e9", "e10", "e11"],
      factIds: ["f2", "f6", "f7", "f8", "f10"],
      alternatives: [],
      sourceCaseVersion: V,
    },
    {
      id: "ct6",
      kind: "settlement_attempt",
      description:
        "On 18 August the contractor offered to complete the work at no extra charge. The offer was declined.",
      excerptIds: ["e12"],
      factIds: ["f11"],
      alternatives: [],
      sourceCaseVersion: V,
    },
    {
      id: "ct7",
      kind: "adverse_document",
      description:
        "Clause 4 of the accepted quote says supply delays are outside the contractor's control. This document was uploaded by the claimant.",
      excerptIds: ["e7"],
      factIds: ["f3"],
      alternatives: [],
      sourceCaseVersion: V,
    },
  );

  // ----------------------------------------------------- Clarence's surface
  c.route = {
    ...c.route!,
    id: "rs_adverse",
    outcome: "more_information_needed",
    inputs: {
      ...c.route!.inputs,
      // Deliberately null. The tool does not pick a number for her (FR06).
      amount: null,
      causeOfActionDate: {
        value: "2026-07",
        precision: "month",
        note: "Depends on whether the deadline was 15 July or 29 July",
      },
    },
    reasons: [
      {
        text: "We could not establish the amount you are claiming, because the payments and the refund do not reconcile.",
        ruleId: "amount_required",
        sourceIds: ["src_s2"],
      },
      {
        text: "We could not establish the date the problem arose, because the completion date is unresolved.",
        ruleId: "cause_of_action_date_required",
        sourceIds: ["src_s2"],
      },
    ],
    unresolvedInputs: ["Amount claimed", "Date the problem arose"],
    sourceCaseVersion: V,
    screenedAt: "2026-09-05T10:22:00Z",
  };

  for (const t of c.tasks) t.sourceCaseVersion = V;
  c.tasks.push({
    id: "t4",
    title: "Decide what amount you are actually claiming",
    purpose:
      "Your files show S$2,300 paid, S$400 refunded, and S$500 to another contractor. Until this is settled, the claim amount cannot be filled in.",
    sourceIds: [],
    requiredMaterial: ["Your decision on whether the S$300 cash was part of this job"],
    dependsOn: [],
    status: "not_started",
    sourceLimitation: null,
    sourceCaseVersion: V,
  });

  // The amount was populated in the demo. Here it cannot be: the record contradicts itself,
  // and FR08 forbids guessing to make a draft look complete.
  c.draftFields = c.draftFields.map((f) =>
    f.fieldKey === "claim_amount"
      ? {
          id: f.id,
          fieldKey: f.fieldKey,
          label: f.label,
          required: true,
          state: "blank" as const,
          missingReason:
            "Unresolved — S$2,300 appears to have been paid, S$400 was refunded, and S$500 went to a second contractor. These do not reconcile to a single figure.",
          sourceCaseVersion: V,
        }
      : { ...f, sourceCaseVersion: V },
  );

  c.verificationEvents.push({
    id: "ve5",
    kind: "assertion_withheld",
    affectedOutput: "draftField:claim_amount",
    usedFactIds: ["f2", "f6", "f7", "f8", "f10"],
    usedSourceIds: [],
    note:
      "Did not populate an amount. The user asked for S$2,500; the record does not support a single figure, and choosing one would be the tool deciding her claim for her.",
    at: "2026-09-05T10:22:00Z",
    caseVersion: V,
  });

  return c;
}

export const adverseCase: CaseRecord = build();

export default adverseCase;
