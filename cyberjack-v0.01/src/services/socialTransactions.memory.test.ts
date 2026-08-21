import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { characterRelationRepo, subjectRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';
import { createSocialTurnPlan } from './socialTransactions';

/**
 * Слой D: темы диалогов должны браться из субъективной памяти пары
 * (memoryThemesForPair) — приоритетнее статичных хуков и общей комнаты.
 */

const A = 'SOCIAL-MEM-A';
const B = 'SOCIAL-MEM-B';

beforeEach(() => {
    for (const id of [A, B]) {
        subjectRepo.save(id, id, {
            sensitivity: 50, capacity: 80, openness: 50, plasticity: 50, attitude: 50, tension: 0,
        });
        db.prepare('DELETE FROM social_threads WHERE from_id = ? OR to_id = ?').run(id, id);
        db.prepare('DELETE FROM pending_social_turns WHERE speaker_id = ? OR recipient_id = ?').run(id, id);
        db.prepare('DELETE FROM chat_memory WHERE subject_id = ?').run(id);
    }
    characterRelationRepo.ensure(A, B, { knows: true, present: true, canInteract: true, attitude: 50, openness: 50, plasticity: 50 });
    characterRelationRepo.ensure(B, A, { knows: true, present: true, canInteract: true, attitude: 50, openness: 50, plasticity: 50 });
    // Высокая familiarity → не first encounter.
    characterRelationRepo.updateSocialStats(A, B, { familiarityDelta: 0.5 });
    characterRelationRepo.updateSocialStats(B, A, { familiarityDelta: 0.5 });
});

describe('chooseTopic использует память пары', () => {
    it('тема из субъективной памяти приоритетнее общей комнаты', () => {
        // Создаём субъективный эпизод A, вовлекающий B, с осмысленным title.
        const atom = db.prepare(`INSERT INTO memory_embeddings
            (subject_id, text, tags, related_subjects, type, embedding, metadata)
            VALUES (?, ?, ?, ?, 'episode_v2', ?, ?)`).run(
            A, 'Разговор о культе и аномалии', JSON.stringify(['social_transaction']),
            JSON.stringify([B]), JSON.stringify([]), JSON.stringify({ actionId: 'verbal_pressure' }),
        );
        const atomId = (atom as any).lastInsertRowid;
        db.prepare(`INSERT INTO subjective_memory_episodes
            (subject_id, source_key, source_atom_ids, summary_json, status)
            VALUES (?, ?, ?, ?, 'ready')`).run(
            A, 'ep-mem-1', JSON.stringify([Number(atomId)]),
            JSON.stringify({ title: 'Разговор с B о культе и аномалии', summary: 'Мы говорили о том, что культ связан с Аномалией.' }),
        );

        const plan = createSocialTurnPlan(A, B, 100, 'co_presence', undefined, {
            roomId: 'cell-1', roomName: 'Камера 1', roomType: 'cell',
        });

        expect(plan).not.toBeNull();
        // Тема из памяти (а не 'shared_cell').
        expect(plan!.topic).toBe('Разговор с B о культе и аномалии');
        expect(plan!.topicContext).toContain('Ты вспоминаешь:');
    });
});
