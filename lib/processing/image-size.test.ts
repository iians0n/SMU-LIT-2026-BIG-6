import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { imageSize } from "./image-size";

const fixture = (name: string) => new Uint8Array(readFileSync(`fixtures/documents/${name}`));

describe("imageSize", () => {
  it("reads PNG dimensions from IHDR", () => {
    // The generator renders the chat at 820 wide.
    assert.deepEqual(imageSize(fixture("whatsapp-thread.png"))?.width, 820);
  });

  it("reads JPEG dimensions from the SOF frame header", () => {
    const size = imageSize(fixture("receipt.jpg"));
    assert.ok(size, "receipt.jpg should be readable");
    // Rendered 900x1250 then rotated 1.1 degrees with expand, so it grew slightly.
    assert.ok(size.width > 900 && size.width < 960, `unexpected width ${size.width}`);
    assert.ok(size.height > 1250 && size.height < 1310, `unexpected height ${size.height}`);
  });

  it("agrees with the blurry scan's known size", () => {
    assert.deepEqual(imageSize(fixture("handwritten-note.jpg")), { width: 1000, height: 700 });
  });

  it("returns null rather than guessing for a non-image", () => {
    assert.equal(imageSize(fixture("quote-accepted.pdf")), null);
    assert.equal(imageSize(new Uint8Array([1, 2, 3])), null);
  });
});
