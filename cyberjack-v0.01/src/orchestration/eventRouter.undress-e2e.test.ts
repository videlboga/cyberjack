import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../infrastructure/seed';
import { activeContextsRepo, subjectRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';
import { dispatchEvent } from './eventRouter';

const mocks = vi.hoisted(() => ({ parseSemanticVerbalInput: vi.fn() }));
vi.mock('../parser/semanticVerbalParser', () => ({ parseSemanticVerbalInput: mocks.parseSemanticVerbalInput }));

const SUBJECT = 'TEST-UNDRESS-E2E';

beforeEach(() => {
    subjectRepo.save(SUBJECT, SUBJECT, {
        sensitivity: 50, capacity: 80, openness: 50, plasticity: 50, attitude: 80, tension: 0,
    });
    db.prepare(`
        INSERT OR IGNORE INTO subject_point_states (
            subject_id, point_id, local_sensitivity, local_attitude, local_openness,
            familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude, baseline_local_openness
        )
        SELECT ?, point_id, local_sensitivity, local_attitude, local_openness,
            familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude, baseline_local_openness
        FROM subject_point_states WHERE subject_id = 'S-AV-01'
    `).run(SUBJECT);
    db.prepare('DELETE FROM active_contexts WHERE subject_id = ?').run(SUBJECT);
    mocks.parseSemanticVerbalInput.mockReset();
});

/**
 * Полный путь «разденься»: текст → semantic parser → commandIntent
 * (remove_worn_clothing) → dispatchEvent → runGameTick → снятие одежды.
 * Парсер замокан (возвращает структурированный intent), остальное — реальный
 * production-путь.
 */
describe('undress-all command end-to-end', () => {
    it('routes text through the parser to remove all worn clothing', async () => {
        activeContextsRepo.add('test-underwear', SUBJECT, 'eq_clothe_underwear', -1, 'systemic');
        activeContextsRepo.add('test-panties', SUBJECT, 'eq_clothe_panties', -1, 'systemic');
        activeContextsRepo.add('test-jumpsuit', SUBJECT, 'eq_clothe_jumpsuit', -1, 'systemic');

        mocks.parseSemanticVerbalInput.mockResolvedValue({
            intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0,
            pointId: 'systemic', verbalIntent: 'command',
            commandIntent: { type: 'remove_worn_clothing' },
            semanticMentions: { actionIds: [], pointIds: [] }, mentionedTags: [],
            model: 'semantic-parser-v2:test',
        });

        const result = await dispatchEvent({
            subjectId: SUBJECT,
            playerId: 'PL-1',
            sceneId: 'scene_lab_calibrator',
            pointId: 'systemic',
            presetId: 'verbal_pressure',
            textMessage: 'Разденься',
            skipPrompt: true,
        });

        // The parser was invoked with the raw text.
        expect(mocks.parseSemanticVerbalInput).toHaveBeenCalled();
        expect(mocks.parseSemanticVerbalInput.mock.calls[0][0]).toBe('Разденься');

        // The engine applied the removal.
        expect(result.bundle.actionApplied).toBe(true);
        expect(activeContextsRepo.getAllForSubject(SUBJECT)).toEqual([]);
    });

    it('normalizes a legacy perform_action + command_remove_worn_clothing to remove_worn_clothing', async () => {
        activeContextsRepo.add('test-underwear', SUBJECT, 'eq_clothe_underwear', -1, 'systemic');
        activeContextsRepo.add('test-panties', SUBJECT, 'eq_clothe_panties', -1, 'systemic');

        // Old model output: perform_action with the technical actionId.
        mocks.parseSemanticVerbalInput.mockResolvedValue({
            intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0,
            pointId: 'systemic', verbalIntent: 'command',
            commandIntent: { type: 'perform_action', actionId: 'command_remove_worn_clothing', targetId: SUBJECT, pointId: 'systemic' },
            semanticMentions: { actionIds: [], pointIds: [] }, mentionedTags: [],
            model: 'semantic-parser-v2:legacy',
        });

        const result = await dispatchEvent({
            subjectId: SUBJECT,
            playerId: 'PL-1',
            sceneId: 'scene_lab_calibrator',
            pointId: 'systemic',
            presetId: 'verbal_pressure',
            textMessage: 'Разденься',
            skipPrompt: true,
        });

        // The normalized intent is remove_worn_clothing, not the legacy actionId.
        expect(result.dynamicModifiers?.commandIntent).toEqual({ type: 'remove_worn_clothing' });
        // The description is the human-readable form, not the technical id.
        expect(result.dynamicModifiers?.commandDescription).toBe('снять надетую одежду');
        // The engine applied the removal.
        expect(result.bundle.actionApplied).toBe(true);
        expect(activeContextsRepo.getAllForSubject(SUBJECT)).toEqual([]);
    });
});
