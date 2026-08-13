import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../infrastructure/db';
import {
    clearBackgroundJobs, enqueueBackgroundJob, listBackgroundJobs,
    listDueBackgroundJobs, claimBackgroundJob, markBackgroundJobDone, markBackgroundJobFailed,
    markBackgroundJobRunning, renewBackgroundJobLease, recoverStaleBackgroundJobs, tryAcquireJobSlot, releaseJobSlot,
} from './backgroundJobs';

describe('backgroundJobs', () => {
    beforeEach(() => {
        clearBackgroundJobs();
    });

    it('enqueues a job and lists it', () => {
        const job = enqueueBackgroundJob({ type: 'memory', key: 'S-1:ep1', dueMinute: 100 });
        expect(job).toBeDefined();
        expect(job!.status).toBe('pending');
        expect(job!.dueMinute).toBe(100);
        expect(listBackgroundJobs()).toHaveLength(1);
    });

    it('is idempotent on (type, key) while pending', () => {
        enqueueBackgroundJob({ type: 'memory', key: 'S-1:ep1', dueMinute: 100 });
        const again = enqueueBackgroundJob({ type: 'memory', key: 'S-1:ep1', dueMinute: 200 });
        expect(again!.dueMinute).toBe(100); // unchanged while pending
        expect(listBackgroundJobs()).toHaveLength(1);
    });

    it('selects only due jobs in due order', () => {
        enqueueBackgroundJob({ type: 'a', key: 'a1', dueMinute: 50 });
        enqueueBackgroundJob({ type: 'b', key: 'b1', dueMinute: 10 });
        enqueueBackgroundJob({ type: 'c', key: 'c1', dueMinute: 200 });
        const due = listDueBackgroundJobs(100);
        expect(due.map(j => j.type)).toEqual(['b', 'a']);
    });

    it('tracks running/done/failed lifecycle', () => {
        const job = enqueueBackgroundJob({ type: 'x', key: 'x1', dueMinute: 0 })!;
        markBackgroundJobRunning(job.id);
        expect(listDueBackgroundJobs(0)).toHaveLength(0); // running not due
        markBackgroundJobDone(job.id);
        expect(listDueBackgroundJobs(0)).toHaveLength(0); // done not due
        const failed = enqueueBackgroundJob({ type: 'y', key: 'y1', dueMinute: 0 })!;
        markBackgroundJobRunning(failed.id);
        markBackgroundJobFailed(failed.id, 'boom');
        const retried = enqueueBackgroundJob({ type: 'y', key: 'y1', dueMinute: 0 })!;
        expect(retried.status).toBe('pending'); // failed can be re-enqueued
        expect(retried.attempts).toBe(1);
    });

    it('claims a job atomically so two workers cannot run the same job', () => {
        const job = enqueueBackgroundJob({ type: 'z', key: 'z1', dueMinute: 0 })!;
        const first = claimBackgroundJob(job.id);
        expect(first).not.toBeNull();
        expect(first!.status).toBe('running');
        expect(first!.attempts).toBe(1);
        // Second worker tries to claim the same job: must be rejected.
        const second = claimBackgroundJob(job.id);
        expect(second).toBeNull();
        // A failed job can be claimed again (retry path).
        markBackgroundJobFailed(job.id, 'boom');
        const retry = claimBackgroundJob(job.id);
        expect(retry).not.toBeNull();
        expect(retry!.attempts).toBe(2);
    });

    it('enforces a global concurrency gate across calls (not per run)', () => {
        // Acquire the maximum slots; a further acquire must fail even though
        // this is a separate "tick" (no per-call reset).
        expect(tryAcquireJobSlot()).toBe(true);
        expect(tryAcquireJobSlot()).toBe(true);
        expect(tryAcquireJobSlot()).toBe(false);
        // Releasing frees a slot so a later acquire succeeds.
        releaseJobSlot();
        expect(tryAcquireJobSlot()).toBe(true);
        releaseJobSlot();
        releaseJobSlot();
        releaseJobSlot();
        // All released.
        expect(tryAcquireJobSlot()).toBe(true);
        releaseJobSlot();
    });

    it('renews a running job lease so a slow model is not declared stale', () => {
        const job = enqueueBackgroundJob({ type: 'x', key: 'x1', dueMinute: 0 })!;
        claimBackgroundJob(job.id);
        const before = job.leaseUntil ?? 0;
        // Renewal must extend the lease past the original expiry.
        const renewed = renewBackgroundJobLease(job.id);
        expect(renewed).toBeGreaterThan(before);
        // After renewal the job is not stale.
        expect(recoverStaleBackgroundJobs()).toBe(0);
    });
});
