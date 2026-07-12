import { describe, expect, it } from 'vitest';
import { advanceBaseline, dampTowardsBaseline } from '../src/engine/baselineUtils';

describe('baseline time scaling', () => {
  it('makes one 20-unit damping step equivalent to twenty 1-unit steps', () => {
    const cfg = { dampingBase: .1, dampingDistanceScale: 0, maxDamping: .5 };
    let repeated = 20;
    for (let i=0;i<20;i++) repeated = dampTowardsBaseline(repeated, 50, cfg);
    const single = dampTowardsBaseline(20, 50, { ...cfg, timeScale: 20 });
    expect(single).toBeCloseTo(repeated, 10);
  });

  it('makes one 20-unit baseline step equivalent to twenty 1-unit steps', () => {
    const cfg = { baseRate: .01, plasticityWeight: 1, opennessWeight: 1, noveltyBase: 1, noveltyScale: 0 };
    const driver = { plasticity: 50, openness: 50, novelty: .5 };
    let repeated = 40;
    for (let i=0;i<20;i++) repeated = advanceBaseline(repeated, 60, driver, cfg);
    const single = advanceBaseline(40, 60, driver, { ...cfg, timeScale: 20 });
    expect(single).toBeCloseTo(repeated, 10);
  });
});
