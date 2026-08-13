import { randomUUID } from 'crypto';
import { appendJsonLog } from '../utils/fileLogs';

/**
 * Unified structured trace for Этап 10: one trace for a tick, its LLM calls
 * and its background jobs, correlated by a shared `requestId`/`traceId`.
 * Every stage records a duration; prompt size and fallback attempts are
 * attached when available. Nothing here is awaited or blocking — traces are
 * fire-and-forget JSONL lines.
 */

export interface TraceSpan {
    traceId: string;
    requestId: string;
    stage: string;
    startedAt: number;
    durationMs: number;
    subjectId?: string;
    tickId?: string;
    error?: string;
    [key: string]: unknown;
}

/** A correlated root id shared by a request and its child spans. */
export function newRequestId(): string {
    return randomUUID();
}

/**
 * Measures a stage synchronously and emits a trace span. Returns the span.
 * Use around any stage that returns a value (not a Promise that must be
 * awaited later — wrap async with `traceAsync`).
 */
export function traceSync<T>(
    traceId: string,
    requestId: string,
    stage: string,
    fn: () => T,
    context: Omit<TraceSpan, 'traceId' | 'requestId' | 'stage' | 'startedAt' | 'durationMs'> = {},
): T {
    const startedAt = performance.now();
    try {
        const result = fn();
        emitTrace({ traceId, requestId, stage, startedAt, durationMs: Math.round(performance.now() - startedAt), ...context });
        return result;
    } catch (error) {
        emitTrace({ traceId, requestId, stage, startedAt, durationMs: Math.round(performance.now() - startedAt), ...context, error: String(error) });
        throw error;
    }
}

/** Measures an async stage and emits a trace span. */
export async function traceAsync<T>(
    traceId: string,
    requestId: string,
    stage: string,
    fn: () => Promise<T>,
    context: Omit<TraceSpan, 'traceId' | 'requestId' | 'stage' | 'startedAt' | 'durationMs'> = {},
): Promise<T> {
    const startedAt = performance.now();
    try {
        const result = await fn();
        emitTrace({ traceId, requestId, stage, startedAt, durationMs: Math.round(performance.now() - startedAt), ...context });
        return result;
    } catch (error) {
        emitTrace({ traceId, requestId, stage, startedAt, durationMs: Math.round(performance.now() - startedAt), ...context, error: String(error) });
        throw error;
    }
}

/** Emit a free-form trace span (e.g. an LLM fallback attempt or a memory job). */
export function emitTrace(span: TraceSpan) {
    try {
        appendJsonLog('trace.jsonl', span);
    } catch {
        // never let observability break the game loop
    }
}
