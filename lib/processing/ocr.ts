/**
 * OCR for image documents. Server-only. FR03.
 *
 * The rule this module exists to enforce: "A blurry scan produces an
 * uncertainty flag, not invented text." OCR always returns *something*, and the
 * something is often confidently wrong — the blurry fixture reads "$3OO" where
 * the character is genuinely ambiguous between letter-O and zero. So confidence
 * travels with every word and every excerpt, and callers must surface it rather
 * than presenting OCR output as if it were a text layer.
 *
 * Failures are typed, never thrown, matching lib/processing/extract.
 */

import type { DocumentIssue } from "@/lib/contracts";
import { imageSize } from "./image-size";

export interface OcrWord {
  text: string;
  /** 0..1. Tesseract reports 0..100 per word; divided here so it matches Excerpt.extractionConfidence. */
  confidence: number;
  /** Normalised 0..1, origin top-left — same convention as ExtractedTextItem. */
  bbox: { x: number; y: number; w: number; h: number };
}

/** A value-shaped word read with less than full confidence. Needs confirming. */
export interface OcrSuspectValue {
  text: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface OcrLine {
  text: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
}

export type OcrOutcome =
  | {
      kind: "ocr";
      text: string;
      /** Mean word confidence, 0..1. Becomes the excerpt's extractionConfidence. */
      confidence: number;
      words: OcrWord[];
      lines: OcrLine[];
      /** Share of kept words below OCR_WEAK_WORD_BELOW. Shown to the user, not just used internally. */
      weakWordShare: number;
      /**
       * Money, dates and reference numbers that were not read cleanly. These
       * must be confirmed before they can become facts, however well the page
       * scored overall.
       */
      suspectValues: OcrSuspectValue[];
      /**
       * True when the read is too uncertain to quote back to the user as fact.
       * The text is still returned — hiding it would be its own kind of lying —
       * but it must be shown as uncertain and must not become a confirmed fact.
       */
      uncertain: boolean;
    }
  | { kind: "failed"; issue: DocumentIssue; reason: string };

/**
 * Uncertainty is decided by two signals, because the mean alone does not work.
 *
 * Measured on the fixtures:
 *
 *   file                 mean    share of words below 0.80
 *   clean receipt        0.938   3%
 *   clean chat           0.926   6%
 *   deliberately blurred 0.831   25%
 *
 * A single mean threshold has to thread 0.926 and 0.831 and gets no margin. The
 * blurred note read "Pad" for "Paid", "{check" for "(check", and resolved the
 * deliberately ambiguous "$3OO" to a confident "$300" — three errors at 83%
 * self-reported confidence. Tesseract is optimistic on degraded text, so a mean
 * that looks healthy hides a tail of bad words.
 *
 * The share of weak words separates the same files 3%/6% against 25%. Either
 * signal alone catches the blurred note here; requiring both to pass gives
 * margin as real scans get messier than the fixtures.
 */
export const OCR_UNCERTAIN_MEAN_BELOW = 0.88;
export const OCR_WEAK_WORD_BELOW = 0.8;
export const OCR_UNCERTAIN_WEAK_SHARE_ABOVE = 0.15;

/** Words below this are dropped entirely — at that level it is noise, not text. */
export const OCR_WORD_FLOOR = 0.3;

/**
 * Values worth forcing a human to confirm regardless of how the page scored:
 * money, dates, and long digit runs like reference or account numbers.
 *
 * The clean receipt returned "S$$2,000.00" at 0.55 — a doubled dollar sign on
 * the most consequential value in the case, inside a document whose overall
 * read was excellent. A page-level flag would never surface that, and FR01
 * requires names, dates and amounts to be confirmed explicitly.
 */
const VALUE_LIKE = /(?:S?\$|\bSGD\b)|\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\b\d+\.\d{2}\b|\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b\d{4,}\b/i;
export const OCR_VALUE_CONFIRM_BELOW = 0.95;

async function loadTesseract() {
  return import("tesseract.js");
}

export async function ocrImage(bytes: Uint8Array): Promise<OcrOutcome> {
  const size = imageSize(bytes);
  if (!size) {
    return {
      kind: "failed",
      issue: "unreadable",
      reason: "We could not read this image. If you have another copy, try uploading that.",
    };
  }

  let worker: Awaited<ReturnType<Awaited<ReturnType<typeof loadTesseract>>["createWorker"]>> | null =
    null;
  try {
    const { createWorker } = await loadTesseract();
    worker = await createWorker("eng");

    // Buffer copy: tesseract.js is happier with a plain Node Buffer, and the
    // pooled-view problem that bit pdfjs applies here too.
    const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const { data } = await worker.recognize(buf, {}, { blocks: true, text: true });

    const norm = (b: { x0: number; y0: number; x1: number; y1: number }) => ({
      x: clamp01(b.x0 / size.width),
      y: clamp01(b.y0 / size.height),
      w: clamp01((b.x1 - b.x0) / size.width),
      h: clamp01((b.y1 - b.y0) / size.height),
    });

    const words: OcrWord[] = [];
    const lines: OcrLine[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          const kept = (line.words ?? []).filter((w) => w.confidence / 100 >= OCR_WORD_FLOOR);
          for (const w of kept) {
            words.push({ text: w.text, confidence: w.confidence / 100, bbox: norm(w.bbox) });
          }
          if (kept.length > 0) {
            lines.push({
              text: kept.map((w) => w.text).join(" "),
              confidence: line.confidence / 100,
              bbox: norm(line.bbox),
            });
          }
        }
      }
    }

    const text = lines.map((l) => l.text).join("\n");
    const confidence =
      words.length === 0 ? 0 : words.reduce((s, w) => s + w.confidence, 0) / words.length;
    const weakWordShare =
      words.length === 0
        ? 1
        : words.filter((w) => w.confidence < OCR_WEAK_WORD_BELOW).length / words.length;
    const suspectValues = words
      .filter((w) => w.confidence < OCR_VALUE_CONFIRM_BELOW && VALUE_LIKE.test(w.text))
      .map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox }));

    return {
      kind: "ocr",
      text,
      confidence,
      words,
      lines,
      weakWordShare,
      suspectValues,
      uncertain:
        words.length === 0 ||
        confidence < OCR_UNCERTAIN_MEAN_BELOW ||
        weakWordShare > OCR_UNCERTAIN_WEAK_SHARE_ABOVE,
    };
  } catch {
    // Language data is fetched on first use. Offline, that fails — and the
    // correct behaviour is to say so, never to proceed with no text and let the
    // rest of the pipeline read that as "this document says nothing".
    return {
      kind: "failed",
      issue: "unreadable",
      reason:
        "We could not read the text in this image. You can try uploading a clearer photo, or type the details in yourself.",
    };
  } finally {
    await worker?.terminate().catch(() => {});
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 1 ? 1 : n;
}
