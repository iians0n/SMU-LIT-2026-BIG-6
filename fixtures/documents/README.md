# Synthetic document corpus

Every file here exists to trigger one specific FR03 behaviour. They are committed, so you only need the generator if you want to change them:

```
python3 scripts/make_fixture_documents.py   # regenerate
npm run fixtures                            # re-emit JSON + verify hashes match
```

`npm run fixtures` fails if a case fixture's `byteSize` or `hash` has drifted from the file on disk, or if a `duplicate` flag doesn't follow from the actual bytes. A fixture asserting made-up hashes would let duplicate detection "pass" against numbers we invented.

**Everything is fictional.** Names, amounts, UEN, and account numbers are synthetic (PRD §8: use synthetic documents for the hackathon).

## The files

| File | Triggers | Expected pipeline behaviour |
| --- | --- | --- |
| `quote-accepted.pdf` | *nothing — the happy path* | Real text layer, 2 pages. Extract without OCR. Yields the S$2,000 scope/price (excerpt e1) and the 15 July completion date (e2). |
| `receipt.jpg` | OCR path | No text layer. Photographed at a slight angle with uneven lighting, so OCR has to work for it. Yields the S$2,000 payment on 20 June (e3). |
| `receipt-photo-2.jpg` | `duplicate` | Byte-identical to `receipt.jpg`. Must be detected by hash and **must not improve support** on the payment issue (FR05). |
| `whatsapp-thread.png` | the contradiction | Carries the 12 Jul "can we push to 29 Jul" message (e4) and the ambiguous "ok" reply (e5). This is what stops the completion-date issue going green. |
| `handwritten-note.jpg` | `low_quality_scan` | Blurred, noisy, heavily recompressed. Reads `$3OO` where the character is genuinely ambiguous between letter-O and zero. **Must produce an uncertainty flag, not invented text** — FR03's most important acceptance criterion. |
| `bank-statement.pdf` | `password_protected` | AES-256, user password `weiling2026`. Must fail visibly with a retry path. Corroborates the S$300 in the blurry note *and* shows the S$500 second contractor — so unlocking it changes the case. |
| `scanned-receipt.pdf` | the OCR-for-PDF path | A photograph of the receipt wrapped in a PDF, with **no text layer at all** — what a phone or scanner actually produces. Extraction finds nothing, so the page is rendered and OCR'd. Reads the total as `$$2,000.00` at 0.44 confidence, which is why the weakest passage decides the document's flag rather than the page average. |
| `contract-draft.rtf` | `unsupported_type` | Outside the supported set. Must be **visibly** unsupported; the UI must never imply it was read. Its text contradicts nothing — the point is that we never got to read it. |
| `holiday-photo.jpg` | `possibly_unrelated` | No dispute-relevant content. Flag it, do not delete it — the user decides. |
| `corrupted-scan.pdf` | `unreadable` | Valid header, truncated body, garbage tail. Opens with 0 pages and an xref error. Must not produce invented text. |
| `long-appendix.pdf` | `truncated` | 120 pages against the 100-page budget. Read what fits, mark the rest truncated, say so. |

## Not represented by a file

- **`over_size_limit`** — needs a >20 MB file, which does not belong in git. It is a byte-count check on `UPLOAD_LIMITS.maxBytesPerFile`; test it with a stub rather than a committed blob.

## Which fixture uses what

- **`case.demo.ts`** uses `d1`–`d7`: the quote, receipt, chat, duplicate, blurry note, password-protected statement, and unsupported RTF. The narrative stays about the dispute rather than about failures.
- **`case.adverse.ts`** takes the remaining three plus the seeded contradictions. That variant is where the pipeline gets stress-tested.
