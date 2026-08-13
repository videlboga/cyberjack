import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { characterRelationRepo, subjectRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';
import { createSocialTurnPlan, enqueueSocialTurn } from './socialTransactions';

/**
 * Этап 4, открытый критерий: «два персонажа в одной доступной сцене могут
 * знакомиться и обмениваться репликами через стандартный чат».
 *
 * Проверяет реальный путь: два персонажа в одной комнате → createSocialTurnPlan
 * формирует акт знакомства (introduce) → enqueueSocialTurn ставит задание в
 * очередь. Полный цикл с LLM-репликой покрыт мок-тестом characterSpeechExecutor.
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
    }
    // Fresh relation with low familiarity → first encounter.
    characterRelationRepo.ensure(A, B, { knows: true, present: true, canInteract: true, attitude: 50, openness: 50, plasticity: 50 });
    characterRelationRepo.ensure(B, A, { knows: true, present: true, canInteract: true, attitude: 50, openness: 50, plasticity: 50 });
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
