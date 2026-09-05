/** Deterministic evidence assessment for the live case record. */

import type {
  CaseRecord,
  Contradiction,
  FactKind,
  IssueAssessment,
} from "@/lib/contracts";
import {
  CHECKLIST_VERSION,
  goodsServicesChecklistV1,
} from "./checklist.v1";

const FACT_KINDS: Record<string, readonly FactKind[]> = {
  agreement_and_terms: ["agreement"],
  your_performance: ["payment"],
  their_performance: ["promised_performance", "other_party_response"],
  alleged_failure: ["event"],
  claimed_loss_and_remedy: ["loss", "desired_outcome"],
  contrary_explanations: ["attempted_resolution", "other_party_response"],
};

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function assessEvidence(
  record: CaseRecord,
  contradictions: Contradiction[],
  now = new Date(),
): IssueAssessment[] {
  const readableDocuments = new Set(
    record.documents
      .filter((document) =>
        document.processingStatus === "extracted" && !document.issues.includes("duplicate"),
      )
      .map((document) => document.id),
  );
  const citableExcerpts = new Set(
    record.excerpts
      .filter((excerpt) => readableDocuments.has(excerpt.documentId))
      .map((excerpt) => excerpt.id),
  );
  const processingFailed = record.documents.some((document) => document.processingStatus === "failed");
  const noReadableMaterial = readableDocuments.size === 0;

  return goodsServicesChecklistV1.map((item): IssueAssessment => {
    const kinds = FACT_KINDS[item.id] ?? [];
    const facts = record.facts.filter((fact) => kinds.includes(fact.kind));
    const factIds = facts.map((fact) => fact.id);
    const relevantContradictions = contradictions.filter((contradiction) =>
      item.id === "contrary_explanations" ||
      contradiction.factIds.some((factId) => factIds.includes(factId)),
    );
    const supportingExcerptIds = unique(
      facts.flatMap((fact) => fact.excerptIds).filter((id) => citableExcerpts.has(id)),
    );
    const conflictingExcerptIds = unique(
      relevantContradictions.flatMap((contradiction) => contradiction.excerptIds)
        .filter((id) => citableExcerpts.has(id) && !supportingExcerptIds.includes(id)),
    );
    const disputed = facts.some((fact) => fact.disputed) || conflictingExcerptIds.length > 0;

    let supportStatus: IssueAssessment["supportStatus"];
    let notAssessedReason: IssueAssessment["notAssessedReason"] = null;
    let reason: string;

    if (facts.length === 0 && item.id === "contrary_explanations") {
      supportStatus = "not_assessed";
      notAssessedReason = processingFailed && noReadableMaterial ? "processing_failed" : "insufficient_information";
      reason = processingFailed && noReadableMaterial
        ? "We do not yet have the other side's account, and at least one uploaded file could not be read."
        : "We do not yet have enough information about what the other side may say.";
    } else if (facts.length === 0) {
      supportStatus = "missing";
      reason = `The case does not yet contain a recorded fact about ${item.label.toLowerCase()}.`;
    } else if (supportingExcerptIds.length === 0) {
      supportStatus = processingFailed && noReadableMaterial ? "not_assessed" : "missing";
      notAssessedReason = processingFailed && noReadableMaterial ? "processing_failed" : null;
      reason = processingFailed && noReadableMaterial
        ? "This point is recorded, but at least one uploaded file could not be read and no readable passage is linked to it."
        : "This point is recorded from the conversation, but no passage in the uploaded files is linked to it.";
    } else if (disputed) {
      supportStatus = "partial_or_disputed";
      reason = `Readable material is linked to this point, but ${
        conflictingExcerptIds.length > 0 ? "other material raises a conflicting account" : "the fact is marked as disputed"
      }.`;
    } else {
      supportStatus = "supported";
      reason = supportingExcerptIds.length === 1
        ? "A readable passage from an uploaded file is linked to this point, and no conflict was detected."
        : `${supportingExcerptIds.length} readable passages from uploaded files are linked to this point, and no conflict was detected.`;
    }

    return {
      id: `ia_${item.id}`,
      issueId: item.id,
      checklistVersion: CHECKLIST_VERSION,
      label: item.label,
      factIds,
      supportingExcerptIds,
      conflictingExcerptIds,
      supportStatus,
      notAssessedReason,
      reason,
      nextQuestion: supportStatus === "supported" ? null : item.probes[0] ?? null,
      contraryExplanations: relevantContradictions.map((contradiction) => contradiction.description),
      sourceCaseVersion: record.case.version,
      assessedAt: now.toISOString(),
    };
  });
}
