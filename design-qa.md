# Design QA

**Source visual truth**

- `public/design/quiet-workspace-reference.png`
- Original dimensions: 1536 × 1024 pixels.

**Implementation evidence**

- Browser-rendered Casepath overview captured in the Codex in-app browser at a 1536 × 1024 CSS viewport and device scale factor 1.
- Side-by-side comparison capture: Codex in-app browser QA capture from 5 September 2026. The browser tool does not expose a persistent filesystem path for its capture.
- State: fresh synthetic repair-work case, 0 of 6 preparation tasks reviewed.

**Full-view comparison**

The implementation preserves the selected direction's proportions: a fixed 272px navigation rail, 76px toolbar, open two-column content area, 340px case-details rail, fine grey dividers, system typography, and one deep-green action colour. The implementation begins at 0 reviewed tasks because that is the honest initial state; the visual target's 2 of 6 was presentation data. Full unresolved questions and real fixture dates replace abbreviated mock copy.

**Focused comparison**

The overview header, next-action band, progress rail, attention rows, document table, case-detail rows, navigation state, and toolbar were readable in the normalized side-by-side browser comparison. No additional crop was needed because those elements remained legible at the comparison scale. Route, options, source drawer, and draft screens were inspected separately at desktop size; the overview was also inspected at the default narrow viewport.

**Required fidelity surfaces**

- Fonts and typography: native system stack, restrained weights, matching heading scale and compact UI labels. Passed.
- Spacing and layout rhythm: major grid tracks, dividers, open sections, side-rail spacing, and responsive collapse match the reference. Passed.
- Colours and visual tokens: warm white, quiet grey, deep green, and supplementary amber/red states match the selected direction with accessible text labels. Passed.
- Image and asset fidelity: the target contains no content imagery or decorative assets. Interface icons use the installed outline icon library. Passed.
- Copy and content: product language is grounded in the live case and keeps procedural limits, missing information, and filing status explicit. Intentional fixture differences are listed above. Passed.

**Interaction and accessibility checks**

- Primary navigation, route review, option selection, source drawer, task and draft controls were exercised in the in-app browser.
- The 390px-class responsive layout and the 1536 × 1024 desktop layout were inspected without hidden persistent controls.
- Source drawer focus lands on Close; controls have visible focus styles; every semantic state includes a text label.
- Browser console errors and warnings: none.

**Findings**

No actionable P0, P1, or P2 differences remain. The smaller number of unresolved items in the visual target was mock content and was intentionally not copied.

**Comparison history**

- Initial browser pass found same-origin session initialization rejected under the framework's forwarded host. Fixed origin validation to compare the browser origin with the request and forwarded hosts while preserving cross-site rejection.
- Post-fix capture showed the complete overview with live case data at both responsive breakpoints.
- Final normalized side-by-side comparison found no remaining P0, P1, or P2 issue.

**Follow-up polish**

- P3: consider a short plain-language label beside source reference IDs once Anson's source viewer supplies document-page anchors.

final result: passed
