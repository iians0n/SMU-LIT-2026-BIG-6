/**
 * Turning an uploaded file into a Document and its Excerpts. Server-only. FR03.
 *
 * "Accept supported files without requiring users to sort or determine
 * relevance." So this module is forgiving about what arrives and strict about
 * what it claims: every excerpt carries a source anchor and a confidence, and
 * anything unreadable is marked rather than guessed at.
 *
 * Ids are derived from the content hash, not from arrival order. FR03 requires
 * that "upload order does not change the set of extracted events", and that is
 * only true if the same bytes always produce the same ids.
 */

import { createHash } from "node:crypto";

import {
  SUPPORTED_EXTENSIONS,
  UPLOAD_LIMITS,
  type Document,
  type DocumentIssue,
  type Excerpt,
  type ExcerptAnchor,
  type VerificationEvent,
} from "@/lib/contracts";
import { extract, type ExtractedTextItem } from "./extract";
import { ocrImage } from "./ocr";
import { scanForInjection } from "./envelope";
import { proposeLabel } from "./label";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

export interface IngestInput {
  fileName: string;
  bytes: Uint8Array;
  uploadedAt?: string;
}

export interface IngestResult {
  document: Document;
  excerpts: Excerpt[];
  verificationEvents: VerificationEvent[];
  /** Text aimed at an AI system found inside the file. Reported, never acted on. */
  injectionFindings: Array<{ why: string; match: string }>;
}

export interface IngestContext {
  /** Already-ingested documents, for duplicate detection by hash. */
  existing: Pick<Document, "id" | "hash">[];
  caseVersion: number;
}

function hashOf(bytes: Uint8Array): string {
  return "sha256:" + createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i === -1 ? "" : fileName.slice(i + 1).toLowerCase();
}

/**
 * Group positioned text runs into excerpts.
 *
 * One excerpt per run would be unusable (31 on a single quote page) and one per
 * page would be too coarse to anchor a highlight. Splitting on vertical gaps
 * approximates paragraphs, which is the unit a user actually points at when
 * they say "this line is where the date is".
 */
function groupIntoExcerpts(
  items: Array<{ text: string; bbox: { x: number; y: number; w: number; h: number }; confidence: number }>,
  page: number,
  idFor: (page: number, index: number) => string,
  documentId: string,
): Excerpt[] {
  const usable = items.filter((i) => i.text.trim().length > 0);
  if (usable.length === 0) return [];

  const sorted = [...usable].sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
  const medianHeight =
    [...sorted.map((i) => i.bbox.h)].sort((a, b) => a - b)[Math.floor(sorted.length / 2)] || 0.02;
  const gapLimit = Math.max(medianHeight * 1.8, 0.02);

  const groups: (typeof sorted)[] = [];
  let current: typeof sorted = [];
  let lastBottom = Number.NEGATIVE_INFINITY;

  for (const item of sorted) {
    if (current.length > 0 && item.bbox.y - lastBottom > gapLimit) {
      groups.push(current);
      current = [];
    }
    current.push(item);
    lastBottom = Math.max(lastBottom, item.bbox.y + item.bbox.h);
  }
  if (current.length > 0) groups.push(current);

  return groups.map((group, index) => {
    const x = Math.min(...group.map((i) => i.bbox.x));
    const y = Math.min(...group.map((i) => i.bbox.y));
    const right = Math.max(...group.map((i) => i.bbox.x + i.bbox.w));
    const bottom = Math.max(...group.map((i) => i.bbox.y + i.bbox.h));
    const anchor: ExcerptAnchor = {
      kind: "region",
      page,
      bbox: { x, y, w: Math.min(1 - x, right - x), h: Math.min(1 - y, bottom - y) },
    };
    return {
      id: idFor(page, index),
      documentId,
      anchor,
      text: group.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim(),
      // The weakest run in the group governs. An excerpt is only as trustworthy
      // as its least certain word, and averaging would hide exactly the value
      // that needs confirming.
      extractionConfidence: Math.min(...group.map((i) => i.confidence)),
    };
  });
}

/**
 * Excerpts for formats that carry no position information (TXT, DOCX).
 *
 * These anchor to the page rather than a region — there is no region to point
 * at. Without this path a .txt or .docx yields a document with zero excerpts,
 * which the rest of the pipeline cannot distinguish from a file that says
 * nothing.
 */
function excerptsFromPlainText(
  text: string,
  page: number,
  idFor: (page: number, index: number) => string,
  documentId: string,
): Excerpt[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter((block) => block.length > 0)
    .map((block, index) => ({
      id: idFor(page, index),
      documentId,
      anchor: { kind: "page", page } as ExcerptAnchor,
      text: block,
      // A text layer was read exactly, unlike OCR. That says nothing about
      // whether the content supports anything - that is supportStatus's job.
      extractionConfidence: 1,
    }));
}

export async function ingestDocument(
  input: IngestInput,
  context: IngestContext,
): Promise<IngestResult> {
  const { fileName, bytes } = input;
  const uploadedAt = input.uploadedAt ?? new Date().toISOString();
  const extension = extensionOf(fileName);
  const hash = hashOf(bytes);
  const id = `d_${hash.slice(7, 19)}`;
  const idFor = (page: number, index: number) => `e_${hash.slice(7, 19)}_${page}_${index}`;

  const issues: DocumentIssue[] = [];
  if (context.existing.some((d) => d.hash === hash && d.id !== id)) issues.push("duplicate");

  const base: Document = {
    id,
    fileName,
    extension,
    byteSize: bytes.byteLength,
    hash,
    uploadedAt,
    processingStatus: "extracted",
    issues,
    proposedLabel: null,
    userLabel: null,
    pageCount: null,
    failureReason: null,
  };

  const fail = (issue: DocumentIssue, reason: string): IngestResult => ({
    document: { ...base, processingStatus: "failed", issues: [...issues, issue], failureReason: reason },
    excerpts: [],
    verificationEvents: [],
    injectionFindings: [],
  });

  if (bytes.byteLength > UPLOAD_LIMITS.maxBytesPerFile) {
    const mb = (UPLOAD_LIMITS.maxBytesPerFile / (1024 * 1024)).toFixed(0);
    return fail("over_size_limit", `This file is larger than the ${mb} MB limit, so we could not read it.`);
  }
  if (!SUPPORTED_EXTENSIONS.includes(extension as never)) {
    return fail(
      "unsupported_type",
      `We do not read ${extension ? "." + extension : "files without an extension"}. Accepted formats are PDF, DOCX, JPG, PNG and TXT.`,
    );
  }

  let excerpts: Excerpt[] = [];
  let pageCount: number | null = null;
  let uncertain = false;
  let contribution: VerificationEvent["kind"] = "ai_extracted";

  if (IMAGE_EXTENSIONS.has(extension)) {
    const result = await ocrImage(bytes);
    if (result.kind === "failed") return fail(result.issue, result.reason);

    pageCount = 1;
    uncertain = result.uncertain;
    if (result.uncertain) issues.push("low_quality_scan");
    excerpts = groupIntoExcerpts(
      result.lines.map((l) => ({ text: l.text, bbox: l.bbox, confidence: l.confidence })),
      1,
      idFor,
      id,
    );
  } else {
    const result = await extract(fileName, bytes);
    if (result.kind === "failed") return fail(result.issue, result.reason);

    pageCount = result.pageCount;
    if (result.truncated) issues.push("truncated");

    if (result.needsOcr) {
      // A scanned PDF. Rasterising pages for OCR needs a canvas backend we do
      // not carry in P0, so this is reported as a scan with no readable text
      // rather than silently returning an empty document - which the rest of
      // the pipeline would read as "this file says nothing".
      issues.push("low_quality_scan");
      uncertain = true;
    }

    excerpts = result.pages.flatMap((page) =>
      page.items.length > 0
        ? groupIntoExcerpts(
            page.items.map((i: ExtractedTextItem) => ({ text: i.text, bbox: i.bbox, confidence: 1 })),
            page.page,
            idFor,
            id,
          )
        : excerptsFromPlainText(page.text, page.page, idFor, id),
    );
  }

  const injectionFindings = excerpts.flatMap((e) => scanForInjection(e.text));
  // Proposed only. The user can override it, and nothing downstream reads it.
  const proposal = proposeLabel(fileName, excerpts.map((e) => e.text).join("\n"));

  const verificationEvents: VerificationEvent[] = [
    {
      id: `ve_${hash.slice(7, 19)}`,
      kind: contribution,
      affectedOutput: `document:${id}`,
      usedFactIds: [],
      usedSourceIds: [],
      note:
        excerpts.length === 0
          ? `No readable text was found in ${fileName}.`
          : `${excerpts.length} passage(s) read from ${fileName}${uncertain ? ", flagged uncertain" : ""}.`,
      at: uploadedAt,
      caseVersion: context.caseVersion,
    },
  ];

  return {
    document: { ...base, issues, pageCount, proposedLabel: proposal?.label ?? null },
    excerpts,
    verificationEvents,
    injectionFindings,
  };
}
