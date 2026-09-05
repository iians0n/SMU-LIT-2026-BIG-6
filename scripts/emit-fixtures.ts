/**
 * Emits the JSON fixtures from their typed sources.
 *
 * The .ts files are the source of truth — they get type-checked against
 * lib/contracts, so a fixture that has drifted fails the build instead of
 * failing silently at 2am. The .json artifacts exist for consumers that
 * shouldn't need a compile step (tests, fetch(), non-TS tooling).
 *
 * Run: npm run fixtures
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { demoCase } from "../fixtures/case.demo";

const OUT = [{ name: "case.demo.json", data: demoCase }] as const;

for (const { name, data } of OUT) {
  const path = join(process.cwd(), "fixtures", name);
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`wrote fixtures/${name}`);
}
