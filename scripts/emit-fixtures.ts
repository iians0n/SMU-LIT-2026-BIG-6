/**
 * Emits the JSON fixtures from their typed sources, and checks that they
 * describe the real files in fixtures/documents/.
 *
 * The .ts files are the source of truth — they get type-checked against
 * lib/contracts, so a fixture that has drifted fails the build instead of
 * failing silently at 2am. The .json artifacts exist for consumers that
 * shouldn't need a compile step (tests, fetch(), non-TS tooling).
 *
 * Run: npm run fixtures
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { CaseRecord } from "../lib/contracts";
import { demoCase } from "../fixtures/case.demo";
import { adverseCase } from "../fixtures/case.adverse";

const ROOT = process.cwd();
const DOCS_DIR = join(ROOT, "fixtures", "documents");

/**
 * A fixture that claims a hash the file on disk does not have is worse than no
 * fixture: duplicate detection would "pass" against numbers we made up. So the
 * two are reconciled here rather than trusted.
 */
function verifyDocuments(record: CaseRecord, label: string): string[] {
  const problems: string[] = [];

  for (const doc of record.documents) {
    const path = join(DOCS_DIR, doc.fileName);
    if (!existsSync(path)) {
      problems.push(`${label}: ${doc.fileName} — no such file in fixtures/documents/`);
      continue;
    }
    const bytes = readFileSync(path);
    const hash = "sha256:" + createHash("sha256").update(bytes).digest("hex").slice(0, 16);

    if (doc.byteSize !== bytes.length) {
      problems.push(
        `${label}: ${doc.fileName} — byteSize ${doc.byteSize}, file is ${bytes.length}`,
      );
    }
    if (doc.hash !== hash) {
      problems.push(`${label}: ${doc.fileName} — hash ${doc.hash}, file is ${hash}`);
    }
  }

  // Duplicate flags must follow from the actual bytes, not from an assertion.
  const byHash = new Map<string, string[]>();
  for (const doc of record.documents) {
    byHash.set(doc.hash, [...(byHash.get(doc.hash) ?? []), doc.id]);
  }
  for (const [hash, ids] of byHash) {
    const flagged = ids.filter((id) =>
      record.documents.find((d) => d.id === id)?.issues.includes("duplicate"),
    );
    if (ids.length > 1 && flagged.length !== ids.length - 1) {
      problems.push(
        `${label}: hash ${hash} is shared by ${ids.join(", ")} — expected ${ids.length - 1} marked duplicate, found ${flagged.length}`,
      );
    }
    if (ids.length === 1 && flagged.length > 0) {
      problems.push(`${label}: ${ids[0]} is marked duplicate but its hash is unique`);
    }
  }

  return problems;
}

const FIXTURES = [
  { name: "case.demo.json", label: "case.demo", data: demoCase },
  { name: "case.adverse.json", label: "case.adverse", data: adverseCase },
] as const;

const allProblems = FIXTURES.flatMap(({ label, data }) => verifyDocuments(data, label));

if (allProblems.length > 0) {
  console.error("Fixture does not match fixtures/documents/:\n");
  for (const problem of allProblems) console.error(`  ✗ ${problem}`);
  console.error("\nRegenerate with: python3 scripts/make_fixture_documents.py");
  process.exit(1);
}

for (const { name, data } of FIXTURES) {
  writeFileSync(join(ROOT, "fixtures", name), JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`✓ wrote fixtures/${name} (${data.documents.length} documents verified against disk)`);
}
