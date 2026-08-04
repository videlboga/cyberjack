import { describe, expect, it } from "vitest";
import { scoreGoalCandidate } from "../src/ui/goalRecommendation";

const candidate = (delta: number, key = "attitude") => ({
  tags: [] as string[],
  preferenceScore: 0,
  intensity: .5,
  observations: [{ changes: { [key]: delta }, reaction: { overload: 0 } }],
});

describe("goal recommendation scoring", () => {
  it("rewards movement toward a lower-bound goal and rejects movement away", () => {
    const goal = { type: "attitude", operator: ">=", value: 70 };
    expect(scoreGoalCandidate(goal, 55, candidate(2))).toBeGreaterThan(0);
    expect(scoreGoalCandidate(goal, 55, candidate(-2))).toBe(Number.NEGATIVE_INFINITY);
  });

  it("reverses direction for upper-bound goals", () => {
    const goal = { type: "custom", key: "capacity", operator: "<=", value: 20 };
    expect(scoreGoalCandidate(goal, 40, candidate(-3, "capacity"))).toBeGreaterThan(0);
    expect(scoreGoalCandidate(goal, 40, candidate(3, "capacity"))).toBe(Number.NEGATIVE_INFINITY);
  });

  it("uses matching tags for preference and trait goals", () => {
    const goal = { type: "acquired_trait", key: "trait_masochist", operator: ">=", value: 1 };
    const matching = { tags: ["pain"], preferenceScore: 0, intensity: .7, observations: [] };
    const missing = { ...matching, tags: ["comfort"] };
    // The UI expands trait keys to their semantic tags before scoring.
    expect(scoreGoalCandidate({ ...goal, key: "pain" }, 0, matching)).toBeGreaterThan(0);
    expect(scoreGoalCandidate({ ...goal, key: "pain" }, 0, missing)).toBe(Number.NEGATIVE_INFINITY);
  });
});
