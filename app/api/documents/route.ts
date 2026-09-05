/**
 * /api/documents — upload, retry, and remove. FR03.
 *
 * Owned by Anson.
 *
 * Upload accepts several files at once and reports on each independently: "a
 * partial upload failure must not lose the successful ones", so one bad file
 * cannot fail the batch.
 */

import { UPLOAD_LIMITS } from "@/lib/contracts";
import { ingestDocument } from "@/lib/processing/ingest";
import { bumpVersion, getCase, patchCase } from "@/lib/store";

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET() {
  const record = getCase();
  return Response.json({
    caseVersion: record.case.version,
    documents: record.documents,
    limits: UPLOAD_LIMITS,
  });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("The upload could not be read.");
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return bad("No files were received.");

  const record = getCase();
  const remaining = UPLOAD_LIMITS.maxFilesPerCase - record.documents.length;
  if (remaining <= 0) {
    return bad(`This case already has the maximum of ${UPLOAD_LIMITS.maxFilesPerCase} files.`);
  }

  const results = [];
  for (const file of files.slice(0, remaining)) {
    // Each file is ingested and recorded on its own. One failure is reported
    // against that file and leaves the others in place.
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await ingestDocument(
        { fileName: file.name, bytes },
        { existing: getCase().documents, caseVersion: getCase().case.version },
      );

      patchCase((draft) => {
        draft.documents = [
          ...draft.documents.filter((d) => d.id !== result.document.id),
          result.document,
        ];
        draft.excerpts = [
          ...draft.excerpts.filter((e) => e.documentId !== result.document.id),
          ...result.excerpts,
        ];
        draft.verificationEvents.push(...result.verificationEvents);
        draft.case.stageStatus.clarify_upload = "in_progress";
      });

      results.push({
        fileName: file.name,
        documentId: result.document.id,
        status: result.document.processingStatus,
        issues: result.document.issues,
        failureReason: result.document.failureReason,
        excerpts: result.excerpts.length,
        injectionFindings: result.injectionFindings,
      });
    } catch {
      results.push({
        fileName: file.name,
        documentId: null,
        status: "failed" as const,
        issues: ["unreadable"],
        failureReason:
          "Something went wrong while reading this file. You can try uploading it again.",
        excerpts: 0,
        injectionFindings: [],
      });
    }
  }

  // New material can change what the record supports, so anything derived from
  // the previous version needs another look.
  const version = bumpVersion(`uploaded ${results.length} file(s)`);

  const skipped = files.length - Math.min(files.length, remaining);
  return Response.json({
    caseVersion: version,
    results,
    skipped: skipped > 0 ? `${skipped} file(s) were not accepted: this case is at its file limit.` : null,
  });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return bad("Which file should be removed?");

  const record = getCase();
  const document = record.documents.find((d) => d.id === id);
  if (!document) return bad("That file is no longer in the case.", 404);

  const orphanedExcerpts = new Set(
    record.excerpts.filter((e) => e.documentId === id).map((e) => e.id),
  );

  // FR03: "Removing a file marks dependent facts and outputs for review."
  // A fact that loses the last of its supporting material has to be confirmed
  // again — the ground it stood on is gone, and leaving it confirmed would
  // present it as still backed by something.
  let unconfirmed = 0;
  patchCase((draft) => {
    draft.documents = draft.documents.filter((d) => d.id !== id);
    draft.excerpts = draft.excerpts.filter((e) => e.documentId !== id);
    draft.facts = draft.facts.map((fact) => {
      const kept = fact.excerptIds.filter((x) => !orphanedExcerpts.has(x));
      if (kept.length === fact.excerptIds.length) return fact;
      const lostAll = kept.length === 0 && fact.excerptIds.length > 0;
      if (lostAll && fact.confirmedByUser) unconfirmed++;
      return {
        ...fact,
        excerptIds: kept,
        confirmedByUser: lostAll ? false : fact.confirmedByUser,
      };
    });
    draft.issues = draft.issues.map((issue) => ({
      ...issue,
      supportingExcerptIds: issue.supportingExcerptIds.filter((x) => !orphanedExcerpts.has(x)),
      conflictingExcerptIds: issue.conflictingExcerptIds.filter((x) => !orphanedExcerpts.has(x)),
    }));
    draft.case.stageStatus.confirm = "needs_review";
    draft.case.stageStatus.review_support = "needs_review";
  });

  const version = bumpVersion(`removed ${document.fileName}`);
  return Response.json({
    caseVersion: version,
    removed: document.fileName,
    factsNeedingConfirmation: unconfirmed,
  });
}
