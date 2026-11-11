import { describe, expect, it } from 'vitest';
import { buildTickCommitPlan } from './buildTickCommitPlan';

describe('buildTickCommitPlan', () => {
    it('assembles a commit plan that mirrors its input', () => {
        const input = {
            tickId: 'tick-1',
            subjectId: 'S-1',
            pointId: 'systemic',
            initiatorId: 'PL-1',
            presetId: 'stimulate',
            compiledAction: { actionKey: 'stimulate' } as any,
            output: { nextCore: {} } as any,
            observation: { behavioralState: 'engaged' },
            eventMetadata: { backgroundTime: false },
            learningScale: 0.8,
            stateBefore: { core: { sensitivity: 50 }, point: { localSensitivity: 50 } },
            resources: { id: 'S-1' },
            peakEvent: { presetId: 'peak', narrative: 'n' },
            commandEvent: { attempted: true, applied: true, narrative: 'cmd' },
            effects: [{ kind: 'event.append', event: {} }] as any[],
        };
        const plan = buildTickCommitPlan(input as any);
        expect(plan.tickId).toBe('tick-1');
        expect(plan.subjectId).toBe('S-1');
        expect(plan.pointId).toBe('systemic');
        expect(plan.initiatorId).toBe('PL-1');
        expect(plan.presetId).toBe('stimulate');
        expect(plan.compiledAction).toBe(input.compiledAction);
        expect(plan.output).toBe(input.output);
        expect(plan.observation).toBe(input.observation);
        expect(plan.learningScale).toBe(0.8);
        expect(plan.stateBefore.core).toBe(input.stateBefore.core);
        expect(plan.resources).toBe(input.resources);
        expect(plan.peakEvent).toBe(input.peakEvent);
        expect(plan.commandEvent).toEqual(input.commandEvent);
        expect(plan.effects).toHaveLength(1);
    });

    it('is pure: performs no writes and no side effects', () => {
        const input = {
            tickId: 't', subjectId: 'S', pointId: 'p', initiatorId: 'I', presetId: 'x',
            compiledAction: { actionKey: 'x' } as any, output: { nextCore: {} } as any,
            observation: {}, eventMetadata: undefined, learningScale: 1,
            stateBefore: { core: {} }, resources: {}, peakEvent: null,
            commandEvent: { attempted: false, applied: false }, effects: [],
        };
        // No DB access is performed; calling it multiple times is stable.
        const a = buildTickCommitPlan(input as any);
        const b = buildTickCommitPlan(input as any);
        expect(a).toEqual(b);
    });
});
