import { describe, expect, it } from 'vitest';
import { evaluateTensionDischarge } from '../src/orchestration/triggers';

const core = (overrides: Record<string, number> = {}): any => ({
  sensitivity: 60, capacity: 60, openness: 65, plasticity: 70,
  attitude: 70, tension: 100, ...overrides
});
const result = (overrides: Record<string, number> = {}): any => ({
  effectiveSensitivity: 60, effectiveAttitude: 60, attitudeShift: .2,
  finalValence: .5, experiencedIntensity: 30, pleasure: 25,
  discomfort: 0, overload: 0, engagement: 40, learningEffect: 20,
  ...overrides
});
const event = (pleasure: number, discomfort: number, overload = 0) => ({
  resultPayload: { result: result({ pleasure, discomfort, overload }) }
});

describe('tension discharge classification', () => {
  it('classifies sustained positive activation as positive discharge', () => {
    const decision = evaluateTensionDischarge({
      core: core(), result: result(),
      recentEvents: [event(20, 0), event(15, 2), event(18, 0)]
    });
    expect(decision.outcome).toBe('positive');
    expect(decision.recentBalance).toBeGreaterThan(0);
  });

  it('does not let one pleasant final tick erase a negative buildup', () => {
    const decision = evaluateTensionDischarge({
      core: core({ attitude: 30, openness: 25, capacity: 25 }),
      result: result({ pleasure: 4, discomfort: 0 }),
      recentEvents: [event(0, 30, 20), event(0, 25, 10), event(0, 20, 15)]
    });
    expect(decision.outcome).toBe('breakdown');
    expect(decision.recentBalance).toBeLessThan(0);
  });

  it('does not let one painful final tick erase a positive buildup', () => {
    const decision = evaluateTensionDischarge({
      core: core(),
      result: result({ pleasure: 0, discomfort: 3, overload: 0 }),
      recentEvents: [event(25, 0), event(20, 0), event(18, 0)]
    });
    expect(decision.outcome).toBe('positive');
  });

  it('does not turn positive activation into a breakdown only because a crisis context is active', () => {
    const decision = evaluateTensionDischarge({
      core: core(), result: result(),
      recentEvents: [event(25, 0), event(20, 0)],
      activeContextIds: ['effect_panic']
    });
    expect(decision.outcome).toBe('overload');
    expect(decision.blockedByContext).toBe(true);
  });

  it('resolves a positive peak as overload when functional capacity is exhausted', () => {
    const decision = evaluateTensionDischarge({
      core: core({ capacity: 5 }), result: result(),
      recentEvents: [event(25, 0), event(20, 0)]
    });
    expect(decision.outcome).toBe('overload');
  });

  it('keeps a genuinely mixed peak distinct from discharge and breakdown', () => {
    const decision = evaluateTensionDischarge({
      core: core(),
      result: result({ pleasure: 20, discomfort: 15, overload: 10 }),
      recentEvents: [event(18, 12, 8), event(14, 13, 4)]
    });
    expect(decision.outcome).toBe('overload');
    expect(Math.abs(decision.activationBalance)).toBeLessThan(20);
  });
});
