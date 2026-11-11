import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    transaction: vi.fn((work: () => void) => () => work()),
    saveTickState: vi.fn(),
    saveResources: vi.fn(),
    appendEvent: vi.fn(),
    executeEffects: vi.fn(() => ({ applied: [], skipped: [] })),
    appendEffectEvents: vi.fn(),
}));

vi.mock('../infrastructure/db', () => ({
    db: { transaction: mocks.transaction },
}));
vi.mock('./saveTickState', () => ({ saveTickState: mocks.saveTickState }));
vi.mock('./tickEffectPlan', () => ({
    executeTickEffectPlan: mocks.executeEffects,
    appendTickEffectEvents: mocks.appendEffectEvents,
}));
vi.mock('../domain/intimatePartnerMechanics', () => ({
    isPartnerPointAction: () => false,
    intimateActorPoints: () => [],
    recordPartnerPointExperience: (preferences: unknown) => preferences,
}));
vi.mock('../infrastructure/repositories', () => ({
    characterItemsRepo: { get: vi.fn(), save: vi.fn() },
    eventLogRepo: { append: mocks.appendEvent },
    itemRepo: { get: vi.fn() },
    pointStateRepo: { getAllForSubject: vi.fn(() => []) },
    presetRepo: { getActionPreset: vi.fn() },
    resourceRepo: { save: mocks.saveResources },
    subjectRepo: { updatePreferences: vi.fn() },
}));

import { commitTickOutcome } from './commitTickOutcome';

describe('tick commit phase', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('commits primary state, resources and ordered system events in one transaction', () => {
        commitTickOutcome({
            tickId: 'tick-1',
            subjectId: 'subject-1',
            pointId: 'hands',
            initiatorId: 'PL-1',
            presetId: 'test-action',
            compiledAction: { actionKey: 'test-action', tags: [] } as any,
            output: {} as any,
            observation: {} as any,
            learningScale: 1,
            stateBefore: { core: {} as any },
            resources: { id: 'PL-1', resources: {} },
            peakEvent: { presetId: 'discharge', narrative: 'peak' },
            commandEvent: { attempted: true, applied: true, narrative: 'command' },
        });

        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.executeEffects).toHaveBeenCalledOnce();
        expect(mocks.saveTickState).toHaveBeenCalledOnce();
        expect(mocks.executeEffects.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.saveTickState.mock.invocationCallOrder[0]);
        expect(mocks.saveResources).toHaveBeenCalledOnce();
        expect(mocks.appendEvent).toHaveBeenCalledTimes(2);
        expect(mocks.appendEvent.mock.calls.map(call => call[1])).toEqual(['system_tick', 'system_trigger']);
        expect(mocks.saveTickState.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.appendEvent.mock.invocationCallOrder[0]);
    });
});
