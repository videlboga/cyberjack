import { runBackgroundSustainedTicks } from '../orchestration/backgroundTimeTick';
import { advanceWorldTime, getWorldClock } from './worldService';
import { enqueueBackgroundJob, listDueBackgroundJobs, listBackgroundJobs, claimBackgroundJob, recoverStaleBackgroundJobs, renewBackgroundJobLease, tryAcquireJobSlot, releaseJobSlot, markBackgroundJobDone, markBackgroundJobFailed } from '../orchestration/backgroundJobs';
import { materializeNextSubjectiveMemory } from '../workers/subjectiveMemoryWorker';
import { runAutonomousSceneMinute } from '../orchestration/autonomousScene';
import { runEpisodeIntervention, type EpisodeInterventionInput } from './worldService';
import { expireOverdueContracts } from '../services/contractService';
import { aggregateMemoryEpisodes } from '../services/memoryEpisodes';
import { memoryRepo } from '../infrastructure/repositories';
import { emitTrace, newRequestId } from '../orchestration/trace';

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
    // Expire accepted contracts whose deadline has passed (Этап 4).
    expireOverdueContracts(clock.totalMinutes);
    // After time is fixed, run any background jobs that have come due. Each
    // job is idempotent on (type, key), so a repeated worker run never
    // duplicates replicas or memories. LLM-backed jobs run in the background
    // (fire-and-forget) so a slow model never blocks the game clock.
    runDueBackgroundJobs(clock.totalMinutes);
    // Schedule the next low-priority memory materialization pass ~45 game
    // minutes out. Idempotent on the queue key, so only one is pending.
    scheduleMemoryMaterialization(clock.totalMinutes + MEMORY_MATERIALIZE_INTERVAL_MINUTES);
    // Schedule the next autonomous scene pulse at the next 5-minute boundary
    // strictly in the future, so a job is never created already-due and then
    // deferred to the following tick. Idempotent per world minute.
    const nextAutonomousMinute = Math.floor(clock.totalMinutes / AUTONOMOUS_INTERVAL_MINUTES) * AUTONOMOUS_INTERVAL_MINUTES + AUTONOMOUS_INTERVAL_MINUTES;
    enqueueBackgroundJob({
        type: 'scene.autonomous',
        key: `scene.autonomous:${nextAutonomousMinute}`,
        dueMinute: nextAutonomousMinute,
    });
    return clock;
}

const MEMORY_MATERIALIZE_INTERVAL_MINUTES = 45;
const AUTONOMOUS_INTERVAL_MINUTES = 5;

/**
 * Runs background jobs whose dueMinute has been reached. Each job is claimed
 * atomically (pending/failed -> running) so two workers can never run the same
 * job. LLM-backed jobs are awaited here but the caller fires this without
 * awaiting, so a slow model does not block the game clock.
 */
export function runDueBackgroundJobs(worldMinute: number) {
    // Recover jobs whose lease expired (a worker crashed or hung) so they can
    // be retried on the next pass.
    recoverStaleBackgroundJobs();
    const due = listDueBackgroundJobs(worldMinute);
    const requestId = newRequestId();
    if (due.length) {
        // Queue observability (Этап 10): pending/running ages in world minutes.
        const pendingJobs = listBackgroundJobs(100).filter(j => j.status === 'pending' || j.status === 'failed');
        emitTrace({
            traceId: requestId,
            requestId,
            stage: 'background.queue',
            startedAt: performance.now(),
            durationMs: 0,
            worldMinute,
            dueCount: due.length,
            pendingCount: pendingJobs.length,
            oldestPendingAgeMinutes: pendingJobs.length
                ? worldMinute - Math.min(...pendingJobs.map(j => j.dueMinute))
                : 0,
        });
    }
    // Cap concurrent LLM-backed jobs globally. tryAcquireJobSlot uses a
    // module-level counter, so the cap holds ACROSS game ticks, not just within
    // a single runDueBackgroundJobs call. Due jobs that cannot get a slot stay
    // claimed and will be picked up (and retried) on the next pass.
    for (const job of due) {
        // Atomically claim; skip if another worker already took it.
        const claimed = claimBackgroundJob(job.id);
        if (!claimed) continue;
        // Global concurrency gate: do not start more LLM jobs than the cap.
        if (!tryAcquireJobSlot()) {
            // No slot free: put the job back as pending so a later pass retries it.
            markBackgroundJobFailed(claimed.id, 'concurrency cap reached');
            continue;
        }
        const startedAt = performance.now();
        void (async () => {
            // Heartbeat: renew the lease periodically so a slow model response
            // is not declared stale and re-run while this call is still running.
            const heartbeat = setInterval(() => renewBackgroundJobLease(claimed.id), 15_000);
            try {
                await executeBackgroundJob(claimed);
                markBackgroundJobDone(claimed.id);
                emitTrace({ traceId: requestId, requestId, stage: 'background.job', startedAt, durationMs: Math.round(performance.now() - startedAt), jobType: claimed.type, jobId: claimed.id, status: 'done' });
            } catch (error: any) {
                markBackgroundJobFailed(claimed.id, error?.message || String(error));
                emitTrace({ traceId: requestId, requestId, stage: 'background.job', startedAt, durationMs: Math.round(performance.now() - startedAt), jobType: claimed.type, jobId: claimed.id, status: 'failed', error: String(error?.message || error) });
            } finally {
                clearInterval(heartbeat);
                releaseJobSlot();
            }
        })();
    }
}

async function executeBackgroundJob(job: { type: string; payload: string | null }) {
    // Job handlers are registered here. Each handler is responsible for its
    // own idempotency (the queue key already prevents duplicate enqueue).
    switch (job.type) {
        case 'memory.materialize':
            await materializeNextSubjectiveMemory();
            return;
        case 'scene.autonomous':
            await runAutonomousSceneMinute();
            return;
        case 'episode.intervene': {
            const input = JSON.parse(job.payload || '{}') as EpisodeInterventionInput;
            // Re-resolve the factual episode from the immutable source key.
            const memory = aggregateMemoryEpisodes(
                memoryRepo.listRecent(input.subjectId, 160, 'episode_v2'), 80,
            ).find(entry => `${entry.id}:${entry.moments.map(moment => moment.id).join(',')}` === input.memorySourceKey);
            if (!memory) throw new Error('Эпизод для внушения больше не найден');
            await runEpisodeIntervention({ ...input, memory });
            return;
        }
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

