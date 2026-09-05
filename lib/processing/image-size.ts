/**
 * Pixel dimensions from a PNG or JPEG header. Server-side, no dependencies.
 *
 * OCR reports word boxes in pixels, but ExcerptAnchor regions are normalised
 * 0..1 so a viewer can draw a highlight at any zoom. Normalising needs the page
 * size, and pulling in an image library for two header reads is not worth it.
 */

export interface ImageSize {
  width: number;
  height: number;
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Returns null when the header is not a PNG/JPEG we can read — never a guess. */
export function imageSize(bytes: Uint8Array): ImageSize | null {
  return pngSize(bytes) ?? jpegSize(bytes);
}

function pngSize(b: Uint8Array): ImageSize | null {
  if (b.length < 24 || !PNG_MAGIC.every((v, i) => b[i] === v)) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // IHDR is always the first chunk: width and height are big-endian at 16 and 20.
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(b: Uint8Array): ImageSize | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);

  let i = 2;
  while (i < b.length - 1) {
    if (b[i] !== 0xff) {
      i++; // resync rather than give up: padding bytes are legal between segments
      continue;
    }
    const marker = b[i + 1];

    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // end of header section

    if (i + 4 > b.length) return null;
    const length = view.getUint16(i + 2);

    // SOF0..SOF15, excluding DHT (c4), JPG (c8) and DAC (cc), carry the frame size.
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (i + 9 > b.length) return null;
      return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}
