import { runBackgroundSustainedTicks } from '../orchestration/backgroundTimeTick';
import { advanceWorldTime, getWorldClock } from './worldService';
import { enqueueBackgroundJob, listDueBackgroundJobs, markBackgroundJobDone, markBackgroundJobFailed, markBackgroundJobRunning } from '../orchestration/backgroundJobs';
import { materializeNextSubjectiveMemory } from '../workers/subjectiveMemoryWorker';

/**
 * Advances active simulation time.
 *
 * Unlike scenario time costs (travel, contracts, recruitment), this path also
 * advances every ongoing physical process once per crossed world minute.
 */
export async function advanceSimulationTime(
    minutes: number,
    reason?: string,
    options: { activeSubjectIds?: string[] } = {}
) {
    const amount = Math.max(0, Math.round(Number(minutes) || 0));
    if (!amount) return getWorldClock();
    const clock = advanceWorldTime(amount, reason, options);
    await runBackgroundSustainedTicks(amount);
    // After time is fixed, run any background jobs that have come due. Each
    // job is idempotent on (type, key), so a repeated worker run never
    // duplicates replicas or memories.
    await runDueBackgroundJobs(clock.totalMinutes);
    return clock;
}

/** Runs background jobs whose dueMinute has been reached. */
export async function runDueBackgroundJobs(worldMinute: number) {
    const due = listDueBackgroundJobs(worldMinute);
    for (const job of due) {
        markBackgroundJobRunning(job.id);
        try {
            await executeBackgroundJob(job);
            markBackgroundJobDone(job.id);
        } catch (error: any) {
            markBackgroundJobFailed(job.id, error?.message || String(error));
        }
    }
}

async function executeBackgroundJob(job: { type: string; payload: string | null }) {
    // Job handlers are registered here. Each handler is responsible for its
    // own idempotency (the queue key already prevents duplicate enqueue).
    switch (job.type) {
        case 'memory.materialize':
            await materializeNextSubjectiveMemory();
            return;
        default:
            throw new Error(`Unknown background job type: ${job.type}`);
    }
}

/**
 * Schedules a low-priority subjective-memory materialization pass. Idempotent
 * on the queue key: only one such job is pending at a time, so a repeated
 * worker run never duplicates memories.
 */
export function scheduleMemoryMaterialization(dueMinute: number) {
    return enqueueBackgroundJob({
        type: 'memory.materialize',
        key: 'memory.materialize',
        dueMinute,
    });
}

