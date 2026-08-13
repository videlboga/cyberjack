import { db } from '../infrastructure/db';

/**
 * Unified background job queue. The target model for Этап 4: a single
 * `worldMinute` cursor, one queue of background jobs with a `dueMinute`,
 * a type and an idempotent key. Time is advanced first, then due jobs are
 * selected and run. A repeated worker run is safe and never duplicates
 * replicas or memories (idempotent keys).
 */

export interface BackgroundJob {
    id: number;
    type: string;
    key: string;
    subjectId: string | null;
    dueMinute: number;
    payload: string | null;
    status: 'pending' | 'running' | 'done' | 'failed';
    attempts: number;
    lastError: string | null;
    leaseUntil: number | null;
    createdAt: number;
    updatedAt: number;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS background_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    key TEXT NOT NULL,
    subject_id TEXT,
    due_minute INTEGER NOT NULL,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    lease_until INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(type, key)
  )
`);
// Add lease_until to existing tables (migration for pre-lease schemas).
try { db.exec(`ALTER TABLE background_jobs ADD COLUMN lease_until INTEGER`); } catch { /* already present */ }

const now = () => Date.now();
const LEASE_MS = 60_000; // a job lease expires after 60s of wall-clock

const JOB_COLUMNS = `
    id, type, key, subject_id AS subjectId, due_minute AS dueMinute,
    payload, status, attempts, last_error AS lastError,
    lease_until AS leaseUntil, created_at AS createdAt, updated_at AS updatedAt
`;

/** Enqueue a background job. Idempotent on (type, key): re-enqueueing the same
 *  key while pending/running is a no-op. */
export function enqueueBackgroundJob(input: {
    type: string;
    key: string;
    subjectId?: string | null;
    dueMinute: number;
    payload?: unknown;
}): BackgroundJob | null {
    const existing = db.prepare(
        `SELECT ${JOB_COLUMNS} FROM background_jobs WHERE type = ? AND key = ?`
    ).get(input.type, input.key) as BackgroundJob | undefined;
    if (existing && (existing.status === 'pending' || existing.status === 'running')) {
        return existing;
    }
    const payload = input.payload === undefined ? null : JSON.stringify(input.payload);
    const t = now();
    db.prepare(`
        INSERT INTO background_jobs (type, key, subject_id, due_minute, payload, status, attempts, last_error, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?)
        ON CONFLICT(type, key) DO UPDATE SET
            due_minute = excluded.due_minute,
            payload = excluded.payload,
            status = 'pending',
            last_error = NULL,
            updated_at = excluded.updated_at
    `).run(input.type, input.key, input.subjectId ?? null, input.dueMinute, payload, t, t);
    return db.prepare(`SELECT ${JOB_COLUMNS} FROM background_jobs WHERE type = ? AND key = ?`).get(input.type, input.key) as BackgroundJob;
}

/** Select jobs that are due at or before the given world minute and not yet
 *  done. Returns them in due order. */
export function listDueBackgroundJobs(worldMinute: number, limit = 20): BackgroundJob[] {
    return db.prepare(`
        SELECT ${JOB_COLUMNS} FROM background_jobs
        WHERE status IN ('pending', 'failed') AND due_minute <= ?
        ORDER BY due_minute ASC, id ASC
        LIMIT ?
    `).all(worldMinute, limit) as BackgroundJob[];
}

/**
 * Atomically claim a due job: transitions it from pending/failed to running in
 * a single UPDATE ... WHERE status IN ('pending','failed'), so two workers can
 * never pick up the same job. Returns the claimed job or null if it was
 * already taken. A job stuck in 'running' (e.g. a crashed worker) is recovered
 * once its lease expires (see recoverStaleBackgroundJobs).
 */
export function claimBackgroundJob(id: number): BackgroundJob | null {
    const leaseUntil = now() + LEASE_MS;
    const res = db.prepare(`
        UPDATE background_jobs
        SET status = 'running', attempts = attempts + 1, lease_until = ?, updated_at = ?
        WHERE id = ? AND status IN ('pending', 'failed')
    `).run(leaseUntil, now(), id);
    if (res.changes === 0) return null;
    return db.prepare(`SELECT ${JOB_COLUMNS} FROM background_jobs WHERE id = ?`).get(id) as BackgroundJob;
}

/**
 * Recover jobs whose lease has expired (a worker crashed or hung). Resets them
 * to 'failed' so the next claim pass can retry them. Returns the number of
 * recovered jobs.
 */
export function recoverStaleBackgroundJobs(): number {
    const res = db.prepare(`
        UPDATE background_jobs
        SET status = 'failed', last_error = 'lease expired', updated_at = ?
        WHERE status = 'running' AND lease_until IS NOT NULL AND lease_until < ?
    `).run(now(), now());
    return res.changes;
}

export function markBackgroundJobRunning(id: number) {
    db.prepare(`UPDATE background_jobs SET status = 'running', attempts = attempts + 1, updated_at = ? WHERE id = ?`)
        .run(now(), id);
}

export function markBackgroundJobDone(id: number) {
    db.prepare(`UPDATE background_jobs SET status = 'done', last_error = NULL, updated_at = ? WHERE id = ?`)
        .run(now(), id);
}

export function markBackgroundJobFailed(id: number, error: string) {
    db.prepare(`UPDATE background_jobs SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?`)
        .run(error.slice(0, 2000), now(), id);
}

export function listBackgroundJobs(limit = 50): BackgroundJob[] {
    return db.prepare(`SELECT ${JOB_COLUMNS} FROM background_jobs ORDER BY id DESC LIMIT ?`).all(limit) as BackgroundJob[];
}

export function clearBackgroundJobs() {
    db.prepare(`DELETE FROM background_jobs`).run();
}
