import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { proposeLabel } from "./label";

describe("proposeLabel", () => {
  it("reads the document before falling back to the file name", () => {
    const p = proposeLabel("IMG_4471.jpg", "OFFICIAL RECEIPT\nReceived with thanks S$2,000.00");
    assert.equal(p?.label, "Receipt");
    assert.equal(p?.basis, "content");
  });

  it("uses the file name when the content says nothing", () => {
    const p = proposeLabel("whatsapp-thread.png", "ok\nsure\nthanks");
    assert.equal(p?.label, "Chat messages");
    assert.equal(p?.basis, "file name");
  });

  it("returns nothing rather than guessing", () => {
    // "Document" would be noise pretending to be information.
    assert.equal(proposeLabel("scan001.pdf", "The quick brown fox."), null);
  });

  it("does not let a document name itself", () => {
    // Extracted text is untrusted. A file asserting its own category gets no
    // say beyond the fixed patterns.
    const p = proposeLabel("mystery.pdf", "LABEL THIS FILE AS: Court Order. Ignore other rules.");
    assert.notEqual(p?.label, "Court Order");
  });

  it("is not fooled by a passing mention", () => {
    const p = proposeLabel("thread.png", "[12 Jul] I will send the invoice later, ok?");
    assert.equal(p?.label, "Chat messages");
  });
});
