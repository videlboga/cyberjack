import { describe, expect, it } from 'vitest';
import { planSustainedPulses } from '../src/orchestration/sustainedEffects';

describe('sustained effect pulse planning', () => {
    it('creates periodic vibration pulses on the installed point', () => {
        expect(planSustainedPulses([
            { actionId: 'act_start_vibrator', pointId: 'vulva' }
        ], 8)).toEqual([expect.objectContaining({
            presetId: 'sustained_vibration_pulse', pointId: 'vulva', pulses: 2
        })]);
    });

    it('keeps boost as a level of one continuous effect', () => {
        const plans = planSustainedPulses([
            { actionId: 'act_start_electrostimulation', pointId: 'nipples' },
            { actionId: 'act_adjust_electrostimulation', pointId: 'nipples' }
        ], 20);
        expect(plans).toHaveLength(1);
        expect(plans[0]).toMatchObject({ pointId: 'nipples', pulses: 4, label: 'Интенсивная продолжительная электростимуляция' });
    });

    it('stops producing pulses after the active context is removed', () => {
        expect(planSustainedPulses([{ actionId: 'act_connect_tens', pointId: 'nipples' }], 8)).toEqual([]);
    });
});
