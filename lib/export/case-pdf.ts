import type { CaseRecord, Fact, Party } from "@/lib/contracts";
import { FACT_ORIGIN_LABEL, formatMoney } from "@/lib/contracts";
import type { Case, SourceRef, VerificationEvent } from "@/lib/dashboard/contracts";
import { deriveForm } from "@/lib/cjts/form";
import { isRenderable, money, readyForTransfer } from "@/lib/drafting";
import type { Workflow } from "@/lib/workflow";
import { PdfDocument, COLOURS } from "./pdf";

export type CasePdfKind = "pack" | "verification" | "referral";

interface BuildCasePdfOptions {
  kind: CasePdfKind;
  record: CaseRecord;
  view: Case;
  workflow: Workflow;
  verification: VerificationEvent[];
  generatedAt?: Date;
}

const KIND_TITLE: Record<CasePdfKind, string> = {
  pack: "Casepath preparation pack",
  verification: "Casepath verification record",
  referral: "Casepath referral brief",
};

const DRAFT_SECTION: Record<string, string> = {
  summary: "Claim summary",
  chronology: "Chronology",
  evidence: "Evidence list",
  amount: "Amount calculation",
  worksheet: "CJTS worksheet",
};

function yesNo(value: boolean | null): string {
  return value === null ? "Not answered" : value ? "Yes" : "No";
}

function displayDate(value: string | null | undefined): string {
  if (!value) return "Not answered";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
    timeZone: "Asia/Singapore",
  }).format(parsed);
}

function sourceRefLabel(ref: SourceRef): string {
  return `${ref.kind} ${ref.id}`;
}

function addEmpty(pdf: PdfDocument, text = "None recorded."): void {
  pdf.text(text, { font: "italic", colour: COLOURS.MUTED, spaceAfter: 4 });
}

function addBullets(pdf: PdfDocument, values: string[], empty = "None recorded."): void {
  if (!values.length) {
    addEmpty(pdf, empty);
    return;
  }
  for (const value of values) pdf.bullet(value);
}

function partyTitle(party: Party, index: number): string {
  const role = party.role === "claimant" ? "Claimant" : "Respondent";
  return `${role} ${index + 1}${party.name ? ` - ${party.name}` : ""}`;
}

function addParties(pdf: PdfDocument, record: CaseRecord): void {
  pdf.section("People and organisations");
  if (!record.parties.length) {
    addEmpty(pdf, "No party details have been entered.");
    return;
  }

  record.parties.forEach((party, index) => {
    pdf.text(partyTitle(party, index), { font: "bold", size: 12, spaceBefore: 6, spaceAfter: 4 });
    pdf.field({ label: "Role", value: party.role });
    pdf.field({ label: "Person or business", value: party.kind === "unknown" ? null : party.kind });
    pdf.field({ label: "Name", value: party.name });
    pdf.field({ label: "ID / UEN", value: party.idNumber });
    pdf.field({ label: "Contact", value: party.contact });
    pdf.field({ label: "Address", value: party.address });
    pdf.field({ label: "In Singapore", value: yesNo(party.inSingapore) });
    pdf.field({ label: "Notes", value: party.notes });
  });
}

function factDetails(fact: Fact): string {
  const details = [
    `Source: ${FACT_ORIGIN_LABEL[fact.origin]}`,
    `User confirmed: ${fact.confirmedByUser ? "yes" : "no"}`,
    `Disputed: ${fact.disputed ? "yes" : "no"}`,
    `Marked unknown: ${fact.unknown ? "yes" : "no"}`,
  ];
  if (fact.amount) details.push(`Amount: ${formatMoney(fact.amount)}`);
  if (fact.date) {
    details.push(
      `Date: ${fact.date.value} (${fact.date.precision}${fact.date.note ? `; ${fact.date.note}` : ""})`,
    );
  }
  details.push(`Supporting excerpts: ${fact.excerptIds.join(", ") || "none"}`);
  return details.join(" | ");
}

function addFacts(pdf: PdfDocument, record: CaseRecord): void {
  pdf.section("Your account - all recorded facts");
  if (!record.facts.length) {
    addEmpty(pdf, "No facts have been entered yet.");
    return;
  }
  record.facts.forEach((fact, index) => {
    pdf.field({
      label: `${index + 1}. ${fact.kind.replaceAll("_", " ")}`,
      value: fact.statement,
      note: factDetails(fact),
      tone: fact.disputed || fact.unknown ? "pending" : "filled",
    });
  });
}

function addQuestions(pdf: PdfDocument, record: CaseRecord): void {
  pdf.section("Questions and unanswered information");
  if (!record.openQuestions.length) {
    addEmpty(pdf, "No questions have been recorded.");
    return;
  }
  record.openQuestions.forEach((question, index) => {
    pdf.field({
      label: `${index + 1}. ${question.topic.replaceAll("_", " ")} - ${question.status.replaceAll("_", " ")}`,
      value: question.question,
      note: `Why it matters: ${question.whyItMatters} | Answered fact: ${question.answeredFactId ?? "none"}`,
      tone: question.status === "answered" ? "filled" : "pending",
    });
  });
}

function addFormWorksheet(pdf: PdfDocument, record: CaseRecord): void {
  const form = deriveForm(record);
  pdf.section("CJTS claim-form worksheet");
  pdf.text(
    `${form.filled} of ${form.total} required fields that can be completed here are filled. ` +
      "This is a preparation worksheet, not a filed court form.",
    { colour: COLOURS.MUTED, spaceAfter: 6 },
  );
  for (const group of form.groups) {
    pdf.text(group.name, { font: "bold", size: 12, spaceBefore: 7, spaceAfter: 4 });
    for (const field of group.fields) {
      const placeholder = field.status === "from_cjts" ? "To be obtained from CJTS" : field.help;
      const status = field.status.replaceAll("_", " ");
      pdf.field({
        label: `${field.label}${field.required ? " (required)" : ""}`,
        value: field.value,
        placeholder,
        note: `Status: ${status}${field.source ? ` | Source: ${field.source}` : ""}`,
        tone: field.status === "filled" ? "filled" : "pending",
      });
    }
  }
}

function addDocuments(pdf: PdfDocument, record: CaseRecord): void {
  pdf.section("Files and extracted information");
  if (!record.documents.length) {
    addEmpty(pdf, "No files have been added.");
    return;
  }

  for (const [index, document] of record.documents.entries()) {
    pdf.text(`${index + 1}. ${document.fileName}`, {
      font: "bold",
      size: 12,
      spaceBefore: 7,
      spaceAfter: 4,
    });
    const labels = [document.userLabel, document.proposedLabel].filter(Boolean).join(" / ") || "none";
    pdf.text(
      [
        `Status: ${document.processingStatus}`,
        `Type: .${document.extension || "unknown"}`,
        `Size: ${document.byteSize.toLocaleString("en-SG")} bytes`,
        `Pages: ${document.pageCount ?? "unknown"}`,
        `Label: ${labels}`,
        `Added: ${displayDate(document.uploadedAt)}`,
        `Issues: ${document.issues.join(", ") || "none"}`,
      ].join(" | "),
      { size: 9, colour: COLOURS.MUTED, spaceAfter: 4 },
    );
    if (document.failureReason) {
      pdf.text(`Processing note: ${document.failureReason}`, { colour: COLOURS.WARN, spaceAfter: 4 });
    }

    const excerpts = record.excerpts.filter((excerpt) => excerpt.documentId === document.id);
    if (!excerpts.length) {
      addEmpty(pdf, "No text was extracted from this file.");
      continue;
    }
    for (const excerpt of excerpts) {
      pdf.text(
        `Page ${excerpt.anchor.page} | extraction confidence ${Math.round(excerpt.extractionConfidence * 100)}% | ${excerpt.id}`,
        { font: "bold", size: 9, colour: COLOURS.MUTED, spaceBefore: 3 },
      );
      // Use ordinary paragraphs here: uploaded text can be longer than one page,
      // and it must paginate instead of being clipped inside a fixed field row.
      pdf.text(excerpt.text, { size: 10, indent: 10, leading: 1.42, spaceAfter: 5 });
    }
  }
}

function addIssueReview(pdf: PdfDocument, record: CaseRecord): void {
  pdf.section("Evidence review");
  if (!record.issues.length) {
    addEmpty(pdf, "No evidence review has been created.");
    return;
  }
  record.issues.forEach((issue, index) => {
    const contrary = issue.contraryExplanations.length
      ? issue.contraryExplanations.join(" / ")
      : "No contrary explanation was identified in the reviewed material.";
    pdf.field({
      label: `${index + 1}. ${issue.label} - ${issue.supportStatus.replaceAll("_", " ")}`,
      value: issue.reason,
      note:
        `Supporting excerpts: ${issue.supportingExcerptIds.join(", ") || "none"} | ` +
        `Conflicting excerpts: ${issue.conflictingExcerptIds.join(", ") || "none"} | ` +
        `Next question: ${issue.nextQuestion ?? "none"} | Other possible account: ${contrary}`,
      tone: issue.supportStatus === "supported" ? "filled" : "pending",
    });
  });
}

function addContradictions(pdf: PdfDocument, record: CaseRecord): void {
  pdf.section("Conflicts and alternative accounts");
  if (!record.contradictions.length) {
    addEmpty(pdf, "No contradictions were identified in the reviewed material.");
    return;
  }
  record.contradictions.forEach((contradiction, index) => {
    pdf.field({
      label: `${index + 1}. ${contradiction.kind.replaceAll("_", " ")}`,
      value: contradiction.description,
      note:
        `Sources: ${[...contradiction.factIds, ...contradiction.excerptIds].join(", ") || "none"} | ` +
        `Possible readings: ${contradiction.alternatives.map((item) => `${item.reading} To distinguish: ${item.distinguishingFact}`).join(" / ") || "none recorded"}`,
      tone: "pending",
    });
  });
}

function addDraft(pdf: PdfDocument, view: Case, workflow: Workflow): void {
  pdf.section("Reviewed preparation draft");
  const stale = workflow.draft.sourceCaseVersion !== view.version;
  pdf.text(
    stale
      ? `Needs review: this draft is from case version ${workflow.draft.sourceCaseVersion}, while the case is version ${view.version}.`
      : "Draft fields are shown with their review and source status.",
    { colour: stale ? COLOURS.WARN : COLOURS.MUTED, spaceAfter: 4 },
  );
  for (const section of ["summary", "chronology", "evidence", "amount", "worksheet"]) {
    const fields = workflow.draft.fields.filter((field) => field.section === section);
    if (!fields.length) continue;
    pdf.text(DRAFT_SECTION[section], { font: "bold", size: 12, spaceBefore: 7, spaceAfter: 4 });
    for (const field of fields) {
      const renderable = isRenderable(field, view);
      const refs = [field.sourceRef, ...field.additionalSourceRefs].filter(
        (ref): ref is SourceRef => ref !== null,
      );
      pdf.field({
        label: `${field.label}${field.required ? " (required)" : ""}`,
        value: renderable && field.value ? field.value : null,
        placeholder: field.value ? "Withheld because a source is missing" : "Not answered yet",
        note:
          `Reviewed: ${field.reviewedAt ? displayDate(field.reviewedAt) : "no"} | ` +
          `Sources: ${refs.map(sourceRefLabel).join(", ") || "none"}`,
        tone: renderable && field.value && field.reviewedAt ? "filled" : "pending",
      });
    }
  }
}

function addPreparationNotes(pdf: PdfDocument, workflow: Workflow): void {
  pdf.section("Preparation notes");
  pdf.text("Missing information", { font: "bold", size: 11, spaceAfter: 3 });
  addBullets(pdf, workflow.draft.gaps, "No required draft fields are blank.");
  pdf.text("Warnings and unresolved issues", { font: "bold", size: 11, spaceBefore: 6, spaceAfter: 3 });
  addBullets(pdf, workflow.draft.warnings, "No additional warnings are recorded.");
  pdf.field({
    label: "Remaining gaps acknowledged",
    value: workflow.draft.gapsAcknowledged ? "Yes" : "No",
    tone: workflow.draft.gapsAcknowledged ? "filled" : "pending",
  });
}

function addRouteAndTasks(pdf: PdfDocument, workflow: Workflow): void {
  pdf.section("Route screening and next steps");
  pdf.field({
    label: "Screening outcome",
    value: workflow.route.outcome.replaceAll("_", " "),
    note:
      `Rules: ${workflow.route.rulesVersion} | Reviewed: ${workflow.route.reviewed ? "yes" : "no"} | ` +
      `Case version: ${workflow.route.sourceCaseVersion}`,
    tone: workflow.route.outcome === "appears_supported" ? "filled" : "pending",
  });
  for (const reason of workflow.route.reasons) {
    pdf.field({
      label: `${reason.label} - ${reason.result}`,
      value: reason.assertionId ? `Grounded instruction: ${reason.assertionId}` : "Screening input",
      tone: reason.result === "pass" ? "filled" : "pending",
    });
  }
  pdf.field({ label: "Selected next step", value: workflow.option, placeholder: "No option selected yet" });

  pdf.text("Task checklist", { font: "bold", size: 12, spaceBefore: 7, spaceAfter: 4 });
  if (!workflow.tasks.length) addEmpty(pdf, "No tasks have been created.");
  for (const task of workflow.tasks) {
    pdf.field({
      label: `${task.title} - ${task.status}`,
      value: task.purpose,
      note:
        `Required material: ${task.requiredMaterial.join(", ") || "none"} | ` +
        `Depends on: ${task.dependencies.join(", ") || "nothing"}`,
      tone: task.status === "Reviewed" ? "filled" : "pending",
    });
  }
}

function addVerification(pdf: PdfDocument, verification: VerificationEvent[]): void {
  pdf.section("Verification record");
  if (!verification.length) {
    addEmpty(pdf, "No verification events have been recorded.");
    return;
  }
  verification.forEach((event, index) => {
    pdf.field({
      label: `${index + 1}. ${event.action.replaceAll("_", " ")} - ${displayDate(event.timestamp)}`,
      value: event.description,
      note:
        `AI drafted: ${event.aiDrafted ? "yes" : "no"} | Case version: ${event.sourceCaseVersion} | ` +
        `Field: ${event.fieldId ?? "not applicable"} | Sources: ${event.sourceRefs.map(sourceRefLabel).join(", ") || "none"}`,
      tone: event.aiDrafted ? "pending" : "filled",
    });
  });
}

function addSourceLibrary(pdf: PdfDocument, record: CaseRecord): void {
  pdf.section("Official source library");
  if (!record.sources.length) {
    addEmpty(pdf, "No official sources are attached to this case.");
    return;
  }
  for (const source of record.sources) {
    pdf.field({
      label: source.title,
      value: source.url,
      note:
        `Source key: ${source.sourceKey} | Retrieved: ${displayDate(source.retrievedAt)} | ` +
        `Last reviewed: ${displayDate(source.lastReviewedAt)} | Version: ${source.version ?? "not stated"}`,
    });
  }
}

function addAtAGlance(
  pdf: PdfDocument,
  record: CaseRecord,
  view: Case,
  workflow: Workflow,
): void {
  pdf.section("Case at a glance");
  pdf.field({ label: "Case title", value: view.title });
  pdf.field({ label: "Claim category", value: record.case.claimCategory.replaceAll("_", " ") });
  pdf.field({ label: "What you want", value: record.case.requestedOutcome });
  pdf.field({ label: "Recorded claim amount", value: view.amountCents === null ? null : money(view.amountCents) });
  pdf.field({ label: "Relevant event date", value: view.causeOfActionDate });
  pdf.field({ label: "Current stage", value: record.case.stage.replaceAll("_", " ") });
  pdf.field({ label: "Selected next step", value: workflow.option, placeholder: "No option selected yet" });
  pdf.field({ label: "Case created", value: displayDate(record.case.createdAt) });
  pdf.field({ label: "Last updated", value: displayDate(record.case.updatedAt) });
}

function addReferralSections(
  pdf: PdfDocument,
  record: CaseRecord,
  view: Case,
  workflow: Workflow,
): void {
  addAtAGlance(pdf, record, view, workflow);
  addParties(pdf, record);
  addFacts(pdf, record);
  addDocuments(pdf, record);
  addQuestions(pdf, record);
  addContradictions(pdf, record);
  addPreparationNotes(pdf, workflow);
}

export function buildCasePdf(options: BuildCasePdfOptions): Uint8Array {
  const { kind, record, view, workflow, verification } = options;
  const generatedAt = options.generatedAt ?? new Date();
  const draftStatus =
    workflow.draft.sourceCaseVersion !== view.version
      ? "Needs review - the case changed"
      : readyForTransfer(workflow.draft, view)
        ? "Reviewed for transfer - no guarantee of court acceptance"
        : "Working draft - review required";
  const title = KIND_TITLE[kind];
  const pdf = new PdfDocument({
    title,
    footerNote: "Casepath working document - not filed with CJTS",
  });

  pdf.cover({
    title,
    subtitle:
      kind === "pack"
        ? "A structured record of the information entered, uploaded, reviewed and still unresolved."
        : kind === "verification"
          ? "An audit trail of AI-assisted and user-reviewed work on this case."
          : "A structured brief for a lawyer, adviser or support service.",
    meta: [
      `Case: ${view.title}`,
      `Case version: ${view.version}`,
      `Generated: ${displayDate(generatedAt.toISOString())}`,
      `Status: ${draftStatus}`,
    ],
    warning:
      "This is a preparation document, not legal advice, a court form, or proof of filing. Check every item against the original material and CJTS before use.",
  });

  if (kind === "verification") {
    addVerification(pdf, verification);
    addSourceLibrary(pdf, record);
    return pdf.build();
  }

  if (kind === "referral") {
    addReferralSections(pdf, record, view, workflow);
    addVerification(pdf, verification);
    return pdf.build();
  }

  addAtAGlance(pdf, record, view, workflow);
  addParties(pdf, record);
  addFacts(pdf, record);
  addFormWorksheet(pdf, record);
  addQuestions(pdf, record);
  addDocuments(pdf, record);
  addIssueReview(pdf, record);
  addContradictions(pdf, record);
  addDraft(pdf, view, workflow);
  addPreparationNotes(pdf, workflow);
  addRouteAndTasks(pdf, workflow);
  addVerification(pdf, verification);
  addSourceLibrary(pdf, record);
  return pdf.build();
}
