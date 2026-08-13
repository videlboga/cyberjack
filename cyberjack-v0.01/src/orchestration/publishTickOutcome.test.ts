import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    emitMetrics: vi.fn(),
    recordObservation: vi.fn(),
}));

vi.mock('../scenario/eventDirector', () => ({ emitSubjectMetricChanges: mocks.emitMetrics }));
vi.mock('../services/sceneAwareness', () => ({ recordSceneObservation: mocks.recordObservation }));

import { publishTickOutcome } from './publishTickOutcome';

describe('tick publication phase', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    it('isolates a failed projection and continues publishing the others', () => {
        mocks.emitMetrics.mockImplementationOnce(() => { throw new Error('projection failed'); });
        publishTickOutcome({
            tickId: 'tick-1',
            subjectId: 'subject-1',
            before: {} as any,
            after: {} as any,
            sceneObservation: {} as any,
        });
        expect(mocks.emitMetrics).toHaveBeenCalledOnce();
        expect(mocks.recordObservation).toHaveBeenCalledOnce();
    });
});
