import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  extract,
  extractDocx,
  extractPdf,
  extractTxt,
} from "./extract";

function readFixture(name: string): Buffer {
  const localUrl = new URL(`../../fixtures/documents/${name}`, import.meta.url);
  try {
    return fs.readFileSync(localUrl);
  } catch {
    return fs.readFileSync(path.resolve(process.cwd(), "fixtures/documents", name));
  }
}

describe("extract", () => {
  it("extracts text and bboxes from quote-accepted.pdf", async () => {
    const bytes = readFixture("quote-accepted.pdf");
    const res = await extractPdf(bytes);

    assert.equal(res.kind, "extracted");
    if (res.kind !== "extracted") return;

    assert.equal(res.pageCount, 2);
    assert.equal(res.pages.length, 2);
    assert.equal(res.needsOcr, false);
    assert.equal(res.truncated, false);

    const fullText = res.pages.map((p) => p.text).join("\n");
    assert.ok(fullText.includes("S$2,000"), 'text should contain "S$2,000"');
    assert.ok(fullText.includes("15 July 2026"), 'text should contain "15 July 2026"');

    for (const page of res.pages) {
      assert.ok(page.items.length > 0, `page ${page.page} items should be non-empty`);
      for (const item of page.items) {
        assert.ok(item.bbox.x >= 0 && item.bbox.x <= 1, `bbox.x out of range: ${item.bbox.x}`);
        assert.ok(item.bbox.y >= 0 && item.bbox.y <= 1, `bbox.y out of range: ${item.bbox.y}`);
        assert.ok(item.bbox.w >= 0 && item.bbox.w <= 1, `bbox.w out of range: ${item.bbox.w}`);
        assert.ok(item.bbox.h >= 0 && item.bbox.h <= 1, `bbox.h out of range: ${item.bbox.h}`);
      }
    }
  });

  it("fails with password_protected issue for bank-statement.pdf", async () => {
    const bytes = readFixture("bank-statement.pdf");
    const res = await extractPdf(bytes);

    assert.equal(res.kind, "failed");
    if (res.kind !== "failed") return;

    assert.equal(res.issue, "password_protected");
    assert.ok(res.reason.length > 0);
  });

  it("fails with unreadable issue for corrupted-scan.pdf", async () => {
    const bytes = readFixture("corrupted-scan.pdf");
    const res = await extractPdf(bytes);

    assert.equal(res.kind, "failed");
    if (res.kind !== "failed") return;

    assert.equal(res.issue, "unreadable");
    assert.ok(res.reason.length > 0);
  });

  it("truncates long-appendix.pdf when over page budget", async () => {
    const bytes = readFixture("long-appendix.pdf");
    const res = await extractPdf(bytes, { maxPages: 10 });

    assert.equal(res.kind, "extracted");
    if (res.kind !== "extracted") return;

    assert.equal(res.truncated, true);
    assert.equal(res.pages.length, 10);
    assert.equal(res.pageCount, 120);
  });

  it("accepts a Buffer, a plain Uint8Array, and an offset view alike", async () => {
    // Regression guard. pdfjs rejects Buffer by constructor check, and reads
    // .buffer without honouring byteOffset — so a pooled Buffer (which is what
    // fs.readFile returns for a small file) silently reported every PDF as
    // corrupt. toBytes() normalises all three shapes; if that is ever
    // "simplified" away, this fails.
    const raw = readFixture("quote-accepted.pdf");

    const plain = new Uint8Array(raw.byteLength);
    plain.set(raw);

    // A view sitting at a non-zero offset inside a larger buffer, like a pooled Buffer.
    const padded = new Uint8Array(raw.byteLength + 64);
    padded.set(raw, 64);
    const offsetView = padded.subarray(64);

    const [fromBuffer, fromPlain, fromOffset] = await Promise.all([
      extractPdf(raw),
      extractPdf(plain),
      extractPdf(offsetView),
    ]);

    for (const [label, res] of [
      ["Buffer", fromBuffer],
      ["Uint8Array", fromPlain],
      ["offset view", fromOffset],
    ] as const) {
      assert.equal(res.kind, "extracted", `${label} should extract`);
    }
    assert.deepEqual(fromBuffer, fromPlain);
    assert.deepEqual(fromPlain, fromOffset);
  });

  it("fails with unsupported_type for contract-draft.rtf via extract()", async () => {
    const bytes = readFixture("contract-draft.rtf");
    const res = await extract("contract-draft.rtf", bytes);

    assert.equal(res.kind, "failed");
    if (res.kind !== "failed") return;

    assert.equal(res.issue, "unsupported_type");
    assert.ok(res.reason.toLowerCase().includes("rtf"));
    assert.ok(res.reason.includes(".pdf"));
    assert.ok(res.reason.includes(".docx"));
    assert.ok(res.reason.includes(".txt"));
  });

  it("extracts in-memory .txt via extractTxt and extract", async () => {
    const content = "Dispute claim note: S$2,000 paid on 20 June 2026.";
    const bytes = new TextEncoder().encode(content);

    const resTxt = await extractTxt(bytes);
    assert.equal(resTxt.kind, "extracted");
    if (resTxt.kind !== "extracted") return;

    assert.equal(resTxt.pageCount, 1);
    assert.equal(resTxt.pages.length, 1);
    assert.equal(resTxt.truncated, false);
    assert.equal(resTxt.needsOcr, false);
    assert.equal(resTxt.pages[0].text, content);
    assert.deepEqual(resTxt.pages[0].items, []);

    const resExtract = await extract("claim.txt", bytes);
    assert.equal(resExtract.kind, "extracted");
    if (resExtract.kind !== "extracted") return;
    assert.equal(resExtract.pages[0].text, content);
  });

  it("fails with unreadable issue for corrupted docx bytes", async () => {
    const invalidBytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const res = await extractDocx(invalidBytes);

    assert.equal(res.kind, "failed");
    if (res.kind !== "failed") return;

    assert.equal(res.issue, "unreadable");
    assert.ok(res.reason.length > 0);
  });

  it("is deterministic: extracting the same PDF bytes twice yields deep-equal output", async () => {
    const bytes = readFixture("quote-accepted.pdf");
    const run1 = await extractPdf(bytes);
    const run2 = await extractPdf(bytes);

    assert.deepEqual(run1, run2);
  });
});
