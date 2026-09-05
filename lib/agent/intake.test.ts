import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { demoCase } from "@/fixtures/case.demo";
import { sgd } from "@/lib/contracts";
import { deriveForm } from "@/lib/cjts/form";
import { emptyCase } from "@/lib/store/emptyCase";
import { planIntakeProgress } from "./intake";

describe("planIntakeProgress", () => {
  it("asks for all missing form details in one grouped follow-up", () => {
    const result = planIntakeProgress(emptyCase());

    assert.equal(result.complete, false);
    assert.match(result.reply, /one more reply/i);
    assert.match(result.reply, /Your details/);
    assert.match(result.reply, /Other side/);
    assert.match(result.reply, /Dispute/);
    assert.equal(result.missingKeys.length, 12);
  });

  it("ends the interview and returns direct next steps when the form is filled", () => {
    const record = structuredClone(demoCase);
    const disputedDate = record.facts.find((fact) => fact.id === "f3");
    assert.ok(disputedDate);
    disputedDate.disputed = false;

    const result = planIntakeProgress(record);

    assert.equal(result.complete, true);
    assert.equal(result.fullyFilled, true);
    assert.deepEqual(result.nextSteps.map((step) => step.href), [
      "/chronology",
      "/evidence",
      "/prepare",
    ]);
  });

  it("does not re-ask fields the user explicitly set aside", () => {
    const record = emptyCase();
    const first = planIntakeProgress(record);
    record.openQuestions.push({
      id: "q_set_aside",
      topic: "events",
      question: "Which details do you not know?",
      whyItMatters: `Form fields set aside: ${first.missingKeys.join(",")}`,
      status: "dont_know",
      answeredFactId: null,
      askedAt: new Date().toISOString(),
    });

    const result = planIntakeProgress(record);
    assert.equal(result.complete, true);
    assert.equal(result.fullyFilled, false);
    assert.match(result.reply, /stopped the questions/i);
  });

  it("uses the amount requested instead of assuming it equals everything paid", () => {
    const record = structuredClone(demoCase);
    const requestedOutcome = record.facts.find((fact) => fact.kind === "desired_outcome");
    assert.ok(requestedOutcome);
    requestedOutcome.amount = sgd(1200);

    const amount = deriveForm(record)
      .groups.flatMap((group) => group.fields)
      .find((field) => field.key === "claim_amount");

    assert.equal(amount?.value, "S$1,200.00");
  });
});
