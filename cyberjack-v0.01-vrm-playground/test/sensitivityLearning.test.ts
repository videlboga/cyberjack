import { describe, expect, it } from 'vitest';
import { applyLearning } from '../src/engine/applyLearning';
import { DEFAULT_CONFIG } from '../src/engine/config';

const action: any = {
  actionKey: 'test', label: 'Test', type: 'physical', tags: [],
  intensity: 0.3, valence: 0.5, contact: 0.5, sharpness: 0.1, novelty: 0.7
};
const baseCore: any = {
  sensitivity: 50, capacity: 60, openness: 60, plasticity: 70,
  attitude: 55, tension: 0, baselineSensitivity: 50,
  baselineCapacity: 60, baselineOpenness: 60,
  baselinePlasticity: 70, baselineAttitude: 55
};
const basePoint: any = {
  pointId: 'hands', localSensitivity: 50, localAttitude: 55,
  familiarity: 0, exposureCount: 0,
  baselineLocalSensitivity: 50, baselineLocalAttitude: 55
};

const result = (overrides: Record<string, number> = {}) => ({
  experiencedIntensity: 0, pleasure: 0, discomfort: 0,
  overload: 0, engagement: 0, learningEffect: 0,
  ...overrides
});

describe('sensitivity adaptation and learning', () => {
  it('does not raise current sensitivity above baseline under weak stimulation', () => {
    const next = applyLearning(baseCore, basePoint, action, result(), DEFAULT_CONFIG);
    expect(next.nextCore.sensitivity).toBe(50);
    expect(next.nextPoint.localSensitivity).toBe(50);
  });

  it('recovers current sensitivity towards baseline without overshooting it', () => {
    const core = { ...baseCore, sensitivity: 40 };
    const point = { ...basePoint, localSensitivity: 40 };
    const next = applyLearning(core, point, action, result(), DEFAULT_CONFIG, 20);
    expect(next.nextCore.sensitivity).toBeGreaterThan(40);
    expect(next.nextCore.sensitivity).toBeLessThanOrEqual(50);
    expect(next.nextPoint.localSensitivity).toBeGreaterThan(40);
    expect(next.nextPoint.localSensitivity).toBeLessThanOrEqual(50);
  });

  it('raises current sensitivity after manageable engaging learning', () => {
    const next = applyLearning(
      baseCore,
      basePoint,
      action,
      result({ experiencedIntensity: 15, pleasure: 20, discomfort: 2, engagement: 55, learningEffect: 30 }),
      DEFAULT_CONFIG
    );
    expect(next.nextCore.sensitivity).toBeGreaterThan(50);
    expect(next.nextPoint.localSensitivity).toBeGreaterThan(50);
    expect(next.nextCore.baselineSensitivity).toBeGreaterThan(50);
    expect(next.nextPoint.baselineLocalSensitivity).toBeGreaterThan(50);
    expect(next.nextCore.baselineSensitivity! - 50).toBeLessThan(next.nextCore.sensitivity - 50);
  });

  it('desensitizes current state under excessive load', () => {
    const next = applyLearning(baseCore, basePoint, action, result({ experiencedIntensity: 60, overload: 20, engagement: 20, learningEffect: 10 }), DEFAULT_CONFIG);
    expect(next.nextCore.sensitivity).toBeLessThan(50);
    expect(next.nextPoint.localSensitivity).toBeLessThan(50);
  });

  it('spends capacity during action and recovers it only while waiting', () => {
    const active = applyLearning(baseCore, basePoint, action, result({ experiencedIntensity: 15 }), DEFAULT_CONFIG);
    const depleted = { ...baseCore, capacity: 40 };
    const resting = applyLearning(depleted, basePoint, { ...action, actionKey: 'wait' }, result(), DEFAULT_CONFIG, 30);
    const fullResting = applyLearning(baseCore, basePoint, { ...action, actionKey: 'wait' }, result(), DEFAULT_CONFIG, 30);
    expect(active.nextCore.capacity).toBeLessThan(60);
    expect(resting.nextCore.capacity).toBeGreaterThan(40);
    expect(resting.nextCore.capacity).toBeLessThanOrEqual(60);
    expect(fullResting.nextCore.capacity).toBe(60);
  });

  it('does not reduce plasticity merely because learning is absent', () => {
    const idleAction = { ...action, actionKey: 'wait' };
    const next = applyLearning(baseCore, basePoint, idleAction, result(), DEFAULT_CONFIG, 20);
    expect(next.nextCore.plasticity).toBeGreaterThanOrEqual(baseCore.plasticity);
  });
});
