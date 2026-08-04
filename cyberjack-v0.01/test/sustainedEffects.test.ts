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

    it('does not send an equipment occupancy slot to the physical tick', () => {
        expect(planSustainedPulses([
            { actionId: 'act_start_vibrator', pointId: 'active_vibration_handheld' }
        ], 8)[0]).toMatchObject({ pointId: 'clitoris' });
    });

    it('stops producing pulses after the active context is removed', () => {
        expect(planSustainedPulses([{ actionId: 'act_connect_tens', pointId: 'nipples' }], 8)).toEqual([]);
    });

    it('turns an active sexual interaction into periodic pulses', () => {
        const plans = planSustainedPulses([
            { actionId: 'act_start_penetration', pointId: 'vagina' },
            { actionId: 'act_increase_friction', pointId: 'vagina' }
        ], 12);
        expect(plans).toEqual([expect.objectContaining({
            presetId: 'sustained_sexual_pulse', pointId: 'vagina', pulses: 6, label: 'Быстрые фрикции'
        })]);
    });

    it('makes fast sexual pace produce more pulses in the same interval', () => {
        const steady = planSustainedPulses([
            { actionId: 'finger_insertion', pointId: 'vagina' }
        ], 8)[0];
        const fast = planSustainedPulses([
            { actionId: 'finger_insertion', pointId: 'vagina' },
            { actionId: 'act_increase_friction', pointId: 'vagina' }
        ], 8)[0];
        expect(steady.pulses).toBe(2);
        expect(fast.pulses).toBe(4);
    });
});
