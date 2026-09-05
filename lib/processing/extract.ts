/**
 * Text extraction from uploaded files. Server-only. FR03.
 *
 * Extraction ONLY — no OCR here. A scanned PDF with no text layer is a
 * successful extraction that reports `needsOcr: true`; the caller decides
 * whether to run OCR. Keeping them apart matters because they fail differently
 * and carry different confidence.
 *
 * Hard rules, from FR03 and PRD §8:
 *
 *   - Deterministic. The same bytes must always produce the same output, or
 *     "upload order does not change the set of extracted events" cannot hold.
 *   - Never invent text. A file we cannot read produces a failure with a
 *     reason, never a plausible guess. No module may silently substitute a
 *     confident answer when extraction fails.
 *   - Failures are typed, not thrown. Every outcome maps to a DocumentIssue the
 *     UI already knows how to display, so a new failure mode cannot arrive as
 *     an unhandled exception.
 *   - Extracted text is UNTRUSTED. Callers must pass it through
 *     lib/processing/envelope before it reaches a model.
 */

import mammoth from "mammoth";

import type { DocumentIssue } from "@/lib/contracts";
import { UPLOAD_LIMITS } from "@/lib/contracts";

/** One text run with its position, used to build region anchors for excerpts. */
export interface ExtractedTextItem {
  text: string;
  /**
   * Normalised 0..1 against the page, origin TOP-LEFT.
   *
   * PDF space has its origin at the bottom-left, so PDF y must be flipped.
   * ExcerptAnchor region bboxes are top-left, and a viewer drawing a highlight
   * from an unflipped bbox points at the wrong part of the page.
   */
  bbox: { x: number; y: number; w: number; h: number };
}

export interface ExtractedPage {
  /** 1-indexed. */
  page: number;
  text: string;
  /** Empty when the format carries no position information (TXT, DOCX). */
  items: ExtractedTextItem[];
}

export type ExtractionOutcome =
  | {
      kind: "extracted";
      pages: ExtractedPage[];
      /** Pages in the file, which may exceed pages.length when truncated. */
      pageCount: number;
      /** True when the page budget cut the read short. Maps to DocumentIssue "truncated". */
      truncated: boolean;
      /**
       * True when the file parsed but carries little or no text layer — a scan.
       * Not a failure. The caller may run OCR and must mark the result uncertain.
       */
      needsOcr: boolean;
    }
  | {
      kind: "failed";
      issue: DocumentIssue;
      /** Shown to the user. Plain language, and says what they can do next. */
      reason: string;
    };

export interface ExtractOptions {
  /** Default UPLOAD_LIMITS.maxPagesPerCase. */
  maxPages?: number;
}

export const DEFAULT_MAX_PAGES = UPLOAD_LIMITS.maxPagesPerCase;

/**
 * A page with fewer than this many characters of text layer is treated as a
 * scan. Chosen so a mostly-image page with a stray page number still counts as
 * needing OCR.
 */
export const OCR_TEXT_THRESHOLD = 32;

/**
 * Normalise any byte view to a plain, tightly-bound Uint8Array.
 *
 * fs.readFile hands back a Buffer, and that breaks pdfjs in two separate ways:
 *
 *   1. A Buffer is a view into a SHARED pooled ArrayBuffer. A 3 KB file
 *      typically lands at some non-zero byteOffset inside an 8 KB pool, and
 *      code that reads `.buffer` without honouring the offset gets garbage.
 *   2. Even at offset 0, pdfjs rejects Buffer outright by constructor check:
 *      "Please provide binary data as `Uint8Array`, rather than `Buffer`."
 *
 * Both surface as a generic throw, which the caller would report as a corrupt
 * file — silently, and for every PDF. Callers should not have to know any of
 * this, so every extractor normalises first.
 */
function toBytes(input: Uint8Array): Uint8Array {
  const isPlainAndTight =
    input.constructor === Uint8Array &&
    input.byteOffset === 0 &&
    input.byteLength === input.buffer.byteLength;
  if (isPlainAndTight) return input;

  const copy = new Uint8Array(input.byteLength);
  copy.set(input);
  return copy;
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/**
 * pdfjs ships ESM only. This project transpiles to CJS in some runtimes (tsx),
 * where a static import becomes a require() and throws at module load — which
 * the catch below would then report as a corrupt file. Importing dynamically
 * inside the async function works under both, and keeps pdfjs out of the module
 * graph until a PDF actually arrives.
 */
async function loadPdfjs() {
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

export async function extractPdf(
  bytes: Uint8Array,
  opts: ExtractOptions = {},
): Promise<ExtractionOutcome> {
  let task: ReturnType<Awaited<ReturnType<typeof loadPdfjs>>["getDocument"]> | null = null;
  try {
    const pdfjs = await loadPdfjs();
    task = pdfjs.getDocument({
      data: toBytes(bytes),
      useWorkerFetch: false,
      useSystemFonts: false,
    });
    const doc = await task.promise;

    const pageCount = doc.numPages;
    const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
    const truncated = pageCount > maxPages;
    const pages: ExtractedPage[] = [];

    for (let pageNum = 1; pageNum <= Math.min(pageCount, maxPages); pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();

      const items: ExtractedTextItem[] = [];
      const pieces: string[] = [];

      for (const rawItem of textContent.items) {
        if (!("str" in rawItem)) continue;
        const item = rawItem as {
          str: string;
          transform: number[];
          width: number;
          height: number;
          hasEOL?: boolean;
        };

        pieces.push(item.str);
        // Without this, lines fuse: "...(inclusive of materials)Works to be
        // completed by...". That string appears in no document, and FR03
        // forbids producing text the source does not contain.
        if (item.hasEOL) pieces.push("\n");

        // Empty runs are line breaks, not anchorable text.
        if (item.str.length === 0) continue;

        // PDF space has its origin bottom-left; ExcerptAnchor bboxes are
        // top-left, so f is flipped against the page height.
        const [, , , , e, f] = item.transform;
        items.push({
          text: item.str,
          bbox: {
            x: clamp01(e / viewport.width),
            y: clamp01((viewport.height - f - item.height) / viewport.height),
            w: clamp01(item.width / viewport.width),
            h: clamp01(item.height / viewport.height),
          },
        });
      }

      page.cleanup();
      pages.push({ page: pageNum, text: pieces.join(""), items });
    }

    const needsOcr =
      pages.length === 0 || pages.every((p) => p.text.trim().length < OCR_TEXT_THRESHOLD);

    return { kind: "extracted", pages, pageCount, truncated, needsOcr };
  } catch (err: unknown) {
    // Detect by exception name. pdfjs numbers its password responses 1 and 2,
    // but treating any error carrying code 1 as a password problem would tell
    // someone to "remove the password" from a file that has none.
    const name = (err as { name?: string })?.name;
    if (name === "PasswordException") {
      return {
        kind: "failed",
        issue: "password_protected",
        reason:
          "This PDF is password protected, so we could not open it. You can remove the password and upload it again.",
      };
    }
    return {
      kind: "failed",
      issue: "unreadable",
      reason:
        "This file appears to be damaged and we could not read any of it. If you have another copy, try uploading that.",
    };
  } finally {
    // Frees the worker-side document. Failure here must not mask the outcome.
    await task?.destroy().catch(() => {});
  }
}

export async function extractDocx(
  bytes: Uint8Array,
  opts: ExtractOptions = {},
): Promise<ExtractionOutcome> {
  try {
    const normalised = toBytes(bytes);
    const buffer = Buffer.from(
      normalised.buffer,
      normalised.byteOffset,
      normalised.byteLength,
    );
    const result = await mammoth.extractRawText({ buffer });
    return {
      kind: "extracted",
      pages: [
        {
          page: 1,
          text: result.value,
          items: [],
        },
      ],
      pageCount: 1,
      truncated: false,
      needsOcr: false,
    };
  } catch {
    return {
      kind: "failed",
      issue: "unreadable",
      reason:
        "The Word document could not be read. Please ensure the file is a valid, uncorrupted DOCX file and try again.",
    };
  }
}

export async function extractTxt(
  bytes: Uint8Array,
  opts: ExtractOptions = {},
): Promise<ExtractionOutcome> {
  try {
    const text = new TextDecoder("utf-8").decode(toBytes(bytes));
    return {
      kind: "extracted",
      pages: [
        {
          page: 1,
          text,
          items: [],
        },
      ],
      pageCount: 1,
      truncated: false,
      needsOcr: false,
    };
  } catch {
    return {
      kind: "failed",
      issue: "unreadable",
      reason:
        "The text file could not be read. Please check that the file is valid UTF-8 text and try again.",
    };
  }
}

/** Dispatch on file extension. Unknown extensions fail as unsupported_type. */
export async function extract(
  fileName: string,
  bytes: Uint8Array,
  opts: ExtractOptions = {},
): Promise<ExtractionOutcome> {
  const dotIndex = fileName.lastIndexOf(".");
  const ext = dotIndex !== -1 ? fileName.slice(dotIndex + 1).toLowerCase() : "";

  switch (ext) {
    case "pdf":
      return extractPdf(bytes, opts);
    case "docx":
      return extractDocx(bytes, opts);
    case "txt":
      return extractTxt(bytes, opts);
    default: {
      const extLabel = ext ? `.${ext}` : "no extension";
      return {
        kind: "failed",
        issue: "unsupported_type",
        reason: `Unsupported file format (${extLabel}). Accepted formats are PDF (.pdf), Word (.docx), and plain text (.txt). Please convert your file to a supported format and try again.`,
      };
    }
  }
}
