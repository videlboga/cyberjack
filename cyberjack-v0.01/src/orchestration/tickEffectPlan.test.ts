import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    contexts: [] as Array<{ id: string; actionId: string }>,
    applyContext: vi.fn(() => ({ applied: true, blocked: false })),
    removeAction: vi.fn(),
    removeId: vi.fn(),
    appendEvent: vi.fn(),
    setSlot: vi.fn(),
    soften: vi.fn(),
    recordIgnored: vi.fn(),
    softenAll: vi.fn(),
    saveStance: vi.fn(),
    savePoint: vi.fn(),
    edgeClear: vi.fn(),
    edgeUpdate: vi.fn(),
    pendingClear: vi.fn(),
    pendingSave: vi.fn(),
    triggerSet: vi.fn(),
    processTick: vi.fn(),
    setPresence: vi.fn(),
    clearSetup: vi.fn(),
}));

vi.mock('./contextManager', () => ({
    ContextManager: {
        applyContext: mocks.applyContext,
        processTick: mocks.processTick,
    },
}));
vi.mock('../infrastructure/repositories', () => ({
    activeContextsRepo: {
        getAllForSubject: () => mocks.contexts,
        removeByActionId: mocks.removeAction,
        remove: mocks.removeId,
    },
    eventLogRepo: { append: mocks.appendEvent },
    sceneCharacterRepo: { set: mocks.setSlot },
    pointStateRepo: { save: mocks.savePoint },
    subjectEdgeStateRepo: { clear: mocks.edgeClear, update: mocks.edgeUpdate },
    stateTriggersRepo: { set: mocks.triggerSet },
}));
vi.mock('../infrastructure/interactionStanceRepo', () => ({
    interactionStanceRepo: {
        soften: mocks.soften,
        recordIgnored: mocks.recordIgnored,
        softenAll: mocks.softenAll,
        save: mocks.saveStance,
    },
}));
vi.mock('../infrastructure/pendingCommandRepo', () => ({
    pendingCommandRepo: { clear: mocks.pendingClear, save: mocks.pendingSave },
}));
vi.mock('../scenario/calibrationContextCleanup', () => ({
    clearCalibrationSetupContexts: mocks.clearSetup,
}));
vi.mock('../scenario/spatialContext', () => ({
    setLaboratoryPresence: mocks.setPresence,
}));

import { appendTickEffectEvents, executeTickEffectPlan } from './tickEffectPlan';

describe('tick effect plan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.contexts.length = 0;
    });

    it('does not emit an event when a planned context application is blocked', () => {
        mocks.applyContext.mockReturnValueOnce({ applied: false, blocked: true } as any);
        const result = executeTickEffectPlan([{
            kind: 'context.apply',
            subjectId: 'subject-1',
            actionId: 'pose-test',
            action: { contextConfig: {} } as any,
            event: {
                subjectId: 'subject-1', type: 'context_change', presetId: 'pose-test', narrative: 'applied',
            },
        }]);
        expect(result.applied).toEqual([]);
        expect(result.skipped).toHaveLength(1);
        expect(mocks.appendEvent).not.toHaveBeenCalled();
    });

    it('persists an effect event only after the effect succeeds', () => {
        mocks.contexts.push({ id: 'ctx-1', actionId: 'clothing' });
        executeTickEffectPlan([{
            kind: 'context.remove-action',
            subjectId: 'subject-1',
            actionId: 'clothing',
            event: {
                subjectId: 'subject-1', type: 'context_change', presetId: 'remove', narrative: 'removed',
            },
        }]);
        expect(mocks.removeAction).toHaveBeenCalledOnce();
        expect(mocks.appendEvent).toHaveBeenCalledOnce();
        expect(mocks.removeAction.mock.invocationCallOrder[0]).toBeLessThan(mocks.appendEvent.mock.invocationCallOrder[0]);
    });

    it('can defer effect events until primary state persistence has completed', () => {
        mocks.contexts.push({ id: 'ctx-1', actionId: 'clothing' });
        const result = executeTickEffectPlan([{
            kind: 'context.remove-action',
            subjectId: 'subject-1',
            actionId: 'clothing',
            event: {
                subjectId: 'subject-1', type: 'context_change', presetId: 'remove', narrative: 'removed',
            },
        }], { appendEvents: false });
        expect(mocks.appendEvent).not.toHaveBeenCalled();
        appendTickEffectEvents(result.applied);
        expect(mocks.appendEvent).toHaveBeenCalledOnce();
    });

    it('represents an audit-only event without inventing a state mutation', () => {
        const result = executeTickEffectPlan([{
            kind: 'event.append',
            event: {
                subjectId: 'subject-1', type: 'system_trigger', presetId: 'refusal', narrative: 'refused',
            },
        }], { appendEvents: false });
        expect(result.applied).toHaveLength(1);
        expect(mocks.appendEvent).not.toHaveBeenCalled();
        appendTickEffectEvents(result.applied);
        expect(mocks.appendEvent).toHaveBeenCalledOnce();
    });

    it('applies stance, point, edge, pending-command and state-trigger effects without emitting events', () => {
        const result = executeTickEffectPlan([
            { kind: 'stance.soften', subjectId: 's', actorId: 'a', amount: 0.2 },
            { kind: 'stance.record-ignored', subjectId: 's', actorId: 'a' },
            { kind: 'stance.soften-all', subjectId: 's', amount: 0.3 },
            { kind: 'stance.save', stance: { subjectId: 's', actorId: 'a', request: 'stop', scopePoints: [], scopeTags: [], intensity: 0.5, ignoredCount: 0 } as any },
            { kind: 'point.save', subjectId: 's', point: { pointId: 'systemic', localSensitivity: 50, localAttitude: 50, localOpenness: 50, familiarity: 0, exposureCount: 0 } as any },
            { kind: 'edge.clear', subjectId: 's' },
            { kind: 'edge.update', subjectId: 's', state: { enteredAtMinute: 1, cycles: 0, valence: 'positive' }, worldMinute: 2 },
            { kind: 'pending-command.clear', subjectId: 's', playerId: 'p' },
            { kind: 'pending-command.save', focus: { subjectId: 's', playerId: 'p', sceneId: 'sc', sourceText: '', description: '', intent: { type: 'none' } } as any },
            { kind: 'state-trigger.set', subjectId: 's', triggerCode: 'apathy', ticks: 1 },
            { kind: 'context.age', subjectId: 's', deltaTime: 1, elapsedMinutes: 1 },
        ], { appendEvents: false });
        expect(result.applied).toHaveLength(11);
        expect(mocks.soften).toHaveBeenCalledTimes(1);
        expect(mocks.recordIgnored).toHaveBeenCalledOnce();
        expect(mocks.softenAll).toHaveBeenCalledOnce();
        expect(mocks.saveStance).toHaveBeenCalledOnce();
        expect(mocks.savePoint).toHaveBeenCalledOnce();
        expect(mocks.edgeClear).toHaveBeenCalledOnce();
        expect(mocks.edgeUpdate).toHaveBeenCalledOnce();
        expect(mocks.pendingClear).toHaveBeenCalledOnce();
        expect(mocks.pendingSave).toHaveBeenCalledOnce();
        expect(mocks.triggerSet).toHaveBeenCalledOnce();
        expect(mocks.processTick).toHaveBeenCalledOnce();
        expect(mocks.appendEvent).not.toHaveBeenCalled();
    });

    it('applies laboratory presence and setup-context clearing without emitting events', () => {
        const result = executeTickEffectPlan([
            { kind: 'lab.set-presence', characterId: 'c', slotId: 'room:r', roomId: 'r', status: 'resident', playerId: 'p' },
            { kind: 'lab.clear-setup-contexts', subjectId: 'c' },
        ], { appendEvents: false });
        expect(result.applied).toHaveLength(2);
        expect(mocks.setPresence).toHaveBeenCalledOnce();
        expect(mocks.clearSetup).toHaveBeenCalledOnce();
        expect(mocks.appendEvent).not.toHaveBeenCalled();
    });
});
