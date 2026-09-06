import type { CaseRecord, Fact, Party } from "@/lib/contracts";
import { formatMoney } from "@/lib/contracts";
import type { Case, SourceRef } from "@/lib/dashboard/contracts";
import { deriveForm } from "@/lib/cjts/form";
import type { Workflow } from "@/lib/workflow";

export type GuideValueStatus = "filled" | "missing" | "cjts_only";

export interface GuideValue {
  value: string | null;
  status: GuideValueStatus;
  sourceRefs: SourceRef[];
}

export interface ParsedContact {
  phone: string | null;
  email: string | null;
}

export interface ParsedAddress {
  premisesType: string | null;
  postalCode: string | null;
  block: string | null;
  street: string | null;
  floor: string | null;
  unit: string | null;
  buildingName: string | null;
  country: string | null;
}

export interface GuideParty {
  name: GuideValue;
  idType: GuideValue;
  idNumber: GuideValue;
  phone: GuideValue;
  email: GuideValue;
  address: Record<keyof ParsedAddress, GuideValue>;
}

export interface GuideDocument {
  fileName: string;
  description: string;
  pages: number[];
  readyForUpload: boolean;
  conversionNote: string | null;
}

export interface CjtsEntryGuide {
  caseVersion: number;
  generatedAt: string;
  preFilingReference: GuideValue;
  videoConferenceConsent: GuideValue;
  claimant: GuideParty;
  respondent: GuideParty;
  claim: {
    nature: GuideValue;
    disputeType: GuideValue;
    goodsOrServices: GuideValue;
    invoiceNumber: GuideValue;
    contractSum: GuideValue;
    paid: GuideValue;
    balance: GuideValue;
    contractDate: GuideValue;
    datePerformed: GuideValue;
    dateDefaulted: GuideValue;
    claimAmount: GuideValue;
    summary: GuideValue;
    orders: {
      moneyOrder: boolean;
      workOrder: boolean;
      vacantPossession: boolean;
      costs: boolean;
      disbursements: boolean;
    };
  };
  documents: GuideDocument[];
  warnings: string[];
  finalChecklist: string[];
}

const missing = (): GuideValue => ({ value: null, status: "missing", sourceRefs: [] });
const cjtsOnly = (): GuideValue => ({ value: null, status: "cjts_only", sourceRefs: [] });
const filled = (value: string | null | undefined, sourceRefs: SourceRef[] = []): GuideValue =>
  value?.trim() ? { value: value.trim(), status: "filled", sourceRefs } : missing();

function factRef(fact: Fact | undefined): SourceRef[] {
  return fact ? [{ kind: "fact", id: fact.id }] : [];
}

function settledFact(record: CaseRecord, kind: Fact["kind"]): Fact | undefined {
  const candidates = record.facts.filter(
    (fact) => fact.kind === kind && !fact.unknown && !fact.disputed &&
      (fact.origin === "user_stated" || fact.confirmedByUser ||
        (fact.origin === "document_extracted" && fact.excerptIds.length > 0)),
  );
  return candidates.find((fact) => fact.origin === "document_extracted" && fact.excerptIds.length > 0)
    ?? candidates[0];
}

export function parseContact(value: string | null): ParsedContact {
  if (!value) return { phone: null, email: null };
  const emails = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const candidates = value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .match(/(?:\+?65[\s-]*)?[689]\d(?:[\s-]*\d){6}/g) ?? [];
  const phones = [...new Set(candidates.map((phone) => phone.replace(/\D/g, "").replace(/^65(?=\d{8}$)/, "")))]
    .filter((phone) => /^[689]\d{7}$/.test(phone));
  return {
    phone: phones.length === 1 ? phones[0] : null,
    email: emails.length === 1 ? emails[0] : null,
  };
}

export function parseSingaporeAddress(value: string | null, inSingapore: boolean | null): ParsedAddress {
  const blank: ParsedAddress = {
    premisesType: null,
    postalCode: null,
    block: null,
    street: null,
    floor: null,
    unit: null,
    buildingName: null,
    country: inSingapore === true ? "SINGAPORE" : null,
  };
  if (!value) return blank;

  const postal = value.match(/(?:Singapore\s*)?(\d{6})\b/i)?.[1] ?? null;
  const floorUnit = value.match(/#\s*([A-Z0-9]{1,3})\s*[-/]\s*([A-Z0-9]{1,5})\b/i);
  const firstSegment = value.split(",")[0]?.trim() ?? "";
  const streetMatch = firstSegment.match(/^(?:Blk|Block)\s+([A-Z0-9-]+)\s+(.+)$/i)
    ?? firstSegment.match(/^(\d+[A-Z]?)\s+(.+)$/i);

  return {
    premisesType: floorUnit ? "APARTMENT / FLAT / CONDO" : streetMatch ? "OTHER" : null,
    postalCode: postal,
    block: streetMatch?.[1] ?? null,
    street: streetMatch?.[2]?.trim() ?? null,
    floor: floorUnit?.[1] ?? null,
    unit: floorUnit?.[2] ?? null,
    buildingName: null,
    country: inSingapore === true ? "SINGAPORE" : null,
  };
}

export function summariseForCjts(value: string, max = 500): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const available = clean.slice(0, Math.max(0, max - 1));
  const boundary = available.lastIndexOf(" ");
  return `${available.slice(0, boundary > 0 ? boundary : available.length).trim()}…`;
}

function partyRefs(party: Party | undefined): SourceRef[] {
  return (party?.excerptIds ?? []).map((id) => ({ kind: "excerpt" as const, id }));
}

function guideAddress(party: Party | undefined): Record<keyof ParsedAddress, GuideValue> {
  const parsed = parseSingaporeAddress(party?.address ?? null, party?.inSingapore ?? null);
  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, filled(value, partyRefs(party))]),
  ) as Record<keyof ParsedAddress, GuideValue>;
}

function idType(party: Party | undefined): string | null {
  if (!party) return null;
  if (party.kind === "business") return "UEN";
  if (party.kind !== "individual" || !party.idNumber) return null;
  return /^[ST]\d{7}[A-Z]$/i.test(party.idNumber) ? "NRIC" : null;
}

function guideParty(party: Party | undefined): GuideParty {
  const contact = parseContact(party?.contact ?? null);
  const refs = partyRefs(party);
  return {
    name: filled(party?.name, refs),
    idType: filled(idType(party), refs),
    idNumber: filled(party?.idNumber, refs),
    phone: filled(contact.phone, refs),
    email: filled(contact.email, refs),
    address: guideAddress(party),
  };
}

function formatDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function amountOf(fact: Fact | undefined): number | null {
  return fact?.amount?.currencyCode === "SGD" ? fact.amount.minorUnits : null;
}

function money(cents: number | null): string | null {
  return cents === null
    ? null
    : formatMoney({ currencyCode: "SGD", minorUnits: cents });
}

function agreementNumber(record: CaseRecord): string | null {
  const match = record.documents
    .filter((document) => document.processingStatus === "extracted")
    .flatMap((document) => record.excerpts.filter((excerpt) => excerpt.documentId === document.id))
    .map((excerpt) => excerpt.text.match(/\b(?:agreement|quote|invoice)\s+(?:ref(?:erence)?\s*)?([A-Z0-9-]{4,})\b/i)?.[1])
    .find(Boolean);
  return match ?? null;
}

export function buildCjtsEntryGuide(
  record: CaseRecord,
  view: Case,
  workflow: Workflow,
): CjtsEntryGuide {
  const claimant = record.parties.find((party) => party.role === "claimant");
  const respondent = record.parties.find((party) => party.role === "respondent");
  const agreement = settledFact(record, "agreement");
  const allPaymentFacts = record.facts.filter(
    (fact) => fact.kind === "payment" && !fact.unknown && !fact.disputed && fact.amount?.currencyCode === "SGD" &&
      !/\b(refund|refunded|repaid)\b/i.test(fact.statement),
  );
  const citedPaymentFacts = allPaymentFacts.filter(
    (fact) => fact.origin === "document_extracted" && fact.excerptIds.length > 0,
  );
  const paymentFacts = citedPaymentFacts.length > 0 ? citedPaymentFacts : allPaymentFacts;
  const promised = settledFact(record, "promised_performance");
  const desired = settledFact(record, "desired_outcome");
  const contractSum = amountOf(agreement);
  const paid = paymentFacts.length ? paymentFacts.reduce((sum, fact) => sum + (fact.amount?.minorUnits ?? 0), 0) : null;
  const balance = contractSum !== null && paid !== null && contractSum >= paid ? contractSum - paid : null;
  const form = deriveForm(record);
  const formField = (key: string) => form.groups.flatMap((group) => group.fields).find((field) => field.key === key);
  const summaryField = workflow.draft.fields.find(
    (field) => field.section === "summary" && !field.id.startsWith("uncertainty-") && field.value &&
      field.reviewedAt && field.sourceCaseVersion === view.version,
  );

  const documents: GuideDocument[] = record.documents
    .filter((document) => document.processingStatus === "extracted" && !document.issues.includes("duplicate"))
    .map((document) => {
      const excerpts = record.excerpts.filter((excerpt) => excerpt.documentId === document.id);
      const pages = [...new Set(excerpts.map((excerpt) => excerpt.anchor.page))].sort((a, b) => a - b);
      const clean = document.issues.length === 0;
      const readyForUpload = document.extension === "pdf" && clean;
      return {
        fileName: document.fileName,
        description: document.userLabel ?? document.proposedLabel ?? "Supporting document",
        pages,
        readyForUpload,
        conversionNote: readyForUpload
          ? null
          : document.extension !== "pdf"
            ? "Convert this file to PDF before uploading it to CJTS."
            : "Review the document issue before using this file.",
      };
    });

  const nature = record.case.claimCategory === "services"
    ? "CONTRACT FOR PROVISION OF SERVICES"
    : record.case.claimCategory === "goods"
      ? "CONTRACT FOR SALE OF GOODS"
      : record.case.claimCategory === "goods_and_services"
        ? "CONTRACT FOR GOODS AND SERVICES"
        : null;
  const claimAmount = amountOf(desired) ?? view.amountCents;
  const warnings = [...workflow.draft.warnings];
  if (record.parties.some((party) => party.kind === "business")) {
    warnings.push("Obtain the latest ACRA Business Profile within the period required by CJTS before filing.");
  }
  for (const document of documents.filter((item) => !item.readyForUpload)) {
    warnings.push(`${document.fileName}: ${document.conversionNote}`);
  }

  return {
    caseVersion: view.version,
    generatedAt: new Date().toISOString(),
    preFilingReference: cjtsOnly(),
    videoConferenceConsent: missing(),
    claimant: guideParty(claimant),
    respondent: guideParty(respondent),
    claim: {
      nature: filled(nature),
      disputeType: filled(record.case.claimCategory === "services" ? "Service not completed as agreed" : null),
      goodsOrServices: formField("goods_or_service")?.status === "filled"
        ? filled(formField("goods_or_service")?.value, factRef(agreement))
        : missing(),
      invoiceNumber: filled(agreementNumber(record)),
      contractSum: filled(money(contractSum), factRef(agreement)),
      paid: filled(money(paid), paymentFacts.flatMap(factRef)),
      balance: filled(money(balance), [...factRef(agreement), ...paymentFacts.flatMap(factRef)]),
      contractDate: filled(formatDate(agreement?.date?.value), factRef(agreement)),
      datePerformed: missing(),
      dateDefaulted: filled(formatDate(promised?.date?.value), factRef(promised)),
      claimAmount: filled(money(claimAmount), factRef(desired)),
      summary: summaryField
        ? filled(summariseForCjts(summaryField.value), [summaryField.sourceRef, ...summaryField.additionalSourceRefs]
          .filter((ref): ref is SourceRef => Boolean(ref)))
        : formField("claim_summary")?.status === "filled" && formField("claim_summary")?.value
          ? filled(
              summariseForCjts(formField("claim_summary")!.value!),
              [agreement, settledFact(record, "event"), settledFact(record, "loss")].flatMap(factRef),
            )
          : missing(),
      orders: {
        moneyOrder: claimAmount !== null && claimAmount > 0,
        workOrder: false,
        vacantPossession: false,
        costs: false,
        disbursements: false,
      },
    },
    documents,
    warnings: [...new Set(warnings)],
    finalChecklist: [
      "Complete the CJTS pre-filing assessment and copy the reference ID into the live form.",
      "Check every name, ID, contact detail, address, amount, and date against the original source.",
      "Obtain a recent ACRA Business Profile for every business claimant or respondent.",
      "Convert supporting files to PDF and use safe filenames without prohibited special characters.",
      "Enter these values and upload the supporting documents on the current CJTS website.",
      "Review the live form before you submit and pay. This guide does not file anything.",
    ],
  };
}
