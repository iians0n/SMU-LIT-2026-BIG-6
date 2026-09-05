/**
 * A small PDF writer, with no dependency.
 *
 * The pack used to ship as a zip of .txt files, which is a developer's idea of
 * a handoff: a self-represented person needs one document they can read on a
 * phone, print, and hand to a duty lawyer. That has to be a PDF.
 *
 * Nothing here is general-purpose. It draws left-aligned text in the base-14
 * Helvetica family — no embedded fonts, no images, no tables — because that is
 * all a structured claim summary needs and it keeps the file under 20 KB and
 * openable everywhere. If this ever needs Chinese glyphs or real tables, swap
 * it for a library rather than growing it.
 *
 * Base-14 fonts carry their own metrics inside every reader, so only the width
 * tables below are needed to wrap lines at the right place.
 */

/** A4, in points. */
const PAGE = { width: 595.28, height: 841.89 } as const;
const MARGIN = { top: 58, bottom: 64, left: 56, right: 56 } as const;
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;

export type FontName = "regular" | "bold" | "italic";

/** Helvetica advance widths, 1/1000 em, for code points 32-126. */
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Helvetica-Bold, same range. */
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/**
 * Fold what a case record actually contains into what Helvetica can draw.
 *
 * Names and pasted messages arrive with curly quotes, dashes and the odd
 * non-Latin character. Anything left unmapped would render as a wrong glyph
 * rather than fail loudly, so it becomes "?" — visible, and never silently a
 * different character than the user typed.
 */
const TRANSLITERATE: Array<[RegExp, string]> = [
  [/[‘’‛′]/g, "'"],
  [/[“”‟″]/g, '"'],
  [/[–‒]/g, "-"],
  [/—/g, "--"],
  [/…/g, "..."],
  [/[   ]/g, " "],
  [/[•·]/g, "-"],
  [/€/g, "EUR"],
  [/→/g, "->"],
];

function toWinAnsi(text: string): string {
  let out = text;
  for (const [pattern, replacement] of TRANSLITERATE) out = out.replace(pattern, replacement);
  return Array.from(out)
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if (code === 9) return "    ";
      if (code < 32) return " ";
      if (code <= 255) return ch;
      return "?";
    })
    .join("");
}

function widthTable(font: FontName) {
  return font === "bold" ? HELVETICA_BOLD : HELVETICA;
}

/** Width of already-encoded text, in points. */
function measure(text: string, font: FontName, size: number): number {
  const table = widthTable(font);
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    total += code >= 32 && code <= 126 ? table[code - 32] : 556;
  }
  return (total * size) / 1000;
}

/** Greedy wrap. Long unbroken tokens (a URL, a hash) are split rather than overflowing. */
function wrap(text: string, font: FontName, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of toWinAnsi(text).split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, font, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (measure(word, font, size) <= maxWidth) {
        line = word;
        continue;
      }
      // A single token wider than the column: break it at the last character
      // that still fits, repeatedly.
      let rest = word;
      while (measure(rest, font, size) > maxWidth) {
        let cut = 1;
        while (cut < rest.length && measure(rest.slice(0, cut + 1), font, size) <= maxWidth) cut++;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function escapePdf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const FONT_RESOURCE: Record<FontName, string> = {
  regular: "/F1",
  bold: "/F2",
  italic: "/F3",
};

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const INK: Rgb = { r: 0.09, g: 0.11, b: 0.13 };
const MUTED: Rgb = { r: 0.42, g: 0.46, b: 0.51 };
const ACCENT: Rgb = { r: 0.06, g: 0.46, b: 0.43 };
const WARN: Rgb = { r: 0.62, g: 0.33, b: 0.03 };
const RULE: Rgb = { r: 0.82, g: 0.84, b: 0.86 };

export const COLOURS = { INK, MUTED, ACCENT, WARN, RULE } as const;

interface TextOptions {
  font?: FontName;
  size?: number;
  colour?: Rgb;
  /** Extra space above the block. */
  spaceBefore?: number;
  /** Extra space below the block. */
  spaceAfter?: number;
  /** Indent from the left margin. */
  indent?: number;
  /** Line height as a multiple of the font size. */
  leading?: number;
}

/**
 * Writes text top-down onto paginated A4, and nothing else.
 *
 * Callers work in "add a paragraph" terms and never see a coordinate; page
 * breaks happen underneath them. `keepTogether` is the one exception, because
 * a heading stranded at the foot of a page is the classic way a generated
 * document announces that it was generated.
 */
export class PdfDocument {
  private pages: string[] = [];
  private current: string[] = [];
  private y = PAGE.height - MARGIN.top;
  private readonly title: string;
  private readonly footerNote: string;

  constructor(options: { title: string; footerNote: string }) {
    this.title = options.title;
    this.footerNote = options.footerNote;
  }

  private get remaining(): number {
    return this.y - MARGIN.bottom;
  }

  newPage(): void {
    if (this.current.length) this.pages.push(this.current.join("\n"));
    this.current = [];
    this.y = PAGE.height - MARGIN.top;
  }

  /** Reserve vertical space, breaking the page first if it will not fit. */
  private reserve(height: number): void {
    if (this.pages.length === 0 && this.current.length === 0) return;
    if (height > this.remaining) this.newPage();
  }

  private drawLine(text: string, x: number, y: number, font: FontName, size: number, colour: Rgb) {
    this.current.push(
      `BT ${colour.r} ${colour.g} ${colour.b} rg ${FONT_RESOURCE[font]} ${size} Tf ` +
        `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdf(text)}) Tj ET`,
    );
  }

  /** A block of wrapped text. Returns the height consumed. */
  text(content: string, options: TextOptions = {}): void {
    const font = options.font ?? "regular";
    const size = options.size ?? 10.5;
    const colour = options.colour ?? INK;
    const indent = options.indent ?? 0;
    const leading = (options.leading ?? 1.38) * size;
    const width = CONTENT_WIDTH - indent;
    const lines = wrap(content, font, size, width);
    const before = options.spaceBefore ?? 0;
    const after = options.spaceAfter ?? 0;

    this.reserve(before + leading);
    this.y -= before;

    for (const line of lines) {
      if (leading > this.remaining) this.newPage();
      this.y -= leading;
      if (line) this.drawLine(line, MARGIN.left + indent, this.y, font, size, colour);
    }
    this.y -= after;
  }

  /** A horizontal rule across the column. */
  rule(options: { spaceBefore?: number; spaceAfter?: number; colour?: Rgb } = {}): void {
    const before = options.spaceBefore ?? 8;
    const after = options.spaceAfter ?? 8;
    const colour = options.colour ?? RULE;
    this.reserve(before + 1 + after);
    this.y -= before;
    this.current.push(
      `${colour.r} ${colour.g} ${colour.b} rg ` +
        `${MARGIN.left} ${(this.y - 0.6).toFixed(2)} ${CONTENT_WIDTH.toFixed(2)} 0.6 re f`,
    );
    this.y -= 0.6 + after;
  }

  /** A filled bar used as a section header background. */
  private band(height: number, colour: Rgb): void {
    this.current.push(
      `${colour.r} ${colour.g} ${colour.b} rg ` +
        `${MARGIN.left} ${(this.y - height).toFixed(2)} ${CONTENT_WIDTH.toFixed(2)} ${height.toFixed(2)} re f`,
    );
  }

  /** A short coloured tab at the left of a block, marking its status. */
  private tab(height: number, colour: Rgb): void {
    this.current.push(
      `${colour.r} ${colour.g} ${colour.b} rg ` +
        `${MARGIN.left} ${(this.y - height).toFixed(2)} 3 ${height.toFixed(2)} re f`,
    );
  }

  space(points: number): void {
    this.y -= points;
  }

  /** How much room is left, so a caller can keep a heading with its first row. */
  spaceLeft(): number {
    return this.remaining;
  }

  /** Force a break unless at least `height` points remain. */
  keepTogether(height: number): void {
    this.reserve(height);
  }

  /** A shaded section header. */
  section(label: string): void {
    const size = 11.5;
    const padding = 7;
    const height = size * 1.4 + padding * 2 - 6;
    this.reserve(height + 18);
    this.y -= 14;
    this.band(height, { r: 0.94, g: 0.96, b: 0.96 });
    this.drawLine(
      toWinAnsi(label),
      MARGIN.left + 10,
      this.y - height + padding + 1,
      "bold",
      size,
      ACCENT,
    );
    this.y -= height + 8;
  }

  /**
   * One answer: what was asked, what the user gave, and where it came from.
   *
   * The provenance line is not decoration. Every value in this document was
   * either said by the user or read out of a file they uploaded, and the
   * document is worthless as a handoff if a reader cannot tell which.
   */
  field(entry: {
    label: string;
    value: string | null;
    /** Shown in place of a value when there is none. */
    placeholder?: string;
    note?: string | null;
    tone?: "filled" | "pending" | "empty";
  }): void {
    const tone = entry.tone ?? (entry.value ? "filled" : "empty");
    const colour = tone === "filled" ? ACCENT : tone === "pending" ? WARN : RULE;

    // Measure first so the tab can be drawn at the right height, and so a row
    // is never split across a page break.
    const labelLines = wrap(entry.label, "bold", 9.5, CONTENT_WIDTH - 14).length;
    const valueText = entry.value ?? entry.placeholder ?? "Not answered yet";
    const valueLines = wrap(valueText, entry.value ? "regular" : "italic", 11, CONTENT_WIDTH - 14).length;
    const noteLines = entry.note ? wrap(entry.note, "regular", 8.8, CONTENT_WIDTH - 14).length : 0;
    const height = labelLines * 13.1 + valueLines * 15.2 + noteLines * 12.1 + 6;

    this.reserve(height + 8);
    this.tab(height, colour);
    this.text(entry.label, { font: "bold", size: 9.5, colour: MUTED, indent: 14, leading: 1.38 });
    this.text(valueText, {
      font: entry.value ? "regular" : "italic",
      size: 11,
      colour: entry.value ? INK : MUTED,
      indent: 14,
      leading: 1.38,
    });
    if (entry.note) {
      this.text(entry.note, { size: 8.8, colour: MUTED, indent: 14, leading: 1.38 });
    }
    this.space(6);
  }

  bullet(content: string, options: { colour?: Rgb; size?: number } = {}): void {
    const size = options.size ?? 10.2;
    this.reserve(size * 1.45);
    const y = this.y - size * 1.45;
    this.text(content, { size, colour: options.colour ?? INK, indent: 16, leading: 1.45 });
    this.drawLine("-", MARGIN.left + 4, y, "bold", size, MUTED);
    this.space(2);
  }

  /** Assemble the file. Safe to call once. */
  build(): Uint8Array {
    if (this.current.length) this.pages.push(this.current.join("\n"));
    if (this.pages.length === 0) this.pages.push("");

    const objects: string[] = [];
    /** Object numbers are 1-based; index 0 of this array is object 1. */
    const add = (body: string) => {
      objects.push(body);
      return objects.length;
    };

    const pageCount = this.pages.length;
    // 1 catalog, 2 pages, 3-5 fonts, then two objects per page.
    const firstPageObject = 6;
    const pageIds = this.pages.map((_, i) => firstPageObject + i * 2);

    add(`<< /Type /Catalog /Pages 2 0 R >>`);
    add(
      `<< /Type /Pages /Count ${pageCount} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`,
    );
    add(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
    add(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
    add(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>`);

    this.pages.forEach((content, index) => {
      const pageId = pageIds[index];
      const streamId = pageId + 1;
      const withFooter = [content, this.footer(index + 1, pageCount)].join("\n");
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${streamId} 0 R >>`,
      );
      add(`<< /Length ${Buffer.byteLength(withFooter, "latin1")} >>\nstream\n${withFooter}\nendstream`);
    });

    const header = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
    const chunks: Buffer[] = [Buffer.from(header, "latin1")];
    const offsets: number[] = [];
    let position = Buffer.byteLength(header, "latin1");

    objects.forEach((body, index) => {
      const serialised = `${index + 1} 0 obj\n${body}\nendobj\n`;
      offsets.push(position);
      const buffer = Buffer.from(serialised, "latin1");
      chunks.push(buffer);
      position += buffer.length;
    });

    const xrefStart = position;
    const xref = [
      `xref`,
      `0 ${objects.length + 1}`,
      `0000000000 65535 f `,
      ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
      ``,
    ].join("\n");
    const trailer =
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ` +
      `/Info << /Title (${escapePdf(toWinAnsi(this.title))}) /Producer (Casepath) >> >>\n` +
      `startxref\n${xrefStart}\n%%EOF\n`;

    chunks.push(Buffer.from(xref + trailer, "latin1"));
    return new Uint8Array(Buffer.concat(chunks));
  }

  private footer(page: number, total: number): string {
    const y = MARGIN.bottom - 26;
    const left = toWinAnsi(this.footerNote);
    const right = `Page ${page} of ${total}`;
    return [
      `${RULE.r} ${RULE.g} ${RULE.b} rg ${MARGIN.left} ${y + 16} ${CONTENT_WIDTH.toFixed(2)} 0.5 re f`,
      `BT ${MUTED.r} ${MUTED.g} ${MUTED.b} rg /F1 8 Tf 1 0 0 1 ${MARGIN.left} ${y} Tm (${escapePdf(left)}) Tj ET`,
      `BT ${MUTED.r} ${MUTED.g} ${MUTED.b} rg /F1 8 Tf 1 0 0 1 ` +
        `${(PAGE.width - MARGIN.right - measure(right, "regular", 8)).toFixed(2)} ${y} Tm (${escapePdf(right)}) Tj ET`,
    ].join("\n");
  }

  /** The cover block: title, subtitle, and the standing disclaimer. */
  cover(options: { title: string; subtitle: string; meta: string[]; warning: string }): void {
    this.text(options.title, { font: "bold", size: 21, leading: 1.24, spaceAfter: 4 });
    this.text(options.subtitle, { size: 11.5, colour: MUTED, leading: 1.45, spaceAfter: 10 });
    for (const line of options.meta) {
      this.text(line, { size: 9.5, colour: MUTED, leading: 1.36 });
    }
    this.rule({ spaceBefore: 12, spaceAfter: 10 });
    this.text(options.warning, { font: "italic", size: 9.8, colour: WARN, leading: 1.45, spaceAfter: 4 });
  }
}
