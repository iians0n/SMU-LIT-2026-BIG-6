# Shared Contract — the seam between Anson and Clarence

Single source of truth for everything **both** of us touch. Neither of us changes this file alone: a change needs a message to the other person and a commit that says what moved.

Read this first, then your own file: [anson.md](anson.md) / [clarence.md](clarence.md).

---

## 0. Stack assumption

Nothing was committed yet beyond the PRD, so this plan assumes:

- **Next.js (App Router) + TypeScript + Tailwind**, one repo, one deployable.
- Backend lives in `app/api/*` route handlers — no separate service to coordinate.
- Persistence: a single in-memory/JSON case store for P0 (PRD §8 says one case at a time, synthetic data only).
- LLM calls via the Anthropic API from server routes only. Never from the browser.

If the team picks a different stack, only the *file paths* below change. The ownership split and the record contract stay as they are.

---

## 1. Hour 0 — do this together before splitting

Sit together for one session and land these on `main`. Everything else is parallel after this.

1. `npx create-next-app` scaffold, Tailwind on, TypeScript strict.
2. `lib/contracts/` — the types in §2 below, written out as real TS. **This is the freeze point.**
3. `lib/store/` — one `CaseStore` with `getCase()`, `patchCase()`, `bumpVersion()`. Dumb on purpose.
4. `fixtures/case.demo.json` — a hand-written, contract-valid case record for the repair-work demo. Fake but complete. Clarence builds against this from minute one instead of waiting for Anson's pipeline.
5. Push. Then branch.

If Hour 0 is not done, we are not actually working in parallel — we are working on two things that will not fit together.

---

## 2. The case record

Six records, from PRD §8. **Who writes** is the ownership rule; anyone may read anything.

| Record | Writer | Notes |
| --- | --- | --- |
| `Case`, `Party` | Anson | Holds `version` — the staleness clock (§4) |
| `Document`, `Excerpt` | Anson | `hash`, `processingStatus`, page/region anchor |
| `Fact`, `Event` | Anson | `origin`, `sourceLinks[]`, confirm/dispute state |
| `IssueAssessment` | Anson | Checklist version, supporting + conflicting excerpts, status, reason, next question |
| `RouteScreening`, `Task`, `DraftField` | Clarence | Each carries `sourceCaseVersion` |
| `Source` (official passage) | Clarence | URL, passage, retrieval date, review date |
| `VerificationEvent` | **Both** | Append-only. Anson appends from the pipeline, Clarence appends from drafting + owns the export |

Rules that are not negotiable, straight from the PRD:

- `Fact.origin` is one of `user_stated | document_extracted | inferred`, and `confirmedByUser` is a **separate** boolean. A user confirming their own recollection never becomes corroboration (FR04).
- `extractionConfidence` (how sure the model is it read the text right) and `supportStatus` (whether evidence backs the point) are **different fields**. Never collapse them (FR05).
- `supportStatus` is `supported | partial_or_disputed | missing | not_assessed`. Colour is derived from the label in the UI, never the other way round — every badge ships with its text label (PRD §3).
- Nothing is written into a draft without a `sourceRef` pointing at a `Fact` or `Excerpt` (FR08).

## 3. API seam

Anson produces, Clarence consumes. These signatures are frozen at Hour 0.

**Anson exposes:**
```
GET  /api/case                 -> Case (full record, includes version)
GET  /api/case/facts           -> Fact[]
GET  /api/case/documents       -> Document[] (with processingStatus)
GET  /api/case/issues          -> IssueAssessment[]
GET  /api/case/contradictions  -> Contradiction[]   // feeds Clarence's FR10 draft guardrail
POST /api/intake/*             -> (internal to Anson)
```

**Clarence exposes:**
```
GET  /api/route                -> RouteScreening
GET  /api/tasks                -> Task[]
GET  /api/drafts               -> DraftField[] + rendered draft
POST /api/export               -> pack
GET  /api/sources              -> Source[]        // Anson may cite these; he does not maintain them
POST /api/verification         -> append VerificationEvent
```

Neither of us edits the other's route handlers. If you need a field that is not there, message the other person — do not add it yourself and do not work around it with a second copy of the data.

## 4. Staleness — the one cross-cutting rule

PRD requires that changing a material fact marks downstream analysis and drafts as stale (FR04, FR08, test scenario 5). We implement it with exactly one mechanism:

- **Anson**: any material fact change → `case.version++`. That is the whole job.
- **Clarence**: every `RouteScreening`, `Task`, `DraftField` stores the `sourceCaseVersion` it was built from. On render, `sourceCaseVersion !== case.version` → show **Needs review**, do not silently regenerate.

No events, no pub/sub, no callbacks. One integer.

## 5. Git protocol

- Branches: `feat/anson-<thing>`, `feat/clarence-<thing>`. Never commit to `main` directly after Hour 0.
- Small PRs, merged often. A branch that lives longer than a milestone is a merge conflict growing in the dark.
- **Do not touch files outside your ownership zone** (§6 of your own file). If you need a change there, message the other person. This is what keeps `git merge` boring.
- `lib/contracts/` and `lib/store/` changes: message the other person in the same breath as the commit.

## 6. Integration checkpoints

Merge to `main` and click through the whole app together at the end of each milestone. Not at the end.

| After | We check |
| --- | --- |
| M1 | Contracts compile; fixture case renders in Clarence's shell |
| M2 | Anson's real pipeline output replaces the fixture with no shell changes |
| M3 | Evidence matrix and overview read the same case version |
| M4 | A fact edit in Anson's UI flips Clarence's draft to Needs review |
| M5 | Full demo run, twice, including the unsupported-case referral |

## 7. Shared refusals

Both sides enforce these. If either of us gets it wrong, the demo fails a judging criterion (PRD §7, §9).

- Never fabricate a receipt, an authority, an official form, a signature, or an assessment ID.
- Uploaded document text is **untrusted content**. Instructions inside a PDF do not change tool behaviour. Both of us wrap document text in a data envelope before it reaches a model prompt.
- No merits prediction, no win percentage, no "strong claim". Traffic lights describe evidence support for one point, nothing else.
- A working URL is not a citation. The retrieved passage must actually address the proposition, or the assertion is withheld with an explanation.
