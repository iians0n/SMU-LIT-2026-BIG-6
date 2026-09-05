/**
 * Short silence and room-noise clips can make Whisper emit stock outro text.
 * Keep this deliberately narrow: ordinary speech must never be discarded just
 * because it contains the word "thanks" in a real sentence.
 */
const SILENCE_HALLUCINATIONS = new Set([
  "thank you for watching",
  "thanks for watching",
  "thank you for listening",
  "thanks for listening",
  "please subscribe",
  "like and subscribe",
]);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isLikelySilenceHallucination(text: string): boolean {
  const value = normalise(text);
  if (!value) return false;
  return SILENCE_HALLUCINATIONS.has(value);
}

