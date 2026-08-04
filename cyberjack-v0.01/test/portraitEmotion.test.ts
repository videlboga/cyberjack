import { describe, expect, it } from "vitest";
import { resolvePortraitEmotion } from "../src/domain/portraitEmotion";

describe("portrait emotion resolver", () => {
  it("prioritizes critical engine states", () => {
    expect(resolvePortraitEmotion({ behavioralState: "unresponsive", reaction: { pleasure: 20 } })).toBe("unconscious");
    expect(resolvePortraitEmotion({ transitions: [{ kind: "discharge" }], reaction: { discomfort: 20 } })).toBe("climax");
    expect(resolvePortraitEmotion({ behavioralState: "subspace" })).toBe("subspace");
  });

  it("uses the computed reaction rather than the action label or generated text", () => {
    expect(resolvePortraitEmotion({ reaction: { pleasure: 2, discomfort: 12 } })).toBe("pain");
    expect(resolvePortraitEmotion({ reaction: { pleasure: 12, discomfort: 1 } })).toBe("pleasure");
    expect(resolvePortraitEmotion({ reaction: { pleasure: 7, discomfort: 5, mixed: true } })).toBe("mixed");
    expect(resolvePortraitEmotion({ reaction: { pleasure: 0, discomfort: 50, overload: 15 } })).toBe("pain");
    expect(resolvePortraitEmotion({ reaction: { pleasure: 8, discomfort: 20, overload: 15 } })).toBe("mixed_overload");
  });

  it("falls back to stable state without inventing excitement", () => {
    expect(resolvePortraitEmotion({ state: { attitude: 70, openness: 60 } })).toBe("receptive");
    expect(resolvePortraitEmotion({ state: { attitude: 20, openness: 60 } })).toBe("guarded");
    expect(resolvePortraitEmotion({})).toBe("neutral");
  });
});
