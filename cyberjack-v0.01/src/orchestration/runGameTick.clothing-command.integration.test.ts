import { beforeEach, describe, expect, it } from 'vitest';
import '../infrastructure/seed';
import { activeContextsRepo, presetRepo, subjectRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';
import { runGameTick } from './runGameTick';

const subjects = ['TEST-CMD-01', 'TEST-CMD-02', 'TEST-CMD-REFUSAL'];

beforeEach(() => {
    for (const subjectId of subjects) {
        subjectRepo.save(subjectId, subjectId, {
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
        `).run(subjectId);
        db.prepare('DELETE FROM active_contexts WHERE subject_id = ?').run(subjectId);
    }
});

async function commandRemoveClothing(subjectId: string, actionId = 'eq_clothe_panties_remove', textMessage = 'Сними трусики') {
    return runGameTick({
        subjectId,
        playerId: 'PL-1',
        sceneId: 'scene_lab_calibrator',
        pointId: 'systemic',
        presetId: 'verbal_pressure',
        textMessage,
        dynamicModifiers: {
            intensity: 0.3,
            valence: 0,
            contact: 0,
            sharpness: 0,
            novelty: 0.5,
            commandIntent: {
                type: 'perform_action',
                actionId,
                targetId: subjectId,
                pointId: 'systemic',
            },
        } as any,
    });
}

describe('spoken clothing commands', () => {
    it.each([
        ['TEST-CMD-01', 'eq_clothe_underwear'],
        ['TEST-CMD-02', 'eq_clothe_panties'],
    ])('removes %s clothing context for %s', async (subjectId, wornContext) => {
        activeContextsRepo.add(`test-${subjectId}`, subjectId, wornContext, -1, 'systemic');

        const result = await commandRemoveClothing(subjectId);

        expect(result.actionApplied).toBe(true);
        expect(activeContextsRepo.getAllForSubject(subjectId)).toEqual([]);
    });

    it('removes both legacy and current clothing contexts when both are present', async () => {
        activeContextsRepo.add('test-underwear', 'TEST-CMD-01', 'eq_clothe_underwear', -1, 'systemic');
        activeContextsRepo.add('test-panties', 'TEST-CMD-01', 'eq_clothe_panties', -1, 'systemic');

        const result = await commandRemoveClothing('TEST-CMD-01');

        expect(result.actionApplied).toBe(true);
        expect(activeContextsRepo.getAllForSubject('TEST-CMD-01')).toEqual([]);
    });

    it('keeps the general “Снять бельё” command compatible with both context names', async () => {
        activeContextsRepo.add('test-underwear', 'TEST-CMD-02', 'eq_clothe_underwear', -1, 'systemic');
        activeContextsRepo.add('test-panties', 'TEST-CMD-02', 'eq_clothe_panties', -1, 'systemic');

        const result = await commandRemoveClothing('TEST-CMD-02', 'eq_clothe_underwear_remove', 'Сними бельё');

        expect(result.actionApplied).toBe(true);
        expect(activeContextsRepo.getAllForSubject('TEST-CMD-02')).toEqual([]);
    });

    it('does not apply preset effects when the command was refused', async () => {
        subjectRepo.save('TEST-CMD-REFUSAL', 'TEST-CMD-REFUSAL', {
            sensitivity: 50, capacity: 80, openness: 0, plasticity: 0, attitude: 0, tension: 0,
        });
        presetRepo.saveActionPreset('test_refused_command', 'Недопустимое требование', {
            intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0,
            removeContexts: ['eq_clothe_underwear'],
        }, {
            type: 'pose', duration: -1, priority: 10, occupiesPoints: ['global_pose'],
        });
        activeContextsRepo.add('test-refusal-underwear', 'TEST-CMD-REFUSAL', 'eq_clothe_underwear', -1, 'systemic');

        const result = await runGameTick({
            subjectId: 'TEST-CMD-REFUSAL',
            playerId: 'PL-1',
            sceneId: 'scene_lab_calibrator',
            pointId: 'systemic',
            presetId: 'verbal_pressure',
            textMessage: 'Выполни недопустимое требование',
            dynamicModifiers: {
                intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0,
                commandIntent: {
                    type: 'perform_action',
                    actionId: 'test_refused_command',
                    targetId: 'TEST-CMD-REFUSAL',
                    pointId: 'systemic',
                },
            } as any,
            skipPrompt: true,
        });

        expect(result.actionApplied).toBe(false);
        const activeIds = activeContextsRepo.getAllForSubject('TEST-CMD-REFUSAL').map(context => context.actionId);
        expect(activeIds).toContain('eq_clothe_underwear');
        expect(activeIds).not.toContain('test_refused_command');
    });
});
