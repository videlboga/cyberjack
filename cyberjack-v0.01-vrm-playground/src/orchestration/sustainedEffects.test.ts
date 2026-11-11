import { describe, expect, it } from 'vitest';
import { planSustainedPulses } from './sustainedEffects';

describe('sustained oral contact', () => {
  it('turns oral/giving into pulses directed at the character lips', () => {
    const [plan] = planSustainedPulses([{ actionId: 'act_start_oral_giving', pointId: 'lips' }], 8);
    expect(plan).toMatchObject({
      sourceActionId: 'act_start_oral_giving',
      presetId: 'sustained_sexual_pulse',
      pointId: 'lips',
      label: 'Продолжительный оральный контакт',
    });
  });

  it('uses the giving_deep phase when the oral modifier is active', () => {
    const [plan] = planSustainedPulses([
      { actionId: 'act_start_oral_giving', pointId: 'lips' },
      { actionId: 'act_deepen_oral', pointId: 'lips' },
    ], 8);
    expect(plan.label).toBe('Глубокий оральный контакт');
    expect(plan.pulses).toBeGreaterThan(1);
  });
});
