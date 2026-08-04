import { describe, expect, it } from 'vitest';
import { arousalDirection, passiveArousalAfterMinutes } from './arousalDynamics';

describe('narrative arousal regulation', () => {
    it('keeps intimate stimulation exciting even when positively accepted', () => {
        expect(arousalDirection({ actionKey: 'licking', tags: ['sexual'] }, 'clitoris', .8, 90).excitation).toBe(1);
    });

    it('turns stopping and slowing existing stimulation into regulation', () => {
        expect(arousalDirection({ actionKey: 'act_stop_vibrator' }, 'clitoris', .4, 92).regulation).toBe(1);
        expect(arousalDirection({ actionKey: 'act_decrease_friction' }, 'vagina', .4, 92).regulation).toBeGreaterThan(.4);
    });

    it('lets accepted non-intimate soothing contact settle an edge state', () => {
        const direction = arousalDirection({ actionKey: 'gentle_stroke' }, 'hair', .5, 90);
        expect(direction.excitation).toBe(0);
        expect(direction.regulation).toBeGreaterThan(0);
    });

    it('does not make the same touch a universal sedative', () => {
        expect(arousalDirection({ actionKey: 'gentle_stroke' }, 'vulva', .5, 90).excitation).toBe(1);
        expect(arousalDirection({ actionKey: 'gentle_stroke' }, 'hair', .5, 30).regulation).toBe(0);
    });
});

describe('passive arousal settling', () => {
    it('settles slowly over ordinary world minutes', () => {
        expect(passiveArousalAfterMinutes(90, 1)).toBeCloseTo(89.39, 3);
        expect(passiveArousalAfterMinutes(90, 10)).toBeGreaterThan(83);
        expect(passiveArousalAfterMinutes(90, 10)).toBeLessThan(85);
        expect(passiveArousalAfterMinutes(90, 60)).toBeGreaterThan(56);
        expect(passiveArousalAfterMinutes(90, 60)).toBeLessThan(60);
    });

    it('never crosses below zero', () => {
        expect(passiveArousalAfterMinutes(.1, 10)).toBe(0);
    });
});
