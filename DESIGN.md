---
name: Casepath
description: A quiet, source-aware case desk for preparing a Singapore small claim one decision at a time.
colors:
  ink: "#1d1d1f"
  text-secondary: "#6e6e73"
  divider: "#d2d2d7"
  divider-soft: "#e5e5ea"
  canvas: "#f5f5f7"
  surface: "#ffffff"
  surface-secondary: "#f0f0f2"
  system-blue: "#0066cc"
  system-blue-hover: "#0055b3"
  system-blue-soft: "#e8f2ff"
  status-green: "#1b6f3a"
  status-green-soft: "#e8f5ec"
  caution-amber: "#8a4b00"
  caution-amber-soft: "#fff3df"
  critical-red: "#b4232d"
  critical-red-soft: "#fff0f1"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(36px, 4vw, 52px)"
    fontWeight: 690
    lineHeight: 1.04
    letterSpacing: "-0.038em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Arial, sans-serif"
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.22
    letterSpacing: "-0.022em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 640
    lineHeight: 1.35
    letterSpacing: "-0.012em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.006em"
  supporting:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 610
    lineHeight: 1
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.012em"
rounded:
  icon: "8px"
  navigation: "10px"
  field: "11px"
  compact: "12px"
  panel: "14px"
  guide: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "28px"
  4xl: "32px"
  5xl: "48px"
  6xl: "52px"
components:
  button-primary:
    backgroundColor: "{colors.system-blue}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 17px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.system-blue-hover}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 17px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.system-blue}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 17px"
    height: "42px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.system-blue}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: "0 17px"
    height: "42px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "13px 14px"
  choice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "18px"
  badge-neutral:
    backgroundColor: "{colors.surface-secondary}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
    height: "26px"
  guide-primary:
    backgroundColor: "{colors.system-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "0 24px"
    height: "54px"
  navigation-active:
    backgroundColor: "{colors.system-blue-soft}"
    textColor: "{colors.system-blue}"
    typography: "{typography.control}"
    rounded: "{rounded.navigation}"
    padding: "6px 10px"
    height: "44px"
  guide-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.guide}"
    padding: "52px 54px 40px"
  callout-info:
    backgroundColor: "{colors.system-blue-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "16px 17px"
---

# Design System: Casepath

## Overview

**Creative North Star: "Quiet Case Desk"**

Casepath should feel like opening a carefully indexed working file in a calm Apple-native utility: cool neutral surroundings, a clear current stage, and one flat surface on which to make the next decision. The interface is restrained but not sparse for its own sake. It lowers pressure through plain hierarchy, generous reading room, familiar controls, and persistent source and review state.

The visual system separates navigation chrome from case work. The sidebar, top bar, drawers, and toast may use translucent material because they orient or temporarily overlay the record. The case record itself stays opaque, flat, and highly legible, organised by rules, rows, sections, and source-aware status labels rather than by a generic grid of elevated cards.

**Key Characteristics:**

- Native system typography with compact, sentence-case labels and tightly balanced headings.
- Cool greys and white work surfaces, with system blue reserved for the current path and decisive actions.
- A persistent indexed-stage structure on wide screens and a focused drawer on narrow screens.
- Flat records divided by hairlines; semantic tints explain review state without replacing text.
- One dominant decision at each junction, with provenance, uncertainty, and reversibility left visible.

## Colors

The palette is Apple-inspired and deliberately cool: nearly black text, quiet blue-grey neutrals, a single system-blue action voice, and restrained semantic pairs for verified, caution, and critical states.

### Primary

- **System Blue:** The product's sole action accent. Use it for primary buttons, links, current-stage indicators, selection rings, carets, and visible focus.
- **Pressed Blue:** The darker hover state for filled blue actions; it should communicate response without introducing a second accent.
- **Source Blue Wash:** A pale informational surface for reviewed-source notes, selected navigation, and other non-alarming guidance.

### Neutral

- **Case Ink:** Primary headings, body copy, and high-confidence values.
- **Quiet Graphite:** Secondary explanations, metadata, timestamps, and supporting labels.
- **Desk Canvas:** The cool page field surrounding the active work.
- **Paper Surface:** Opaque reading, editing, and selection surfaces.
- **Recessed Surface:** Subordinate bands, metrics, inactive chips, and compact summaries.
- **Divider / Soft Divider:** Structural hairlines. Use the stronger divider between regions and the softer divider within a record.

### Semantic

- **Verified Green / Verified Wash:** Confirmed, ready, available, or completed states.
- **Caution Amber / Caution Wash:** Conflicts, gaps, hard-to-read sources, and conditions needing review.
- **Critical Red / Critical Wash:** Failures and consequential missing information, never decorative emphasis.

**The One Voice Rule.** System blue identifies navigation, interaction, and the current decision; semantic colours report state and always travel with a text label or icon.

**The Quiet Canvas Rule.** Keep large areas neutral. Tinted semantic backgrounds belong to bounded callouts and badges, not page sections or decorative bands.

## Typography

**Display Font:** Native system sans (`-apple-system` with BlinkMacSystemFont, SF Pro Text, Helvetica Neue, Arial fallbacks)  
**Body Font:** The same native system stack  
**Label/Mono Font:** The same native system stack; numeric progress uses tabular figures rather than a separate mono face

**Character:** The single-family system keeps the workspace familiar, fast, and unperformed. Hierarchy comes from optical weight, compressed letter spacing, line length, and whitespace—not from a display typeface or legal-document styling.

### Hierarchy

- **Display** (weight 690, fluid 36–52px, line-height 1.04): Page and guided-step titles; keep them short and balance wrapping.
- **Headline** (weight 650, 21px, line-height 1.22): Major record groups inside the work surface.
- **Title** (weight 640, 16px, line-height 1.35): Row headings, panel headings, and case-detail labels.
- **Body** (regular, 16px, line-height 1.5): Primary explanation and editable content; longer introductions may rise to 18px and stay within roughly 65 characters.
- **Supporting** (regular, 13px, line-height 1.5): Metadata, source references, qualifiers, and secondary help.
- **Control** (weight 610, 14px, line-height 1): Buttons and compact actions.
- **Label** (weight 600, 12px, slight positive tracking): Navigation group labels, compact status, and table headings; sentence case remains the default.

**The Native First Rule.** Do not introduce an expressive display face, serif legal styling, or monospace decoration; the system stack is part of the trust model.

**The Plain Hierarchy Rule.** Use size and weight to clarify task order, not to dramatise the dispute. Avoid all caps, oversized numerals, and promotional headline cadence.

## Layout

The wide layout is an indexed case desk: a fixed 260px stage sidebar, a sticky 72px top bar, and a centred work surface capped at 1220px with 48px horizontal breathing room. Most preparation routes use a main record column plus a 320px contextual aside separated by a vertical divider. Records flow as sections and rows rather than independent cards; related facts remain visually contiguous.

At 1050px, the index narrows to 244px and the contextual column to 280px. At 860px, the fixed index becomes a navigation drawer, the work becomes a single column, the top bar reduces to 64px, and the aside moves below the main record with a horizontal divider. At 640px and 420px, page actions stack, tables suppress nonessential columns, choice rows simplify, and content gutters reduce to 22px and then 14px. Touch controls remain at least 42px high, with the guided primary action reaching 54–56px.

The spacing rhythm clusters around 8, 12, 16, 20, 24, 28, 32, 48, and 52px. Use smaller steps inside controls and rows, 28px between record sections, and 48–52px only for major page or column separation.

**The Indexed Desk Rule.** The stage index provides the map; the work surface presents the current job. Do not turn the main area into another navigation dashboard.

**The One Decision Rule.** At decision points, one filled action carries the path forward. Secondary, corrective, and deferral actions remain outlined or quiet.

## Elevation & Depth

Casepath is flat by default. Depth comes primarily from cool tonal layers, borders, and fixed-versus-scrolling structure. Ambient shadows are reserved for the guided front-door sheet, temporary toast, mobile drawer, brand mark, and filled action response; ordinary records, inputs, choices, tables, callouts, and side panels remain on the page plane.

### Shadow Vocabulary

- **Guided sheet** (`0 18px 60px rgba(0, 0, 0, 0.08)`): The focused step-by-step front door only.
- **Floating feedback** (`0 8px 28px rgba(0, 0, 0, 0.1)`): Toasts and transient feedback above the workspace.
- **Drawer edge** (`18px 0 60px rgba(0, 0, 0, 0.14)`): Separates the mobile drawer from its scrim.
- **Blue action response** (`0 3px 10px rgba(0, 102, 204, 0.18)` at rest; `0 5px 14px rgba(0, 102, 204, 0.24)` on hover): Gives the single primary control a modest tactile cue.

**The Structural Glass Rule.** Blur and translucency belong only to persistent or transient chrome—the sidebar, top bar, and toast—and must fall back to opaque surfaces when reduced transparency is requested.

**The Flat Work Rule.** Never use shadows to make every section, metric, or piece of evidence look like an independent card. Relationships are expressed with alignment, hairlines, and tonal restraint.

## Shapes

The form language is softly rectilinear. Navigation items use compact 10px corners, fields use 11px, callouts and choices use 14px, and the singular guided sheet uses 24px on wide screens. Pills are reserved for buttons, compact status, stage numbers, and progress tracks. Circular geometry communicates selection, completion, or point progress—not decoration.

Borders are hairline neutral strokes. A selected choice earns a system-blue border plus a one-pixel outer reinforcement; focused fields use a blue stroke and a three-pixel translucent focus halo. Dashed outlines are limited to empty and upload targets.

**The Bounded Softness Rule.** Use medium radii to make stressful work approachable, but keep the underlying information architecture rectilinear and aligned. Avoid bubbly nested panels.

## Components

### Buttons

- **Shape:** Compact actions are 42px-high pills; the guided full-width action is a 54px-high rounded rectangle.
- **Primary:** White text on system blue, with 17px horizontal padding for compact actions or 24px in the guided flow. One primary action per decision junction.
- **Hover / Focus:** Darken to Pressed Blue and increase the blue ambient shadow slightly. Keyboard focus uses the global three-pixel blue outline; press scales to 0.97 unless reduced motion is requested.
- **Secondary / Quiet:** Secondary actions use a white surface, blue text, and a cool blue-grey border. Quiet actions are transparent blue text and gain only a pale blue hover wash.

### Chips

- **Style:** Compact 26px pills with explicit text labels. Neutral chips use Recessed Surface; semantic chips pair dark semantic text with its pale wash.
- **State:** Chips report status but do not behave like primary actions. Never rely on their colour alone.

### Cards / Containers

- **Corner Style:** Most bounded work patterns use the 14px panel radius; the guided front door alone uses the larger guide radius.
- **Background:** Opaque Paper Surface or Recessed Surface. Semantic washes are reserved for messages with semantic meaning.
- **Shadow Strategy:** Flat for records and controls; use the guided-sheet shadow only on the step-by-step front door.
- **Border:** Hairline dividers structure rows and sections. Dashed borders signal an upload or empty target.
- **Internal Padding:** Typically 16–20px for bounded messages and choices; 52–54px for the wide guided sheet.

### Inputs / Fields

- **Style:** Opaque white background, quiet grey stroke, 11px corners, and 13px by 14px internal padding.
- **Focus:** System-blue border with a three-pixel translucent blue halo; the global focus outline remains visible for keyboard interaction.
- **Error / Disabled:** Disabled fields move to the Desk Canvas and muted text. Errors and uncertainties appear in adjacent labelled callouts rather than turning the whole form red.

### Navigation

- **Style:** The sidebar is a translucent cool-neutral index on wide screens. Each 44px row carries an icon, a plain-language label, and optionally a numbered stage pill.
- **States:** Hover uses a faint neutral wash. The current stage uses system-blue text and a pale blue background; completed stages use verified green on the icon without replacing the label.
- **Mobile:** Below 860px, the sidebar becomes an opaque-near-white modal drawer with a dim scrim, explicit close control, focus placement, and Escape dismissal.

### Choice Row

The choice row is the signature decision component: a full-width, flat white selection surface with a radio-like dot, clear title, explanation, trade-off, and optional trailing arrow. Selection is a blue boundary, not a filled blue card. Disabled choices stay readable and explain the prerequisite in amber text.

### Source-aware Callout

Callouts use a 14px bounded wash, an icon, and direct explanatory copy. Information uses Source Blue Wash, review-needed uses Caution Wash, and failure uses Critical Wash. Reviewed-source actions stay quiet and visibly link back to the source record.

## Do's and Don'ts

### Do:

- **Do** preserve the indexed-stage shell and keep the current stage unmistakable on desktop and mobile.
- **Do** structure case material as continuous sections, rows, timelines, and source-linked fields separated by hairlines.
- **Do** reserve filled system blue for the one action that advances the current decision.
- **Do** keep uncertainty, provenance, version state, and conflicting evidence visible in plain text alongside semantic colour.
- **Do** maintain 42px minimum controls, visible keyboard focus, reduced-motion and reduced-transparency behavior, and layouts that remain usable at 320px.

### Don't:

- **Don't** introduce a generic SaaS card grid, dashboard tile mosaic, gradient, glass panel inside the work surface, or decorative AI motif.
- **Don't** use legal theatre: no gavels, seals, courthouse imagery, serif briefs, ceremonial borders, or language that implies court authority.
- **Don't** apply status colours as decoration or as the only carrier of meaning.
- **Don't** add competing primary actions, motivational filler, or autonomous-looking recommendations at a decision junction.
- **Don't** smooth away missing, disputed, stale, unreadable, or source-less information to make the interface appear complete.
