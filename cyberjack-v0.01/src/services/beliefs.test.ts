import { describe, expect, it } from 'vitest';
import { beliefConvictionDelta, evolveBelief, ScriptSeed } from './beliefs';

const seed: ScriptSeed = {
    script: 'Не доверяй / Будь сильной',
    lifePosition: 'ok_not_ok',
    racket: 'Праведный гнев / недоверие',
    game: 'nigsyb',
};

describe('beliefConvictionDelta', () => {
    it('sums agency conviction deltas', () => {
        expect(beliefConvictionDelta(['wanted', 'mixed'])).toBeCloseTo(0.02);
        expect(beliefConvictionDelta(['lost_control', 'lost_control'])).toBeCloseTo(-0.12);
    });
});

describe('evolveBelief', () => {
    it('keeps base position at neutral experience', () => {
        const b = evolveBelief(seed, { agencies: [], cooperativeCount: 0 });
        expect(b.conviction).toBe(0.5);
        expect(b.lifePosition).toBe('ok_not_ok');
        expect(b.shiftedLifePosition).toBeUndefined();
        expect(b.axes.length).toBe(4);
    });

    it('shifts position when conviction drops', () => {
        const b = evolveBelief(seed, { agencies: ['lost_control', 'lost_control', 'lost_control', 'lost_control'], cooperativeCount: 0 });
        expect(b.conviction).toBeLessThanOrEqual(0.3);
        expect(b.shiftedLifePosition).toBe('not_ok_not_ok');
        expect(b.scriptText).toContain('перестаю верить');
    });

    it('softens prohibition on cooperative experience', () => {
        const b = evolveBelief(seed, { agencies: ['wanted'], cooperativeCount: 8 });
        const prohibition = b.axes.find(a => a.kind === 'prohibition')!;
        expect(prohibition.conviction).toBeLessThan(0.5);
        expect(b.scriptText).toContain('сомневаться');
    });

    it('clamps conviction to [0,1]', () => {
        expect(evolveBelief(seed, { agencies: ['wanted'], cooperativeCount: 0 }).conviction).toBeGreaterThan(0.5);
    });
});
