import { runBackgroundSustainedTicks } from '../orchestration/backgroundTimeTick';
import { advanceWorldTime, getWorldClock } from './worldService';
import { enqueueBackgroundJob, listDueBackgroundJobs, markBackgroundJobDone, markBackgroundJobFailed, markBackgroundJobRunning } from '../orchestration/backgroundJobs';
import { materializeNextSubjectiveMemory } from '../workers/subjectiveMemoryWorker';
import { runAutonomousSceneMinute } from '../orchestration/autonomousScene';
import { runEpisodeIntervention, type EpisodeInterventionInput } from './worldService';
import { aggregateMemoryEpisodes } from '../services/memoryEpisodes';
import { memoryRepo } from '../infrastructure/repositories';

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
    // Schedule the next low-priority memory materialization pass ~45 game
    // minutes out. Idempotent on the queue key, so only one is pending.
    scheduleMemoryMaterialization(clock.totalMinutes + MEMORY_MATERIALIZE_INTERVAL_MINUTES);
    // Schedule the next autonomous scene pulse at the next 5-minute boundary.
    // Idempotent per world minute, so a repeated worker run never duplicates
    // an autonomous action.
    const nextAutonomousMinute = Math.ceil(clock.totalMinutes / AUTONOMOUS_INTERVAL_MINUTES) * AUTONOMOUS_INTERVAL_MINUTES;
    enqueueBackgroundJob({
        type: 'scene.autonomous',
        key: `scene.autonomous:${nextAutonomousMinute}`,
        dueMinute: nextAutonomousMinute,
    });
    return clock;
}

const MEMORY_MATERIALIZE_INTERVAL_MINUTES = 45;
const AUTONOMOUS_INTERVAL_MINUTES = 5;

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

