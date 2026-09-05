import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { demoCase } from "@/fixtures/case.demo";
import { adverseCase } from "@/fixtures/case.adverse";
import type { CaseRecord, ContradictionKind } from "@/lib/contracts";
import { detectContradictions } from "./contradictions";

const kinds = (r: CaseRecord): ContradictionKind[] => detectContradictions(r).map((c) => c.kind);

describe("detectContradictions", () => {
  it("surfaces every seeded contradiction in the adverse case", () => {
    // PRD §9 release gate: "Every seeded material contradiction is surfaced."
    const found = new Set(kinds(adverseCase));
    for (const required of [
      "changed_terms",
      "refund",
      "partial_performance",
      "settlement_attempt",
      "adverse_document",
      "inconsistent_amount",
    ] as const) {
      assert.ok(found.has(required), `missed ${required}; found ${[...found].join(", ")}`);
    }
  });

  it("catches the deadline conflict the demo turns on", () => {
    const date = detectContradictions(demoCase).find((c) => c.kind === "inconsistent_date");
    assert.ok(date, "the 15 July / 29 July conflict was not detected");
    assert.ok(date.alternatives.length >= 2, "both readings must be offered");
    for (const alt of date.alternatives) {
      assert.ok(alt.distinguishingFact.trim().length > 0, "an alternative has no distinguishing fact");
    }
  });

  it("stays quiet on the demo case's uncontested points", () => {
    // The demo is not the adverse case. Flagging a refund or a settlement here
    // would be a false positive, and false positives teach users to ignore the flag.
    const found = new Set(kinds(demoCase));
    for (const absent of ["refund", "settlement_attempt", "inconsistent_amount"] as const) {
      assert.ok(!found.has(absent), `false positive: ${absent}`);
    }
  });

  it("does not multiply one problem into several findings", () => {
    // The single S$400 refund appears in the statement, the offer and the
    // confirmation. That is one problem with three citations.
    const refunds = detectContradictions(adverseCase).filter((c) => c.kind === "refund");
    assert.equal(refunds.length, 1, "one refund reported more than once");
    assert.ok(refunds[0].excerptIds.length > 1, "the other mentions were dropped rather than cited");
  });

  it("cites a specific excerpt for every finding", () => {
    // FR10: "Show the specific source of any concern."
    for (const record of [demoCase, adverseCase]) {
      const ids = new Set(record.excerpts.map((e) => e.id));
      for (const c of detectContradictions(record)) {
        assert.ok(c.excerptIds.length > 0 || c.factIds.length > 0, `${c.kind} cites nothing`);
        for (const id of c.excerptIds) assert.ok(ids.has(id), `${c.kind} cites missing excerpt ${id}`);
      }
    }
  });

  it("never cites a document it could not read", () => {
    // Quoting a password-protected or duplicate file would be inventing evidence.
    const unreadable = new Set(
      adverseCase.documents
        .filter((d) => d.processingStatus !== "extracted" || d.issues.includes("duplicate"))
        .map((d) => d.id),
    );
    const banned = new Set(
      adverseCase.excerpts.filter((e) => unreadable.has(e.documentId)).map((e) => e.id),
    );
    for (const c of detectContradictions(adverseCase)) {
      for (const id of c.excerptIds) assert.ok(!banned.has(id), `${c.kind} cites unreadable ${id}`);
    }
  });

  it("runs with no model configured", () => {
    // Deterministic by design. If this needed an API key, a missing key would
    // mean shipping an assessment that silently skipped its own bias check.
    const before = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      assert.ok(detectContradictions(adverseCase).length > 0);
    } finally {
      if (before !== undefined) process.env.OPENAI_API_KEY = before;
    }
  });

  it("is deterministic", () => {
    assert.deepEqual(detectContradictions(adverseCase), detectContradictions(adverseCase));
  });
});
