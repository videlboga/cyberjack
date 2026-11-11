import { describe, expect, it } from 'vitest';
import { computeResult } from './computeResult';

const core = { sensitivity: 50, capacity: 65, openness: 50, attitude: 50, plasticity: 50 };
const point = { pointId: 'vulva', localSensitivity: 50, localAttitude: 50, localOpenness: 50 };
const intimate = { actionKey: 'intimate_test', tags: ['sexual'], intensity: .5, valence: .35, contact: .7, sharpness: .15, novelty: .5 };

describe('relationship-aware intimate appraisal', () => {
  it('changes intimate appraisal with the relationship to the initiator', () => {
    const distant = computeResult(intimate, core, point, undefined, { attitude: 20, openness: 25 }).result;
    const close = computeResult(intimate, core, point, undefined, { attitude: 80, openness: 75 }).result;
    expect(close.finalValence).toBeGreaterThan(distant.finalValence);
    expect(close.pleasure).toBeGreaterThan(distant.pleasure);
    expect(close.engagement).toBeGreaterThan(distant.engagement);
  });

  it('does not apply the relationship bias to ordinary contact', () => {
    const ordinary = { ...intimate, actionKey: 'gentle_stroke', tags: [], };
    const distant = computeResult(ordinary, core, { ...point, pointId: 'hands' }, undefined, { attitude: 20, openness: 25 }).result;
    const close = computeResult(ordinary, core, { ...point, pointId: 'hands' }, undefined, { attitude: 80, openness: 75 }).result;
    expect(close.finalValence).toBe(distant.finalValence);
    expect(close.engagement).toBe(distant.engagement);
  });
});
