import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { memoryRepo, subjectRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';
import { memoryThemesForPair } from './socialTransactions';

// Memory → themes + intentions (Layer 1/2): accumulated lived history of a pair
// must produce emergent topics and unresolved intentions, so relationships grow
// instead of staying pinned to static conversationHooks.

const A = 'MEM-A';
const B = 'MEM-B';

function seedMemory(subjectId: string, text: string, related: string[], meta: Record<string, any> = {}) {
    // 8-dim dummy embedding, distinct per call
    const embedding = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, text.length, 0.9];
    memoryRepo.save({ subjectId, text, embedding, relatedSubjects: related, type: 'episode_v2', metadata: meta });
}

beforeEach(() => {
    for (const id of [A, B]) {
        db.prepare('DELETE FROM memory_embeddings WHERE subject_id = ?').run(id);
        db.prepare('DELETE FROM subjective_memory_episodes WHERE subject_id = ?').run(id);
        db.prepare('DELETE FROM subjective_associations WHERE subject_id = ?').run(id);
        db.prepare('DELETE FROM memory_association_effects WHERE subject_id = ?').run(id);
    }
});

describe('memoryThemesForPair', () => {
    it('produces a theme from an episode that involves both pair members', () => {
        // Seed a lived conversation episode between A and B, then a subjective episode for it.
        const atomId = 1001;
        db.prepare(`INSERT INTO memory_embeddings (id, subject_id, text, tags, related_subjects, type, embedding, metadata)
            VALUES (?, ?, ?, ?, ?, 'episode_v2', '[]', ?)`)
            .run(atomId, A, 'Разговор о времени', '[]', JSON.stringify([A, B]), JSON.stringify({ socialTransaction: true, worldMinute: 10 }));
        db.prepare(`INSERT INTO subjective_memory_episodes (subject_id, source_key, source_atom_ids, summary_json, status)
            VALUES (?, ?, ?, ?, 'ready')`)
            .run(A, `${atomId}:${atomId}`, JSON.stringify([atomId]),
                JSON.stringify({ title: 'Аномалии времени', summary: 'Мы обсуждали странное течение времени.', openLoops: ['Подтвердится ли аномалия завтра?'] }));
        const result = memoryThemesForPair(A, B);
        expect(result.themes.length).toBeGreaterThan(0);
        expect(result.themes[0].topic).toBe('Аномалии времени');
        expect(result.intentions).toContain('Подтвердится ли аномалия завтра?');
    });

    it('ignores episodes that do not involve the recipient', () => {
        const atomId = 2001;
        db.prepare(`INSERT INTO memory_embeddings (id, subject_id, text, tags, related_subjects, type, embedding, metadata)
            VALUES (?, ?, ?, ?, ?, 'episode_v2', '[]', ?)`)
            .run(atomId, A, 'Разговор с третьим', '[]', JSON.stringify([A, 'OTHER']), JSON.stringify({ socialTransaction: true }));
        db.prepare(`INSERT INTO subjective_memory_episodes (subject_id, source_key, source_atom_ids, summary_json, status)
            VALUES (?, ?, ?, ?, 'ready')`)
            .run(A, `${atomId}:${atomId}`, JSON.stringify([atomId]),
                JSON.stringify({ title: 'Чужая тема', summary: 'Не про пару.', openLoops: [] }));
        const result = memoryThemesForPair(A, B);
        expect(result.themes.length).toBe(0);
        expect(result.intentions.length).toBe(0);
    });

    it('is empty when there is no memory at all', () => {
        const result = memoryThemesForPair(A, B);
        expect(result.themes.length).toBe(0);
        expect(result.intentions.length).toBe(0);
    });
});
