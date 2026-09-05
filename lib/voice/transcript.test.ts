import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLikelySilenceHallucination } from "./transcript";

describe("silence transcription filtering", () => {
  it("drops the stock Whisper outro produced from room noise", () => {
    assert.equal(isLikelySilenceHallucination("Thank you for watching."), true);
    assert.equal(isLikelySilenceHallucination("  THANKS for watching!  "), true);
  });

  it("keeps real answers that happen to contain similar words", () => {
    assert.equal(
      isLikelySilenceHallucination("Thank you for watching the contractor finish the repair."),
      false,
    );
    assert.equal(isLikelySilenceHallucination("Thank you, I paid S$500."), false);
  });
});
