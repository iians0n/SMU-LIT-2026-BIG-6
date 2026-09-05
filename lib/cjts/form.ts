/**
 * The CJTS claim form, derived live from the case record. FR08.
 *
 * This is the thing the user is actually trying to produce, so it fills in as
 * they talk rather than appearing at the end. Watching a field populate — with
 * where it came from attached — is also the clearest way to show that nothing
 * was invented.
 *
 * Three rules from FR08, enforced here rather than trusted to the UI:
 *
 *   A field is only filled from a CONFIRMED fact or a readable document. An
 *   unconfirmed fact shows as "waiting for you to confirm", never as a value.
 *
 *   Every filled field carries its source. If we cannot say where a value came
 *   from, it does not go in.
 *
 *   The pre-filing assessment ID is never populated by anything. CJTS issues
 *   it, and inventing one would be fabricating an official reference.
 *
 * Field names follow the publicly documented CJTS information requirements
 * (PRD S3). They must be checked against the live portal before anyone claims
 * this maps one-to-one onto the real form.
 */

import type { CaseRecord } from "@/lib/contracts";
import { formatMoney } from "@/lib/contracts";

export type FieldStatus =
  /** Filled from something we can point at. */
  | "filled"
  /** We have it, but the user has not confirmed it yet. */
  | "unconfirmed"
  /** Nothing in the case supplies it. */
  | "missing"
  /** Only CJTS can supply it. Never filled here. */
  | "from_cjts";

export interface FormField {
  key: string;
  label: string;
  group: string;
  required: boolean;
  /** Plain-language explanation, shown when the field is not yet filled. */
  help: string;
  value: string | null;
  status: FieldStatus;
  /** Where the value came from, in the user's terms. */
  source: string | null;
}

export interface FormGroup {
  name: string;
  fields: FormField[];
}

export interface DerivedForm {
  groups: FormGroup[];
  /** Required, fillable-here fields that are done. Counted against `total`. */
  filled: number;
  /**
   * Required fields the user can actually complete here.
   *
   * Excludes anything only CJTS can issue: counting the pre-filing assessment
   * number would leave the form permanently short of complete, which reads as
   * broken rather than as accurate.
   */
  total: number;
  /**
   * Required fields the user can still supply by talking, in form order. Fields
   * only CJTS can issue are excluded — the assistant works through this list,
   * and asking someone for a number they cannot have would be a dead end.
   */
  outstanding: string[];
  /** Required, but obtained elsewhere. Shown on the form, never asked for. */
  fromElsewhere: string[];
  sourceCaseVersion: number;
}

interface Spec {
  key: string;
  label: string;
  group: string;
  required: boolean;
  help: string;
  /** Returns a value plus where it came from, or null when the case cannot supply it. */
  derive: (r: CaseRecord) => { value: string; source: string; confirmed: boolean } | null;
}

const claimant = (r: CaseRecord) => r.parties.find((p) => p.role === "claimant");
const respondent = (r: CaseRecord) => r.parties.find((p) => p.role === "respondent");

function factOf(r: CaseRecord, kind: string) {
  return r.facts.find((f) => f.kind === kind && !f.unknown);
}

/**
 * Whether a fact is settled enough to fill a field.
 *
 * Something the user said in conversation is already their own account — asking
 * them to confirm what they just told us is friction that teaches people to
 * click through confirmations without reading. What genuinely needs confirming
 * is anything we READ or WORKED OUT, and anything a document contradicts.
 *
 * This does not weaken FR04. Its point is that a user confirming their own
 * recollection is not independent corroboration, and that still holds: this
 * only decides whether a form field is populated, never whether an issue is
 * supported by evidence.
 */
function settled(f: { origin: string; confirmedByUser: boolean; disputed: boolean }): boolean {
  if (f.disputed) return false;
  return f.origin === "user_stated" || f.confirmedByUser;
}

const SPECS: Spec[] = [
  {
    key: "claimant_name",
    label: "Your full name",
    group: "About you",
    required: true,
    help: "Exactly as it appears on your NRIC or FIN.",
    derive: (r) => {
      const p = claimant(r);
      return p?.name ? { value: p.name, source: "you told us", confirmed: true } : null;
    },
  },
  {
    key: "claimant_contact",
    label: "Your phone or email",
    group: "About you",
    required: true,
    help: "So the tribunal can reach you about your case.",
    derive: (r) => {
      const p = claimant(r);
      return p?.contact ? { value: p.contact, source: "you told us", confirmed: true } : null;
    },
  },
  {
    key: "claimant_address",
    label: "Your address",
    group: "About you",
    required: true,
    help: "Where documents about your case should be sent.",
    derive: (r) => {
      const p = claimant(r);
      return p?.address ? { value: p.address, source: "you told us", confirmed: true } : null;
    },
  },
  {
    key: "respondent_name",
    label: "Who you are claiming against",
    group: "The other side",
    required: true,
    help: "A person's full name, or a business's registered name.",
    derive: (r) => {
      const p = respondent(r);
      return p?.name ? { value: p.name, source: "you told us", confirmed: true } : null;
    },
  },
  {
    key: "respondent_type",
    label: "Are they a person or a business?",
    group: "The other side",
    required: true,
    help: "A business has to be named exactly as it is registered.",
    derive: (r) => {
      const p = respondent(r);
      if (!p || p.kind === "unknown") return null;
      return {
        value: p.kind === "business" ? "A business" : "A person",
        source: "you told us",
        confirmed: true,
      };
    },
  },
  {
    key: "respondent_address",
    label: "Their address",
    group: "The other side",
    required: true,
    help: "Needed so the claim can be delivered to them.",
    derive: (r) => {
      const p = respondent(r);
      return p?.address ? { value: p.address, source: "you told us", confirmed: true } : null;
    },
  },
  {
    key: "claim_type",
    label: "What the dispute is about",
    group: "Your claim",
    required: true,
    help: "For example, a service that was not completed.",
    derive: (r) => {
      if (r.case.claimCategory === "unknown") return null;
      const words: Record<string, string> = {
        goods: "Something you bought",
        services: "Work or a service you paid for",
        goods_and_services: "Goods and a service",
        other: "Something else",
      };
      return { value: words[r.case.claimCategory] ?? r.case.claimCategory, source: "from what you told us", confirmed: true };
    },
  },
  {
    key: "claim_amount",
    label: "How much you are claiming",
    group: "Your claim",
    required: true,
    help: "Added up from what you paid and what it cost you, less anything refunded.",
    derive: (r) => {
      // Built from components so the figure can be traced, and left empty when
      // they do not reconcile rather than guessed at.
      const parts = r.facts.filter(
        (f) => (f.kind === "payment" || f.kind === "loss") && f.amount && !f.unknown,
      );
      if (parts.length === 0) return null;
      const refunds = r.facts.filter((f) => f.amount && /\brefund/i.test(f.statement));
      const total =
        parts.reduce((s, f) => s + (f.amount?.minorUnits ?? 0), 0) -
        refunds.reduce((s, f) => s + (f.amount?.minorUnits ?? 0), 0);
      if (total <= 0) return null;
      return {
        value: formatMoney({ currencyCode: "SGD", minorUnits: total }),
        source: `${parts.length} amount(s) you gave us`,
        confirmed: parts.every(settled),
      };
    },
  },
  {
    key: "claim_date",
    label: "When the problem arose",
    group: "Your claim",
    required: true,
    help: "A claim normally has to be brought within two years of this date.",
    derive: (r) => {
      const f = factOf(r, "promised_performance") ?? factOf(r, "event");
      if (!f?.date?.value) return null;
      // An approximate date is not good enough for a filing deadline, so it is
      // offered as unconfirmed rather than presented as settled.
      return {
        value: f.date.value,
        source: f.statement.slice(0, 70),
        confirmed: settled(f) && f.date.precision === "exact",
      };
    },
  },
  {
    key: "claim_summary",
    label: "What happened",
    group: "Your claim",
    required: true,
    help: "A short account of the dispute, in your own words.",
    derive: (r) => {
      const parts = [factOf(r, "agreement"), factOf(r, "event"), factOf(r, "loss")].filter(
        (f): f is NonNullable<typeof f> => Boolean(f),
      );
      if (parts.length === 0) return null;
      return {
        value: parts.map((f) => f.statement).join(" "),
        source: `${parts.length} thing(s) you told us`,
        confirmed: parts.every(settled),
      };
    },
  },
  {
    key: "supporting_documents",
    label: "Documents you will attach",
    group: "Your claim",
    required: false,
    help: "Anything that backs up your account.",
    derive: (r) => {
      const usable = r.documents.filter(
        (d) => d.processingStatus === "extracted" && !d.issues.includes("duplicate"),
      );
      if (usable.length === 0) return null;
      return {
        value: usable.map((d) => d.userLabel ?? d.proposedLabel ?? d.fileName).join(", "),
        source: `${usable.length} file(s) you added`,
        confirmed: true,
      };
    },
  },
  {
    key: "acra_profile",
    label: "The other side's ACRA profile",
    group: "Also needed",
    required: false,
    help: "Only if you are claiming against a business. It has to be recent.",
    derive: (r) => {
      const p = respondent(r);
      if (p?.kind !== "business") return null;
      return { value: "Needed — you obtain this from ACRA", source: "they are a business", confirmed: true };
    },
  },
  {
    key: "assessment_id",
    label: "Pre-filing assessment number",
    group: "Also needed",
    required: true,
    help: "CJTS gives you this after you complete their pre-filing assessment. We cannot fill it in.",
    // Deliberately has no derive. FR08: never fabricate an official reference.
    derive: () => null,
  },
];

const CJTS_ONLY = new Set(["assessment_id"]);

export function deriveForm(record: CaseRecord): DerivedForm {
  const fields: FormField[] = SPECS.map((spec) => {
    const found = spec.derive(record);
    const status: FieldStatus = CJTS_ONLY.has(spec.key)
      ? "from_cjts"
      : !found
        ? "missing"
        : found.confirmed
          ? "filled"
          : "unconfirmed";

    return {
      key: spec.key,
      label: spec.label,
      group: spec.group,
      required: spec.required,
      help: spec.help,
      value: found ? found.value : null,
      status,
      source: found ? found.source : null,
    };
  });

  const groups: FormGroup[] = [];
  for (const field of fields) {
    const existing = groups.find((g) => g.name === field.group);
    if (existing) existing.fields.push(field);
    else groups.push({ name: field.group, fields: [field] });
  }

  return {
    groups,
    // Must match `total`'s basis or the counter can read "11 of 10", which it
    // did: optional fields were counted as progress towards a required-only goal.
    // Same basis as `total`, or the counter reads "11 of 10" - which it did,
    // because optional fields counted towards a required-only goal. A from_cjts
    // field can never be "filled", so it is excluded by construction.
    filled: fields.filter((f) => f.required && f.status === "filled").length,
    total: fields.filter((f) => f.required && f.status !== "from_cjts").length,
    outstanding: fields
      .filter((f) => f.required && f.status !== "filled" && f.status !== "from_cjts")
      .map((f) => f.label),
    fromElsewhere: fields.filter((f) => f.status === "from_cjts").map((f) => f.label),
    sourceCaseVersion: record.case.version,
  };
}
