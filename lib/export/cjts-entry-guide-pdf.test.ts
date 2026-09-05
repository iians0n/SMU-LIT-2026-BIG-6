import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CjtsEntryGuide, GuideValue } from "@/lib/cjts/entry-guide";
import { buildCjtsEntryGuidePdf } from "./cjts-entry-guide-pdf";

const value = (text: string): GuideValue => ({ value: text, status: "filled", sourceRefs: [] });
const blank = (): GuideValue => ({ value: null, status: "missing", sourceRefs: [] });
const cjts = (): GuideValue => ({ value: null, status: "cjts_only", sourceRefs: [] });

const address = {
  premisesType: value("APARTMENT / FLAT / CONDO"),
  postalCode: value("560210"),
  block: value("210"),
  street: value("Ang Mo Kio Ave 3"),
  floor: value("08"),
  unit: value("142"),
  buildingName: blank(),
  country: value("SINGAPORE"),
};

const guide: CjtsEntryGuide = {
  caseVersion: 9,
  generatedAt: "2026-09-05T12:00:00.000Z",
  preFilingReference: cjts(),
  videoConferenceConsent: blank(),
  claimant: {
    name: value("Tan Wei Ling"),
    idType: value("NRIC"),
    idNumber: value("S8412345A"),
    phone: value("91234567"),
    email: value("weiling.tan@example.com"),
    address,
  },
  respondent: {
    name: value("Precision Home Repairs Pte Ltd"),
    idType: value("UEN"),
    idNumber: value("201412345K"),
    phone: blank(),
    email: blank(),
    address: { ...address, block: value("18"), street: value("Kaki Bukit Road 3"), postalCode: value("417818") },
  },
  claim: {
    nature: value("CONTRACT FOR PROVISION OF SERVICES"),
    disputeType: value("Service not completed as agreed"),
    goodsOrServices: value("Bathroom waterproofing and re-tiling"),
    invoiceNumber: value("Q-2026-0418"),
    contractSum: value("S$2,000.00"),
    paid: value("S$2,000.00"),
    balance: value("S$0.00"),
    contractDate: blank(),
    datePerformed: blank(),
    dateDefaulted: value("15/07/2026"),
    claimAmount: value("S$2,500.00"),
    summary: value("I paid for bathroom work that was not completed by the agreed date."),
    orders: { moneyOrder: true, workOrder: false, vacantPossession: false, costs: false, disbursements: false },
  },
  documents: [
    { fileName: "quote-accepted.pdf", description: "Accepted quote", pages: [1], readyForUpload: true, conversionNote: null },
    { fileName: "receipt.jpg", description: "Receipt", pages: [1], readyForUpload: false, conversionNote: "Convert this file to PDF before uploading it to CJTS." },
  ],
  warnings: ["Obtain the latest ACRA Business Profile before filing."],
  finalChecklist: ["Check every value.", "Enter the values on CJTS.", "Review before submitting."],
};

async function inspect(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const document = await task.promise;
  const pages: string[] = [];
  const sizes: Array<[number, number]> = [];
  for (let index = 1; index <= document.numPages; index++) {
    const page = await document.getPage(index);
    sizes.push([page.view[2], page.view[3]]);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  await task.destroy();
  return { pages, sizes };
}

describe("filled CJTS entry guide PDF", () => {
  it("renders six A4 pages with mapped fields and safe prompts", async () => {
    const bytes = buildCjtsEntryGuidePdf(guide);
    assert.equal(new TextDecoder("latin1").decode(bytes.slice(0, 8)).startsWith("%PDF-"), true);

    const { pages, sizes } = await inspect(bytes);
    assert.equal(pages.length, 6);
    for (const [width, height] of sizes) {
      assert.ok(Math.abs(width - 595.28) < 0.1);
      assert.ok(Math.abs(height - 841.89) < 0.1);
    }
    for (const page of pages) assert.match(page, /Preparation guide - not filed or submitted/);

    const text = pages.join("\n");
    for (const heading of [
      "How to use this guide",
      "A. Particulars of Claimant(s)",
      "B. Particulars of Respondent(s)",
      "C. Particulars of Claim",
      "D. Brief Summary of Claim",
      "Final CJTS checklist",
    ]) assert.match(text, new RegExp(heading.replace(/[()]/g, "\\$&")));
    assert.match(text, /Tan Wei Ling/);
    assert.match(text, /S8412345A/);
    assert.match(text, /S\$2,500\.00/);
    assert.match(text, /quote-accepted\.pdf/);
    assert.match(text, /Money Order/);
    assert.match(text, /SELECTED/);
    assert.match(text, /ENTER ON CJTS/);
    assert.match(text, /ISSUED BY CJTS/);
  });

  it("contains none of the captured browser identity or redacted template residue", async () => {
    const text = (await inspect(buildCjtsEntryGuidePdf(guide))).pages.join("\n");
    for (const forbidden of [
      "ONG JUN QUAN",
      "828769",
      "PUNGGOL WALK",
      "05/09/2026, 22:10",
      "cjts.judiciary.gov.sg/claims/formOne",
    ]) assert.ok(!text.includes(forbidden), `found captured source residue: ${forbidden}`);
  });
});
