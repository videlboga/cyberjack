import { describe, expect, it } from 'vitest';
import { peakResolutionReady } from './triggers';

describe('peak resolution gate', () => {
  it('lets ordinary pleasant actions reshape balance without accidental discharge', () => {
    expect(peakResolutionReady({ outcome: 'positive' }, {
      pleasure: 3, discomfort: 0, overload: 0, experiencedIntensity: 10,
    }, 60)).toBe(false);
  });

  it('allows a strong pleasurable impulse to discharge', () => {
    expect(peakResolutionReady({ outcome: 'positive' }, {
      pleasure: 12, discomfort: 1, overload: 0, experiencedIntensity: 30,
    }, 60)).toBe(true);
  });

  it('gives moderate negative activation a rescue window', () => {
    expect(peakResolutionReady({ outcome: 'breakdown' }, {
      pleasure: 0, discomfort: 5, overload: 0, experiencedIntensity: 15,
    }, 40)).toBe(false);
  });

  it('still permits breakdown from acute distress', () => {
    expect(peakResolutionReady({ outcome: 'breakdown' }, {
      pleasure: 0, discomfort: 11, overload: 0, experiencedIntensity: 25,
    }, 40)).toBe(true);
  });
});
