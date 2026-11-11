import { describe, expect, it } from 'vitest';
import { newRequestId, traceSync, traceAsync, emitTrace } from './trace';
import { readJsonLog } from '../utils/fileLogs';

describe('trace', () => {
    it('produces a unique correlated request id', () => {
        const a = newRequestId();
        const b = newRequestId();
        expect(a).not.toBe(b);
        expect(a).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('traceSync measures a synchronous stage and propagates its result', () => {
        const requestId = newRequestId();
        const value = traceSync(requestId, requestId, `test.stage:${requestId}`, () => 42, { subjectId: 'S-1' });
        expect(value).toBe(42);
        const lines = readJsonLog('trace.jsonl', 20000);
        const span = lines.find((l: any) => l?.traceId === requestId);
        expect(span).toBeDefined();
        expect(span.traceId).toBe(requestId);
        expect(span.subjectId).toBe('S-1');
        expect(typeof span.durationMs).toBe('number');
    });

    it('traceAsync measures an async stage and propagates result/error', async () => {
        const requestId = newRequestId();
        const value = await traceAsync(requestId, requestId, `test.async:${requestId}`, async () => 'ok');
        expect(value).toBe('ok');
        const errRequestId = newRequestId();
        await expect(
            traceAsync(errRequestId, errRequestId, `test.error:${errRequestId}`, async () => { throw new Error('boom'); }),
        ).rejects.toThrow('boom');
        const lines = readJsonLog('trace.jsonl', 30000);
        const errSpan = lines.find((l: any) => l?.traceId === errRequestId);
        expect(errSpan).toBeDefined();
        expect(errSpan.error).toBeTruthy();
    });

    it('emitTrace writes a free-form span (e.g. LLM fallback)', () => {
        const requestId = newRequestId();
        emitTrace({ traceId: requestId, requestId, stage: 'llm.fallback', startedAt: 0, durationMs: 5, model: 'm', attempt: 2 });
        const lines = readJsonLog('trace.jsonl', 30000);
        const span = lines.find((l: any) => l?.traceId === requestId);
        expect(span).toBeDefined();
        expect(span.model).toBe('m');
        expect(span.attempt).toBe(2);
    });
});
