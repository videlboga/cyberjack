import { describe, expect, it } from 'vitest';
import { computeNovelty } from '../src/compiler/noveltyService';

const action: any = { actionKey: 'stroke', novelty: 0.8 };
const event = (key: string) => ({ actionPayload: { presetId: key } });

describe('computeNovelty', () => {
  it('keeps preset novelty for a new action', () => {
    expect(computeNovelty(action, [])).toBe(0.8);
  });

  it('reduces novelty across an immediate repetition streak', () => {
    const once = computeNovelty(action, [event('stroke')]);
    const three = computeNovelty(action, [event('stroke'), event('stroke'), event('stroke')]);
    expect(once).toBeLessThan(0.8);
    expect(three).toBeLessThan(once);
  });

  it('partly restores novelty after switching actions', () => {
    const repeated = computeNovelty(action, [event('stroke'), event('stroke')]);
    const switched = computeNovelty(action, [event('ice'), event('stroke'), event('stroke')]);
    expect(switched).toBeGreaterThan(repeated);
  });

  it('reduces novelty as point familiarity grows', () => {
    expect(computeNovelty(action, [], 20)).toBeLessThan(computeNovelty(action, [], 0));
  });
});
