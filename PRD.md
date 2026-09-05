# Small Claims Preparation Dashboard

Product Requirements Document

Version 0.1 | 5 September 2026 | SMU LIT Legal Tech Hackathon | Track 4 Ministry of Law

## 1 Product definition and challenge fit

Build an AI assisted dashboard that helps self-represented people turn an incomplete account of a dispute and an unordered collection of documents into a clear, reviewable Small Claims Tribunals case preparation pack. Users can speak or type, receive targeted follow-up questions, confirm the facts, inspect evidence against relevant issues, compare next steps, and prepare editable filing materials.

The dashboard gives users a bird's eye view of their progress and one clear next action. The assistant works within that dashboard, so the case remains understandable without rereading a long conversation.

**Product promise:** Understand what happened, what supports your account, what remains uncertain, and what you can do next.

### The problem we are solving

People preparing a claim may not know which facts matter, how to organise their documents, or how to navigate the process. A fluent AI response can reinforce their initial assumptions and make an incomplete account look authoritative. Track 4 asks for interactive support for SCT pre-filing and case preparation that addresses hallucinations, confirmation bias, and responsible GenAI use. [S1]

### Product goals

- Reduce the effort required to organise a dispute into a chronology, issues, supporting materials, and missing information.
- Help users recognise uncertainty, contradictory evidence, and the other party's possible account before deciding what to do.
- Make each suggested procedural step traceable to an official source.
- Produce editable preparation materials that users can inspect and correct before using them outside the tool.

### Positioning and boundaries

The first release supports individuals considering an SCT claim arising from goods or services. Other SCT categories and respondent preparation are later extensions. General civil litigation, employment, criminal and family matters are outside the first release.

CJTS already provides AI summaries for active SCT cases. The proposed distinction is the preparation workflow: guided intake, evidence gaps, fact confirmation, and an actionable overview before filing. This is a positioning hypothesis to test with users, not a claim that every feature is unique. [S5]

The traffic lights describe evidence support for individual issues. The product does not give a percentage chance of winning or label an entire claim as strong based on the number of uploaded files. Case-specific legal merits opinions would require a separately validated service design and qualified review.

## 2 Users and release scope

### Primary user and jobs to be done

The primary user is an individual without legal training preparing a potential goods or services claim. They may be distressed, unsure of dates, and working from phone screenshots, receipts, and memory. They remain the author and decision-maker for their claim.

Their core jobs are: explain the problem in ordinary language; discover what else matters; check that the tool understood; see which statements have support; and leave knowing the next practical step. Assisted use with a trusted helper is a later opportunity; the MVP has one case owner and no shared accounts.

### Scope by priority

| Priority | Included capabilities | Boundary |
| --- | --- | --- |
| P0 Hackathon MVP | English voice and text intake; adaptive questions; mixed document upload and OCR; confirmed chronology; issue and evidence matrix; route screening; step checklist; editable preparation pack | One claimant workflow for goods or services; synthetic demo cases; user transfers information to CJTS |
| P1 Pilot expansion | Respondent preparation; more SCT case categories; multilingual intake with translation review; resumable accounts; consultation preparation and reminders | Requires category specific content and evaluation before release |
| P2 Later integration | Reviewed official form adapters; supported portal integration; user controlled sharing; case status synchronisation | Depends on verified permissions, technical interfaces, and operational support |

P0 includes a draft field worksheet aligned to publicly documented CJTS information requirements. Prefilling an official downloadable form is included only where its current template and fields have been verified. It does not depend on a CJTS API or automatic browser interaction.

### Explicit non goals

- Autonomous filing, payment, signing, service of documents, or contacting the other party.
- Generating or altering evidence, certifying authenticity, or deciding admissibility.
- Open-ended legal research, invented authorities, or automated litigation strategy.
- Treating all contract disputes as eligible for SCT or silently changing a claim amount to fit a route.
- A full case management system for hearings, appeals, or enforcement in P0.

### Working assumptions

The initial product is a responsive web application for one case at a time. Proposed upload limits are 20 files per case, 20 MB per file, and 100 pages in total. P0 accepts PDF, DOCX, JPG, PNG, and TXT. Other file types stay visibly unsupported; the interface never implies that arbitrary uploads were successfully read. These are product defaults for team review, not external filing limits.

## 3 User journey and dashboard

### End to end preparation journey

| Stage | User experience | Result and progression condition |
| --- | --- | --- |
| 1 Explain | Speak or type what happened and what outcome is wanted | Editable account; early checks for scope and urgency |
| 2 Clarify and upload | Answer focused questions; add files in any order and at any stage | Extracted facts, document inventory, missing information |
| 3 Confirm | Review people, dates, amounts, events, and conflicting accounts | Versioned factual record with confirmed and unresolved items |
| 4 Review support | Inspect issues, evidence, gaps, and possible objections | Explained support indicators and prioritised follow-ups |
| 5 Choose a next step | Consider gathering information, settlement, help, or preparing to file | User selected route with its assumptions and prerequisites |
| 6 Prepare and hand off | Edit the draft and compare it with sources | Downloadable pack, field worksheet, official links, final review |

The flow is iterative. New evidence can change earlier facts, issue support, and the next step. Early screening runs during intake to avoid making users complete an irrelevant workflow; it does not force a final classification before enough facts are available.

### Dashboard layout

Desktop uses persistent stage navigation, a central case workspace, and a contextual assistant beside it. Mobile places the current action first, with the assistant and source viewer opening as separate panels.

The overview contains the current stage, next action, unresolved questions, document processing status, and upcoming tasks. A chronology shows events with source links. The evidence workspace maps issues to facts and files. The preparation area holds the draft, checklist, and export controls. Every badge has a text label and explanation; colour is supplementary.

The full roadmap also shows filing and service, online dispute resolution, consultation, and a possible hearing as later stages, with official links. These stages reflect the published SCT process. P0 shows them for orientation and does not track their completion automatically. [S4]

### Progress and recovery

Stages use Not started, In progress, Needs review, or Reviewed. Progress measures completed preparation tasks, never litigation prospects. An export does not mark a case as filed. The app preserves edits within the active session, shows processing failures per file, and supports retry without losing successful uploads. Pilot accounts add secure cross-session recovery.

## 4 Intake and fact confirmation requirements

### FR01 Voice and text intake

The user can start, pause, stop, and review a voice transcript, or use text throughout. Explain recording and processing before activation. Names, dates, and amounts receive explicit confirmation. Raw audio is transient by default and is removed after transcript confirmation; the retained transcript remains editable.

**Acceptance:** Denied microphone permission offers text immediately. A misheard amount can be corrected before entering the confirmed case record. The interface distinguishes the user's spoken account from the AI's summary.

### FR02 Adaptive questioning

The assistant maintains an unresolved information list covering parties, agreement, promised performance, events, payment, loss, attempted resolution, response from the other party, and desired outcome. Ask one main question at a time, explain why it matters, and allow I do not know or Skip for now. Reuse information already available in files.

Questions must test the initial account, such as whether a deadline changed or part of the work was completed. They must not suggest a favourable answer. Stop questioning when material fields are confirmed or explicitly unresolved and offer the summary for review; do not trap the user in an endless interview.

**Acceptance:** A missing delivery date triggers a focused question. An already confirmed payment is not repeatedly requested. A possible changed deadline triggers a neutral question about what both parties agreed.

### FR03 Document intake

Accept supported files without requiring users to sort or determine relevance. Preserve originals, extract text and OCR where needed, identify duplicates, propose labels, and link excerpts to original pages or image regions. Mark unreadable, password-protected, truncated, unsupported, and possibly unrelated material visibly. Users can retry, replace, retain, or remove files.

**Acceptance:** Upload order does not change the set of extracted events. A blurry scan produces an uncertainty flag, not invented text. Removing a file marks dependent facts and outputs for review.

### FR04 Confirmed case record

Show a plain-language summary and editable timeline. Each material fact records its source and status: user stated, document extracted, inferred, user confirmed, disputed, or unknown. Multiple statuses may coexist. A user confirming their own recollection does not turn it into independent corroboration.

**Acceptance:** Conflicting dates remain visible until addressed. Confirmation creates a versioned record. Changing a material fact marks affected analysis and drafts as stale; unsupported assumptions cannot silently enter the final pack.

## 5 Issue and evidence assessment

### FR05 Mapping facts to issues

Use a reviewed issue checklist appropriate to the supported claim category. For a goods or services contract dispute, the preparation checklist can cover the agreement and terms, each party's performance, alleged failure, claimed loss and requested remedy, and possible contrary explanations. This is a proposed product checklist; it must be legally reviewed before being presented as the applicable legal elements.

Every row shows the issue in ordinary language, linked facts, supporting evidence, conflicting evidence, support status, why it received that status, and the next useful question. Users can open the source excerpt without leaving the row. Model extraction confidence and evidence support are separate concepts.

### Support indicators

| Status | Meaning | Required response |
| --- | --- | --- |
| Green with Supported label | Identified material directly supports the specific factual point, with no detected material conflict | Explain the link and let the user inspect it; do not certify truth or legal sufficiency |
| Amber with Partial or disputed label | Support is incomplete, indirect, ambiguous, or contradicted | Show the gap and any conflicting material together |
| Red with Support missing label | No supporting material has been identified for the point | Ask what records or recollection may help; do not equate absence with a false claim |
| Grey with Not assessed label | Processing failed, information is insufficient to assess, or the issue is outside supported scope | Explain the limitation and next step |

### Illustrative service dispute

This fictional example demonstrates the UI. It is not a merits assessment or a statement of a complete legal test.

| Issue | Facts asserted | Evidence available | Status and next question |
| --- | --- | --- | --- |
| Agreed work | Supplier accepted a S$2,000 repair job | Accepted quote D1 page 1 | Green for scope and price; confirm parties |
| Payment | Customer paid S$2,000 | Receipt D2 page 1 | Green for recorded payment; confirm recipient |
| Completion date | Work was due on 15 July | Quote D1; chat D3 suggests an extension | Amber; was a later date agreed? |
| Additional loss | Customer claims S$500 extra expense | User account only | Red for documentary support; what expense and records exist? |

**Acceptance:** A contradictory chat prevents an unqualified green status on the deadline. Adding a duplicate receipt does not improve support. Every assessment includes possible contrary explanations or states that none were identified in the reviewed material; it never invents the other party's position.

## 6 Route guidance and filing preparation

### FR06 Preliminary route screening

Use maintained rules for procedural screening, with language models helping to extract inputs and explain results. Collect claim type, amount, relevant dates, respondent location, and exceptional circumstances. Show Appears within supported route, More information needed, or Outside supported route, with reasons and official links. A route match is not a merits conclusion.

The current official guidance describes a S$20,000 limit, potentially S$30,000 with both parties' consent, and a two-year filing period from the event creating the cause of action. Claim category and service in Singapore also matter. The official CJTS pre-filing assessment itself is not conclusive. Store these as versioned rules; uncertainty about the relevant event date must remain visible. [S2]

**Acceptance:** A S$25,000 example without confirmed consent produces a conditional result. An unsupported category produces a referral and exportable facts summary. The tool does not automatically reduce the claim, assume consent, or invent a deadline.

### FR07 Options and next actions

Present gathering more information, exploring settlement, obtaining appropriate help, and preparing to file where supported. Explain prerequisites and tradeoffs in neutral terms; the user selects the path. Each procedural task includes its purpose, source, required material, dependency, and completion status. If a source is unavailable or outdated, show that limitation before offering definitive instructions.

### FR08 Editable drafts and CJTS handoff

Official guidance requires filing through the Community Justice and Tribunals System, or CJTS. It identifies information such as the pre-filing assessment ID, parties' details, claim summary, and supporting PDFs. Conditional documents include a recent ACRA profile for a business respondent and a Memorandum of Consent where applicable. Filing, service, and the Declaration of Service are separate steps. [S3]

Prepare an editable claim summary, chronology, evidence index, amount calculation, and worksheet of proposed field values. Every material statement and populated field links to a confirmed fact or document. Missing required inputs stay blank and are listed. Retrieved official templates retain their source, version, and review date; the product never fabricates an official form, signature, declaration, or assessment ID.

**Acceptance:** A material fact change invalidates affected draft fields. Users can edit, preview, and download working drafts with unresolved items clearly marked. A Reviewed for transfer label requires review of all populated fields and acknowledgement of remaining gaps; it never promises court acceptance. The user logs into CJTS, checks the current fields, submits, and pays there.

## 7 Responsible AI and user control

The Courts' GenAI Guide places responsibility for submitted content on the court user. It calls for checking accuracy and authorities against reliable sources, prohibits fabrication or tampering with evidence, and addresses confidential information. Users should be able to identify AI-assisted portions and explain their verification; a pre-emptive AI declaration is not generally required unless the Court asks. Asking another AI to confirm an answer is insufficient verification. [S6]

The following are proposed product controls implementing those principles and Track 4's objectives. They are not a claim that the Court mandates this exact architecture.

### FR09 Grounding and uncertainty

Use a curated library of official procedural sources and reviewed issue checklists. For each source, retain its URL, relevant passage, version or retrieval date, and last review date. Separate factual extraction, procedural information, and unresolved legal interpretation in both storage and display.

Before displaying a legal or procedural assertion, require a supporting retrieved passage that actually addresses the proposition. Unsupported assertions are withheld with an explanation and a useful next step. A valid URL alone does not establish that a claim is supported. P0 avoids open-ended case-law generation.

### FR10 Balanced assessment

Before generating an issue review or narrative draft, check for inconsistent dates and amounts, partial performance, changed terms, refunds, settlement attempts, and material adverse documents in the supplied record. Show the specific source of any concern. Where more than one interpretation remains plausible, present the alternatives and the fact that would help distinguish them.

The assistant may improve clarity while retaining the meaning of the user's account. It must decline requests to invent receipts, strengthen evidence, or misrepresent what an uploaded document says. Source documents are untrusted content; instructions embedded within them cannot change tool behaviour or authorise external actions.

### FR11 Review record and appropriate help

Retain which paragraphs were AI drafted, the facts and sources used, user corrections, and review timestamps. Export a separate verification record for the user's reference. Keep the preparation analysis and unresolved issues separate from the clean narrative intended for possible transfer; omission from that narrative must never be used to make it misleading.

If the issue exceeds supported scope or needs legal judgment, explain the boundary and offer official help links plus a concise handoff brief containing the confirmed account, files, uncertainties, and specific questions. Do not represent referral as guaranteed access to assistance.

## 8 Data design and operational requirements

### Suggested system design

The web client handles voice, text, review, and source previews. A processing service performs transcription, parsing, and OCR into a structured case record. A question planner identifies missing or conflicting facts. A retrieval layer supplies approved content; a rule service handles procedural conditions and deterministic calculations. A drafting service builds outputs from the reviewed record. Validation runs before results reach the dashboard or export service.

Choose specific vendors after checking privacy controls, cost, and accuracy on the demo corpus. A second model's agreement is not an independent source check. Reuse a single structured record across modules so corrections propagate reliably.

| Record | Minimum information |
| --- | --- |
| Case and party | Owner, role, jurisdiction context, requested outcome, stage, record version |
| Document and excerpt | Original file reference, hash, processing status, page or region, extracted text |
| Fact and event | Value, date precision, origin, source links, confirmation and dispute states |
| Issue assessment | Checklist version, facts, supporting and conflicting excerpts, status, reason, next question |
| Task and draft field | Dependencies, official source, proposed value, review state, source case version |
| Verification event | AI contribution, user correction or review, timestamp, affected output |

### Privacy and reliability requirements

- Use synthetic documents for the hackathon. A real-data pilot requires a published retention policy, reviewed provider processing terms, access controls, and a deletion workflow.
- For a pilot, encrypt data in transit and at rest, isolate every case by owner, and keep case content out of analytics and ordinary application logs. Use provider settings or terms that prevent training on case content.
- Collect only needed identifiers; show redaction suggestions before external model processing. Preserve originals separately from any redacted working copies.
- Proposed pilot defaults are deletion after 30 days of inactivity and immediate user-requested removal from active storage, with disclosed backup expiry within 30 days. Deletion includes extracted text and search indexes. Final policy requires operational validation.
- Support keyboard navigation, screen reader labels, readable error messages, and all critical paths without audio or colour. Warn before data is lost at session expiry.
- Failures must retain completed work, identify affected files or sections, and provide retry. No module may silently substitute a confident answer when OCR or retrieval fails.

Proposed performance targets under a documented demo workload are a first response within five seconds and a ten-page mixed upload processed within 60 seconds at the 95th percentile. Measure actual results before making user-facing speed claims.

## 9 Success metrics and acceptance testing

### Product outcome measures

The primary measure is the proportion of test users who produce a correctly organised preparation pack and can explain the next step and the remaining uncertainties. Filing volume and win rate are not success proxies.

Pilot targets below are hypotheses, not measured results. Compare the same synthetic tasks against preparation using official guidance alone, using a predefined rubric and independent review.

| Measure | Proposed target | How it is checked |
| --- | --- | --- |
| End to end usability | At least 80% complete the main workflow without facilitator intervention | Moderated sessions with 8 to 12 representative users |
| User understanding | At least 80% identify the next action and explain why green is not a win prediction | Short comprehension questions after the task |
| Preparation quality | At least 90% of required facts and relevant evidence included or explicitly marked unresolved | Review against annotated case files |
| Traceability | All material generated factual and procedural statements have valid supporting references | Inspect references and whether their contents support each statement |
| Confirmation bias | Every seeded material contradiction is surfaced in the release suite | Adversarial cases with changed terms, refunds, and partial performance |
| Fabrication and leakage | Zero fabricated evidence, authorities, or cross-case disclosures in the release suite | Manual review plus deterministic access and output checks |

These are release gates for a finite test set, not guarantees about all future cases. Report denominators, failures, and rubric disagreements alongside scores.

### Mandatory test scenarios

1. Complete goods or services dispute: the user finishes intake, reviews facts, inspects evidence, and exports an editable pack with working references.
2. Missing and poor-quality evidence: no written contract, a blurry receipt, and uncertain dates remain visibly unresolved without blocking access to the summary.
3. Contradiction: a chat changes the alleged completion date; the matrix and draft reflect the uncertainty even when the user insists the case is obvious.
4. Scope and rule boundaries: test amounts around each configured threshold, an uncertain start date, an overseas respondent, and an unsupported claim category.
5. Change propagation: replace a document or correct a payment amount; affected summaries, totals, tasks, and drafts all require refreshed review.
6. Grounding failure and misuse: a stale source, nonexistent citation, evidence fabrication request, and document-based prompt injection never produce unqualified guidance or altered originals.
7. Recovery and access: denied microphone permission, partial upload failure, export retry, keyboard-only use, and a second account requesting the first account's files.

## 10 Delivery plan and demo

### Proposed build sequence

| Milestone | Deliverable | Exit condition |
| --- | --- | --- |
| M1 Scope and corpus | One reviewed goods or services checklist, versioned official sources, synthetic case and adverse variant | Expected facts, gaps, route results, and outputs annotated |
| M2 Intake and record | Voice or text entry, document extraction, adaptive questions, editable timeline | Corrections persist and each extracted fact links to a source |
| M3 Dashboard and assessment | Stage navigation, support matrix, contradiction review, next actions | Users can inspect support and understand unresolved issues |
| M4 Drafting and handoff | Editable pack, field worksheet, verification record, CJTS checklist | No invented required values; changes invalidate stale outputs |
| M5 Evaluation and presentation | Tested end to end demo and failure cases | Release suite passes and limitations are visible |

Dates and named owners depend on the team's capacity and hackathon schedule. Suggested responsibilities are product and UX, application engineering, document and AI processing, and legal content and evaluation; one person may cover several.

### Demonstration narrative

Use a fictional customer seeking a refund for incomplete repair work. Start with a short spoken account and upload a quote, receipt, and chat screenshots in an arbitrary order. The assistant identifies the parties and payment but asks about a missing completion date. The user confirms the chronology, then sees that the chat may record an extension.

Open the amber issue row, inspect the chat excerpt, and answer the follow-up. Show how the assessment changes without predicting the outcome. Choose preparation for filing, review the draft and amount calculation, and export the pack. End with the CJTS handoff checklist, including later service tasks. Repeat briefly with an unsupported case to demonstrate a useful referral.

### Decisions before a real-data pilot

- Confirm the first claim category and have a suitably qualified reviewer approve its issue checklist and route rules.
- Verify the current CJTS field names, constraints, and any downloadable form templates before claiming exact prefilling compatibility.
- Assign a content owner to review official sources before launch, at least monthly, and after a detected change; stale content requires revalidation before use.
- Test English speech recognition with local accents, ambiguous dates, and monetary amounts before prioritising more languages.
- Confirm hosting, model processing, retention, support arrangements, and access to appropriate referral resources.

## 11 Sources and interpretation

The feature priorities, architecture, upload limits, performance targets, and milestones are proposed product decisions. Procedural statements are grounded in the sources below, checked on 5 September 2026. Rules and portal fields must be revalidated when implemented.

**S1 Challenge brief.** User supplied Challenge Statements PDF, page 7, Problem Statement 4 Min Law. Establishes SCT pre-filing and case preparation, interactive guidance, hallucination reduction, confirmation bias, and alignment with the Courts' GenAI Guide. Requirements under other tracks have not been treated as Track 4 requirements.

**S2 Eligibility.** Singapore Courts, [Cases eligible for a small claim](https://www.judiciary.gov.sg/civil/cases-eligible-small-claim). Source for the limited procedural screening examples and the distinction between preliminary screening and a conclusive jurisdiction decision.

**S3 Filing.** Singapore Courts, [How to file and serve a small claim](https://www.judiciary.gov.sg/civil/how-to-file-serve-small-claim). Source for CJTS handoff, required information, supporting files, conditional documents, and separate service steps.

**S4 Process overview.** Singapore Courts, [File a small claim](https://www.judiciary.gov.sg/civil/file-small-claim). Source for the later-stage roadmap and official process orientation.

**S5 Existing AI feature.** Singapore Courts, [Guide to SCT AI generated summaries](https://www.judiciary.gov.sg/docs/default-source/civil-docs/guide-to-sct-ai-generated-summaries.pdf?sfvrsn=bc53fa8d_1). Establishes the existing CJTS case summarisation feature and informs product positioning.

**S6 Responsible use.** Singapore Courts, [Guide on the Use of Generative Artificial Intelligence Tools by Court Users](https://www.judiciary.gov.sg/docs/default-source/news-and-resources-docs/guide-on-the-use-of-generative-ai-tools-by-court-users.pdf?sfvrsn=3900c814_1), particularly paragraphs 3 and 5. Source for the responsibility, verification, evidence integrity, and confidentiality principles summarised in Section 7.
