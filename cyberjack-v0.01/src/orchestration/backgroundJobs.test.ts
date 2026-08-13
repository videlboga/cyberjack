import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../infrastructure/db';
import {
    clearBackgroundJobs, enqueueBackgroundJob, listBackgroundJobs,
    listDueBackgroundJobs, markBackgroundJobDone, markBackgroundJobFailed,
    markBackgroundJobRunning,
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
});
