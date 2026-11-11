import { describe, expect, it } from 'vitest';
import { seedBiographyFacts } from './seedBiography';
import { db } from '../infrastructure/db';

// Тест создаёт временного персонажа с биографией и проверяет сидирование.
function makeTempCharacter(): string {
    const id = 'TEST-BIO-' + Math.floor(Math.random() * 1e6);
    db.prepare(`INSERT INTO characters (id, name, kind, profile_json) VALUES (?, 'Тест', 'npc', ?)`)
        .run(id, JSON.stringify({
            generatedProfile: {
                biography: {
                    origin: ['Факт происхождения один', 'Факт происхождения два'],
                    formerRole: 'Бывший техник',
                    formativeEvents: ['Событие из прошлого'],
                },
            },
        }));
    return id;
}

describe('seedBiographyFacts', () => {
    it('writes biography atoms for a temp character', () => {
        const id = makeTempCharacter();
        const written = seedBiographyFacts(id);
        expect(written).toBe(4); // 2 origin + 1 formerRole + 1 formativeEvent
        const rows = db.prepare(`SELECT text FROM memory_embeddings WHERE subject_id = ? AND type = 'biography'`).all(id);
        expect(rows.length).toBe(4);
        // Idempotent
        const again = seedBiographyFacts(id);
        expect(again).toBe(0);
        db.prepare('DELETE FROM memory_embeddings WHERE subject_id = ?').run(id);
        db.prepare('DELETE FROM characters WHERE id = ?').run(id);
    });
});
