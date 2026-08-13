import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../infrastructure/seed';
import { characterRelationRepo, subjectRepo, chatMemoryRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';
import { createSocialTurnPlan, enqueueSocialTurn, processPendingSocialTurns } from './socialTransactions';

const mocks = vi.hoisted(() => ({
    executeCharacterSpeech: vi.fn(),
    parseVerbalInputWithLLM: vi.fn(),
}));
vi.mock('./characterSpeechExecutor', () => ({ executeCharacterSpeech: mocks.executeCharacterSpeech }));
vi.mock('../adapters/llmAdapter', () => ({ parseVerbalInputWithLLM: mocks.parseVerbalInputWithLLM }));

/**
 * Этап 4, открытый критерий: «два персонажа в одной доступной сцене могут
 * знакомиться и обмениваться репликами через стандартный чат».
 *
 * Проверяет реальный путь: два персонажа в одной комнате → createSocialTurnPlan
 * формирует акт знакомства (introduce) → enqueueSocialTurn ставит задание в
 * очередь → processPendingSocialTurns доставляет реплику в оба чата.
 */

const A = 'SOCIAL-A';
const B = 'SOCIAL-B';

beforeEach(() => {
    for (const id of [A, B]) {
        subjectRepo.save(id, id, {
            sensitivity: 50, capacity: 80, openness: 50, plasticity: 50, attitude: 50, tension: 0,
        });
        db.prepare('DELETE FROM social_threads WHERE from_id = ? OR to_id = ?').run(id, id);
        db.prepare('DELETE FROM pending_social_turns WHERE speaker_id = ? OR recipient_id = ?').run(id, id);
        db.prepare('DELETE FROM chat_memory WHERE subject_id = ?').run(id);
    }
    // Fresh relation with low familiarity → first encounter.
    characterRelationRepo.ensure(A, B, { knows: true, present: true, canInteract: true, attitude: 50, openness: 50, plasticity: 50 });
    characterRelationRepo.ensure(B, A, { knows: true, present: true, canInteract: true, attitude: 50, openness: 50, plasticity: 50 });
    mocks.executeCharacterSpeech.mockReset();
    mocks.parseVerbalInputWithLLM.mockReset();
});

describe('two characters in a shared room can start a conversation', () => {
    it('creates an introduce plan for a first encounter in a shared cell', () => {
        const plan = createSocialTurnPlan(A, B, 100, 'co_presence', undefined, {
            roomId: 'cell-1',
            roomName: 'Камера 1',
            roomType: 'cell',
        });

        expect(plan).not.toBeNull();
        expect(plan!.speakerId).toBe(A);
        expect(plan!.recipientId).toBe(B);
        expect(plan!.act).toBe('introduce');
        expect(plan!.topic).toBe('shared_cell');
        expect(plan!.expectedReply).toBe('adult_reply');
    });

    it('enqueues the introduce turn into the pending queue', () => {
        const plan = createSocialTurnPlan(A, B, 100, 'co_presence', undefined, {
            roomId: 'cell-1',
            roomName: 'Камера 1',
            roomType: 'cell',
        });
        expect(plan).not.toBeNull();

        enqueueSocialTurn(plan!);

        const row = db.prepare("SELECT * FROM pending_social_turns WHERE speaker_id = ? AND recipient_id = ? AND status = 'planned'").get(A, B) as any;
        expect(row).toBeTruthy();
        const stored = JSON.parse(row.plan_json);
        expect(stored.act).toBe('introduce');
        expect(stored.topic).toBe('shared_cell');
    });

    it('returns null when the two characters are not in a shared room', () => {
        const plan = createSocialTurnPlan(A, B, 100, 'co_presence', undefined, undefined);
        // No co-presence context → no shared-room topic → no plan.
        expect(plan).toBeNull();
    });
});

describe('end-to-end social turn delivery', () => {
    it('delivers the introduce reply to both participants through the standard chat', async () => {
        const plan = createSocialTurnPlan(A, B, 100, 'co_presence', undefined, {
            roomId: 'cell-1',
            roomName: 'Камера 1',
            roomType: 'cell',
        });
        expect(plan).not.toBeNull();
        enqueueSocialTurn(plan!);

        mocks.executeCharacterSpeech.mockResolvedValue({
            success: true,
            speech: 'Привет, я Май. Как тебя зовут?',
            speechAct: 'question',
            addressedTo: B,
            sentMessages: [],
        });
        mocks.parseVerbalInputWithLLM.mockResolvedValue({
            parsed: {
                speechAct: 'question', apparentEgoState: 'adult', transaction: 'complementary',
                boundary: 'none', invitation: 'conversation', openLoop: 'question',
                conversationDisposition: 'continue', confidence: 0.9,
            },
        });

        await processPendingSocialTurns();

        // The reply is delivered to both transcripts.
        const aChat = chatMemoryRepo.getRecent(A, 5);
        const bChat = chatMemoryRepo.getRecent(B, 5);
        const aHas = aChat.some(entry => entry.content.includes('Привет, я Май'));
        const bHas = bChat.some(entry => entry.content.includes('Привет, я Май'));
        expect(aHas).toBe(true);
        expect(bHas).toBe(true);

        // The turn is marked applied.
        const row = db.prepare("SELECT status FROM pending_social_turns WHERE speaker_id = ? AND recipient_id = ?").get(A, B) as any;
        expect(row.status).toBe('applied');
    });
});
