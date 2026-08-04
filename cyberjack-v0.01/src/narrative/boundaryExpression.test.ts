import { describe, expect, it } from 'vitest';
import { buildBoundaryExpression } from './boundaryExpression';

const core = { capacity: 50 } as any;
function observation(values: any = {}) {
    const { fear = 20, agency = 50, resistance = 45, trust = 30, dissociation = 0, learnedCompliance = 0, control = 50, ignored = false, state = 'responsive' } = values;
    return {
        behavioralState: state,
        reactionSnapshot: {
            boundary: { request: 'stop', ignored, respected: false, intensity: .8 },
            appraisal: { agency, trust, willingness: 0, valence: -.8 },
            affect: { control },
            behavior: { resistance, desiredResponse: 'stop' },
            dynamics: { fear, dissociation, learnedCompliance, resistance, dependency: 0 },
        },
    } as any;
}

describe('boundary expression strategy', () => {
    it('turns high fear and low agency into a plea without weakening stop', () => {
        const frame = buildBoundaryExpression(observation({ fear: 90, agency: 15, resistance: 20, control: 30 }), core)!;
        expect(frame.need).toBe('stop');
        expect(frame.strategy).toBe('plea');
        expect(frame.force).toBe('desperate');
        expect(frame.instruction).toContain('пытаешься вызвать сочувствие');
        expect(frame.instruction).not.toContain('мольба');
    });

    it('turns high fear plus resistance into an urgent command', () => {
        const frame = buildBoundaryExpression(observation({ fear: 85, agency: 45, resistance: 85 }), core)!;
        expect(frame.strategy).toBe('command');
        expect(frame.directness).toBe('direct');
    });

    it('uses appeasement when fear combines with learned compliance', () => {
        const frame = buildBoundaryExpression(observation({ fear: 85, agency: 20, resistance: 20, learnedCompliance: 80 }), core)!;
        expect(frame.strategy).toBe('appeasement');
        expect(frame.need).toBe('stop');
    });

    it('does not force speech after dissociative collapse', () => {
        const frame = buildBoundaryExpression(observation({ dissociation: 90, ignored: true }), core)!;
        expect(frame.strategy).toBe('concealed');
        expect(frame.escalation).toBe('collapsed');
    });
});
