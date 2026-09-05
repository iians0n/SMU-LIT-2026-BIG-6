# Filled CJTS Entry Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a six-page, accurately populated CJTS entry-guide PDF that users can follow while completing the live CJTS form themselves.

**Architecture:** A pure mapping module converts the case record and reviewed workflow into a typed, source-aware guide model. A separate fixed-layout PDF renderer consumes only that model; the export route and preparation UI expose it without changing the existing preparation, verification, or referral exports.

**Tech Stack:** TypeScript 5.9, Next.js 16.3 Route Handlers, React 19, the repository's dependency-free PDF writer conventions, Vitest, pdfjs-dist, Poppler for visual QA.

**Spec:** `docs/superpowers/specs/2026-09-05-cjts-filled-entry-guide-design.md`

## Global Constraints

- Treat `/Users/clarencechoo/Downloads/CJTS.pdf` only as a visual reference; never copy its browser chrome, captured identity, redactions, URL, timestamp, or session data.
- Generate a clean Casepath-branded preparation guide, not an official court-issued form.
- Never populate the pre-filing reference, videoconference consent, signature, filing number, or any ambiguous value.
- Preserve `pack`, `verification`, and `referral` export behavior.
- Keep export responses private with `Cache-Control: no-store`; write no user-generated guide to server disk.
- Keep the claim summary at or below 500 characters and stop on a word boundary.
- The six-page PDF must be A4, readable, unclipped, and visibly labeled `Preparation guide - not filed or submitted` on every page.

---

### Task 1: Typed CJTS guide mapping

**Files:**
- Create: `lib/cjts/entry-guide.ts`
- Create: `lib/cjts/entry-guide.test.ts`

**Interfaces:**
- Consumes: `CaseRecord`, dashboard `Case`, `Workflow`, and `deriveForm(record)`.
- Produces: `buildCjtsEntryGuide(record: CaseRecord, view: Case, workflow: Workflow): CjtsEntryGuide`.
- Produces helpers `parseContact(value: string | null): ParsedContact`, `parseSingaporeAddress(value: string | null, inSingapore: boolean | null): ParsedAddress`, and `summariseForCjts(value: string, max?: number): string`.

- [ ] **Step 1: Write failing mapping tests**

Cover a complete case, missing/CJTS-only fields, conservative phone/email parsing, Singapore address parsing, ambiguous-value rejection, exact dates, money-order selection, usable-document filtering, source page references, and a 500-character word-boundary summary.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx --test lib/cjts/entry-guide.test.ts`  
Expected: FAIL because `lib/cjts/entry-guide.ts` does not exist.

- [ ] **Step 3: Implement the pure mapper**

Define every rendered value as:

```ts
export interface GuideValue {
  value: string | null;
  status: "filled" | "missing" | "cjts_only";
  sourceRefs: SourceRef[];
}
```

Define structured claimant/respondent identity, contact, address, claim particulars, supporting documents, selected orders, warnings, and final checklist. Use exact fact kinds and `deriveForm` values; do not let the renderer infer from raw facts.

- [ ] **Step 4: Run the focused test and verify pass**

Run: `npx tsx --test lib/cjts/entry-guide.test.ts`  
Expected: all mapping tests PASS.

- [ ] **Step 5: Commit the mapping layer**

```bash
git add lib/cjts/entry-guide.ts lib/cjts/entry-guide.test.ts
git commit -m "Add typed CJTS entry guide mapping"
```

---

### Task 2: Fixed six-page PDF renderer

**Files:**
- Create: `lib/export/cjts-entry-guide-pdf.ts`
- Create: `lib/export/cjts-entry-guide-pdf.test.ts`

**Interfaces:**
- Consumes: `CjtsEntryGuide` from Task 1.
- Produces: `buildCjtsEntryGuidePdf(guide: CjtsEntryGuide): Uint8Array`.

- [ ] **Step 1: Write failing renderer tests**

Use pdfjs-dist to assert PDF validity, exactly six A4 pages, the prescribed page headings, representative filled values, explicit `ENTER ON CJTS` and `ISSUED BY CJTS` prompts, and the non-filing notice on every page. Assert captured-source residue is absent: `ONG JUN QUAN`, `828769`, `PUNGGOL WALK`, `05/09/2026, 22:10`, and `cjts.judiciary.gov.sg/claims/formOne`.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx --test lib/export/cjts-entry-guide-pdf.test.ts`  
Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement an isolated fixed-layout writer**

Build a minimal A4 PDF renderer with Helvetica, Helvetica-Bold, colored section bands, bordered value boxes, checkboxes, wrapping, and a footer on each page. The renderer creates exactly one explicit content stream per page and uses the typed guide model only.

Page methods are explicit and independently readable:

```ts
renderIntroduction(page, guide);
renderClaimant(page, guide);
renderRespondent(page, guide);
renderClaim(page, guide);
renderDocumentsAndOrders(page, guide);
renderFinalChecklist(page, guide);
```

- [ ] **Step 4: Run the focused test and verify pass**

Run: `npx tsx --test lib/export/cjts-entry-guide-pdf.test.ts`  
Expected: all renderer tests PASS.

- [ ] **Step 5: Commit the renderer**

```bash
git add lib/export/cjts-entry-guide-pdf.ts lib/export/cjts-entry-guide-pdf.test.ts
git commit -m "Render six-page CJTS entry guide"
```

---

### Task 3: Export API integration

**Files:**
- Modify: `app/api/export/route.ts`
- Modify: `tests/api.test.ts`

**Interfaces:**
- Consumes: `buildCjtsEntryGuide(...)` and `buildCjtsEntryGuidePdf(...)`.
- Extends request kind to `"pack" | "verification" | "referral" | "cjts-guide"`.
- Returns filename `casepath-cjts-entry-guide-v{version}.pdf` for the new kind.

- [ ] **Step 1: Add a failing API test**

Request `kind: "cjts-guide"`; assert status 200, PDF content type, the exact filename, no-store headers, six readable pages, mapped fixture values, and an export verification event whose description is `Downloaded filled CJTS entry guide; filing status unchanged`.

- [ ] **Step 2: Run the API test and verify failure**

Run: `npx vitest run tests/api.test.ts`  
Expected: FAIL because the Zod enum rejects `cjts-guide`.

- [ ] **Step 3: Integrate the new export kind**

Branch explicitly in the handler: use the CJTS mapper/renderer only for `cjts-guide`; continue using `buildCasePdf` for all existing kinds. Keep session, version, ownership, response-security, and verification behavior unchanged.

- [ ] **Step 4: Run API and regression tests**

Run: `npx vitest run tests/api.test.ts`  
Expected: PASS, including all existing export tests.

- [ ] **Step 5: Commit API integration**

```bash
git add app/api/export/route.ts tests/api.test.ts
git commit -m "Expose filled CJTS guide export"
```

---

### Task 4: Preparation-page handoff UX

**Files:**
- Modify: `app/prepare/page.tsx`
- Modify only if required: `app/globals.css`

**Interfaces:**
- Calls existing `/api/export` with `kind: "cjts-guide"`.
- Preserves existing `pack`, `verification`, and `referral` downloads.

- [ ] **Step 1: Add structural assertions for the download controls**

Extend the existing scenario/UI source assertions to require the primary text `Download filled CJTS entry guide`, a secondary `Detailed preparation PDF`, and the `cjts-guide` request kind.

- [ ] **Step 2: Run the focused assertion and verify failure**

Run: `npx vitest run tests/scenarios.test.ts`  
Expected: FAIL because the new primary action is absent.

- [ ] **Step 3: Update the current simplified preparation UI**

Extend `download` to accept `cjts-guide`. Make it the primary button and describe it as a copy guide for the current CJTS website. Move the existing pack button into **Other PDF options** as `Detailed preparation PDF`. Disable only the CJTS guide while gaps have not been acknowledged or the draft is stale; keep other exports available.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npx vitest run tests/scenarios.test.ts && npm run typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit the UI**

```bash
git add app/prepare/page.tsx app/globals.css tests/scenarios.test.ts
git commit -m "Add filled CJTS guide download"
```

---

### Task 5: Full verification and visual QA

**Files:**
- Modify if defects are found: files from Tasks 1-4
- Do not commit: `tmp/pdfs/`

**Interfaces:**
- Verifies the complete feature and all existing workflows.

- [ ] **Step 1: Run all static and automated checks**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Generate a representative CJTS guide**

Use the demo fixture through the mapper and renderer, writing only a temporary file under `tmp/pdfs/cjts-guide/`.

- [ ] **Step 3: Validate logical PDF structure**

Use `pdfinfo` and pdfjs extraction to confirm six A4 pages, expected values, all notices, and absence of captured-source residue.

- [ ] **Step 4: Render and visually inspect every page**

Run `pdftoppm -png` and inspect a six-page contact sheet. Confirm no clipping, overlap, illegible text, missing page sections, false selections, or branding that suggests court issuance.

- [ ] **Step 5: Fix any defects and rerun affected checks**

Apply the smallest scoped fix, rerun its focused test, then repeat the full commands from Step 1.

- [ ] **Step 6: Commit final verification fixes**

```bash
git add <only feature files changed by verification>
git commit -m "Polish CJTS guide output"
```

- [ ] **Step 7: Confirm repository state**

Run `git status --short --branch` and verify pre-existing untracked demo-pack files remain separate from feature commits.
