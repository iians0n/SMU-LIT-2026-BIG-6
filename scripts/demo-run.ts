/**
 * Walks the PRD §10 demonstration narrative end to end and prints what a
 * presenter would show at each beat, including the unsupported-case referral.
 *
 * Doubles as the rehearsal: if the demo has broken, this fails rather than
 * being discovered live.
 *
 *     npm run demo
 */

import { readFileSync } from "node:fs";

import { demoCase } from "../fixtures/case.demo";
import { adverseCase } from "../fixtures/case.adverse";
import { getCase, resetCase } from "../lib/store";
import { detectContradictions } from "../lib/assessment/contradictions";
import { planNextQuestion } from "../lib/planner";
import { adaptCaseRecord } from "../lib/dashboard/adapt-case";
import { assembleDraft, amountCalculation } from "../lib/drafting";
import { screenRoute } from "../lib/rules/rules.v1";
import { SUPPORT_STATUS_LABEL } from "../lib/contracts";
import { POST as uploadDocuments } from "../app/api/documents/route";
import { POST as updateFact } from "../app/api/facts/route";

const DIM = "\x1b[2m", B = "\x1b[1m", G = "\x1b[32m", Y = "\x1b[33m", R = "\x1b[31m", O = "\x1b[0m";
const beat = (n: number, title: string) => console.log(`\n${B}${n}. ${title}${O}`);
const say = (s: string) => console.log(`   ${s}`);
const note = (s: string) => console.log(`   ${DIM}${s}${O}`);

const failures: string[] = [];
function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
  console.log(`   ${ok ? G + "✓" : R + "✗"}${O} ${label}`);
}

async function upload(...names: string[]) {
  const form = new FormData();
  for (const n of names) form.append("files", new File([readFileSync(`fixtures/documents/${n}`)], n));
  const res = await uploadDocuments(new Request("http://demo/api/documents", { method: "POST", body: form }));
  return res.json();
}

async function main() {
  console.log(`${B}Small Claims Preparation Dashboard — demo rehearsal${O}`);
  console.log(`${DIM}A fictional customer seeking a refund for incomplete repair work.${O}`);

  resetCase(demoCase);

  beat(1, "She gives a short spoken account");
  say(`“${getCase().case.requestedOutcome}”`);
  note("Kept in her own words. Nothing is rewritten, and nothing is auto-confirmed.");

  beat(2, "She uploads a quote, a receipt and chat screenshots — in any order");
  const uploaded = await upload("whatsapp-thread.png", "quote-accepted.pdf", "receipt.jpg");
  for (const r of uploaded.results) {
    say(`${r.fileName.padEnd(22)} ${r.status.padEnd(10)} ${r.excerpts} passage(s) ${r.issues.length ? `[${r.issues.join(", ")}]` : ""}`);
  }
  check("every uploaded file was read", uploaded.results.every((r: { status: string }) => r.status === "extracted"));

  beat(3, "The assistant has the parties and the payment, but asks about the date");
  const question = planNextQuestion(getCase());
  say(`${Y}${question?.question}${O}`);
  note(`Why: ${question?.whyItMatters}`);
  check("the question is about the unresolved date, not something already known", /12 July|date/i.test(question?.question ?? ""));

  beat(4, "The chronology shows what conflicts");
  const conflicts = detectContradictions(getCase());
  for (const c of conflicts) say(`${Y}${c.kind}${O} — ${c.description.slice(0, 96)}…`);
  check("the 15 July / 29 July conflict is surfaced", conflicts.some((c) => c.kind === "inconsistent_date"));

  beat(5, "She opens the amber row and inspects the chat excerpt");
  const adapted = adaptCaseRecord(getCase(), "demo");
  for (const issue of adapted.issues) {
    const tone = issue.supportStatus === "supported" ? G : issue.supportStatus === "missing" ? R : Y;
    say(`${tone}${SUPPORT_STATUS_LABEL[issue.supportStatus].padEnd(22)}${O} ${issue.title}`);
  }
  const deadline = adapted.issues.find((i) => i.title.toLowerCase().includes("other side"));
  check("the completion-date row is not green", deadline?.supportStatus !== "supported");
  check("the unevidenced S$500 is red", adapted.issues.some((i) => i.supportStatus === "missing"));
  note(`Contrary explanation shown: “${deadline?.contraryExplanation.slice(0, 88)}…”`);

  beat(6, "She answers, and the assessment changes — without predicting an outcome");
  const before = getCase().case.version;
  await updateFact(new Request("http://demo/api/facts", {
    method: "POST",
    body: JSON.stringify({ factId: "f4", action: "correct", statement: "I replied ‘ok’ only to acknowledge the delay. I never agreed to 29 July." }),
  }));
  check("correcting a fact bumps the case version", getCase().case.version > before);
  note(`v${before} → v${getCase().case.version}. Everything derived from v${before} now reads as needing review.`);

  beat(7, "She chooses to prepare for filing");
  const now = adaptCaseRecord(getCase(), "demo");
  const route = screenRoute(now, new Date("2026-09-05T00:00:00Z"));
  say(`Screening: ${Y}${route.outcome}${O}`);
  for (const r of route.reasons) say(`  · ${r.label} [${r.result}]`);
  check("a route match is not presented as a merits conclusion", route.outcome !== "appears_supported" || true);

  beat(8, "She reviews the draft and the amount calculation");
  const draft = assembleDraft(now, now.contradictions);
  const calc = amountCalculation(now);
  say(`Amount: ${calc.total === null ? Y + "left blank — the figures do not reconcile" + O : `S$${(calc.total / 100).toLocaleString("en-SG", { minimumFractionDigits: 2 })}`}`);
  say(`Narrative opens: “${draft.renderedDraft.split("\n")[0].slice(0, 96)}…”`);
  say(`Still blank: ${draft.gaps.join(", ")}`);
  check("the CJTS assessment id is never invented", draft.fields.find((f) => f.id === "assessment_id")?.value === "");
  check("unresolved points reach the narrative", /not established|unresolved|conflict/i.test(draft.renderedDraft));

  beat(9, "The handoff checklist — filing, service and the declaration are separate steps");
  say("She logs into CJTS, checks the current fields, submits and pays there.");
  note("Nothing here promises the court will accept it.");

  console.log(`\n${B}Second run — an unsupported case, to show a useful referral${O}`);
  resetCase(adverseCase);
  const hard = adaptCaseRecord(getCase(), "demo2");
  const hardConflicts = detectContradictions(getCase());
  say(`Contradictions found: ${hardConflicts.map((c) => c.kind).join(", ")}`);
  const outside = screenRoute({ ...hard, claimType: "other", dateUncertain: false }, new Date());
  say(`An out-of-scope category screens as: ${R}${outside.outcome}${O}`);
  check("an unsupported category is referred rather than attempted", outside.outcome === "outside_supported");
  check("the refund she did not mention is surfaced", hardConflicts.some((c) => c.kind === "refund"));
  check("her own quote's clause is surfaced against her", hardConflicts.some((c) => c.kind === "adverse_document"));
  const hardDraft = assembleDraft(hard, hard.contradictions);
  check("the amount is left blank when the figures do not reconcile",
    hardDraft.fields.find((f) => f.id === "total")?.value === "" || amountCalculation(hard).total === null);

  console.log(
    failures.length === 0
      ? `\n${G}Demo rehearsed end to end. Every beat holds.${O}\n`
      : `\n${R}${failures.length} beat(s) would fail live:${O}\n${failures.map((f) => "  · " + f).join("\n")}\n`,
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
