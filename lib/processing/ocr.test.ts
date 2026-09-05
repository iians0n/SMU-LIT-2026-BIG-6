import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { ocrImage } from "./ocr";

const fixture = (name: string) => new Uint8Array(readFileSync(`fixtures/documents/${name}`));

// OCR downloads language data on first use and runs a real recognition pass.
const SLOW = { timeout: 120_000 };

describe("ocrImage", () => {
  it("reads a clean receipt and finds the amount", SLOW, async () => {
    const r = await ocrImage(fixture("receipt.jpg"));
    assert.equal(r.kind, "ocr");
    if (r.kind !== "ocr") return;
    assert.match(r.text, /PRECISION HOME REPAIRS/i);
    assert.match(r.text, /Tan Wei Ling/i);
    assert.ok(r.confidence > 0.9, `confidence ${r.confidence}`);
    assert.equal(r.uncertain, false);
  });

  it("flags the deliberately blurred note as uncertain", SLOW, async () => {
    // The acceptance criterion for FR03: this must not pass as clean text.
    // It self-reports ~0.83 confidence while misreading three words, so the
    // weak-word share is what has to catch it.
    const r = await ocrImage(fixture("handwritten-note.jpg"));
    assert.equal(r.kind, "ocr");
    if (r.kind !== "ocr") return;
    assert.equal(r.uncertain, true, `mean ${r.confidence}, weak share ${r.weakWordShare}`);
    assert.ok(r.weakWordShare > 0.15, `weak share ${r.weakWordShare}`);
  });

  it("does not invent text: every word it returns is one it actually saw", SLOW, async () => {
    const r = await ocrImage(fixture("handwritten-note.jpg"));
    if (r.kind !== "ocr") return;
    // Text is assembled from kept words only, so nothing can appear in `text`
    // that is not backed by a word with a box and a confidence.
    for (const line of r.lines) {
      for (const token of line.text.split(" ")) {
        assert.ok(
          r.words.some((w) => w.text === token),
          `"${token}" appears in text with no backing word`,
        );
      }
    }
  });

  it("marks money read at less than full confidence for confirmation", SLOW, async () => {
    // The clean receipt returns "S$$2,000.00" at ~0.55 - a doubled dollar sign
    // on the case's most consequential value, inside an otherwise excellent read.
    const r = await ocrImage(fixture("receipt.jpg"));
    if (r.kind !== "ocr") return;
    assert.ok(r.suspectValues.length > 0, "no suspect values on a page containing an amount");
    assert.ok(
      r.suspectValues.some((v) => /\d/.test(v.text)),
      `suspects: ${r.suspectValues.map((v) => v.text).join(", ")}`,
    );
  });

  it("keeps every box inside the page", SLOW, async () => {
    const r = await ocrImage(fixture("whatsapp-thread.png"));
    if (r.kind !== "ocr") return;
    for (const w of r.words) {
      for (const [k, v] of Object.entries(w.bbox)) {
        assert.ok(v >= 0 && v <= 1, `${k}=${v} out of range for "${w.text}"`);
      }
    }
  });

  it("fails rather than guessing when the bytes are not an image", SLOW, async () => {
    const r = await ocrImage(fixture("quote-accepted.pdf"));
    assert.equal(r.kind, "failed");
    if (r.kind !== "failed") return;
    assert.equal(r.issue, "unreadable");
  });
});
