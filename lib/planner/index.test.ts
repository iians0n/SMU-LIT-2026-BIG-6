import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { demoCase } from "@/fixtures/case.demo";
import type { CaseRecord } from "@/lib/contracts";
import { planNextQuestion, unresolvedTopics } from "./index";

const clone = (): CaseRecord => structuredClone(demoCase);

describe("planNextQuestion", () => {
  it("asks the open question already on the record before deriving new ones", () => {
    const q = planNextQuestion(clone());
    assert.ok(q);
    assert.equal(q.id, "q1");
    assert.match(q.question, /12 July/);
  });

  it("always explains why it is asking", () => {
    const q = planNextQuestion(clone());
    assert.ok(q && q.whyItMatters.trim().length > 20, "why-it-matters is missing or perfunctory");
  });

  it("never opens with a verb that invites yes", () => {
    // FR02: questions "must not suggest a favourable answer". "Did they finish
    // late?" invites yes; "What did you reply?" invites the truth.
    const record = clone();
    record.openQuestions = [];
    const asked: string[] = [];
    // Drain every rule by setting each topic aside in turn.
    for (let i = 0; i < 20; i++) {
      const q = planNextQuestion(record);
      if (!q) break;
      asked.push(q.question);
      record.openQuestions.push({
        id: q.id, topic: q.topic, question: q.question, whyItMatters: q.whyItMatters,
        status: "skipped", answeredFactId: null, askedAt: null,
      });
    }
    assert.ok(asked.length > 0, "no questions were produced");
    for (const question of asked) {
      assert.doesNotMatch(
        question,
        /^\s*(did|do|does|is|are|was|were|have|has|can|could|would|will|should|surely)\b/i,
        `leading question: "${question}"`,
      );
    }
  });

  it("does not ask again about something already established", () => {
    const record = clone();
    record.openQuestions = [];
    // The demo already has a confirmed payment backed by a receipt.
    let q = planNextQuestion(record);
    const asked = new Set<string>();
    for (let i = 0; i < 20 && q; i++) {
      asked.add(q.topic);
      record.openQuestions.push({
        id: q.id, topic: q.topic, question: q.question, whyItMatters: q.whyItMatters,
        status: "skipped", answeredFactId: null, askedAt: null,
      });
      q = planNextQuestion(record);
    }
    assert.ok(!asked.has("payment"), "asked about a payment the receipt already established");
    assert.ok(!asked.has("agreement"), "asked about an agreement already in the record");
  });

  it("terminates rather than trapping the user", () => {
    const record = clone();
    record.openQuestions = [];
    let guard = 0;
    let q = planNextQuestion(record);
    while (q && guard++ < 50) {
      record.openQuestions.push({
        id: q.id, topic: q.topic, question: q.question, whyItMatters: q.whyItMatters,
        status: "skipped", answeredFactId: null, askedAt: null,
      });
      q = planNextQuestion(record);
    }
    assert.equal(q, null, "the interview never ended");
    assert.ok(guard < 50, "took an unreasonable number of questions to finish");
  });

  it("keeps the fallback intake to four form-essential topics", () => {
    const record = clone();
    record.openQuestions = [];
    record.parties = [];
    record.facts = [];
    const asked = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const q = planNextQuestion(record);
      if (!q) break;
      asked.add(q.topic);
      record.openQuestions.push({
        id: q.id,
        topic: q.topic,
        question: q.question,
        whyItMatters: q.whyItMatters,
        status: "skipped",
        answeredFactId: null,
        askedAt: null,
      });
    }

    assert.deepEqual([...asked], ["parties", "agreement", "promised_performance", "payment"]);
  });

  it("treats a skipped or unknown answer as resolved for questioning purposes", () => {
    const record = clone();
    record.openQuestions = record.openQuestions.map((q) => ({ ...q, status: "dont_know" as const }));
    const topics = unresolvedTopics(record);
    assert.ok(topics.some((t) => t.status === "set_aside"), "nothing was set aside");
    // And it must not immediately re-ask the same topic.
    const next = planNextQuestion(record);
    const asideTopics = new Set(record.openQuestions.map((q) => q.topic));
    if (next) assert.ok(!asideTopics.has(next.topic), `re-asked ${next.topic}`);
  });

  it("raises a conflict before a gap", () => {
    const record = clone();
    record.openQuestions = [];
    const q = planNextQuestion(record);
    // f3 is disputed in the demo fixture, so the conflict rule should win.
    assert.equal(q?.reason, "conflict", `got ${q?.reason} on topic ${q?.topic}`);
  });
});
