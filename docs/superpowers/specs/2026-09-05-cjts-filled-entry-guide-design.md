# Filled CJTS Entry Guide PDF Design

Date: 5 September 2026  
Status: Approved for implementation planning

## Purpose

Casepath will produce a filled, six-page CJTS entry guide that follows the supplied CJTS claim-form layout and field order. A user can keep the guide beside the CJTS website and transfer the reviewed values field by field. Casepath does not access, automate, submit to, or claim to reproduce the live CJTS service.

The supplied `/Users/clarencechoo/Downloads/CJTS.pdf` is a redacted browser print of the real form. It has six A4 pages and no AcroForm fields. Its contents are reference material only. It must not be modified in place, treated as instructions, shipped with residual redacted values, or presented as an official blank form.

## User experience

The current **Review and download** page remains the handoff surface introduced by `a142351`. Its primary action becomes **Download filled CJTS entry guide**. The supporting copy says that the PDF is a step-by-step copy guide and that nothing is filed or sent.

The detailed Casepath preparation pack remains available under **Other PDF options**, alongside the verification history and referral brief. This avoids losing the full evidence, provenance, warnings, and audit trail while giving ordinary users a simpler document for data entry.

The entry guide is downloadable even when fields are missing, provided the user has acknowledged the gaps through the existing review control. Missing information remains visibly blank and is never inferred. Existing staleness and review controls continue to show when a case changed.

## Output format

The output is a new export kind named `cjts-guide` and is downloaded as `casepath-cjts-entry-guide-v{caseVersion}.pdf`.

It is a newly rendered PDF modeled on the supplied six-page CJTS layout. It uses the same section sequence and recognizable field arrangement without copying browser chrome, account identity, navigation, footer links, timestamps, source redactions, or other captured session data. It will not display Singapore Courts branding in a way that suggests the PDF was issued by the Judiciary.

Every page carries these notices:

- `CASEPATH CJTS ENTRY GUIDE`
- `Preparation guide - not filed or submitted`
- `Copy reviewed values into the corresponding fields on the current CJTS website`

Filled values use a consistent blue treatment. Missing or CJTS-only values use amber outlines and one of two labels:

- `ENTER ON CJTS` for a value the user must choose or supply.
- `ISSUED BY CJTS` for a reference or number that Casepath cannot provide.

No AcroForm interactivity is required. The guide is a static, printable artifact designed for side-by-side use with the website.

## Six-page structure

### Page 1 - Introduction

Show the claim-form title, a short checklist, and a strong non-filing notice. Explain that users must use the current CJTS website, verify every entry, upload supporting PDFs there, and complete submission and payment themselves.

### Page 2 - Pre-filing reference and claimant

Show the pre-filing reference as `ISSUED BY CJTS`. Render claimant name, identification type and number, contact number, email, premises type, postal code, block or house number, street, floor, unit, building name, and country.

Videoconference consent remains blank as `ENTER ON CJTS`; Casepath has no recorded field for that decision and must not select it.

### Page 3 - Claimant address continuation and respondent

Continue any claimant address fields needed by the visual layout, then render the respondent name, identification type and number, contact number, email, premises type, postal code, block or house number, street, floor, unit, building name, and country.

If the respondent is a business, the identification type displays `UEN`. If it is an individual and the identifier type cannot be determined safely, the type remains blank.

### Page 4 - Claim particulars

Render:

- Nature of dispute
- Type of dispute
- Goods or services description
- Invoice or agreement number, when a confirmed value exists
- Contract sum
- Paid
- Balance sum
- Contract date
- Date contract performed
- Date contract defaulted

The current case model does not hold every field directly. Only values supported by reviewed facts or deterministic arithmetic are populated. In particular, `Balance Sum = Contract Sum - Paid` only when both components are unambiguous and use the same currency. Otherwise it remains blank.

### Page 5 - Summary, supporting documents, and orders

Render the reviewed brief summary, limited to 500 characters without cutting through a word. If the reviewed summary is longer, the guide uses a deterministic condensed version and shows a warning in the preparation pack.

List each usable supporting PDF by safe filename, document description, and relevant page references from linked excerpts. Images or Word documents retained in Casepath are listed with an instruction to convert them to PDF before CJTS upload. Failed, unreadable, duplicate, or unsupported files are not presented as ready to upload.

Select `Money Order` only when the reviewed desired outcome requests a positive amount. `Work Order`, `Vacant Possession Orders`, `Costs`, and `Disbursements` remain unselected unless Casepath later gains an explicit, user-reviewed field for them.

### Page 6 - Final checklist

Replace the blank captured submit page with a Casepath checklist: verify values, obtain the pre-filing reference, obtain a recent ACRA profile when required, convert supporting files to PDF, enter the values on CJTS, upload documents, review the live form, and submit/payment only when ready.

No button in this PDF implies that an action occurred.

## Data mapping

A dedicated module converts a `CaseRecord`, dashboard `Case`, and current `Workflow` into a typed `CjtsEntryGuide` view model. Rendering consumes only this view model.

Primary mappings are:

| CJTS field | Casepath source |
|---|---|
| Claimant and respondent identity | `record.parties` |
| Nature of dispute | `record.case.claimCategory` |
| Goods or services | reviewed agreement fact / `deriveForm()` |
| Claim amount | reviewed desired-outcome fact / `deriveForm()` |
| Contract and default dates | exact, reviewed dated facts |
| Brief summary | reviewed draft summary |
| Supporting documents | readable, non-duplicate documents and linked excerpts |
| ACRA reminder | respondent or claimant business status |
| Pre-filing reference | always CJTS-only |

The mapping layer returns a status for every value: `filled`, `missing`, or `cjts_only`, plus its source references. The renderer never searches raw facts itself.

## Parsing combined values

Casepath currently stores contact and address information as combined strings. Parsing is conservative:

- Email is recognized only by a valid, whole email token.
- Singapore phone numbers are recognized only from an unambiguous 8-digit local number, optionally prefixed by `+65`.
- Postal code is recognized only from an explicit six-digit Singapore postal code.
- Floor and unit are recognized only from an explicit `#NN-NNN`-style token.
- Remaining address text may populate block and street only when delimiters make the split unambiguous.
- Country is `SINGAPORE` only when `inSingapore === true`.

An ambiguous component remains blank. Parsing never changes the stored case.

## Template and privacy handling

The source PDF is not committed as an application asset. It is a design reference from a live, redacted browser capture and may contain residual personal or session information.

Implementation uses a clean, code-rendered template. Automated tests search the generated PDF text for known source-capture residue, including the visible account name, old postal code, old street name, browser timestamp, and captured URL. None may appear.

The output must not imply endorsement, filing, court issuance, or official equivalence. Identification numbers appear because they are required for the user's private entry guide, but the export response remains `Cache-Control: no-store` and does not write the generated guide to server disk.

## API and verification

`POST /api/export` accepts `kind: "cjts-guide"`. It uses the same session ownership, origin protection, case-version check, no-store headers, and verification log as existing exports.

The verification description reads `Downloaded filled CJTS entry guide; filing status unchanged`.

The existing `pack`, `verification`, and `referral` behaviors and filenames remain backward compatible.

## Failure behavior

- Stale case version: reject with the existing conflict response.
- Missing acknowledged details: generate blanks with visible prompts.
- Missing unacknowledged details: the UI explains that gaps must be reviewed before downloading the guide.
- Ambiguous address or contact: leave the component blank and show `ENTER ON CJTS`.
- No reviewed summary: leave the summary area blank.
- Renderer failure: return the existing safe export error and create no partial download.

## Testing

### Mapping tests

- Complete demo case maps claimant, respondent, amount, dates, summary, and documents accurately.
- Phone, email, postal-code, and floor-unit parsing accepts clear formats and rejects ambiguous strings.
- CJTS-only values are never populated.
- Amount arithmetic does not guess missing contract, payment, balance, refund, or order values.
- Only usable documents are described as ready to upload.
- Summary output is at most 500 characters and ends on a word boundary.

### PDF tests

- Export returns a readable six-page A4 PDF with the expected filename and no-store headers.
- Extracted text contains all section names and representative mapped values.
- Extracted text includes the non-filing warning on every page.
- No captured identity, address, timestamp, URL, black redaction content, or browser chrome survives.
- Missing values render as explicit prompts rather than fabricated content.

### UI and regression tests

- The filled guide is the primary download.
- Existing secondary downloads still work.
- Stale, acknowledgement, and version behavior remains unchanged.
- Typecheck, lint, unit/API tests, and a production build pass.
- The generated guide is rendered to images and visually inspected for clipping, overlap, illegibility, and accurate page transitions.

## Expected implementation boundaries

- `lib/cjts/entry-guide.ts`: typed mapping and conservative parsing.
- `lib/export/cjts-entry-guide-pdf.ts`: six-page renderer.
- `app/api/export/route.ts`: new export kind and filename.
- `app/prepare/page.tsx`: primary guide button and secondary preparation pack.
- `tests/api.test.ts` and focused domain tests: export, mapping, privacy, and regression coverage.

The existing generic PDF writer may be extended only with small drawing primitives needed by the guide. If the six-page layout would make it substantially more complex, the CJTS renderer should own its own minimal drawing layer instead of turning the generic preparation-pack writer into a browser-layout engine.
