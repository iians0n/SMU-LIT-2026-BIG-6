/**
 * Runs the annotated expectations in fixtures/expectations.ts.
 *
 * Today it checks the fixtures. At M2 the same expectations run against the
 * pipeline's output — that is what makes them an oracle rather than a
 * description of what we happened to write down.
 *
 *     npm run check:fixtures
 */

import type { CaseRecord } from "../lib/contracts";
import { demoCase } from "../fixtures/case.demo";
import { adverseCase } from "../fixtures/case.adverse";
import {
  adverseExpectations,
  demoExpectations,
  invariants,
  type Expectation,
} from "../fixtures/expectations";

const GREEN = "\x1b[32m", RED = "\x1b[31m", DIM = "\x1b[2m", OFF = "\x1b[0m";

function run(label: string, record: CaseRecord, expectations: Expectation[]): number {
  console.log(`\n${label}  ${DIM}v${record.case.version} · ${record.documents.length} docs · ${record.facts.length} facts${OFF}`);
  let failed = 0;

  for (const e of expectations) {
    let result: true | string;
    try {
      result = e.check(record);
    } catch (err) {
      result = `threw ${err instanceof Error ? err.message : String(err)}`;
    }

    if (result === true) {
      console.log(`  ${GREEN}✓${OFF} ${e.id.padEnd(34)} ${DIM}${e.what}${OFF}`);
    } else {
      failed++;
      console.log(`  ${RED}✗${OFF} ${e.id.padEnd(34)} ${e.what}`);
      console.log(`    ${RED}${result}${OFF}`);
      console.log(`    ${DIM}protects: ${e.why}${OFF}`);
    }
  }
  return failed;
}

const failures =
  run("invariants · demo", demoCase, invariants) +
  run("invariants · adverse", adverseCase, invariants) +
  run("demo", demoCase, demoExpectations) +
  run("adverse", adverseCase, adverseExpectations);

const total = invariants.length * 2 + demoExpectations.length + adverseExpectations.length;
console.log(
  failures === 0
    ? `\n${GREEN}${total} expectations pass${OFF}\n`
    : `\n${RED}${failures} of ${total} expectations failed${OFF}\n`,
);
process.exit(failures === 0 ? 0 : 1);
