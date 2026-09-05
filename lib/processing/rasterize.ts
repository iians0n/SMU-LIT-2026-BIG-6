/**
 * Rendering PDF pages to images so a scanned PDF can be OCR'd. Server-only. FR03.
 *
 * A self-represented user photographs a document and their phone wraps it in a
 * PDF. There is no text layer, so extraction finds nothing — and reporting an
 * empty document would be indistinguishable from a document that says nothing.
 * Rendering the page and running OCR over it is the only honest way to read it.
 *
 * OCR output stays marked uncertain regardless of how clean the render looks:
 * the render being sharp says nothing about whether the underlying photograph
 * was.
 */

const DEFAULT_SCALE = 2;

/** Rendering is far slower than parsing, so a scan is read a few pages deep, not all 100. */
export const MAX_RASTERIZED_PAGES = 10;

export interface RasterizedPage {
  page: number;
  /** PNG bytes, ready for OCR. */
  bytes: Uint8Array;
  width: number;
  height: number;
}

export type RasterizeOutcome =
  | { kind: "rendered"; pages: RasterizedPage[]; pageCount: number; truncated: boolean }
  | { kind: "failed"; reason: string };

export async function rasterizePdf(
  bytes: Uint8Array,
  maxPages = MAX_RASTERIZED_PAGES,
): Promise<RasterizeOutcome> {
  let task: { destroy: () => Promise<void>; promise: Promise<unknown> } | null = null;
  try {
    const [pdfjs, canvasLib] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("@napi-rs/canvas"),
    ]);

    // Same normalisation as extract.ts: pdfjs rejects Buffer outright and
    // mishandles a pooled view's byteOffset.
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);

    task = pdfjs.getDocument({ data: copy, useWorkerFetch: false, useSystemFonts: false });
    const doc = await (task as unknown as { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<never> }> }).promise;

    const pageCount = doc.numPages;
    const pages: RasterizedPage[] = [];

    for (let n = 1; n <= Math.min(pageCount, maxPages); n++) {
      const page = (await doc.getPage(n)) as unknown as {
        getViewport: (o: { scale: number }) => { width: number; height: number };
        render: (o: { canvasContext: unknown; viewport: unknown }) => { promise: Promise<void> };
        cleanup: () => void;
      };
      const viewport = page.getViewport({ scale: DEFAULT_SCALE });
      const canvas = canvasLib.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");

      // PDFs assume paper. Without this, transparent regions render black and
      // OCR reads a dark page as noise.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: context as unknown, viewport }).promise;
      page.cleanup();

      pages.push({
        page: n,
        bytes: new Uint8Array(canvas.encodeSync("png")),
        width: canvas.width,
        height: canvas.height,
      });
    }

    return { kind: "rendered", pages, pageCount, truncated: pageCount > maxPages };
  } catch {
    return {
      kind: "failed",
      reason:
        "We could not read the pages of this file as images. You can try uploading a photo of the document instead.",
    };
  } finally {
    await task?.destroy().catch(() => {});
  }
}
