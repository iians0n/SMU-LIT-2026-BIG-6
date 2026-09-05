/**
 * Proposing a label for an uploaded document. FR03.
 *
 * "Propose labels" — proposed, not decided. The label is a convenience so a
 * list of files reads as "Quote, Receipt, Chat messages" rather than
 * "IMG_4471.jpg", and the user can always override it. Nothing downstream
 * depends on it: no assessment, no draft field, and no support status is
 * derived from a label, so a wrong guess costs the user one correction rather
 * than corrupting the record.
 *
 * Deterministic on purpose. A model could label more subtly, but this runs with
 * no API key, is testable, and cannot invent a category. The document text it
 * reads is untrusted, so matching is confined to fixed patterns — a file
 * claiming "this is a court order" gets no say in what it is called.
 */

export interface LabelProposal {
  label: string;
  /** Which signal fired, so the UI can say "from the file name" if that is all we had. */
  basis: "content" | "file name";
}

interface Signal {
  label: string;
  /** Matched against extracted text. */
  content?: RegExp;
  /** Matched against the file name. */
  name: RegExp;
}

/**
 * Ordered: the first content match wins, so the most distinctive patterns come
 * first. Chat leads because a timestamp marker like "[12 Jul]" is structural,
 * whereas the words "invoice" or "receipt" appear inside chats constantly - a
 * message saying "I'll send the invoice later" is a chat, not an invoice.
 *
 * For the same reason the document patterns match document furniture (headings,
 * letterheads, field labels) rather than bare nouns.
 */
const SIGNALS: Signal[] = [
  { label: "Chat messages", content: /\[\d{1,2}\s+\w{3}\]|\b(whatsapp|telegram|last seen(\s+today)?|sms)\b/i, name: /whatsapp|chat|telegram|message|sms|screenshot/i },
  { label: "Receipt", content: /\b(official receipt|received with thanks|receipt no\.?|payment received)\b/i, name: /receipt/i },
  { label: "Invoice", content: /\b(invoice\s*(no\.?|#|number)|amount due|bill to|tax invoice)\b/i, name: /invoice|bill/i },
  { label: "Quote", content: /\b(quotation|quote\s+ref|scope of works?)\b/i, name: /quot|estimate/i },
  { label: "Bank statement", content: /\b(account statement|statement of account|paynow|fast transfer|closing balance)\b/i, name: /statement|bank/i },
  { label: "Contract", content: /\b(terms and conditions|this agreement|agreement between|hereby agree)\b/i, name: /contract|agreement|terms/i },
  { label: "Delivery record", content: /\b(delivery order|delivery note|goods received|handover)\b/i, name: /delivery|handover/i },
  { label: "Photograph", name: /^(img|dsc|photo|pxl)[-_ ]?\d+|\bphoto\b/i },
  { label: "Note", content: /\b(note to self|reminder|memo)\b/i, name: /note|memo/i },
];

/**
 * Returns null rather than guessing when nothing matches. An unlabelled file
 * shown by its own name is honest; a file labelled "Document" is noise
 * pretending to be information.
 */
export function proposeLabel(fileName: string, text: string): LabelProposal | null {
  // Only the opening of the document is considered. Letterheads and headings
  // live there, and reading further mostly finds passing mentions - a chat that
  // says "I'll send the invoice" is not an invoice.
  const head = text.slice(0, 1200);

  for (const signal of SIGNALS) {
    if (signal.content?.test(head)) return { label: signal.label, basis: "content" };
  }
  for (const signal of SIGNALS) {
    if (signal.name.test(fileName)) return { label: signal.label, basis: "file name" };
  }
  return null;
}
