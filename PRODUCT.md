# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People in Singapore preparing a small claim without legal representation. They may be distressed, unfamiliar with legal procedure, older, working on a phone, or starting from screenshots, receipts, incomplete documents, and memory.

## Product Purpose

Casepath helps a person explain what happened, organise mixed evidence, confirm extracted facts, see what each document supports or contradicts, understand possible next steps, and prepare an editable handoff pack. Success means the user can complete the preparation workflow, explain the next action and remaining uncertainties, and verify every material statement before using CJTS or seeking qualified help.

## Positioning

Casepath maintains one versioned, user-controlled case record that links each material fact and draft field back to its source. Corrections propagate through chronology, evidence review, tasks, and drafts while uncertainty and conflicting evidence stay visible.

## Operating Context

The main experience is a six-stage guided workflow: explain the account, add documents, confirm facts, review support, choose a next step, and prepare a handoff pack. Users work with receipts, photos, chat screenshots, statements, PDFs, and official Singapore Courts guidance. A worked synthetic bathroom-repair dispute demonstrates the workflow.

## Capabilities and Constraints

- The interface must use plain language and show one understandable decision at a time.
- The product organises information and explains procedure; it does not provide legal advice, predict outcomes, file a claim, fabricate evidence, or imply court acceptance.
- Filing remains in CJTS and requires the user to verify, submit, and pay there.
- Extracted facts, assessments, and draft fields retain provenance, review state, and source-case version.
- Missing, uncertain, disputed, stale, and unreadable information must remain visible and actionable.
- Critical paths must work without audio or colour and preserve completed work through recoverable failures.

## Brand Commitments

The product name is Casepath. Its voice is calm, direct, respectful, and specific: plain verbs, sentence case, no legal theatre, no motivational filler, and no claims that exceed the evidence.

## Evidence on Hand

- Product and legal-safety requirements: `PRD.md`
- Working routes and realistic interface copy: `app/` and `components/`
- Synthetic demonstration corpus: `fixtures/`
- Existing quiet-workspace reference: `public/design/quiet-workspace-reference.png`
- There are no approved testimonials, customer logos, measured outcome claims, or official-court brand assets; future work must not fabricate them.

## Product Principles

- Preserve user control: what the user confirms outranks an extraction.
- Make uncertainty legible instead of smoothing it away.
- Keep every material statement traceable to a source.
- Reduce cognitive load through guided progression and clear next actions.
- Earn trust through restraint, specificity, and honest boundaries.

## Accessibility & Inclusion

Support keyboard navigation, screen readers, visible focus, readable errors, large touch targets, text zoom, reduced motion, and critical meaning that does not depend on colour or audio. The guided path should remain comfortable for people who are stressed, older, or using a narrow mobile screen.
