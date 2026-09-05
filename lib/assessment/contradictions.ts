/**
 * Contradiction detection. FR10.
 *
 * "Before generating an issue review or narrative draft, check for inconsistent
 * dates and amounts, partial performance, changed terms, refunds, settlement
 * attempts, and material adverse documents in the supplied record."
 *
 * Deliberately deterministic rules over the record, not a model call. Three
 * reasons: this is a release gate ("every seeded material contradiction is
 * surfaced"), a gate that passes only probabilistically is not a gate; the
 * findings must cite a specific excerpt, and a model asked to cite will
 * sometimes cite something that does not say what it claims; and it must run
 * with no API key configured, because failing open here means shipping an
 * assessment that quietly skipped its own bias check.
 *
 * The cost is recall: phrasing these patterns miss are missed. That is the
 * right trade for P0 — a missed pattern is a visible gap in a test, whereas a
 * hallucinated contradiction erodes trust in every badge on the screen.
 */

import type { CaseRecord, Contradiction, ContradictionKind, Excerpt } from "@/lib/contracts";

interface Signal {
  kind: ContradictionKind;
  pattern: RegExp;
  /** Written as something the user can act on, not a category name. */
  describe: (quote: string) => string;
}

const SIGNALS: Signal[] = [
  {
    kind: "changed_terms",
    pattern: /\b(push (it )?(to|back)|postpone|extend(ed|ion)?|reschedul\w+|move (the )?date|delay(ed)? (to|until)|new (completion )?date)\b/i,
    describe: (q) => `A message discusses changing an agreed date: “${q}”. Whether the change was agreed is not established by the message alone.`,
  },
  {
    kind: "refund",
    pattern: /\b(refund(ed|ing)?|money back|reimburs\w+|credit(ed)? (you|back))\b/i,
    describe: (q) => `The record mentions money going back to you: “${q}”. Any amount already returned needs to come off what you are claiming.`,
  },
  {
    kind: "partial_performance",
    pattern: /\b(already done|part(ly|ially)? (done|complete[d]?|finished)|substantially complete|some of the work|only .{0,20}remain\w*|tiles are laid|waterproofing (already )?done)\b/i,
    describe: (q) => `The record suggests part of the work was done: “${q}”. That affects what you can say was not delivered.`,
  },
  {
    kind: "settlement_attempt",
    pattern: /\b(no extra charge|free of charge|come back and (finish|fix)|we can (fix|finish|redo)|settle|offer to (fix|refund|finish)|goodwill)\b/i,
    describe: (q) => `An offer to put things right appears in the record: “${q}”. Declining an offer can be raised against you.`,
  },
  {
    kind: "adverse_document",
    pattern: /\b(not within .{0,30}control|outside .{0,20}control|force majeure|no liability|not (be )?(liable|responsible) for|subject to availability|delays caused by)\b/i,
    describe: (q) => `A document you supplied contains a term that may work against you: “${q}”.`,
  },
];

const MONEY = /(?:S\$|SGD\s*|\$)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/gi;

function quote(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1) + "…";
}

function centsIn(text: string): number[] {
  const found: number[] = [];
  for (const m of text.matchAll(MONEY)) {
    const value = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(value)) found.push(Math.round(value * 100));
  }
  return found;
}

/** Only excerpts from documents we could actually read may be cited. */
function citableExcerpts(record: CaseRecord): Excerpt[] {
  const readable = new Set(
    record.documents
      .filter((d) => d.processingStatus === "extracted" && !d.issues.includes("duplicate"))
      .map((d) => d.id),
  );
  return record.excerpts.filter((e) => readable.has(e.documentId));
}

export function detectContradictions(record: CaseRecord): Contradiction[] {
  const found: Contradiction[] = [];
  const excerpts = citableExcerpts(record);
  const seen = new Set<string>();

  const push = (c: Contradiction) => {
    // One finding per kind per excerpt. A chat that says "refund" three times is
    // one problem, and repeating it would read as three.
    const key = `${c.kind}:${c.excerptIds.join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(c);
  };

  // One finding per signal, citing every excerpt that matched.
  //
  // Per-excerpt findings meant the single S$400 refund appeared three times -
  // in the bank statement, in the offer, and in the confirmation - reading as
  // three separate problems. It is one problem with three pieces of evidence,
  // and all three are still cited so the user can inspect each.
  for (const signal of SIGNALS) {
    const matched = excerpts.filter((e) => signal.pattern.test(e.text));
    if (matched.length === 0) continue;

    const more = matched.length > 1 ? ` Mentioned in ${matched.length} places in your files.` : "";
    push({
      id: `ct_${signal.kind}`,
      kind: signal.kind,
      description: signal.describe(quote(matched[0].text)) + more,
      excerptIds: matched.map((e) => e.id),
      factIds: record.facts
        .filter((f) => f.excerptIds.some((id) => matched.some((e) => e.id === id)))
        .map((f) => f.id),
      alternatives: [],
      sourceCaseVersion: record.case.version,
    });
  }

  // Dates: only the agreed deadline, and only against text that is also talking
  // about a deadline.
  //
  // A first pass compared every dated fact against every excerpt mentioning a
  // date, and produced ten findings on the adverse fixture - a payment date
  // "contradicted" by a completion date, which is not a contradiction, it is
  // two different facts. Noise is worse than a miss here: a user who learns the
  // flag fires on nothing will ignore it when it fires on something.
  const DEADLINE_CONTEXT = /\b(complet\w+|finish\w+|deliver\w+|due|deadline|by (the )?\d)/i;
  for (const fact of record.facts) {
    if (fact.kind !== "promised_performance") continue;
    const factDate = fact.date?.value;
    if (!factDate || fact.date?.precision !== "exact") continue;
    const factMonthDay = factDate.slice(5, 10);

    for (const excerpt of excerpts) {
      if (fact.excerptIds.includes(excerpt.id)) continue;
      if (!DEADLINE_CONTEXT.test(excerpt.text)) continue;
      // Compare month-day: chat rarely writes the year, and requiring one would
      // lose the exact case this exists to catch.
      const others = datesIn(excerpt.text).filter((d) => d.slice(5, 10) !== factMonthDay);
      if (others.length === 0) continue;

      push({
        id: `ct_date_${fact.id}_${excerpt.id}`,
        kind: "inconsistent_date",
        description: `The record gives ${factDate} as the agreed completion date, but another document refers to a different one: “${quote(excerpt.text)}”. Whether the date changed is not established.`,
        excerptIds: [...fact.excerptIds, excerpt.id],
        factIds: [fact.id],
        alternatives: [
          {
            reading: `The completion date remained ${factDate}.`,
            distinguishingFact: "Anything showing the other side's proposal was not accepted.",
          },
          {
            reading: "The completion date was changed by agreement.",
            distinguishingFact: "A later message from either side treating the new date as settled.",
          },
        ],
        sourceCaseVersion: record.case.version,
      });
      break; // One deadline finding per fact is enough to raise the question.
    }
  }

  // Amounts: what the user is asking for, against what the record adds up to.
  const claimed = record.facts.find((f) => f.kind === "desired_outcome")?.amount?.minorUnits;
  if (claimed !== undefined) {
    const components = record.facts.filter(
      (f) => (f.kind === "payment" || f.kind === "loss") && f.amount,
    );
    const total = components.reduce((s, f) => s + (f.amount?.minorUnits ?? 0), 0);
    const refunds = excerpts.flatMap((e) =>
      /\brefund/i.test(e.text) ? centsIn(e.text).map((c) => ({ cents: c, excerptId: e.id })) : [],
    );
    const refunded = refunds.reduce((s, r) => s + r.cents, 0);

    if (components.length > 0 && total - refunded !== claimed) {
      push({
        id: "ct_amount_claimed",
        kind: "inconsistent_amount",
        description:
          `You are asking for ${money(claimed)}. The record adds up to ${money(total)}` +
          (refunded > 0 ? `, less ${money(refunded)} that appears to have been refunded, which is ${money(total - refunded)}` : "") +
          `. These do not reconcile.`,
        excerptIds: refunds.map((r) => r.excerptId),
        factIds: [
          ...components.map((f) => f.id),
          ...record.facts.filter((f) => f.kind === "desired_outcome").map((f) => f.id),
        ],
        alternatives: [],
        sourceCaseVersion: record.case.version,
      });
    }
  }

  return found;
}

function datesIn(text: string): string[] {
  const out: string[] = [];
  const months = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
  const re = new RegExp(`\\b(\\d{1,2})\\s*(${months})\\w*\\s*(\\d{4})?\\b`, "gi");
  for (const m of text.matchAll(re)) {
    const day = m[1].padStart(2, "0");
    const month = String(
      ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
        m[2].toLowerCase().slice(0, 3),
      ) + 1,
    ).padStart(2, "0");
    // Year is often omitted in chat. Leaving it out entirely would lose the
    // finding, so the day and month still count as a different date.
    out.push(`${m[3] ?? "____"}-${month}-${day}`);
  }
  return out.map((d) => (d.startsWith("____") ? d : d));
}

function money(cents: number): string {
  return `S$${(cents / 100).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
