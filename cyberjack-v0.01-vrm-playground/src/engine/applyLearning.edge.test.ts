import { describe, expect, it } from 'vitest';
import { applyLearning } from './applyLearning';

const point = {
  pointId: 'shoulders', localSensitivity: 50, localAttitude: 50,
  localOpenness: 50, familiarity: 0, exposureCount: 0,
  baselineLocalSensitivity: 50, baselineLocalAttitude: 50, baselineLocalOpenness: 50,
};
const action = { actionKey: 'gentle_stroke', intensity: .2, valence: .7, contact: .4, sharpness: 0, novelty: .8 };
const coreAt = (tension: number) => ({
  tension, sensitivity: 50, capacity: 70, openness: 50, plasticity: 50, attitude: 50,
  baselineSensitivity: 50, baselineCapacity: 70, baselineOpenness: 50, baselinePlasticity: 50, baselineAttitude: 50,
});
const result = (valence: number) => ({
  pleasure: valence > 0 ? 10 : 0, discomfort: valence < 0 ? 10 : 0, overload: 0,
  finalValence: valence, experiencedIntensity: 12, effectiveSensitivity: 50,
  learningEffect: 10, engagement: 20,
});

describe('emotional encoding near the edge', () => {
  it('strengthens positive association instead of shutting it off', () => {
    const low = applyLearning(coreAt(10), point, action, result(.7));
    const edge = applyLearning(coreAt(95), point, action, result(.7));
    expect(edge.nextCore.attitude - 50).toBeGreaterThan(low.nextCore.attitude - 50);
    expect(edge.nextPoint.localAttitude - 50).toBeGreaterThan(low.nextPoint.localAttitude - 50);
  });

  it('symmetrically strengthens negative association', () => {
    const low = applyLearning(coreAt(10), point, action, result(-.7));
    const edge = applyLearning(coreAt(95), point, action, result(-.7));
    expect(50 - edge.nextCore.attitude).toBeGreaterThan(50 - low.nextCore.attitude);
    expect(50 - edge.nextPoint.localAttitude).toBeGreaterThan(50 - low.nextPoint.localAttitude);
  });

  it('compresses activation growth inside the edge band', () => {
    const low = applyLearning(coreAt(10), point, action, result(.7));
    const edge = applyLearning(coreAt(95), point, action, result(.7));
    expect(edge.nextCore.tension - 95).toBeLessThan(low.nextCore.tension - 10);
  });

  it('lowers activation when an ongoing stimulus is stopped', () => {
    const stopped = applyLearning(coreAt(95), point, {
      actionKey: 'act_stop_vibrator', intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0,
    }, result(0));
    expect(stopped.nextCore.tension).toBeLessThan(85);
  });

  it('lets non-intimate soothing contact lower activation without losing its learning', () => {
    const soothed = applyLearning(coreAt(92), { ...point, pointId: 'hair' }, action, result(.7));
    expect(soothed.nextCore.tension).toBeLessThan(92);
    expect(soothed.nextCore.attitude).toBeGreaterThan(50);
  });
});
