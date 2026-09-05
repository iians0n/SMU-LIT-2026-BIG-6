# Casepath clean live demo

Everything in this folder is fictional and intended only for a product demonstration.

## Story in one line

Aisha Rahman paid Northstar Bathroom Works S$8,400 for a bathroom renovation due on 30 June 2026. The work remained unfinished and unusable; Northstar admitted the delay and refunded S$1,000. Aisha requests the remaining S$7,400.

## Clean start

1. Run `npm run dev` and open `http://127.0.0.1:3000`.
2. Click **Start a new case**. Do not reuse an earlier browser case.
3. Upload the five numbered PDF files in this folder. Wait until all five say they were read.

## AI conversation

1. Paste the full contents of `01-PASTE-STORY.txt` into **Talk it through** and send it once.
2. Paste the full contents of `02-PASTE-LINKING.txt` and send it once.
3. The linking reply should name all five files. If it says no passage IDs were supplied, resend only `02-PASTE-LINKING.txt`; it explicitly distinguishes excerpt IDs (`e_`) from document IDs (`d_`).

## Review from start to finish

1. **Your documents:** confirm that all five files are extracted and none is flagged.
2. **Check the facts:** confirm each accurate fact. Pay special attention to the exact completion date, the two S$4,200 payments, the S$1,000 refund, and the S$7,400 requested amount.
3. **What your files show:** expect at least four green supported rows after the AI has linked excerpts. The refund and the contractor's alternative account may keep one or two rows amber; that is intentional and makes the demo credible. Open **Show me why** on at least the agreement, what went wrong, and loss/remedy rows to demonstrate provenance.
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
