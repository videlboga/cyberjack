import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    advanceWorldTime:vi.fn(),
    getWorldClock:vi.fn(),
    runBackgroundSustainedTicks:vi.fn(),
}));

vi.mock('./worldService', () => ({
    advanceWorldTime:mocks.advanceWorldTime,
    getWorldClock:mocks.getWorldClock,
}));
vi.mock('../orchestration/backgroundTimeTick', () => ({
    runBackgroundSustainedTicks:mocks.runBackgroundSustainedTicks,
}));

import { advanceSimulationTime } from './simulationTime';

describe('advanceSimulationTime', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.advanceWorldTime.mockReturnValue({ totalMinutes:101 });
        mocks.getWorldClock.mockReturnValue({ totalMinutes:100 });
    });

    it('advances the clock and ongoing processes by the same minute count', async () => {
        const result = await advanceSimulationTime(1.4, 'Тест', { activeSubjectIds:['S-1'] });

        expect(mocks.advanceWorldTime).toHaveBeenCalledWith(1, 'Тест', { activeSubjectIds:['S-1'] });
        expect(mocks.runBackgroundSustainedTicks).toHaveBeenCalledWith(1);
        expect(result).toEqual({ totalMinutes:101 });
    });

    it('does not run a mechanical tick when no time passes', async () => {
        await expect(advanceSimulationTime(0)).resolves.toEqual({ totalMinutes:100 });
        expect(mocks.advanceWorldTime).not.toHaveBeenCalled();
        expect(mocks.runBackgroundSustainedTicks).not.toHaveBeenCalled();
    });
});
