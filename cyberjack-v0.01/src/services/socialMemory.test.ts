import { describe, expect, it, vi, beforeEach } from 'vitest';

const llmMock = vi.hoisted(() => ({ parse: vi.fn() }));

vi.mock('../adapters/llmAdapter', () => ({
  parseVerbalInputWithLLM: llmMock.parse,
}));

import { classifySocialMemoriesLLM } from './socialMemory';

beforeEach(() => {
  llmMock.parse.mockReset();
});

describe('classifySocialMemoriesLLM', () => {
  it('returns empty when LLM yields no memories and no outcome', async () => {
    llmMock.parse.mockResolvedValue({ parsed: { memories: [], promiseOutcome: null } });
    const result = await classifySocialMemoriesLLM('assistant', 'Привет, как дела?');
    expect(result.memories).toEqual([]);
    expect(result.outcome).toBeNull();
  });

  it('keeps an actual future plan as shared_plan', async () => {
    llmMock.parse.mockResolvedValue({
      parsed: {
        memories: [{ kind: 'shared_plan', content: 'Потом вернёмся к этому разговору', importance: 0.7, confidence: 0.8 }],
        promiseOutcome: null,
      },
    });
    const result = await classifySocialMemoriesLLM('assistant', 'Потом вернёмся к этому разговору');
    expect(result.memories[0]?.kind).toBe('shared_plan');
  });

  it('extracts a boundary as its own kind', async () => {
    llmMock.parse.mockResolvedValue({
      parsed: {
        memories: [{ kind: 'boundary', content: 'Не делай этого', importance: 0.9, confidence: 0.9 }],
        promiseOutcome: null,
      },
    });
    const result = await classifySocialMemoriesLLM('user', 'Не делай этого');
    expect(result.memories[0]?.kind).toBe('boundary');
  });

  it('reports promise fulfilment', async () => {
    llmMock.parse.mockResolvedValue({
      parsed: {
        memories: [],
        promiseOutcome: { outcome: 'fulfilled', evidence: 'Я сдержал слово' },
      },
    });
    const result = await classifySocialMemoriesLLM('user', 'Я сдержал слово');
    expect(result.outcome?.outcome).toBe('fulfilled');
  });

  it('drops invalid kinds', async () => {
    llmMock.parse.mockResolvedValue({
      parsed: { memories: [{ kind: 'not_a_kind', content: 'x', importance: 1, confidence: 1 }], promiseOutcome: null },
    });
    const result = await classifySocialMemoriesLLM('assistant', 'some text');
    expect(result.memories).toEqual([]);
  });
});
