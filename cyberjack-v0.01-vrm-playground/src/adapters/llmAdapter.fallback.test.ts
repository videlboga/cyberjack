import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    emitTrace: vi.fn(),
}));
vi.mock('../orchestration/trace', () => ({ emitTrace: mocks.emitTrace, currentTraceRequestId: () => null }));
vi.mock('crypto', () => ({ randomUUID: () => 'trace-123' }));

import { modelAssignments } from './modelAssignments';
import { parseVerbalInputWithLLM } from './llmAdapter';

describe('parser ollama-only (Этап 10)', () => {
    beforeEach(() => {
        mocks.emitTrace.mockReset();
        vi.unstubAllGlobals();
    });

    it('emits llm.fallback with shared traceId and real duration on network failure', async () => {
        // Ollama падает по сети — единственная попытка, fallback-моделей больше нет.
        vi.stubGlobal('fetch', vi.fn()
            .mockRejectedValueOnce(new Error('network down')));

        const nowMock = vi.fn()
            .mockReturnValueOnce(1000)   // startedAt before fetch
            .mockReturnValueOnce(1042);  // duration computation in catch
        vi.stubGlobal('performance', { now: nowMock });

        await expect(parseVerbalInputWithLLM([{ role: 'user', content: 'x' }])).rejects.toThrow();

        const fallback = mocks.emitTrace.mock.calls.map(call => call[0]).find(span => span.stage === 'llm.fallback');
        expect(fallback).toBeTruthy();
        expect(fallback.traceId).toBe('trace-123');
        expect(fallback.requestId).toBe('trace-123');
        expect(fallback.attempt).toBe(1);
        expect(fallback.attemptsTotal).toBe(1);
        expect(fallback.error).toContain('network down');
        expect(fallback.startedAt).toBe(1000);
        expect(fallback.durationMs).toBe(42);
    });

    it('retries ollama on empty response instead of falling back to openrouter', async () => {
        // Первый ответ пустой (reasoning-модель кладёт вывод в thinking),
        // второй — валидный JSON. Оба идут в ollama (provider='ollama').
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { content: '' } }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { content: '{"ok":true}' } }) }));

        const result = await parseVerbalInputWithLLM([{ role: 'user', content: 'x' }]);

        expect(result.parsed).toEqual({ ok: true });
        // Ни одного fallback-спана: пустой ответ ретраится в ollama, не в openrouter.
        const spans = mocks.emitTrace.mock.calls.map(call => call[0]).filter(span => span.stage === 'llm.fallback');
        expect(spans.length).toBe(0);
        // Оба вызова fetch — в ollama (2 вызова: пустой + ретрай).
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('gives up after retries exhausted on persistent empty response', async () => {
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValue({ ok: true, json: async () => ({ message: { content: '' } }) }));

        await expect(parseVerbalInputWithLLM([{ role: 'user', content: 'x' }])).rejects.toThrow();

        // 1 + OLLAMA_EMPTY_RETRIES(2) = 3 вызова, все в ollama.
        expect(fetch).toHaveBeenCalledTimes(3);
        const spans = mocks.emitTrace.mock.calls.map(call => call[0]).filter(span => span.stage === 'llm.fallback');
        expect(spans.length).toBe(1);
        expect(spans[0].attemptsTotal).toBe(1);
    });
});

it('uses the configured remote parser provider after Ollama is unavailable', async()=>{
 const saved=modelAssignments.parser;
 modelAssignments.parser={...saved,providers:['ollama','deepinfra']};
 const fetchMock=vi.fn().mockRejectedValueOnce(new Error('local unavailable')).mockResolvedValueOnce({ok:true,json:async()=>({choices:[{message:{content:'{"ok":true}'}}]})});
 vi.stubGlobal('fetch',fetchMock);
 try {
  expect((await parseVerbalInputWithLLM([{role:'user',content:'Подними руки'}])).parsed).toEqual({ok:true});
  const body=JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(body.provider).toEqual({only:['deepinfra'],allow_fallbacks:false});
 } finally {modelAssignments.parser=saved;vi.unstubAllGlobals()}
});
