import { describe, expect, it } from 'vitest';
import { computeNovelty } from '../src/compiler/noveltyService';

const action = { actionKey: 'stroke', novelty: 0.8 };
const history = (count: number, key = 'stroke') =>
  Array.from({ length: count }, () => ({ actionKey: key }));

describe('computeNovelty', () => {
  it('does not penalize the first three repetitions', () => {
    expect(computeNovelty(action, history(0), 0)).toBeCloseTo(0.8);
    expect(computeNovelty(action, history(1), 0)).toBeCloseTo(0.8);
    expect(computeNovelty(action, history(2), 0)).toBeCloseTo(0.8);
  });

  it('applies accelerating habituation only to a sustained sequence', () => {
    const afterFour = computeNovelty(action, history(3), 0);
    const afterSix = computeNovelty(action, history(5), 0);
    const afterTen = computeNovelty(action, history(9), 0);

    expect(afterFour).toBeGreaterThan(0.75);
    expect(afterSix).toBeGreaterThan(0.5);
    expect(afterTen).toBeLessThan(afterSix * 0.6);
  });

  it('barely reacts to a few interrupted matches', () => {
    const interrupted = [
      { actionKey: 'other' },
      ...history(5),
    ];
    expect(computeNovelty(action, interrupted, 0)).toBeCloseTo(0.8);
  });

  it('delays the long-term familiarity penalty', () => {
    expect(computeNovelty(action, [], 5)).toBeCloseTo(0.8);
    expect(computeNovelty(action, [], 30)).toBeLessThan(0.5);
  });
});
