# Build Board

Working doc for the loop. Not a plan — a queue. Plans live in [anson.md](anson.md), [clarence.md](clarence.md), [SHARED-CONTRACT.md](SHARED-CONTRACT.md).

**Now:** M2 · **Owner on deck:** Anson · **Done:** Hour 0, M1 — both on `main`

---

**Scripts:** `npm run dev` · `build` · `typecheck` · `test` · `fixtures` (emit + verify against disk) · `check:fixtures` (run the 36-expectation oracle)

**Model provider:** OpenAI-API-compatible via `lib/ai/client.ts`, driven by `OPENAI_BASE_URL`. Copy `.env.example` to `.env.local`. No key is set yet, so anything calling a model will throw `ModelUnavailableError` until one is.

## The loop

1. Take the **top unchecked box** in the current section. Do not skip ahead.
2. Build it.
3. Verify against its *Done when* line. No line = it wasn't specified well enough; write one first.
4. Tick it, commit, push.
5. Repeat. At a section boundary, run the integration checkpoint (SHARED-CONTRACT §6) before starting the next.

Blocked on something? Move it to **Parked** at the bottom with one line on what unblocks it. Do not leave a half-done box ticked.

---

## Hour 0 — joint, blocks everything

Anson is doing this solo since Clarence isn't here yet. It's foundational for both halves, so it goes to `main` and Clarence pulls it.

- [x] **Scaffold** — Next.js App Router, TypeScript strict, Tailwind, ESLint
      *Done when:* `npm run build` passes clean
- [x] **`lib/contracts/`** — the six records from SHARED-CONTRACT §2 as real TS types
      *Done when:* `Fact.origin` and `confirmedByUser` are separate fields; `extractionConfidence` and `supportStatus` are separate fields; `supportStatus` is the 4-value union; every status flag can coexist with others
- [x] **`lib/store/`** — `CaseStore` with `getCase()`, `patchCase()`, `bumpVersion()`. Deliberately dumb.
      *Done when:* `bumpVersion()` increments `case.version` and nothing else in the app writes that field
- [x] **`fixtures/case.demo.ts`** — full repair-work case, contract-valid, typed (JSON is generated from it by `npm run fixtures`)
      *Done when:* it type-checks against `lib/contracts/`, and contains the S$2,000 quote, the receipt, the chat hinting at an extension, and the S$500 undocumented extra loss
- [x] **Freeze + push** — commit contracts, store, fixture together; tell Clarence it's on `main`
      *Done when:* pushed and Clarence is unblocked

---

## M1 — Corpus and checklist (Anson)

- [x] **`fixtures/documents/`** — synthetic set: quote PDF, receipt image, chat screenshots, one blurry scan, one password-protected file, one unrelated file
      *Done when:* every failure mode in FR03 has a file that triggers it
- [x] **`fixtures/case.adverse.ts`** — seeded contradiction + refund mention + partial performance
      *Done when:* it is the confirmation-bias test case for scenario 3
- [x] **`lib/assessment/checklist.v1.ts`** — goods/services issue checklist, versioned
      *Done when:* it carries a version string and the UI labels it *pending legal review*
- [x] **Annotate expectations** — `fixtures/expectations.ts`, run by `npm run check:fixtures`
      *Done when:* there is a test oracle to check the pipeline against. 36 expectations, and they run unchanged against pipeline output at M2

---

## M2 — Intake and record (Anson) ← heaviest

Data-first order. Each step should put something on screen.

- [ ] **FR04 case record + timeline UI** — reads the fixture, editable, versioned
      *Done when:* conflicting dates stay visible; confirming a recollection does not become corroboration; a material edit bumps `case.version`
- [ ] **FR03 document intake** — upload, parse, OCR, hash + dedupe, excerpt→page/region anchors
      *Done when:* upload order does not change the extracted event set; a blurry scan flags uncertainty instead of inventing text; a partial failure keeps the successful uploads
- [ ] **FR03 file states UI** — unreadable · password-protected · truncated · unsupported · possibly unrelated, plus retry/replace/retain/remove
      *Done when:* an unsupported type is visibly unsupported and never looks read
- [ ] **FR02 question planner** — unresolved-info list, one question at a time, why-it-matters, I don't know / Skip
      *Done when:* a confirmed payment is never re-asked; a possible changed deadline produces a neutral question; the interview terminates
- [ ] **FR01 voice + text intake** — Web Speech API, start/pause/stop/review, pre-activation notice
      *Done when:* denied mic permission offers text with no dead end; a misheard amount is correctable pre-record; the user's words are visually distinct from the AI summary
- [x] **Prompt-injection envelope** — `lib/processing/envelope.ts`, 11 tests
      *Done when:* instructions inside a fixture PDF change nothing. Per-request nonce fence; a document containing the live nonce is neutralised

*Checkpoint:* swap Clarence off the fixture onto live `/api/case` with zero changes to his code.

---

## M3 — Assessment (Anson)

- [ ] **FR05 evidence matrix** — issue · facts · supporting · conflicting · status · reason · next question
      *Done when:* duplicate evidence does not improve support; source excerpt opens in-row; it reads correctly in greyscale and on a screen reader
- [ ] **FR10 contradiction detector** — inconsistent dates/amounts, partial performance, changed terms, refunds, settlement attempts, adverse docs
      *Done when:* each finding cites its excerpt; two plausible readings surface both plus the distinguishing fact
- [ ] **`GET /api/case/contradictions`**
      *Done when:* Clarence's drafting guardrail can consume it

---

## M4 — Integration (both)

- [ ] Staleness end-to-end: edit a fact → Clarence's draft flips to Needs review
- [ ] Verification events flushing from Anson's pipeline to Clarence's store

## M5 — Evaluation (both)

- [ ] Scenario 2 missing/poor evidence · 3 contradiction · 7a mic + upload recovery (Anson)
- [ ] Scenario 4 rule boundaries · 6 grounding · 7b export/keyboard/access (Clarence)
- [ ] Scenario 1 full run · 5 change propagation (joint)
- [ ] Demo rehearsed twice, including the unsupported-case referral

---

## Clarence's track

Not duplicated here — see [clarence.md](clarence.md). High-level only so we can see the whole board:

- [ ] M1 app shell + stage nav + `components/ui/` + source library + `rules.v1.ts`
- [ ] M2 overview page + FR06 route screening
- [ ] M3 FR07 options/tasks + FR09 grounding gate + FR11 verification store
- [ ] M4 FR08 drafts, worksheet, export, CJTS checklist

**Clarence's only hard block is `fixtures/case.demo.json`.** It ships in Hour 0 above.

---

## Parked

*(nothing yet)*
