import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { db } from '../infrastructure/db';
import { subjectRepo, subjectiveAssociationRepo, memoryRepo } from '../infrastructure/repositories';
import { buildCharacterTurnContext } from './characterTurnContext';

const SUBJECT = 'S-MEM-SEL';

beforeEach(() => {
    subjectRepo.save(SUBJECT, 'MemSel', {
        sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50, tension: 0,
    });
    db.prepare(`DELETE FROM active_contexts WHERE subject_id = ?`).run(SUBJECT);
    db.prepare(`DELETE FROM chat_memory WHERE subject_id = ?`).run(SUBJECT);
    db.prepare(`DELETE FROM subjective_associations WHERE subject_id = ?`).run(SUBJECT);
    db.prepare(`DELETE FROM memory_embeddings WHERE subject_id = ?`).run(SUBJECT);
    db.prepare(`INSERT INTO characters (id, name, kind, current_scene_id) VALUES (?, 'MemSel', 'npc', 'scene_lab_calibrator') ON CONFLICT(id) DO UPDATE SET current_scene_id='scene_lab_calibrator'`).run(SUBJECT);
});

/**
 * Этап 10: memorySelection классифицирует выбранные блоки по kind, а не по
 * текстовым префиксам. Сумма категорий совпадает с total.
 */
describe('memorySelection classification (Этап 10)', () => {
    it('counts selected blocks by kind and matches total', async () => {
        // Seed one active association (kind=association) targeting the
        // addressee (PL-1) so it passes activeForPrompt without action tags.
        subjectiveAssociationRepo.replaceSource(SUBJECT, 'src:1', [{
            type: 'person', key: 'PL-1', label: 'Калибратор', tagLinks: ['oral'],
            valence: 0.5, strength: 0.8, expectation: 'seek',
        }]);
        // Seed one episode (kind=episode).
        memoryRepo.save({
            subjectId: SUBJECT, text: 'Эпизод про калибровку', embedding: [0.1, 0.2, 0.3],
            tags: ['calibration'], relatedSubjects: [], type: 'episode_v2',
            metadata: { actionLabel: 'Калибровка', pointLabel: 'Шея' },
        });

        const context = await buildCharacterTurnContext({
            subjectId: SUBJECT,
            stimulus: { kind: 'internal_impulse', impulseId: 'seek_orientation' },
            initiatorId: 'PL-1',
        });

        const selection = context.payload.memorySelection;
        expect(selection).toBeDefined();
        // Sum of categories equals total.
        expect(selection!.associations + selection!.subjective + selection!.episodes).toBe(selection!.total);
        // The seeded association is classified as association.
        expect(selection!.associations).toBeGreaterThanOrEqual(1);
    });

    it('caps the total at three selected blocks', async () => {
        // Seed many associations and episodes so more than 3 candidates exist.
        for (let i = 0; i < 5; i++) {
            subjectiveAssociationRepo.replaceSource(SUBJECT, `src:${i}`, [{
                type: 'person', key: 'PL-1', label: `связь ${i}`, tagLinks: ['oral'],
                valence: 0.5, strength: 0.8, expectation: 'seek',
            }]);
        }
        for (let i = 0; i < 5; i++) {
            memoryRepo.save({
                subjectId: SUBJECT, text: `Эпизод ${i}`, embedding: [0.1, 0.2, 0.3],
                tags: ['calibration'], relatedSubjects: [], type: 'episode_v2',
                metadata: { actionLabel: 'Калибровка', pointLabel: 'Шея' },
            });
        }

        const context = await buildCharacterTurnContext({
            subjectId: SUBJECT,
            stimulus: { kind: 'internal_impulse', impulseId: 'seek_orientation' },
            initiatorId: 'PL-1',
        });

        const selection = context.payload.memorySelection;
        expect(selection!.total).toBeLessThanOrEqual(3);
        expect(selection!.associations + selection!.subjective + selection!.episodes).toBe(selection!.total);
    });
});
