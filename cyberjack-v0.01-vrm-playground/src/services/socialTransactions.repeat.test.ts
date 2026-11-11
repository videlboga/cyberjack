import { describe, expect, it } from 'vitest';
import { shouldContinueConversation, ConversationState } from './socialTransactions';

const base: ConversationState = { turnCount: 0, maxTurns: 6, hardLimit: 6, engagement: 50, staleStreak: 0, repeatCount: 0 };

const question = {
    speechAct: 'question' as const,
    apparentEgoState: 'adult' as const,
    transaction: 'complementary' as const,
    boundary: 'none' as const,
    invitation: 'none' as const,
    openLoop: 'question' as const,
    conversationDisposition: 'continue' as const,
    confidence: 0.9,
};

describe('shouldContinueConversation', () => {
    it('continues on a fresh question', () => {
        const d = shouldContinueConversation(question, base);
        expect(d.continueConversation).toBe(true);
        expect(d.state.repeatCount).toBe(0);
    });

    it('cuts after 3 repeated questions (treading water)', () => {
        let state = base;
        let d: any;
        for (let i = 0; i < 4; i++) {
            d = shouldContinueConversation(question, state);
            state = d.state;
        }
        expect(d.continueConversation).toBe(false);
        expect(d.status).toBe('resolved');
        expect(state.repeatCount).toBe(3);
    });

    it('resets repeat count when the act changes', () => {
        let d = shouldContinueConversation(question, base);
        d = shouldContinueConversation({ ...question, speechAct: 'answer' }, d.state);
        expect(d.state.repeatCount).toBe(0);
    });
});
