import { describe, expect, it } from 'vitest';
import { canPerformPartnerPointAction, partnerPointAffinity, recordPartnerPointExperience } from './intimatePartnerMechanics';

describe('intimate partner mechanics', () => {
  it('requires male anatomy for penetration while allowing hands for finger contact', () => {
    expect(canPerformPartnerPointAction(['hands', 'lips'], 'act_start_penetration', ['sexual'], 'vagina')).toBe(false);
    expect(canPerformPartnerPointAction(['penis'], 'act_start_penetration', ['sexual'], 'vagina')).toBe(true);
    expect(canPerformPartnerPointAction(['hands'], 'finger_insertion', ['sexual'], 'vagina')).toBe(true);
  });

  it('keeps attraction and familiarity scoped to one partner point', () => {
    const preferences = recordPartnerPointExperience({}, 'eli', 'vulva', .7);
    expect(partnerPointAffinity(preferences, 'eli', 'vulva')).toBeGreaterThan(0);
    expect(partnerPointAffinity(preferences, 'eli', 'neck')).toBe(0);
  });
});
