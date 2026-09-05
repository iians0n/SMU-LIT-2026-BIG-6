# Anson — Intake, Case Record, and Evidence Assessment

**Your half in one line:** everything that turns a messy account and a pile of files into a *trusted, versioned case record* — and the evidence matrix that shows how well that record is supported.

Read [SHARED-CONTRACT.md](SHARED-CONTRACT.md) first. It defines the types, the API seam, and the staleness rule. Clarence's half is in [clarence.md](clarence.md).

---

## 1. Scope

**You own:** FR01 voice/text intake · FR02 adaptive questioning · FR03 document intake + OCR · FR04 confirmed case record · FR05 issue↔evidence mapping · FR10 contradiction detection engine

**Journey stages (PRD §3):** 1 Explain · 2 Clarify and upload · 3 Confirm · 4 Review support

**You do not own:** the app shell, stage navigation, the overview page, the design system, route screening rules, the official source library, drafts, export. Those are Clarence's. You render *inside* his shell.

**The handoff:** you produce the case record. Clarence's entire half is downstream of it. Which means the contract in §2 of SHARED-CONTRACT.md matters more to you than to him — if your output drifts from it, his work stops compiling.

---

## 2. Your build order

Mapped to the PRD's M1–M5 (§10).

### M1 — Corpus and checklist
- Write **`fixtures/case.demo.json`** — the contract-valid demo case (repair work, S$2,000 quote, receipt, chat suggesting an extension). This unblocks Clarence entirely, so it is your first deliverable, not a later one.
- Write **`fixtures/case.adverse.json`** — the same case with a seeded contradiction, a refund mention, and partial performance. This is what proves confirmation-bias handling in §9.
- Build the synthetic document set: quote PDF, receipt image, chat screenshots, one deliberately blurry scan, one password-protected file, one unrelated file.
- Draft the **goods/services issue checklist** (`lib/assessment/checklist.v1.ts`): agreement and terms, each party's performance, alleged failure, claimed loss and remedy, possible contrary explanations. Version it. Label it in the UI as a *preparation checklist pending legal review* — the PRD is explicit that it must not be presented as the applicable legal elements.
- Annotate expected facts and gaps per fixture. This is your test oracle for the rest of the build.

### M2 — Intake and record  ← your heaviest milestone
- FR01, FR02, FR03, FR04 (details in §3).
- Exit condition: corrections persist and every extracted fact links back to a source.

### M3 — Assessment
- FR05 evidence matrix, FR10 contradiction detector.
- Exit condition: a user can inspect support and understand what is unresolved.

### M4 — Support Clarence
- Your APIs are stable. `/api/case/contradictions` feeds his draft guardrail.
- Verify staleness: edit a fact, watch his draft flip to Needs review.

### M5 — Evaluation
- Own test scenarios 2, 3, 7a (§6). Rehearse the first half of the demo.

---

## 3. The work, requirement by requirement

### FR01 — Voice and text intake
Web Speech API for P0 (free, no vendor decision needed; swap for a hosted STT later if accuracy on local accents is poor — the PRD flags this as a pre-pilot decision).

- Start / pause / stop / review the transcript. Text entry works standalone at every point, not as a fallback bolted on.
- Explain recording and processing **before** the mic activates.
- Raw audio is transient — dropped after transcript confirmation. Keep the transcript editable.
- Names, dates and amounts get an explicit confirmation step. Do not let a misheard "fifteen hundred" into the record silently.
- Visually separate **the user's own words** from **the AI's summary of them**. Different container, labelled.

*Acceptance:* denied mic permission offers text immediately, with no dead end. A misheard amount is correctable before it enters the confirmed record.

### FR02 — Adaptive questioning
The question planner (`lib/planner/`) maintains an unresolved-information list: parties · agreement · promised performance · events · payment · loss · attempted resolution · other party's response · desired outcome.

- **One main question at a time**, each with a plain sentence on why it matters.
- Always offer *I don't know* and *Skip for now*. Both are recorded as explicit unresolved states, not silence.
- Reuse what the files already answered. Never ask for a payment that a receipt already established.
- Questions must **test** the account, not flatter it: "did the deadline change?", "was part of the work completed?". Neutrally phrased — never leading toward the answer that helps the user.
- **Terminate.** When material fields are confirmed or explicitly unresolved, stop and offer the summary. An endless interview is a failure mode the PRD calls out by name.

*Acceptance:* missing delivery date → focused question. Confirmed payment → never asked again. Possible changed deadline → a neutral question about what both parties agreed.

### FR03 — Document intake
- Accept in any order, at any stage. Never make the user sort or judge relevance first.
- PDF, DOCX, JPG, PNG, TXT. Limits: 20 files, 20 MB each, 100 pages total. Unsupported types stay **visibly** unsupported — the UI must never imply an arbitrary upload was read.
- Preserve originals. Extract text, OCR images, hash for duplicate detection, propose a label.
- Every excerpt anchors to a page or image region so the matrix can open the source in place.
- Flag visibly: unreadable · password-protected · truncated · unsupported · possibly unrelated.
- Retry / replace / retain / remove per file. A partial upload failure must not lose the successful ones.

*Acceptance:* upload order does not change the extracted event set (sort deterministically before extraction). A blurry scan yields an **uncertainty flag, not invented text** — this is the single most important line in your half of the build. Removing a file marks dependent facts and outputs for review.

### FR04 — Confirmed case record
- Plain-language summary + editable timeline.
- Each fact carries origin and status: user stated · document extracted · inferred · user confirmed · disputed · unknown. **Multiple statuses coexist** — model this as flags, not an enum.
- Confirming your own recollection is not corroboration. Keep `origin` and `confirmedByUser` separate and say so in the UI.
- Conflicting dates stay visible until addressed. Do not auto-resolve, do not pick the more recent one.
- Confirmation writes a version. Material change → `case.version++` (SHARED-CONTRACT §4). That one integer is your entire obligation to Clarence's staleness handling.

### FR05 — Issue and evidence matrix
The centrepiece screen. Each row: issue in ordinary language · linked facts · supporting evidence · **conflicting evidence** · support status · why it got that status · the next useful question.

- Four statuses with text labels: **Supported** (green) · **Partial or disputed** (amber) · **Support missing** (red) · **Not assessed** (grey). Label first, colour supplementary — the whole thing has to work in greyscale and on a screen reader.
- Open the source excerpt without leaving the row.
- **Duplicate evidence does not improve support.** Dedupe by hash before counting.
- Red means no supporting material identified. It never means the claim is false, and the copy must say so.
- Grey covers processing failure, insufficient info, and out-of-scope — three different explanations, so store the reason.
- Every assessment states possible contrary explanations, or says none were identified in the reviewed material. Never invent the other party's position.

### FR10 — Contradiction detection (engine side)
Before any issue review is generated, scan the record for: inconsistent dates · inconsistent amounts · partial performance · changed terms · refunds · settlement attempts · materially adverse documents.

- Each finding cites its specific source excerpt.
- Where two readings remain plausible, present both **and name the fact that would distinguish them**.
- Expose via `GET /api/case/contradictions`. Clarence's drafting service consumes it — this is the reason the seam exists.
- Refuse, at the extraction layer, to invent receipts, strengthen evidence, or misrepresent a document.
- **Prompt injection:** wrap all document text in a data envelope before it reaches a model. Instructions inside an uploaded PDF change nothing. Test scenario 6 attacks this directly.

---

## 4. Your files

```
app/intake/                    voice + text entry, question flow
app/documents/                 upload, processing status, per-file actions
app/chronology/                editable timeline, confirmation
app/evidence/                  issue↔evidence matrix, source viewer
app/api/intake/                transcription, question planner
app/api/documents/             upload, parse, OCR
app/api/case/                  facts, documents, issues, contradictions
components/intake/
components/evidence/
lib/processing/                parse, OCR, hash, dedupe, envelope
lib/planner/                   unresolved-info list, question selection
lib/assessment/                checklist v1, issue mapping, contradiction detector
fixtures/case.demo.json        yours to produce, Clarence's to consume
fixtures/case.adverse.json
fixtures/documents/
```

Shared, do not edit alone: `lib/contracts/`, `lib/store/`, `components/ui/`.

---

## 5. What you need from Clarence, and when

| You need | By | If it slips |
| --- | --- | --- |
| App shell + stage nav | Hour 0 + 1 day | Build your pages standalone at `/intake` etc., wire nav later |
| `components/ui/` primitives | M2 start | Use plain Tailwind, refactor once — do not build a second design system |
| `GET /api/sources` | M3 | Hardcode source refs, swap later |
| `POST /api/verification` | M3 | Buffer events in the store, flush later |

You are **not blocked by him for M1 or M2**. He is blocked by you for M2 onward — which is why `fixtures/case.demo.json` ships on day one.

---

## 6. Test scenarios you own (PRD §9)

- **2 — Missing and poor-quality evidence.** No written contract, blurry receipt, uncertain dates. All stay visibly unresolved *without blocking access to the summary*.
- **3 — Contradiction.** The chat changes the completion date. The matrix must show amber even when the user insists the case is obvious. This is the confirmation-bias gate.
- **5 — Change propagation (your half).** Replace a document, correct a payment amount → `case.version++` fires.
- **6 — Misuse (your half).** Fabrication request refused; document-embedded prompt injection changes nothing.
- **7 — Recovery (your half).** Denied mic permission, partial upload failure, retry without losing successful uploads.

---

## 7. Demo (PRD §10) — you drive the first half

Spoken account → uploads in arbitrary order → assistant identifies parties and payment but asks about the missing completion date → user confirms chronology → chat may record an extension → open the amber row, inspect the chat excerpt, answer the follow-up → **show the assessment change without predicting an outcome**.

Then hand to Clarence at "choose preparation for filing".

---

## 8. Traps specific to your half

- The pipeline is where hallucination enters the product. Every extracted value needs a source anchor or it does not get written.
- Amber is the demo's whole point. Resist any logic that resolves a contradiction automatically.
- `case.version++` on *material* changes only — bump it on a typo fix in a free-text note and you will have Clarence's drafts permanently stale.
- Test upload-order independence early. It is easy to break and embarrassing to discover live.
