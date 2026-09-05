/**
 * Annotated expectations — the M1 test oracle.
 *
 * Each entry states something that must be true of a case record, and which PRD
 * requirement it protects. Right now they run against the fixtures. When Anson's
 * real pipeline lands at M2 they run unchanged against its output, which is the
 * point: the fixtures are not the subject, they are the first thing to satisfy
 * the oracle.
 *
 *     npm run check:fixtures
 *
 * A check returns `true` to pass, or a string explaining the failure.
 */

import type { CaseRecord, SupportStatus } from "@/lib/contracts";
import { isPopulated } from "@/lib/contracts";
import { CHECKLIST_ITEM_IDS, CHECKLIST_VERSION } from "@/lib/assessment/checklist.v1";

export interface Expectation {
  id: string;
  /** What must be true, in plain language. */
  what: string;
  /** Which requirement or acceptance criterion this protects. */
  why: string;
  check: (r: CaseRecord) => true | string;
}

const issue = (r: CaseRecord, id: string) => r.issues.find((i) => i.issueId === id);
const doc = (r: CaseRecord, id: string) => r.documents.find((d) => d.id === id);
const status = (r: CaseRecord, id: string): SupportStatus | undefined => issue(r, id)?.supportStatus;

/* ------------------------------------------------------------------ shared */
/** Invariants that hold for ANY case record, fixture or pipeline output. */
export const invariants: Expectation[] = [
  {
    id: "ref-integrity",
    what: "Every id referenced by an excerpt, fact, or issue resolves to something that exists",
    why: "A dangling reference means a source link that opens nothing — FR05 requires inspecting the excerpt from the row",
    check: (r) => {
      const docs = new Set(r.documents.map((d) => d.id));
      const excerpts = new Set(r.excerpts.map((e) => e.id));
      const facts = new Set(r.facts.map((f) => f.id));
      const bad: string[] = [];
      for (const e of r.excerpts) if (!docs.has(e.documentId)) bad.push(`excerpt ${e.id} -> document ${e.documentId}`);
      for (const f of r.facts) for (const id of f.excerptIds) if (!excerpts.has(id)) bad.push(`fact ${f.id} -> excerpt ${id}`);
      for (const i of r.issues) {
        for (const id of i.factIds) if (!facts.has(id)) bad.push(`issue ${i.issueId} -> fact ${id}`);
        for (const id of [...i.supportingExcerptIds, ...i.conflictingExcerptIds])
          if (!excerpts.has(id)) bad.push(`issue ${i.issueId} -> excerpt ${id}`);
      }
      for (const c of r.contradictions) {
        for (const id of c.excerptIds) if (!excerpts.has(id)) bad.push(`contradiction ${c.id} -> excerpt ${id}`);
        for (const id of c.factIds) if (!facts.has(id)) bad.push(`contradiction ${c.id} -> fact ${id}`);
      }
      return bad.length === 0 ? true : `dangling: ${bad.slice(0, 5).join(", ")}`;
    },
  },
  {
    id: "green-needs-evidence",
    what: "No issue is marked Supported without at least one supporting excerpt",
    why: "FR04 — a user confirming their own recollection is not corroboration, so green must rest on material, not on assertion",
    check: (r) => {
      const bad = r.issues.filter((i) => i.supportStatus === "supported" && i.supportingExcerptIds.length === 0);
      return bad.length === 0 ? true : `green with no evidence: ${bad.map((i) => i.issueId).join(", ")}`;
    },
  },
  {
    id: "green-has-no-conflict",
    what: "No issue is marked Supported while carrying conflicting evidence",
    why: "FR05 — a contradictory chat prevents an unqualified green status",
    check: (r) => {
      const bad = r.issues.filter((i) => i.supportStatus === "supported" && i.conflictingExcerptIds.length > 0);
      return bad.length === 0 ? true : `green despite conflict: ${bad.map((i) => i.issueId).join(", ")}`;
    },
  },
  {
    id: "duplicates-do-not-count",
    what: "No issue draws support from a document flagged as a duplicate",
    why: "FR05 — adding a duplicate receipt does not improve support",
    check: (r) => {
      const dupDocs = new Set(r.documents.filter((d) => d.issues.includes("duplicate")).map((d) => d.id));
      const dupExcerpts = new Set(r.excerpts.filter((e) => dupDocs.has(e.documentId)).map((e) => e.id));
      const bad = r.issues.filter((i) => i.supportingExcerptIds.some((id) => dupExcerpts.has(id)));
      return bad.length === 0 ? true : `counts a duplicate: ${bad.map((i) => i.issueId).join(", ")}`;
    },
  },
  {
    id: "every-status-explained",
    what: "Every issue gives a reason, and every grey one gives a reason code",
    why: "FR05 — a bare badge is not enough; grey covers three different situations with three different next steps",
    check: (r) => {
      const noReason = r.issues.filter((i) => !i.reason.trim());
      const greyNoCode = r.issues.filter((i) => i.supportStatus === "not_assessed" && !i.notAssessedReason);
      const codeNotGrey = r.issues.filter((i) => i.supportStatus !== "not_assessed" && i.notAssessedReason);
      if (noReason.length) return `no reason: ${noReason.map((i) => i.issueId).join(", ")}`;
      if (greyNoCode.length) return `grey without a reason code: ${greyNoCode.map((i) => i.issueId).join(", ")}`;
      if (codeNotGrey.length) return `reason code on a non-grey row: ${codeNotGrey.map((i) => i.issueId).join(", ")}`;
      return true;
    },
  },
  {
    id: "populated-fields-are-sourced",
    what: "Every populated draft field carries at least one source reference",
    why: "FR08 — every populated field links to a confirmed fact or document. The type enforces this; this catches JSON consumers that bypass it",
    check: (r) => {
      const bad = r.draftFields.filter((f) => isPopulated(f) && f.sourceRefs.length === 0);
      return bad.length === 0 ? true : `unsourced: ${bad.map((f) => f.fieldKey).join(", ")}`;
    },
  },
  {
    id: "no-fabricated-assessment-id",
    what: "The pre-filing assessment ID is never populated",
    why: "FR08 — the product never fabricates an official form, signature, declaration, or assessment ID. CJTS issues this",
    check: (r) => {
      const f = r.draftFields.find((f) => f.fieldKey === "pre_filing_assessment_id");
      if (!f) return true;
      return f.state === "blank" ? true : `populated with ${JSON.stringify((f as { proposedValue: string }).proposedValue)}`;
    },
  },
  {
    id: "failed-docs-have-a-reason",
    what: "Every document that failed processing says why, and no failed document yields excerpts",
    why: "FR03 — failures are marked visibly and retryable; no module silently substitutes a confident answer when extraction fails",
    check: (r) => {
      const noReason = r.documents.filter((d) => d.processingStatus === "failed" && !d.failureReason);
      if (noReason.length) return `failed silently: ${noReason.map((d) => d.fileName).join(", ")}`;
      const failedIds = new Set(r.documents.filter((d) => d.processingStatus === "failed").map((d) => d.id));
      const leaked = r.excerpts.filter((e) => failedIds.has(e.documentId));
      return leaked.length === 0 ? true : `text extracted from a failed document: ${leaked.map((e) => e.id).join(", ")}`;
    },
  },
  {
    id: "issues-match-the-checklist",
    what: "Every issue row corresponds to a checklist item, at the checklist version it claims",
    why: "FR05 — the matrix is driven by a reviewed checklist, so a row with no checklist item behind it has no defined meaning",
    check: (r) => {
      const known = new Set(CHECKLIST_ITEM_IDS);
      const unknown = r.issues.filter((i) => !known.has(i.issueId));
      if (unknown.length) return `not in the checklist: ${unknown.map((i) => i.issueId).join(", ")}`;
      const wrongVersion = r.issues.filter((i) => i.checklistVersion !== CHECKLIST_VERSION);
      if (wrongVersion.length)
        return `built from ${wrongVersion[0].checklistVersion}, checklist is now ${CHECKLIST_VERSION}`;
      const covered = new Set(r.issues.map((i) => i.issueId));
      const uncovered = CHECKLIST_ITEM_IDS.filter((id) => !covered.has(id));
      return uncovered.length === 0 ? true : `checklist items with no row: ${uncovered.join(", ")}`;
    },
  },
  {
    id: "derived-not-ahead-of-case",
    what: "No derived object claims a case version newer than the case itself",
    why: "SHARED-CONTRACT §4 — sourceCaseVersion is compared against case.version to detect staleness; ahead is nonsense",
    check: (r) => {
      const v = r.case.version;
      const ahead: string[] = [];
      for (const i of r.issues) if (i.sourceCaseVersion > v) ahead.push(`issue ${i.issueId}`);
      for (const t of r.tasks) if (t.sourceCaseVersion > v) ahead.push(`task ${t.id}`);
      for (const f of r.draftFields) if (f.sourceCaseVersion > v) ahead.push(`field ${f.fieldKey}`);
      if (r.route && r.route.sourceCaseVersion > v) ahead.push("route");
      return ahead.length === 0 ? true : `ahead of case v${v}: ${ahead.join(", ")}`;
    },
  },
];

/* -------------------------------------------------------------------- demo */
export const demoExpectations: Expectation[] = [
  {
    id: "demo-deadline-is-amber",
    what: "The completion-date issue is Partial or disputed, not Supported",
    why: "Scenario 3 — the chat suggesting an extension must prevent an unqualified green",
    check: (r) =>
      status(r, "their_performance") === "partial_or_disputed"
        ? true
        : `is ${status(r, "their_performance")}`,
  },
  {
    id: "demo-loss-is-red",
    what: "The claimed-loss issue is Support missing",
    why: "PRD §5 illustrative table — the S$500 rests on the user's account alone",
    check: (r) => (status(r, "claimed_loss_and_remedy") === "missing" ? true : `is ${status(r, "claimed_loss_and_remedy")}`),
  },
  {
    id: "demo-changed-terms-flagged",
    what: "The deadline conflict is recorded as a contradiction with both readings and a distinguishing fact",
    why: "FR10 — where more than one interpretation is plausible, present the alternatives and what would tell them apart",
    check: (r) => {
      const ct = r.contradictions.find((c) => c.kind === "changed_terms");
      if (!ct) return "no changed_terms contradiction";
      if (ct.alternatives.length < 2) return `only ${ct.alternatives.length} alternative(s)`;
      const missing = ct.alternatives.filter((a) => !a.distinguishingFact.trim());
      return missing.length === 0 ? true : "an alternative has no distinguishing fact";
    },
  },
  {
    id: "demo-duplicate-detected",
    what: "The second receipt photo is flagged duplicate and shares a hash with the first",
    why: "FR05 — duplicate evidence must not improve support, which requires detecting it first",
    check: (r) => {
      const d2 = doc(r, "d2"), d4 = doc(r, "d4");
      if (!d2 || !d4) return "d2 or d4 missing";
      if (d2.hash !== d4.hash) return "hashes differ, so they are not actually duplicates";
      return d4.issues.includes("duplicate") ? true : "d4 not flagged duplicate";
    },
  },
  {
    id: "demo-unsupported-not-read",
    what: "The .rtf is marked unsupported, failed, and produced no excerpts",
    why: "FR03 — the interface never implies that an unsupported upload was successfully read",
    check: (r) => {
      const d = doc(r, "d7");
      if (!d) return "d7 missing";
      if (!d.issues.includes("unsupported_type")) return "not flagged unsupported_type";
      if (d.processingStatus !== "failed") return `processingStatus is ${d.processingStatus}`;
      return r.excerpts.some((e) => e.documentId === "d7") ? "has excerpts" : true;
    },
  },
  {
    id: "demo-blurry-not-invented",
    what: "The low-quality scan is flagged, and any text from it has low confidence",
    why: "FR03 — a blurry scan produces an uncertainty flag, not invented text",
    check: (r) => {
      const d = doc(r, "d5");
      if (!d?.issues.includes("low_quality_scan")) return "not flagged low_quality_scan";
      const from = r.excerpts.filter((e) => e.documentId === "d5");
      const confident = from.filter((e) => e.extractionConfidence > 0.5);
      return confident.length === 0 ? true : `claims high confidence: ${confident.map((e) => e.id).join(", ")}`;
    },
  },
  {
    id: "demo-open-questions-are-neutral",
    what: "Open questions carry a why-it-matters and none is a yes/no leading question",
    why: "FR02 — explain why it matters, and never suggest a favourable answer",
    check: (r) => {
      const noWhy = r.openQuestions.filter((q) => !q.whyItMatters.trim());
      if (noWhy.length) return `no whyItMatters: ${noWhy.map((q) => q.id).join(", ")}`;
      const leading = r.openQuestions.filter((q) => /^(did|didn't|wasn't|isn't|surely|don't you)\b/i.test(q.question.trim()));
      return leading.length === 0 ? true : `leading: ${leading.map((q) => q.id).join(", ")}`;
    },
  },
  {
    id: "demo-confirmed-is-not-corroborated",
    what: "At least one fact is user-confirmed with no supporting excerpt, and no issue treats it as evidence",
    why: "FR04 — confirming your own recollection does not turn it into independent corroboration",
    check: (r) => {
      const selfOnly = r.facts.filter((f) => f.origin === "user_stated" && f.confirmedByUser && f.excerptIds.length === 0);
      if (selfOnly.length === 0) return "the fixture no longer exercises this case";
      const ids = new Set(selfOnly.map((f) => f.id));
      const bad = r.issues.filter((i) => i.supportStatus === "supported" && i.factIds.some((id) => ids.has(id)));
      return bad.length === 0 ? true : `green resting on self-confirmation: ${bad.map((i) => i.issueId).join(", ")}`;
    },
  },
];

/* ----------------------------------------------------------------- adverse */
export const adverseExpectations: Expectation[] = [
  {
    id: "adverse-refund-surfaced",
    what: "The S$400 refund is flagged as a contradiction",
    why: "Confirmation-bias gate — every seeded material contradiction is surfaced. FR10 lists refunds explicitly",
    check: (r) => (r.contradictions.some((c) => c.kind === "refund") ? true : "no refund contradiction"),
  },
  {
    id: "adverse-partial-performance-surfaced",
    what: "Partial performance is flagged, with both readings",
    why: "FR10 — partial performance is one of the checks that runs before any issue review is generated",
    check: (r) => {
      const ct = r.contradictions.find((c) => c.kind === "partial_performance");
      if (!ct) return "no partial_performance contradiction";
      return ct.alternatives.length >= 2 ? true : `only ${ct.alternatives.length} alternative(s)`;
    },
  },
  {
    id: "adverse-own-document-used-against",
    what: "The adverse-document finding cites the claimant's own accepted quote",
    why: "FR10 — materially adverse documents in the supplied record must be surfaced with their specific source",
    check: (r) => {
      const found = r.contradictions.filter((c) => c.kind === "adverse_document");
      if (found.length === 0) return "no adverse_document contradiction";
      // There can be several. At least one must reach the quote she uploaded herself.
      const fromQuote = found.some((ct) =>
        ct.excerptIds.some((id) => r.excerpts.find((e) => e.id === id)?.documentId === "d1"),
      );
      return fromQuote ? true : "none of them cites the quote the claimant uploaded";
    },
  },
  {
    id: "adverse-amount-not-guessed",
    what: "The claim amount stays blank, and route screening carries no amount",
    why: "FR06/FR08 — the tool does not automatically reduce the claim, and missing required inputs stay blank rather than being guessed",
    check: (r) => {
      const f = r.draftFields.find((f) => f.fieldKey === "claim_amount");
      if (!f) return "claim_amount field missing";
      if (f.state !== "blank") return "claim_amount was populated despite irreconcilable figures";
      return r.route?.inputs.amount == null ? true : "route screening picked an amount anyway";
    },
  },
  {
    id: "adverse-route-not-cleared",
    what: "Route screening does not say Appears within supported route while inputs are unresolved",
    why: "FR06 — uncertainty about the relevant event date must remain visible; a route match is not a merits conclusion",
    check: (r) => {
      if (!r.route) return "no route screening";
      if (r.route.unresolvedInputs.length > 0 && r.route.outcome === "within_supported_route")
        return "cleared the route despite unresolved inputs";
      return true;
    },
  },
  {
    id: "adverse-insistence-does-not-win",
    what: "The issues the claimant treats as obvious are not Supported — but a genuinely uncontested one still is",
    why:
      "Scenario 3 — the matrix reflects uncertainty even when the user insists the case is obvious. " +
      "The second half matters just as much: answering overconfidence by doubting everything, including " +
      "the plainly evidenced agreement, would be its own failure and would teach the user to ignore the badges",
    check: (r) => {
      const insists = /obvious/i.test(r.case.requestedOutcome ?? "");
      if (!insists) return "the fixture no longer exercises user insistence";

      const contested = ["their_performance", "alleged_failure", "claimed_loss_and_remedy"];
      const wrongly = contested.filter((id) => status(r, id) === "supported");
      if (wrongly.length) return `contested issue marked Supported: ${wrongly.join(", ")}`;

      return r.issues.some((i) => i.supportStatus === "supported")
        ? true
        : "nothing is Supported at all — the record is being doubted uniformly rather than specifically";
    },
  },
  {
    id: "adverse-covers-failure-modes",
    what: "The corpus exercises unreadable, truncated, and possibly-unrelated alongside the demo's modes",
    why: "M1 exit condition — every FR03 failure mode has a file that triggers it",
    check: (r) => {
      const seen = new Set(r.documents.flatMap((d) => d.issues));
      const want = ["unreadable", "truncated", "possibly_unrelated", "duplicate", "low_quality_scan", "unsupported_type"];
      const missing = want.filter((w) => !seen.has(w as never));
      return missing.length === 0 ? true : `not exercised: ${missing.join(", ")}`;
    },
  },
  {
    id: "adverse-stale-confirmation",
    what: "The Confirm stage is back to Needs review",
    why: "FR04 — changing a material fact marks affected analysis stale; a confirmation made before the bank statement was read cannot silently stand",
    check: (r) => (r.case.stageStatus.confirm === "needs_review" ? true : `is ${r.case.stageStatus.confirm}`),
  },
];
