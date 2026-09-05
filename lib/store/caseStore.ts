/**
 * The case store. Deliberately dumb — see SHARED-CONTRACT.md §1.
 *
 * P0 holds one case in memory (PRD §2: one case at a time, synthetic data only).
 * A pilot swaps the holder for real persistence; nothing above this file changes.
 */

import type { CaseMeta, CaseRecord } from "@/lib/contracts";
import { emptyCase } from "./emptyCase";

/**
 * Survives Next's dev-mode module reloading. Without this, every hot reload
 * silently resets the case and you spend an hour debugging "my edit vanished".
 */
const HOLDER_KEY = Symbol.for("sct.caseStore.holder");

interface Holder {
  record: CaseRecord;
}

function holder(): Holder {
  const g = globalThis as unknown as Record<symbol, Holder | undefined>;
  if (!g[HOLDER_KEY]) {
    g[HOLDER_KEY] = { record: emptyCase() };
  }
  return g[HOLDER_KEY]!;
}

export function getCase(): CaseRecord {
  return holder().record;
}

/**
 * Apply a change.
 *
 * Deliberately does NOT bump the version. Bumping is a separate, explicit call
 * because it must fire on *material* fact changes only — bump it on every
 * keystroke in a free-text note and Clarence's drafts are permanently stale.
 */
export function patchCase(mutate: (draft: CaseRecord) => void): CaseRecord {
  const h = holder();
  mutate(h.record);
  h.record.case.updatedAt = new Date().toISOString();
  return h.record;
}

/**
 * The staleness clock (SHARED-CONTRACT §4).
 *
 * The ONLY writer of `case.version` in the codebase. `CaseMeta.version` is
 * readonly precisely so that this cast is the single exception, and grep for
 * `bumpVersion` finds every place staleness can be triggered.
 */
export function bumpVersion(reason: string): number {
  const h = holder();
  const meta = h.record.case as CaseMeta & { version: number };
  meta.version += 1;
  h.record.case.updatedAt = new Date().toISOString();
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[caseStore] version -> ${meta.version} (${reason})`);
  }
  return meta.version;
}

/**
 * Reseed. With no argument this clears the case back to empty, which is what
 * the app boots with; tests pass a fixture to load the worked example.
 */
export function resetCase(seed?: CaseRecord): CaseRecord {
  const h = holder();
  h.record = seed ? structuredClone(seed) : emptyCase();
  return h.record;
}
