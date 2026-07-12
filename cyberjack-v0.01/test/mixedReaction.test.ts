import { describe, expect, it } from 'vitest';
import { computeResult } from '../src/engine/computeResult';

const core = (capacity=60): any => ({ sensitivity:55, capacity, openness:55, plasticity:60, attitude:60, tension:0 });
const point: any = { pointId:'hands', localSensitivity:55, localAttitude:60, familiarity:0, exposureCount:0 };
const action = (overrides:Record<string,number>={}): any => ({
  actionKey:'test', label:'Test', type:'physical', tags:[],
  intensity:.6, valence:.8, contact:.8, sharpness:.2, novelty:.5,
  ...overrides
});

describe('mixed pleasure and discomfort', () => {
  it('allows a positive sharp action to produce both pleasure and discomfort', () => {
    const { result, tickMeta } = computeResult(action({ sharpness:.8 }), core(), point);
    expect(result.pleasure).toBeGreaterThan(0);
    expect(result.discomfort).toBeGreaterThan(0);
    expect(tickMeta.derived.sharpDiscomfort).toBeGreaterThan(0);
  });

  it('keeps a gentle accepted action predominantly pleasant', () => {
    const { result } = computeResult(action({ intensity:.2, contact:.4, sharpness:.05, valence:.7 }), core(), point);
    expect(result.pleasure).toBeGreaterThan(result.discomfort);
  });

  it('makes the same strong action less comfortable at low capacity', () => {
    const high = computeResult(action(), core(80), point).result;
    const low = computeResult(action(), core(20), point).result;
    expect(low.discomfort).toBeGreaterThan(high.discomfort);
  });

  it('preserves emotional discomfort for negative valence', () => {
    const { result, tickMeta } = computeResult(action({ valence:-.7, sharpness:.1 }), core(), point);
    expect(result.discomfort).toBeGreaterThan(0);
    expect(tickMeta.derived.emotionalDiscomfort).toBeGreaterThan(0);
  });

  it('adds overload as a separate discomfort component', () => {
    const { tickMeta } = computeResult(action({ intensity:1, sharpness:1, contact:1 }), core(10), point);
    expect(tickMeta.derived.overloadDiscomfort).toBeGreaterThan(0);
  });
});
