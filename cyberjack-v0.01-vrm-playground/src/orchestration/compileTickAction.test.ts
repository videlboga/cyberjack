import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../infrastructure/db';
import { presetRepo } from '../infrastructure/repositories';
import { compileTickAction } from './compileTickAction';
import type { CommandIntent } from '../domain/resolver';

const baseInput = {
    payload: {
        subjectId: 'S-1',
        pointId: 'systemic',
        presetId: 'stimulate',
        sceneId: 'scene_lab_calibrator',
        playerIntensity: 1,
        dynamicModifiers: undefined,
        textMessage: 'стимулируй',
        parserVersion: 'v2',
        customPayload: null,
        actingCharacterId: 'PL-1',
        playerId: 'PL-1',
    },
    state: {
        core: { preferences: {}, attitude: 50, plasticity: 50 },
        point: { familiarity: 0 },
        relation: { attitude: 50 },
    },
    history: [],
    edgeProfile: { tension: 0, capacity: 50 } as any,
    relationalDynamics: { learnedCompliance: 0, resistance: 0, dependency: 0 },
    initiatorId: 'PL-1',
    tickEffects: [] as any[],
    preTickContextNotes: [] as string[],
};

describe('compileTickAction', () => {
    beforeEach(() => {
        db.prepare('PRAGMA foreign_keys = OFF').run();
        for (const table of ['action_presets', 'characters', 'active_contexts']) {
            db.prepare(`DELETE FROM ${table}`).run();
        }
        db.prepare('PRAGMA foreign_keys = ON').run();
        presetRepo.saveActionPreset('stimulate', 'Стимуляция', { intensity: 0.5, valence: 0.3 });
        db.prepare(`INSERT INTO characters (id, name, kind) VALUES (?, ?, ?)`).run('S-1', 'Актив', 'npc');
    });

    it('compiles an action vector with the resolved preset', () => {
        const result = compileTickAction(baseInput);
        expect(result.compiledAction).toBeDefined();
        expect(result.compiledAction.actionKey).toBe('stimulate');
        expect(result.commandIntent).toBeUndefined();
        expect(result.ignoredBoundary).toBe(false);
    });

    it('is read-only: does not write to the database', () => {
        const before = db.prepare(`SELECT COUNT(*) AS c FROM event_logs`).get() as any;
        compileTickAction(baseInput);
        const after = db.prepare(`SELECT COUNT(*) AS c FROM event_logs`).get() as any;
        expect(after.c).toBe(before.c);
    });

    it('resolves change_current_interaction into a concrete perform_action', () => {
        // A stop action requires an active context and removes it.
        presetRepo.saveActionPreset('effect_sensory_overload', 'Перегрузка', { intensity: 0 }, { type: 'condition' });
        db.prepare(`INSERT INTO active_contexts (id, subject_id, action_id, duration, point_id) VALUES (?, ?, ?, ?, ?)`)
            .run('ctx-1', 'S-1', 'effect_sensory_overload', -1, 'systemic');
        presetRepo.saveActionPreset('stop_contact', 'Прекратить контакт', {
            intensity: 0,
            requireContexts: ['effect_sensory_overload'],
            removeContexts: ['effect_sensory_overload'],
        }, { type: 'physical' });
        const input = {
            ...baseInput,
            payload: {
                ...baseInput.payload,
                dynamicModifiers: {
                    commandIntent: { type: 'change_current_interaction', goal: 'stop', pointId: 'systemic' } as CommandIntent,
                },
            },
        };
        const result = compileTickAction(input);
        expect(result.commandIntent.type).toBe('perform_action');
        expect(result.commandIntent.actionId).toBe('stop_contact');
    });

    it('reports an unresolved change_current_interaction as a resolution error', () => {
        const input = {
            ...baseInput,
            payload: {
                ...baseInput.payload,
                dynamicModifiers: {
                    commandIntent: { type: 'change_current_interaction', goal: 'start', pointId: 'systemic' } as CommandIntent,
                },
            },
        };
        const result = compileTickAction(input);
        expect(result.commandIntent.type).toBe('none');
        expect(result.commandResolutionError).toMatch(/Нет применимого действия/);
    });
});
