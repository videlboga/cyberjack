import { describe, expect, it } from 'vitest';
import {
    actionConflictsWithStance,
    actionRespectsStance,
    boundaryAcknowledgementStrength,
    boundaryValencePenalty,
    requestedStanceFromReaction,
} from './interactionStance';

describe('interaction stance', () => {
    const stance = {
        subjectId: 'sumi', actorId: 'player', request: 'stop' as const,
        scopePoints: ['arms'], scopeTags: ['contact'], intensity: .8,
        sourceActionId: 'gentle_stroke', ignoredCount: 0,
    };

    it('derives a stop request from the kernel reaction without reading speech', () => {
        expect(requestedStanceFromReaction({
            subjectId: 'sumi', actorId: 'player', pointId: 'arms',
            action: { actionKey: 'gentle_stroke', contact: .5 },
            appraisal: -.72, discomfort: 1, overload: 0,
        })).toMatchObject({ request: 'stop', scopePoints: ['arms'], scopeTags: ['contact'] });
    });

    it('detects continued scoped contact as ignoring the request', () => {
        expect(actionConflictsWithStance(stance, {
            actionKey: 'feather_stroke', contact: .3, tags: ['sensory'],
        }, 'arms')).toBe(true);
        expect(boundaryValencePenalty(stance)).toBeGreaterThan(.8);
    });

    it('treats only an actual stop as compliance', () => {
        expect(actionRespectsStance({ actionKey: 'act_end_exposure', contact: 0 })).toBe(true);
        expect(actionRespectsStance({ actionKey: 'wait', contact: 0 })).toBe(false);
        expect(actionConflictsWithStance(stance, { actionKey: 'wait', contact: 0 }, 'arms')).toBe(false);
    });

    it('distinguishes a clear stop confirmation from a weak acknowledgement', () => {
        expect(boundaryAcknowledgementStrength('Но теперь остановился')).toBe(1);
        expect(boundaryAcknowledgementStrength('Хорошо')).toBe(.65);
        expect(boundaryAcknowledgementStrength('Почему?')).toBe(0);
    });

    it('does not turn negative dialogue into a global physical boundary', () => {
        expect(requestedStanceFromReaction({
            subjectId: 'eli', actorId: 'player', pointId: 'systemic',
            action: { actionKey: 'verbal_pressure', contact: 0, tags: ['mental'] },
            appraisal: -.8, discomfort: 4, overload: 0,
        })).toBeNull();
    });

    it('does not mistake positively appraised pain for a stop request', () => {
        expect(requestedStanceFromReaction({
            subjectId: 'mai', actorId: 'player', pointId: 'shoulders',
            action: { actionKey: 'deep_massage', contact: .9, tags: ['pain'] },
            appraisal: 1, discomfort: 13.9, overload: 1.1,
        })).toBeNull();
    });

    it('keeps a protective slow-down for actual overload even when liked', () => {
        expect(requestedStanceFromReaction({
            subjectId: 'mai', actorId: 'player', pointId: 'shoulders',
            action: { actionKey: 'firm_grip', contact: .8, tags: ['pain'] },
            appraisal: .6, discomfort: 18, overload: 60,
        })).toMatchObject({ request: 'slow_down' });
    });

    it('does not create a protective boundary from moderate sensory load', () => {
        expect(requestedStanceFromReaction({
            subjectId: 'mai', actorId: 'player', pointId: 'shoulders',
            action: { actionKey: 'firm_grip', contact: .8, tags: ['pain'] },
            appraisal: .6, discomfort: 18, overload: 45,
        })).toBeNull();
    });

    it('does not apply a hands boundary to shoulders', () => {
        expect(actionConflictsWithStance(stance, {
            actionKey: 'gentle_stroke', contact: .4, tags: ['affection'],
        }, 'shoulders')).toBe(false);
    });
});
