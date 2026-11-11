import { describe, expect, it } from 'vitest';
import { buildPhysicalReaction } from './physicalReaction';

const core = { sensitivity: 50, capacity: 75, openness: 30, plasticity: 40, attitude: 20, tension: 25 } as any;
const action = { actionKey: 'whip_strike', label: 'Удар хлыстом', contact: .8, sharpness: .9, tags: ['impact', 'pain'] } as any;

function observation(overrides: any = {}) {
    return {
        contact: 'full', behavioralState: 'responsive', contexts: [],
        reaction: { pleasure: 0, discomfort: 35, overload: 8, appraisal: -.8, experiencedIntensity: 32 },
        reactionSnapshot: {
            appraisal: { willingness: 5, valence: -.8 }, affect: { control: 75 },
            behavior: { resistance: 80, desiredResponse: 'stop' },
        },
        ...overrides,
    } as any;
}

describe('parameterized physical reaction', () => {
    it('lets strong self-control suppress a gasp without suppressing the bodily reflex', () => {
        const result = buildPhysicalReaction(observation(), action, core)!;
        expect(result.movementIntent).toBe('withdraw');
        expect(result.reflex).toBe('spasm');
        expect(result.involuntarySound).toBe('breath');
        expect(result.subjectiveText).toContain('отстраняешься');
        expect(result.observerText).toContain('Персонаж отстраняется');
    });

    it('separates attempted withdrawal from movement blocked by restraints', () => {
        const result = buildPhysicalReaction(observation({ contact: 'forced', contexts: [{ role: 'restraint' }] }), action, core)!;
        expect(result.movementRealization).toBe('blocked');
        expect(result.subjectiveText).toContain('фиксация');
        expect(result.subjectiveText).toContain('пытаешься отстраниться');
    });

    it('allows an accepted pleasant touch to produce approach without equating it to reflex', () => {
        const pleasant = observation({
            reaction: { pleasure: 24, discomfort: 1, overload: 0, appraisal: .8, experiencedIntensity: 12 },
            reactionSnapshot: { appraisal: { willingness: 82, valence: .8 }, affect: { control: 70 }, behavior: { resistance: 4, desiredResponse: 'continue' } },
        });
        const result = buildPhysicalReaction(pleasant, { ...action, sharpness: 0, actionKey: 'gentle_stroke' }, core)!;
        expect(result.movementIntent).toBe('approach');
        expect(result.subjectiveText).toContain('навстречу прикосновению');
    });

    it('describes freeze as immobility rather than acceptance', () => {
        const result = buildPhysicalReaction(observation({ behavioralState: 'freeze' }), action, core)!;
        expect(result.movementIntent).toBe('hold');
        expect(result.subjectiveText).toContain('не означает принятия');
    });
});
