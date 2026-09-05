import type { CjtsEntryGuide, GuideValue } from "@/lib/cjts/entry-guide";

const PAGE = { width: 595.28, height: 841.89 } as const;
type Colour = readonly [number, number, number];

const COLOURS = {
  navy: [0.09, 0.2, 0.31] as Colour,
  blue: [0.08, 0.38, 0.7] as Colour,
  paleBlue: [0.93, 0.96, 0.99] as Colour,
  ink: [0.08, 0.11, 0.15] as Colour,
  muted: [0.35, 0.4, 0.45] as Colour,
  line: [0.78, 0.82, 0.86] as Colour,
  amber: [0.72, 0.42, 0.05] as Colour,
  paleAmber: [1, 0.97, 0.89] as Colour,
  green: [0.05, 0.46, 0.25] as Colour,
  white: [1, 1, 1] as Colour,
} as const;

function safeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "?");
}

function escapePdf(value: string): string {
  return safeText(value).replace(/([\\()])/g, "\\$1");
}

function colour(value: Colour): string {
  return `${value[0]} ${value[1]} ${value[2]}`;
}

function wrap(value: string, width: number, size: number): string[] {
  const max = Math.max(1, Math.floor(width / (size * 0.52)));
  const words = safeText(value).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= max) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

class GuidePage {
  readonly commands: string[] = [];

  constructor(private readonly pageNumber: number, private readonly totalPages: number) {
    this.header();
    this.footer();
  }

  private pdfY(top: number): number {
    return PAGE.height - top;
  }

  rect(x: number, top: number, width: number, height: number, fill: Colour, stroke?: Colour): void {
    this.commands.push(
      `${colour(fill)} rg${stroke ? ` ${colour(stroke)} RG 0.8 w` : ""} ` +
      `${x.toFixed(2)} ${(PAGE.height - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${stroke ? "B" : "f"}`,
    );
  }

  line(x1: number, top1: number, x2: number, top2: number, stroke = COLOURS.line): void {
    this.commands.push(
      `${colour(stroke)} RG 0.7 w ${x1.toFixed(2)} ${this.pdfY(top1).toFixed(2)} m ` +
      `${x2.toFixed(2)} ${this.pdfY(top2).toFixed(2)} l S`,
    );
  }

  text(value: string, x: number, top: number, options: {
    size?: number;
    bold?: boolean;
    colour?: Colour;
  } = {}): void {
    const size = options.size ?? 10;
    const face = options.bold ? "/F2" : "/F1";
    this.commands.push(
      `BT ${colour(options.colour ?? COLOURS.ink)} rg ${face} ${size} Tf ` +
      `1 0 0 1 ${x.toFixed(2)} ${this.pdfY(top).toFixed(2)} Tm (${escapePdf(value)}) Tj ET`,
    );
  }

  paragraph(value: string, x: number, top: number, width: number, options: {
    size?: number;
    bold?: boolean;
    colour?: Colour;
    leading?: number;
    maxLines?: number;
  } = {}): number {
    const size = options.size ?? 10;
    const leading = options.leading ?? size * 1.35;
    const lines = wrap(value, width, size).slice(0, options.maxLines ?? Number.POSITIVE_INFINITY);
    lines.forEach((line, index) => this.text(line, x, top + index * leading, options));
    return lines.length * leading;
  }

  title(section: string, subtitle?: string): void {
    this.text(section, 42, 103, { size: 20, bold: true, colour: COLOURS.navy });
    if (subtitle) this.text(subtitle, 42, 124, { size: 9, colour: COLOURS.muted });
    this.line(42, 139, 553, 139, COLOURS.blue);
  }

  section(label: string, top: number): void {
    this.rect(42, top, 511, 25, COLOURS.paleBlue);
    this.text(label, 52, top + 17, { size: 11, bold: true, colour: COLOURS.navy });
  }

  field(label: string, value: GuideValue, x: number, top: number, width: number, height = 54): void {
    const pending = value.status !== "filled";
    this.rect(x, top, width, height, pending ? COLOURS.paleAmber : COLOURS.white, pending ? COLOURS.amber : COLOURS.line);
    this.text(label, x + 8, top + 13, { size: 7.8, bold: true, colour: COLOURS.muted });
    const shown = value.value ?? (value.status === "cjts_only" ? "ISSUED BY CJTS" : "ENTER ON CJTS");
    this.paragraph(shown, x + 8, top + 31, width - 16, {
      size: value.value ? 9.4 : 8.5,
      bold: !value.value,
      colour: value.value ? COLOURS.ink : COLOURS.amber,
      leading: 11,
      maxLines: Math.max(1, Math.floor((height - 26) / 11)),
    });
  }

  checkbox(label: string, checked: boolean, x: number, top: number): void {
    this.rect(x, top, 13, 13, COLOURS.white, checked ? COLOURS.green : COLOURS.line);
    if (checked) {
      this.text("X", x + 2.4, top + 10.5, { size: 9, bold: true, colour: COLOURS.green });
    }
    this.text(label, x + 20, top + 11, { size: 9.5, colour: COLOURS.ink });
    if (checked) this.text("SELECTED", x + 135, top + 11, { size: 7.5, bold: true, colour: COLOURS.green });
  }

  private header(): void {
    this.rect(0, 0, PAGE.width, 68, COLOURS.navy);
    this.text("CASEPATH", 42, 29, { size: 16, bold: true, colour: COLOURS.white });
    this.text("CJTS ENTRY GUIDE", 42, 49, { size: 9, bold: true, colour: COLOURS.white });
    this.text("Copy guide for the current CJTS website", 354, 39, { size: 8.5, colour: COLOURS.white });
  }

  private footer(): void {
    this.line(42, 790, 553, 790);
    this.text("Preparation guide - not filed or submitted", 42, 811, { size: 8, bold: true, colour: COLOURS.amber });
    this.text(`Page ${this.pageNumber} of ${this.totalPages}`, 500, 811, { size: 8, colour: COLOURS.muted });
  }
}

function renderIntroduction(page: GuidePage, guide: CjtsEntryGuide): void {
  page.title("How to use this guide", `Case version ${guide.caseVersion}`);
  page.rect(42, 160, 511, 74, COLOURS.paleAmber, COLOURS.amber);
  page.text("THIS PDF DOES NOT FILE OR SUBMIT A CLAIM", 58, 187, { size: 13, bold: true, colour: COLOURS.amber });
  page.paragraph(
    "Open the current CJTS website separately. Copy each reviewed value into the matching field, upload your own documents, and check the live form before submitting or paying.",
    58, 208, 470, { size: 9.5, colour: COLOURS.ink, leading: 13, maxLines: 3 },
  );
  page.section("Before you begin", 258);
  const steps = [
    "1. Complete the CJTS pre-filing assessment and keep the reference ID it gives you.",
    "2. Compare this guide with your original documents. Correct Casepath first if anything is wrong.",
    "3. Prepare each supporting document as a PDF with a simple filename.",
    "4. Use the current CJTS form. Its wording or order may have changed since this guide was produced.",
    "5. Do not treat a filled field as legal advice or proof that CJTS will accept the claim.",
  ];
  steps.forEach((step, index) => {
    page.rect(52, 300 + index * 65, 30, 30, COLOURS.blue);
    page.text(String(index + 1), 63, 321 + index * 65, { size: 11, bold: true, colour: COLOURS.white });
    page.paragraph(step.replace(/^\d+\.\s*/, ""), 98, 311 + index * 65, 435, { size: 10, leading: 14, maxLines: 3 });
  });
  page.rect(42, 650, 511, 78, COLOURS.paleBlue, COLOURS.blue);
  page.text("What the colours mean", 58, 675, { size: 11, bold: true, colour: COLOURS.navy });
  page.text("BLUE VALUE", 58, 700, { size: 8, bold: true, colour: COLOURS.blue });
  page.text("Copied from reviewed Casepath details", 125, 700, { size: 8.5 });
  page.text("AMBER PROMPT", 310, 700, { size: 8, bold: true, colour: COLOURS.amber });
  page.text("You must enter or obtain this", 395, 700, { size: 8.5 });
}

function renderClaimant(page: GuidePage, guide: CjtsEntryGuide): void {
  page.title("A. Particulars of Claimant(s)", "Copy your own details into the claimant section on CJTS.");
  page.section("Pre-Filing Reference ID", 158);
  page.field("Pre-Filing Reference ID", guide.preFilingReference, 52, 194, 491, 58);
  page.section("Claimant identity and contact", 273);
  page.field("Name *", guide.claimant.name, 52, 309, 310);
  page.field("ID type", guide.claimant.idType, 372, 309, 76);
  page.field("ID *", guide.claimant.idNumber, 458, 309, 85);
  page.field("Contact No 1 *", guide.claimant.phone, 52, 373, 235);
  page.field("Email *", guide.claimant.email, 297, 373, 246);
  page.section("Your Registered Address", 448);
  page.field("Premises Type *", guide.claimant.address.premisesType, 52, 484, 235);
  page.field("Postal Code *", guide.claimant.address.postalCode, 297, 484, 246);
  page.field("Block / House No. *", guide.claimant.address.block, 52, 548, 160);
  page.field("Street Name *", guide.claimant.address.street, 222, 548, 321);
  page.field("Floor", guide.claimant.address.floor, 52, 612, 100);
  page.field("Unit", guide.claimant.address.unit, 162, 612, 100);
  page.field("Building Name", guide.claimant.address.buildingName, 272, 612, 271);
  page.field("Country *", guide.claimant.address.country, 52, 676, 235);
  page.field("Videoconference consent", guide.videoConferenceConsent, 297, 676, 246);
}

function renderRespondent(page: GuidePage, guide: CjtsEntryGuide): void {
  page.title("B. Particulars of Respondent(s)", "Use the registered or service address you have checked.");
  page.section("Respondent identity and contact", 158);
  page.field("Name *", guide.respondent.name, 52, 194, 310);
  page.field("ID type", guide.respondent.idType, 372, 194, 76);
  page.field("ID", guide.respondent.idNumber, 458, 194, 85);
  page.field("Contact No 1", guide.respondent.phone, 52, 258, 235);
  page.field("Email", guide.respondent.email, 297, 258, 246);
  page.section("Respondent (Registered) Address", 333);
  page.field("Premises Type *", guide.respondent.address.premisesType, 52, 369, 235);
  page.field("Postal Code *", guide.respondent.address.postalCode, 297, 369, 246);
  page.field("Block / House No. *", guide.respondent.address.block, 52, 433, 160);
  page.field("Street Name *", guide.respondent.address.street, 222, 433, 321);
  page.field("Floor", guide.respondent.address.floor, 52, 497, 100);
  page.field("Unit", guide.respondent.address.unit, 162, 497, 100);
  page.field("Building Name", guide.respondent.address.buildingName, 272, 497, 271);
  page.field("Country *", guide.respondent.address.country, 52, 561, 235);
  page.rect(42, 642, 511, 91, COLOURS.paleAmber, COLOURS.amber);
  page.text("BUSINESS RESPONDENT CHECK", 58, 669, { size: 9, bold: true, colour: COLOURS.amber });
  page.paragraph(
    "If the respondent is a company or other non-individual, CJTS asks for its latest ACRA Business Profile. Check the current filing instructions before purchase and upload.",
    58, 690, 466, { size: 9, leading: 13, maxLines: 3 },
  );
}

function renderClaim(page: GuidePage, guide: CjtsEntryGuide): void {
  page.title("C. Particulars of Claim", "Copy only values you have checked against the original material.");
  page.field("Nature of Dispute", guide.claim.nature, 52, 158, 245);
  page.field("Type of Dispute", guide.claim.disputeType, 307, 158, 236);
  page.field("Type of Goods Sold or Services Provided *", guide.claim.goodsOrServices, 52, 222, 330, 68);
  page.field("Invoice / Agreement No.", guide.claim.invoiceNumber, 392, 222, 151, 68);
  page.section("Contract amounts", 310);
  page.field("Contract Sum", guide.claim.contractSum, 52, 346, 160);
  page.field("Paid", guide.claim.paid, 222, 346, 160);
  page.field("Balance Sum", guide.claim.balance, 392, 346, 151);
  page.section("Contract dates", 421);
  page.field("Contract Date", guide.claim.contractDate, 52, 457, 160);
  page.field("Date Contract Performed", guide.claim.datePerformed, 222, 457, 160);
  page.field("Date Contract Defaulted", guide.claim.dateDefaulted, 392, 457, 151);
  page.section("Claim amount", 532);
  page.field("Claiming for - Money Order value", guide.claim.claimAmount, 52, 568, 491, 67);
  page.rect(42, 660, 511, 74, COLOURS.paleBlue, COLOURS.blue);
  page.text("CHECK THE LIVE FORM", 58, 687, { size: 9, bold: true, colour: COLOURS.blue });
  page.paragraph(
    "CJTS may retrieve or calculate some fields from the pre-filing assessment. If the live form differs, follow the current CJTS wording and verify the amount before submission.",
    58, 707, 466, { size: 9, leading: 12, maxLines: 2 },
  );
}

function renderDocumentsAndOrders(page: GuidePage, guide: CjtsEntryGuide): void {
  page.title("D. Brief Summary of Claim", "CJTS currently limits this summary to 500 characters.");
  page.field("Brief Summary of Claim *", guide.claim.summary, 52, 158, 491, 91);
  page.text(`${guide.claim.summary.value?.length ?? 0} / 500 characters`, 433, 263, { size: 8, colour: COLOURS.muted });
  page.section("E. Supporting Documents *", 282);
  page.text("File", 52, 320, { size: 8, bold: true, colour: COLOURS.muted });
  page.text("Description / pages", 248, 320, { size: 8, bold: true, colour: COLOURS.muted });
  page.text("CJTS readiness", 455, 320, { size: 8, bold: true, colour: COLOURS.muted });
  const rowHeight = 20;
  guide.documents.slice(0, 20).forEach((document, index) => {
    const top = 329 + index * rowHeight;
    page.line(52, top + rowHeight, 543, top + rowHeight);
    page.text(document.fileName.slice(0, 34), 52, top + 13, { size: 7.5 });
    const pages = document.pages.length ? `p. ${document.pages.join(", ")}` : "page not linked";
    page.text(`${document.description.slice(0, 29)} - ${pages}`, 248, top + 13, { size: 7.5 });
    page.text(document.readyForUpload ? "PDF READY" : "CONVERT / REVIEW", 455, top + 13, {
      size: 7.2,
      bold: true,
      colour: document.readyForUpload ? COLOURS.green : COLOURS.amber,
    });
  });
  const afterDocuments = 342 + Math.min(20, guide.documents.length) * rowHeight;
  page.section("F. Claiming for *", Math.max(afterDocuments + 10, 455));
  const orderTop = Math.max(afterDocuments + 48, 493);
  page.checkbox("Money Order", guide.claim.orders.moneyOrder, 58, orderTop);
  page.checkbox("Work Order", guide.claim.orders.workOrder, 300, orderTop);
  page.checkbox("Vacant Possession Orders", guide.claim.orders.vacantPossession, 58, orderTop + 28);
  page.checkbox("Costs", guide.claim.orders.costs, 300, orderTop + 28);
  page.checkbox("Disbursements", guide.claim.orders.disbursements, 58, orderTop + 56);
}

function renderFinalChecklist(page: GuidePage, guide: CjtsEntryGuide): void {
  page.title("Final CJTS checklist", "Finish these steps on the current CJTS website yourself.");
  const items = guide.finalChecklist.slice(0, 8);
  items.forEach((item, index) => {
    const top = 165 + index * 68;
    page.rect(52, top, 24, 24, COLOURS.white, COLOURS.blue);
    page.text(String(index + 1), 60, top + 17, { size: 9, bold: true, colour: COLOURS.blue });
    page.paragraph(item, 92, top + 12, 441, { size: 9.8, leading: 14, maxLines: 3 });
  });
  const warningTop = 165 + items.length * 68 + 8;
  if (guide.warnings.length && warningTop < 735) {
    page.rect(42, warningTop, 511, Math.min(120, 34 + guide.warnings.length * 17), COLOURS.paleAmber, COLOURS.amber);
    page.text("CHECK BEFORE FILING", 58, warningTop + 22, { size: 9, bold: true, colour: COLOURS.amber });
    guide.warnings.slice(0, 4).forEach((warning, index) => {
      page.paragraph(`- ${warning}`, 58, warningTop + 42 + index * 17, 466, { size: 8.2, leading: 10, maxLines: 1 });
    });
  }
}

function serialise(title: string, pages: GuidePage[]): Uint8Array {
  const objects: string[] = [];
  const add = (value: string) => {
    objects.push(value);
    return objects.length;
  };
  const firstPageObject = 5;
  const pageIds = pages.map((_, index) => firstPageObject + index * 2);
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  pages.forEach((page, index) => {
    const stream = page.commands.join("\n");
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`,
    );
    add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  });

  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const chunks: Buffer[] = [Buffer.from(header, "latin1")];
  const offsets: number[] = [];
  let position = Buffer.byteLength(header, "latin1");
  objects.forEach((body, index) => {
    const value = `${index + 1} 0 obj\n${body}\nendobj\n`;
    offsets.push(position);
    const buffer = Buffer.from(value, "latin1");
    chunks.push(buffer);
    position += buffer.length;
  });
  const xrefStart = position;
  const xref = [
    "xref", `0 ${objects.length + 1}`, "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `), "",
  ].join("\n");
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${escapePdf(title)}) ` +
    `/Producer (Casepath) >> >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer, "latin1"));
  return new Uint8Array(Buffer.concat(chunks));
}

export function buildCjtsEntryGuidePdf(guide: CjtsEntryGuide): Uint8Array {
  const pages = Array.from({ length: 6 }, (_, index) => new GuidePage(index + 1, 6));
  renderIntroduction(pages[0], guide);
  renderClaimant(pages[1], guide);
  renderRespondent(pages[2], guide);
  renderClaim(pages[3], guide);
  renderDocumentsAndOrders(pages[4], guide);
  renderFinalChecklist(pages[5], guide);
  return serialise("Casepath filled CJTS entry guide", pages);
}
