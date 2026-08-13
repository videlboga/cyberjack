import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateCharacterReply: vi.fn() }));
vi.mock('../adapters/llmAdapter', () => ({ generateCharacterReply: mocks.generateCharacterReply }));
import { executeCharacterSpeech } from './characterSpeechExecutor';

const payload = {
    subjectId: 'S-1',
    currentStateSummary: { interpretation: '', attitude: 50, localAttitude: 50, engagement: 0, overload: 0 },
    recentEvents: [],
};

describe('character speech executor', () => {
    beforeEach(() => mocks.generateCharacterReply.mockReset());

    it('normalizes a successful reply', async () => {
        mocks.generateCharacterReply.mockResolvedValue({
            reply: { speech: '  Я отвечаю.  ', speechAct: 'answer', addressedTo: 'PL-1' },
            sentMessages: [{ role: 'user', content: 'Вопрос' }],
        });
        await expect(executeCharacterSpeech({ source: 'player_turn', payload, userInput: 'Вопрос' })).resolves.toEqual({
            success: true,
            speech: 'Я отвечаю.',
            speechAct: 'answer',
            addressedTo: 'PL-1',
            sentMessages: [{ role: 'user', content: 'Вопрос' }],
        });
    });

    it('preserves an adapter failure instead of reporting silence as success', async () => {
        mocks.generateCharacterReply.mockResolvedValue({ reply: { speech: '' }, sentMessages: [], error: 'provider timeout' });
        await expect(executeCharacterSpeech({ source: 'internal_impulse', payload })).resolves.toEqual({
            success: false,
            error: 'provider timeout',
            sentMessages: [],
        });
    });

    it('treats unexplained empty output as a failure', async () => {
        mocks.generateCharacterReply.mockResolvedValue({ reply: '', sentMessages: [] });
        const result = await executeCharacterSpeech({ source: 'social_initiative', payload });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toContain('пустую реплику');
    });
});
