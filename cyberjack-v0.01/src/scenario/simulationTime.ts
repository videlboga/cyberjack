import { runBackgroundSustainedTicks } from '../orchestration/backgroundTimeTick';
import { advanceWorldTime, getWorldClock, TimeAdvanceOptions } from './worldService';

/**
 * Advances active simulation time.
 *
 * Unlike scenario time costs (travel, contracts, recruitment), this path also
 * advances every ongoing physical process once per crossed world minute.
 */
export async function advanceSimulationTime(
    minutes: number,
    reason?: string,
    options: TimeAdvanceOptions = {}
) {
    const amount = Math.max(0, Math.round(Number(minutes) || 0));
    if (!amount) return getWorldClock();
    const clock = advanceWorldTime(amount, reason, options);
    await runBackgroundSustainedTicks(amount);
    return clock;
}
