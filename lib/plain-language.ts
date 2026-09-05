/**
 * Plain-language wording for everything a user reads.
 *
 * The primary user is someone with no legal training, possibly distressed,
 * possibly not young, working from phone screenshots and memory. Every phrase
 * here replaces a term that is precise for us and opaque to them.
 *
 * Rules applied throughout:
 *   - Say what it means for them, not what it is called internally.
 *   - Never use a legal or product term where an ordinary one exists.
 *   - Say what is NOT being claimed as often as what is — "we found nothing"
 *     must never be heard as "you have no case".
 *   - Second person, active voice, short sentences.
 */

import type { SupportStatus, DocumentIssue } from "@/lib/contracts";

/** The six stages, named as things a person does rather than system states. */
export const STEPS = [
  { slug: "explain", title: "Tell us what happened", blurb: "In your own words. Speak it or type it." },
  { slug: "documents", title: "Add anything you have", blurb: "Photos, receipts, messages. Any order." },
  { slug: "check", title: "Check we understood", blurb: "Fix anything we got wrong." },
  { slug: "evidence", title: "See what your files show", blurb: "What they back up, and what they do not." },
  { slug: "next", title: "Decide what to do", blurb: "Your options, with the trade-offs." },
  { slug: "pack", title: "Get your pack", blurb: "Everything gathered in one place." },
] as const;

export type StepSlug = (typeof STEPS)[number]["slug"];

/**
 * Support status in the user's terms.
 *
 * "Support missing" was heard as a verdict. It is not one — it means we could
 * not find a document, which is a very different thing from the claim being
 * untrue, and the wording has to carry that or the traffic lights do harm.
 */
export const SUPPORT_PLAIN: Record<SupportStatus, { headline: string; meaning: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  supported: {
    headline: "Your files back this up",
    meaning:
      "We found something in your documents that points to this. That is not the same as it being proven — but you can show where it comes from.",
    tone: "good",
  },
  partial_or_disputed: {
    headline: "Your files disagree about this",
    meaning:
      "Something in your documents points the other way, or only part of this is covered. This is worth sorting out before you go further.",
    tone: "warn",
  },
  missing: {
    headline: "Nothing in your files shows this yet",
    meaning:
      "We could not find a document about it. That does not mean it did not happen — it means there is no paperwork here to point at.",
    tone: "bad",
  },
  not_assessed: {
    headline: "We could not check this",
    meaning: "Something stopped us looking. Nothing should be read into it either way.",
    tone: "neutral",
  },
};

/** What each file flag means, and the one thing to do about it. */
export const FILE_PLAIN: Record<DocumentIssue, { headline: string; advice: string }> = {
  unreadable: { headline: "We could not open this", advice: "If you have another copy, add that instead." },
  password_protected: { headline: "This one needs a password", advice: "Save it without the password, then add it again." },
  truncated: { headline: "This one was very long", advice: "We read the first 100 pages. Tell us if the important part is later." },
  unsupported_type: { headline: "We cannot read this kind of file", advice: "Save it as a PDF or take a photo of it." },
  possibly_unrelated: { headline: "This may not be about your dispute", advice: "Keep it or remove it — up to you." },
  low_quality_scan: { headline: "This was hard to read", advice: "Please check anything we took from it against the original." },
  duplicate: { headline: "You have added this one already", advice: "Adding it twice does not make your case stronger." },
  over_size_limit: { headline: "This file is too big", advice: "Try a smaller photo, or split the document." },
};

/** Fact provenance, said plainly. */
export const ORIGIN_PLAIN = {
  user_stated: "You told us this",
  document_extracted: "We read this from your files",
  inferred: "We worked this out",
} as const;

/**
 * The one line that has to survive everywhere.
 *
 * Users read colour as a score. PRD §1 forbids exactly that reading, so the
 * disclaimer travels with the traffic lights rather than living in a footer.
 */
export const NOT_A_SCORE =
  "These show what your documents back up. They are not a score, and they do not predict what a tribunal would decide.";

export const NOT_A_LAWYER =
  "This is not legal advice. It helps you get organised — it does not tell you whether you would win.";
