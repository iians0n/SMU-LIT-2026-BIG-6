/**
 * Documents and excerpts. Written by Anson (FR03).
 */

import type { Id, ISODate } from "./primitives";

/** PRD §2 working assumptions. Product defaults for team review, not filing limits. */
export const UPLOAD_LIMITS = {
  maxFilesPerCase: 20,
  maxBytesPerFile: 20 * 1024 * 1024,
  maxPagesPerCase: 100,
} as const;

export const SUPPORTED_EXTENSIONS = ["pdf", "docx", "jpg", "jpeg", "png", "txt"] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/**
 * Pipeline state. Separate from `issues` below: a file can extract successfully
 * and still be flagged possibly unrelated.
 */
export type ProcessingStatus = "pending" | "processing" | "extracted" | "failed";

/**
 * Everything FR03 requires us to mark visibly. The UI must never imply that a
 * file carrying one of these was read normally.
 */
export type DocumentIssue =
  | "unreadable"
  | "password_protected"
  | "truncated"
  | "unsupported_type"
  | "possibly_unrelated"
  | "low_quality_scan"
  | "duplicate"
  | "over_size_limit";

export const DOCUMENT_ISSUE_LABEL: Record<DocumentIssue, string> = {
  unreadable: "Could not be read",
  password_protected: "Password protected",
  truncated: "Only partly read",
  unsupported_type: "File type not supported",
  possibly_unrelated: "May not relate to this dispute",
  low_quality_scan: "Low quality scan — text may be uncertain",
  duplicate: "Duplicate of another file",
  over_size_limit: "Larger than the size limit",
};

export interface Document {
  readonly id: Id;
  fileName: string;
  /** Lower-case, no dot. Unsupported values still get a Document so the UI can show why. */
  extension: string;
  byteSize: number;
  /** Content hash. Duplicate detection and "duplicate evidence does not improve support" (FR05). */
  hash: string;
  uploadedAt: ISODate;
  processingStatus: ProcessingStatus;
  /** Zero or more. Coexist freely — a scan can be both low quality and truncated. */
  issues: DocumentIssue[];
  /** AI-proposed label, e.g. "Quote". The user can override it. */
  proposedLabel: string | null;
  userLabel: string | null;
  pageCount: number | null;
  /** Set when processingStatus is "failed". Shown to the user, retryable. */
  failureReason: string | null;
}

/** Where an excerpt physically sits, so the matrix can open the source in place (FR05). */
export type ExcerptAnchor =
  | { readonly kind: "page"; readonly page: number }
  | {
      readonly kind: "region";
      readonly page: number;
      /** Normalised 0..1 against the page or image, so it survives re-rendering at any zoom. */
      readonly bbox: { x: number; y: number; w: number; h: number };
    };

export interface Excerpt {
  readonly id: Id;
  documentId: Id;
  anchor: ExcerptAnchor;
  /**
   * Extracted text. UNTRUSTED — this came out of a user-supplied file.
   * Never interpolate it straight into a model prompt; wrap it with
   * `lib/processing/envelope` first (FR10, test scenario 6).
   */
  text: string;
  /**
   * How confident we are the text was read correctly.
   *
   * This is NOT evidence support. A perfectly-OCR'd receipt can still leave an
   * issue unsupported. SHARED-CONTRACT §2 forbids collapsing the two.
   */
  extractionConfidence: number;
}
