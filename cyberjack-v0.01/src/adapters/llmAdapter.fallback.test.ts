import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    emitTrace: vi.fn(),
}));
vi.mock('../orchestration/trace', () => ({ emitTrace: mocks.emitTrace, currentTraceRequestId: () => null }));
vi.mock('crypto', () => ({ randomUUID: () => 'trace-123' }));

import { parseVerbalInputWithLLM } from './llmAdapter';

describe('parser fallback trace (Этап 10)', () => {
    beforeEach(() => {
        mocks.emitTrace.mockReset();
        vi.unstubAllGlobals();
    });

    it('emits llm.fallback with shared traceId, attempt number and real duration', async () => {
        // First model fails, second succeeds.
        vi.stubGlobal('fetch', vi.fn()
            .mockRejectedValueOnce(new Error('network down'))
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
            }));

        // Mock performance.now() to a deterministic sequence: the first call
        // (startedAt before fetch) returns 1000, the second (in catch) returns
        // 1042, so the fallback duration must be exactly 42ms.
        const nowMock = vi.fn()
            .mockReturnValueOnce(1000)   // startedAt before fetch
            .mockReturnValueOnce(1042);  // duration computation in catch
        vi.stubGlobal('performance', { now: nowMock });

        const result = await parseVerbalInputWithLLM([{ role: 'user', content: 'x' }]);

        expect(result.parsed).toEqual({ ok: true });

        // Exactly one fallback span for the failed first attempt.
        const fallback = mocks.emitTrace.mock.calls.map(call => call[0]).find(span => span.stage === 'llm.fallback');
        expect(fallback).toBeTruthy();
        expect(fallback.traceId).toBe('trace-123');
        expect(fallback.requestId).toBe('trace-123');
        expect(fallback.attempt).toBe(1);
        expect(fallback.attemptsTotal).toBeGreaterThanOrEqual(2);
        expect(fallback.error).toContain('network down');
        // Real duration: startedAt is the mocked 1000, durationMs is the
        // concrete non-zero difference (1042 - 1000 = 42).
        expect(fallback.startedAt).toBe(1000);
        expect(fallback.durationMs).toBe(42);
    });

    it('shares one traceId across every fallback attempt', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('always fails')));
        await expect(parseVerbalInputWithLLM([{ role: 'user', content: 'x' }])).rejects.toThrow();

        const spans = mocks.emitTrace.mock.calls.map(call => call[0]).filter(span => span.stage === 'llm.fallback');
        expect(spans.length).toBeGreaterThan(1);
        const ids = new Set(spans.map(span => span.traceId));
        expect(ids.size).toBe(1);
        expect(ids.has('trace-123')).toBe(true);
        // Attempt numbers are sequential.
        expect(spans.map(span => span.attempt)).toEqual(spans.map((_, i) => i + 1));
    });
});
