import type { CaseRecord } from "@/lib/contracts";
import { deriveForm, type FormField } from "@/lib/cjts/form";

export interface IntakeNextStep {
  label: string;
  href: "/documents" | "/chronology" | "/evidence" | "/prepare";
}

export interface IntakeProgress {
  complete: boolean;
  fullyFilled: boolean;
  missingKeys: string[];
  reply: string;
  nextSteps: IntakeNextStep[];
}

export const INTAKE_NEXT_STEPS: IntakeNextStep[] = [
  { label: "Review names, dates and amounts", href: "/chronology" },
  { label: "Check what your files support", href: "/evidence" },
  { label: "Download the preparation pack PDF", href: "/prepare" },
];

export const INTAKE_DOCUMENT_STEP: IntakeNextStep = {
  label: "Upload your documents",
  href: "/documents",
};

const FIELD_REQUEST: Record<string, string> = {
  claimant_name: "your full name",
  claimant_id: "your NRIC, FIN or passport number",
  claimant_contact: "your phone number or email",
  claimant_address: "your postal address",
  respondent_name: "the other person's or business's full name",
  respondent_type: "whether the other side is a person or business",
  respondent_address: "the other side's registered or postal address",
  claim_type: "whether this is about goods, services, both, or something else",
  goods_or_service: "what you bought or what work was agreed",
  claim_amount: "the amount you are claiming",
  claim_date: "the exact date the work or delivery was due, or the problem happened",
  claim_summary: "what went wrong",
};

/**
 * Fields explicitly set aside by the user. The form stays visibly incomplete,
 * but the interview must still end instead of asking for the same unknown item.
 */
function setAsideKeys(record: CaseRecord): Set<string> {
  const result = new Set<string>();
  for (const question of record.openQuestions) {
    if (question.status === "open") continue;
    const match = question.whyItMatters.match(/^Form fields set aside:\s*(.+)$/i);
    if (!match) continue;
    for (const key of match[1].split(",")) result.add(key.trim());
  }
  return result;
}

function askableFields(record: CaseRecord): FormField[] {
  const form = deriveForm(record);
  const setAside = setAsideKeys(record);
  return form.groups
    .flatMap((group) => group.fields)
    .filter(
      (field) =>
        field.required &&
        field.status !== "filled" &&
        field.status !== "from_cjts" &&
        !setAside.has(field.key),
    );
}

/**
 * A deterministic follow-up after extraction. This keeps a normal answer to a
 * single model request: the model writes facts, then rules decide what remains
 * and produce one compact, grouped question without another model round trip.
 */
export function planIntakeProgress(record: CaseRecord): IntakeProgress {
  const form = deriveForm(record);
  const missing = askableFields(record);
  const fullyFilled = form.outstanding.length === 0;
  const hasSpokenCase = record.facts.some((fact) => !fact.unknown && fact.kind !== "party");

  if (record.documents.length === 0 && hasSpokenCase) {
    return {
      complete: true,
      fullyFilled,
      missingKeys: missing.map((field) => field.key),
      reply: fullyFilled
        ? "Thanks — I've organised the key details of your case. Next, upload anything that supports what you told me, such as agreements, receipts, emails, messages or photos. I'll read them and connect relevant passages to your case."
        : "Thanks — I have the outline of your case. Upload your agreements, receipts, emails, messages or photos next. Your documents can fill in missing names, dates and amounts, and I’ll link each detail to the passage it came from.",
      nextSteps: [INTAKE_DOCUMENT_STEP],
    };
  }

  if (missing.length === 0) {
    return {
      complete: true,
      fullyFilled,
      missingKeys: [],
      reply: fullyFilled
          ? "Your preparation worksheet is ready. Use the three next steps below to check it, match your files to it, and download the PDF. CJTS will issue the pre-filing assessment ID when you complete its assessment."
        : "I've stopped the questions. Add the details you set aside if you find them later; for now, use the next steps below to review what is recorded and prepare your files.",
      nextSteps: INTAKE_NEXT_STEPS,
    };
  }

  const byGroup = new Map<string, string[]>();
  for (const field of missing) {
    const group = field.group.startsWith("A.")
      ? "Your details"
      : field.group.startsWith("B.")
        ? "Other side"
        : "Dispute";
    const entries = byGroup.get(group) ?? [];
    entries.push(FIELD_REQUEST[field.key] ?? field.label.toLowerCase());
    byGroup.set(group, entries);
  }

  const lines = [...byGroup.entries()].map(([group, entries]) => `• ${group}: ${entries.join(", ")}`);
  return {
    complete: false,
    fullyFilled: false,
    missingKeys: missing.map((field) => field.key),
    reply: [
      "I've saved that. To finish the worksheet in one more reply, send only these missing details:",
      ...lines,
      "Answer in any order. If you do not have something, say which item you don't know and I will set it aside.",
    ].join("\n\n"),
    nextSteps: [],
  };
}
