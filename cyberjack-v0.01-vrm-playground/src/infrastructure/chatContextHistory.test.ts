import { describe, expect, it } from 'vitest';
import { db } from './db';
import { chatMemoryRepo } from './repositories';

describe('context chat history', () => {
    it('keeps a former occupant\'s messages available from the slot journal', () => {
        const subjectId = 'TEST-FORMER-OCCUPANT';
        const contextLabel = 'Тестовый слот';
        db.prepare(`INSERT OR REPLACE INTO characters (id, name, kind, subject_id) VALUES (?, ?, 'npc', ?)`)
            .run(subjectId, 'Бывшая участница', subjectId);
        chatMemoryRepo.append(subjectId, 'assistant', 'Эта реплика остаётся в журнале слота.', contextLabel);

        const messages = chatMemoryRepo.getRecentForContexts([contextLabel]);

        expect(messages).toContainEqual(expect.objectContaining({
            subjectId,
            characterName: 'Бывшая участница',
            contextLabel,
            content: 'Эта реплика остаётся в журнале слота.',
        }));
    });
});
