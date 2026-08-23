import { describe, expect, it } from 'vitest';
import { db } from './db';
import { chatMemoryRepo } from './repositories';

describe('chatMemoryRepo.getRecent ordering', () => {
    it('returns entries in insertion order even when world_minute is non-monotonic (clock rollback)', () => {
        const subjectId = 'TEST-CLOCK-ROLLBACK';
        db.prepare(`INSERT OR REPLACE INTO characters (id, name, kind, subject_id) VALUES (?, ?, 'npc', ?)`)
            .run(subjectId, 'Тестовая', subjectId);

        // Simulate a clock rollback: newer rows carry a LOWER world_minute than
        // older rows. Ordering by world_minute would surface stale history and
        // push the live exchange out of the window.
        db.prepare(`INSERT INTO chat_memory (subject_id, role, content, world_minute) VALUES (?, 'assistant', 'старая реплика', 3800)`)
            .run(subjectId);
        db.prepare(`INSERT INTO chat_memory (subject_id, role, content, world_minute) VALUES (?, 'user', '[Действие] Массаж · Ноги', 2700)`)
            .run(subjectId);
        db.prepare(`INSERT INTO chat_memory (subject_id, role, content, world_minute) VALUES (?, 'assistant', 'свежая реплика', 2701)`)
            .run(subjectId);

        const recent = chatMemoryRepo.getRecent(subjectId, 20);

        expect(recent.map(entry => entry.content)).toEqual([
            'старая реплика',
            '[Действие] Массаж · Ноги',
            'свежая реплика',
        ]);
    });
});
