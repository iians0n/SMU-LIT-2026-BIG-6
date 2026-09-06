import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { demoCase } from "@/fixtures/case.demo";
import type { CaseRecord } from "@/lib/contracts";
import { adaptCaseRecord } from "@/lib/dashboard/adapt-case";
import { assembleDraft } from "@/lib/drafting";
import type { Workflow } from "@/lib/workflow";
import {
  buildCjtsEntryGuide,
  parseContact,
  parseSingaporeAddress,
  summariseForCjts,
} from "./entry-guide";

function cloneRecord(): CaseRecord {
  return structuredClone(demoCase);
}

function workflowFor(record: CaseRecord): Workflow {
  const view = adaptCaseRecord(record);
  const draft = assembleDraft(view, view.contradictions);
  for (const field of draft.fields) {
    if (field.value) field.reviewedAt = "2026-09-05T12:00:00.000Z";
  }
  draft.gapsAcknowledged = true;
  return {
    caseId: view.id,
    route: {
      sourceCaseVersion: view.version,
      rulesVersion: "test",
      assessedAt: "2026-09-05T12:00:00.000Z",
      outcome: "appears_supported",
      reasons: [],
      reviewed: true,
    },
    tasks: [],
    draft,
    option: "file",
    verification: [],
  };
}

describe("CJTS entry guide mapping", () => {
  it("parses only unambiguous contact values", () => {
    assert.deepEqual(parseContact("+65 9123 4567, weiling.tan@example.com"), {
      phone: "91234567",
      email: "weiling.tan@example.com",
    });
    assert.deepEqual(parseContact("Call my office or home"), { phone: null, email: null });
    assert.deepEqual(parseContact("91234567 or 87654321"), { phone: null, email: null });
  });

  it("splits an explicit Singapore address and rejects ambiguous components", () => {
    assert.deepEqual(
      parseSingaporeAddress("Blk 210 Ang Mo Kio Ave 3, #08-142, Singapore 560210", true),
      {
        premisesType: "APARTMENT / FLAT / CONDO",
        postalCode: "560210",
        block: "210",
        street: "Ang Mo Kio Ave 3",
        floor: "08",
        unit: "142",
        buildingName: null,
        country: "SINGAPORE",
      },
    );
    assert.equal(parseSingaporeAddress("Somewhere near town", null).street, null);
    assert.equal(parseSingaporeAddress("18 Kaki Bukit Road 3, #05-12, Singapore 417818", true).block, "18");
  });

  it("shortens the summary to 500 characters without cutting a word", () => {
    const result = summariseForCjts("alpha beta ".repeat(80).trim());
    assert.ok(result.length <= 500);
    assert.ok(!result.endsWith(" "));
    assert.ok(result.endsWith("…"));
    assert.match(result, /(?:alpha|beta)…$/, "the ellipsis should follow a whole word");
  });

  it("maps reviewed case values, sources, documents, and CJTS-only blanks", () => {
    const record = cloneRecord();
    record.parties[0].contact = "+65 9123 4567, weiling.tan@example.com";
    const deadline = record.facts.find((fact) => fact.kind === "promised_performance");
    assert.ok(deadline);
    deadline.disputed = false;
    const view = adaptCaseRecord(record);
    const workflow = workflowFor(record);
    const summary = workflow.draft.fields.find((field) => field.section === "summary" && field.value);
    assert.ok(summary);
    summary.value = "I paid for bathroom renovation work that was not finished by the agreed date.";
    summary.reviewedAt = "2026-09-05T12:00:00.000Z";

    const guide = buildCjtsEntryGuide(record, view, workflow);

    assert.equal(guide.claimant.name.value, "Tan Wei Ling");
    assert.equal(guide.claimant.idNumber.value, "S8412345A");
    assert.equal(guide.claimant.phone.value, "91234567");
    assert.equal(guide.claimant.email.value, "weiling.tan@example.com");
    assert.equal(guide.claimant.address.postalCode.value, "560210");
    assert.equal(guide.respondent.idType.value, "UEN");
    assert.equal(guide.respondent.idNumber.value, "201412345K");
    assert.equal(guide.claim.nature.value, "CONTRACT FOR PROVISION OF SERVICES");
    assert.equal(guide.claim.claimAmount.value, "S$2,500.00");
    assert.equal(guide.claim.dateDefaulted.value, "15/07/2026");
    assert.equal(guide.claim.summary.value, summary.value);
    assert.equal(guide.claim.orders.moneyOrder, true);
    assert.equal(guide.claim.orders.workOrder, false);
    assert.equal(guide.preFilingReference.status, "cjts_only");
    assert.equal(guide.videoConferenceConsent.status, "missing");

    assert.deepEqual(
      guide.documents.map((document) => [document.fileName, document.readyForUpload]),
      [
        ["quote-accepted.pdf", true],
        ["receipt.jpg", false],
        ["whatsapp-thread.png", false],
        ["handwritten-note.jpg", false],
      ],
    );
    assert.deepEqual(guide.documents[0].pages, [1]);
    assert.ok(guide.warnings.some((warning) => warning.includes("ACRA")));
  });

  it("keeps document provenance on party details filled from an uploaded passage", () => {
    const record = cloneRecord();
    const excerptId = record.excerpts[0].id;
    record.parties[0].excerptIds = [excerptId];
    const view = adaptCaseRecord(record);

    const guide = buildCjtsEntryGuide(record, view, workflowFor(record));

    assert.deepEqual(guide.claimant.name.sourceRefs, [{ kind: "excerpt", id: excerptId }]);
    assert.deepEqual(guide.claimant.idNumber.sourceRefs, [{ kind: "excerpt", id: excerptId }]);
  });

  it("leaves ambiguous contact values blank while retaining a cited case summary", () => {
    const record = cloneRecord();
    record.parties[0].contact = "two numbers: 91234567 and 87654321";
    record.parties[1].inSingapore = null;
    const view = adaptCaseRecord(record);
    const workflow = workflowFor(record);
    for (const field of workflow.draft.fields) field.reviewedAt = null;

    const guide = buildCjtsEntryGuide(record, view, workflow);

    assert.equal(guide.claimant.phone.value, null);
    assert.equal(guide.respondent.address.country.value, null);
    assert.match(guide.claim.summary.value ?? "", /bathroom waterproofing/i);
    assert.equal(guide.claim.summary.status, "filled");
  });
});
