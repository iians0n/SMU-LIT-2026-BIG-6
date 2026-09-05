# Clarence — Dashboard, Route Screening, Drafting, and Handoff

**Your half in one line:** the shell the whole product lives in, plus everything downstream of the confirmed case record — what route applies, what to do next, what gets drafted, and what leaves the tool.

Read [SHARED-CONTRACT.md](SHARED-CONTRACT.md) first. It defines the types, the API seam, and the staleness rule. Anson's half is in [anson.md](anson.md).

---

## 1. Scope

**You own:** the app shell + stage navigation + overview + progress model · the design system · FR06 route screening · FR07 options and next actions · FR08 editable drafts and CJTS handoff · FR09 grounding and source library · FR11 verification record and referral

**Journey stages (PRD §3):** 5 Choose a next step · 6 Prepare and hand off — plus the dashboard frame that stages 1–4 render inside.

**You do not own:** voice/text intake, upload and OCR, the chronology, the evidence matrix, the contradiction detector. Those are Anson's, and they render inside your shell.

**Your unblock:** you consume `fixtures/case.demo.json` from Hour 0 and never wait for Anson's pipeline. When his real output lands at M2 it should replace the fixture with **zero changes to your code**. If it doesn't, the contract was wrong and we fix the contract, not your components.

---

## 2. Your build order

Mapped to the PRD's M1–M5 (§10).

### M1 — Shell and sources  ← your heaviest early milestone
- **App shell first**, because Anson's four screens need somewhere to live: persistent stage nav (desktop), current-action-first layout (mobile), contextual assistant panel, source viewer panel.
- `components/ui/` — the primitives both of us use. Badge, status pill, card, panel, empty state, error state. **Every badge takes a text label as a required prop.** Colour is supplementary; make it structurally impossible to ship a colour-only indicator.
- Stage states: Not started · In progress · Needs review · Reviewed. Progress counts *completed preparation tasks*, never litigation prospects. An export does **not** mark a case as filed.
- The **source library** (`lib/retrieval/`): each entry stores URL, the relevant passage, version or retrieval date, and last review date. Seed from PRD §11 — S2 eligibility, S3 filing, S4 process overview, S5 SCT AI summaries, S6 GenAI guide.
- Versioned **route rules** (`lib/rules/rules.v1.ts`) — see FR06 below.

### M2 — Dashboard and screening
- Overview page reading the fixture: current stage · next action · unresolved questions · document processing status · upcoming tasks.
- FR06 route screening against the rules.
- Swap the fixture for Anson's live `/api/case` and confirm nothing else changes.

### M3 — Options and tasks
- FR07 options and next actions, FR09 grounding enforcement, FR11 verification store.

### M4 — Drafting and handoff  ← your heaviest late milestone
- FR08 drafts, worksheet, export, CJTS checklist.
- Exit condition: no invented required values, and a fact change invalidates stale outputs.

### M5 — Evaluation
- Own test scenarios 4, 6, 7b (§6). Rehearse the second half of the demo, including the unsupported-case referral.

---

## 3. The work, requirement by requirement

### FR06 — Preliminary route screening
**Deterministic rules, not a model.** The model extracts inputs and explains results; the rules decide. Store them versioned in `lib/rules/rules.v1.ts`.

Inputs: claim type · amount · relevant dates · respondent location · exceptional circumstances.

Rules per current official guidance (S2) — S$20,000 limit, potentially S$30,000 with **both parties' consent**, two-year filing period from the event creating the cause of action, plus claim category and service in Singapore.

Three outcomes, each with reasons and official links: **Appears within supported route** · **More information needed** · **Outside supported route**.

Hard constraints:
- A route match is **not** a merits conclusion. Say so on the screen, not in a tooltip.
- Uncertainty about the relevant event date stays visible — never resolve it to make the rule fire.
- The tool never auto-reduces a claim to fit, never assumes consent, never invents a deadline.
- The official CJTS pre-filing assessment is itself not conclusive — reflect that in the copy.

*Acceptance:* S$25,000 without confirmed consent → conditional result, not a yes and not a no. Unsupported category → referral plus an exportable facts summary.

### FR07 — Options and next actions
Four neutral options: gather more information · explore settlement · obtain appropriate help · prepare to file (where supported). Prerequisites and tradeoffs stated plainly. **The user picks** — you never preselect the path that happens to be most demoable.

Each task carries: purpose · source · required material · dependency · completion status.

If a source is unavailable or outdated, show that limitation **before** the instruction, not after.

### FR08 — Editable drafts and CJTS handoff
Produce: claim summary · chronology · evidence index · amount calculation · worksheet of proposed field values.

- **Every material statement and populated field links to a confirmed fact or document.** Enforce this in the drafting service, not by convention — a field with no `sourceRef` cannot render.
- Missing required inputs **stay blank** and get listed. Never guess to make the draft look complete.
- Amount calculation is deterministic arithmetic over confirmed facts. No model in that path.
- Retrieved official templates keep source, version, and review date.
- **Never fabricate** an official form, signature, declaration, or assessment ID.
- Consume Anson's `GET /api/case/contradictions` — the draft must reflect uncertainty (FR10's drafting half). Refuse requests to strengthen evidence or misrepresent a document.
- Keep the preparation analysis and unresolved issues **separate** from the clean narrative intended for transfer — and never let that omission make the narrative misleading (FR11).
- The **CJTS handoff checklist** (S3): pre-filing assessment ID, parties' details, claim summary, supporting PDFs; conditionally an ACRA profile for a business respondent and a Memorandum of Consent. Filing, service, and the Declaration of Service are separate later steps — show them, do not track them in P0.
- **Reviewed for transfer** label requires review of every populated field plus acknowledgement of remaining gaps. It never promises court acceptance. The user logs into CJTS, checks current fields, submits and pays there.

*Acceptance:* a material fact change invalidates affected draft fields (staleness, SHARED-CONTRACT §4). Users can edit, preview and download with unresolved items clearly marked.

### FR09 — Grounding and uncertainty
The rule: **before displaying any legal or procedural assertion, a retrieved passage must actually address the proposition.** No passage → the assertion is withheld, with an explanation and a useful next step.

- A valid URL alone establishes nothing. Check the passage content, not just that the link resolves.
- Store and display factual extraction, procedural information, and unresolved legal interpretation as three separate things.
- P0 avoids open-ended case-law generation entirely.
- A second model agreeing is **not** an independent source check.

Implement as a validation gate in the render path, so an ungrounded assertion cannot reach the DOM even if a model produces one.

### FR11 — Review record and appropriate help
- Retain: which paragraphs were AI drafted · the facts and sources used · user corrections · review timestamps.
- Export a **separate verification record** for the user's own reference. Anson appends events from his pipeline via `POST /api/verification`; you own the store and the export.
- Grounded in S6: responsibility for submitted content sits with the court user. They should be able to identify AI-assisted portions and explain their verification.
- **Referral:** when the matter exceeds supported scope or needs legal judgment, explain the boundary and offer official help links plus a concise handoff brief — confirmed account, files, uncertainties, specific questions. Never represent referral as guaranteed access to assistance.

---

## 4. Your files

```
app/layout.tsx                 shell, stage nav, assistant + source panels
app/page.tsx                   overview / dashboard
app/route/                     FR06 screening result
app/options/                   FR07 options and task checklist
app/prepare/                   FR08 draft editor, worksheet, export
app/api/route/
app/api/tasks/
app/api/drafts/
app/api/export/
app/api/sources/
app/api/verification/
components/ui/                 design system — you own it, both of us use it
components/drafts/
lib/rules/rules.v1.ts          versioned route rules
lib/retrieval/                 source library + grounding gate
lib/drafting/                  draft assembly, amount calc, worksheet
fixtures/sources/              official passages with retrieval dates
```

Shared, do not edit alone: `lib/contracts/`, `lib/store/`.
Never edit: `app/intake/`, `app/documents/`, `app/chronology/`, `app/evidence/`, `lib/processing/`, `lib/planner/`, `lib/assessment/`.

---

## 5. What you need from Anson, and when

| You need | By | If it slips |
| --- | --- | --- |
| `fixtures/case.demo.json` | Hour 0 | **Hard block.** Escalate the same day — write a throwaway one yourself rather than wait |
| `GET /api/case` live | M2 end | Keep reading the fixture; the swap is a one-line change |
| `GET /api/case/contradictions` | M4 | Draft guardrail ships without it, wire on arrival |
| `case.version` bumping correctly | M4 | Staleness silently never fires — test this explicitly, do not assume |

Everything in M1 is yours alone. You are only blocked from M2 onward, and only by the fixture.

---

## 6. Test scenarios you own (PRD §9)

- **4 — Scope and rule boundaries.** Amounts either side of each configured threshold, an uncertain start date, an overseas respondent, an unsupported claim category.
- **5 — Change propagation (your half).** Anson bumps the version; your summaries, totals, tasks and drafts all go to Needs review.
- **6 — Grounding failure (your half).** A stale source and a nonexistent citation must never produce unqualified guidance.
- **7 — Recovery (your half).** Export retry, keyboard-only path through every critical screen, and a second account requesting the first account's files.

Accessibility is disproportionately yours because you own the primitives: keyboard navigation, screen reader labels, readable error messages, every critical path working without audio or colour.

---

## 7. Demo (PRD §10) — you drive the second half

Anson hands over at "choose preparation for filing". You then: review the draft and the amount calculation → export the pack → walk the CJTS handoff checklist including the later service tasks → **repeat briefly with an unsupported case to show a useful referral.**

That last beat is yours alone and it is what demonstrates the product knows its own boundary. Do not cut it for time.

---

## 8. Traps specific to your half

- The shell is on the critical path for both of us. Ship something crude on day one and refine it — do not perfect it in isolation while Anson has nowhere to render.
- The grounding gate is easier to build before there is content than to retrofit after. Build it in M1 with the source library.
- Staleness only works if you actually compare versions on render. It is invisible when broken, so write the test at M2, not M4.
- Resist making the draft look finished. Blank required fields with an explicit list is the correct output, and the judges are looking for exactly that.
