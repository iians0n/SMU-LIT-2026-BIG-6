# Casepath clean live demo

Everything in this folder is fictional and intended only for a product demonstration.

## Story in one line

Aisha Rahman paid Northstar Bathroom Works S$8,400 for a bathroom renovation due on 30 June 2026. The work remained unfinished and unusable; Northstar admitted the delay and refunded S$1,000. Aisha requests the remaining S$7,400.

## Clean start

1. Run `npm run dev` and open `http://127.0.0.1:3000`.
2. Click **Start a new case**. Do not reuse an earlier browser case.

## AI conversation

1. Click the microphone and say the short, natural introduction in `00-SPEAK-THIS.txt`. You do not need to recite IDs, addresses, exact dates or arithmetic.
2. After the assistant records the outline, it shows **Upload your documents**. This handoff is state-driven: it appears after a substantive case fact exists and the case has no files.
3. Upload the five numbered PDF files in this folder together. Keep the page open while the button says **Reading and updating your case…**.
4. Wait for the green **Case details updated from your files** panel. The upload automatically extracts missing parties, IDs, addresses, dates, amounts and events, links exact passages, refreshes evidence, and regenerates the CJTS worksheet. No second AI prompt is required.
5. Open **Review details** and confirm the document-filled entries against the originals.

For this demo flow, readable cited documents are the source of truth. If the short spoken outline differs from an uploaded document, the document-backed name, date, amount, category or fact replaces the spoken value in the worksheet and CJTS entry guide. Uncited model output is still rejected.

`01-PASTE-STORY.txt` remains available as a no-microphone fallback. `02-PASTE-LINKING.txt` is now only a recovery prompt for older saved cases created before automatic reconciliation.

## Review from start to finish

1. **Your documents:** confirm that all five files say **Read**, the green update panel appears, and none is flagged.
2. **Check the facts:** confirm each accurate fact. Pay special attention to the exact completion date, the two S$4,200 payments, the S$1,000 refund, and the S$7,400 requested amount.
3. **What your files show:** expect green supported rows without sending a linking prompt. The refund and the contractor's alternative account may keep some rows amber; that is intentional and makes the demo credible. Open **Show me why** on the agreement and loss/remedy rows to demonstrate provenance.
4. **Check the filing route:** click **Check current case**, then **Mark reviewed**. The claim is a service claim for S$7,400, has an exact 30 June 2026 date, and records a Singapore respondent, so the rules-based result should read **Appears within supported route**.
5. **Next steps:** choose **Prepare to file**. If it is disabled, return to the route page and refresh after confirming all facts; any later fact edit makes the route stale.
6. Review the preparation tasks in order and mark each reviewed when its prerequisite is complete.
7. **Download PDF:** click **Update now** if the draft is stale, review and mark the populated fields checked, then acknowledge any remaining gaps.
8. Click **Download filled CJTS entry guide**. The six-page PDF is a copy guide for entering the reviewed values on the current CJTS website; it does not file or submit anything.

## Slide screenshots

Presentation-ready 1600 x 1000 screenshots are stored in
`output/playwright/product-slides/`. See that folder's README for suggested
captions and a recommended four-slide sequence.

## Good demo talking points

- The evidence screen is not a win predictor; green means a readable passage is linked to that factual point.
- The partial refund is included rather than hidden, and the requested S$7,400 reconciles exactly.
- The contractor's explanation and offer are preserved, showing that the tool records material that may cut both ways.
- The filing-route check is procedural and versioned. Changing a fact deliberately makes it stale until refreshed.

## Regenerate the PDFs

Run `python3 scripts/make_clean_demo_pack.py` from the repository root.
