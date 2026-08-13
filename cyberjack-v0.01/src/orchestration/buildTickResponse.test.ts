import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../infrastructure/db';
import { presetRepo } from '../infrastructure/repositories';
import { buildTickResponse } from './buildTickResponse';

const baseInput = {
    tickId: 'tick-1',
    payload: {
        subjectId: 'S-1',
        playerId: 'PL-1',
        sceneId: 'scene_lab_calibrator',
        pointId: 'systemic',
        presetId: 'stimulate',
        playerIntensity: 1,
        textMessage: 'стимулируй',
        dynamicModifiers: undefined,
        customPayload: null,
    },
    activeSceneId: 'scene_lab_calibrator',
    compiledAction: { actionKey: 'stimulate', label: 'Стимуляция', type: 'physical', tags: [] } as any,
    output: {
        nextCore: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50, tension: 10 },
        nextPoint: { pointId: 'systemic', localSensitivity: 50, localAttitude: 50, localOpenness: 50, familiarity: 0, exposureCount: 0 },
        result: { finalValence: 0.3, pleasure: 5, discomfort: 0, overload: 0, experiencedIntensity: 3 },
        delta: { core: {} as any, point: {} as any },
        tickMeta: { inputs: {} as any },
    } as any,
    stateBefore: { core: { sensitivity: 50 }, point: { localSensitivity: 50 } },
    diagnostics: { observation: {} } as any,
    prompt: { systemPrompt: '' } as any,
    scenarioResult: {} as any,
    initiatorId: 'PL-1',
    state: { core: { attitude: 50 }, relation: { attitude: 50 } },
    relationalDynamics: { resistance: 0, learnedCompliance: 0, dissociation: 0 },
    actionApplied: true,
    addedContextNotes: [] as string[],
    commandActionPreset: undefined,
    commandIntent: undefined,
    tickEffects: [] as any[],
};

describe('buildTickResponse', () => {
    beforeEach(() => {
        db.prepare('PRAGMA foreign_keys = OFF').run();
        for (const table of ['action_presets', 'characters']) {
            db.prepare(`DELETE FROM ${table}`).run();
        }
        db.prepare('PRAGMA foreign_keys = ON').run();
        presetRepo.saveActionPreset('stimulate', 'Стимуляция', { intensity: 0.5 });
        db.prepare(`INSERT INTO characters (id, name, kind) VALUES (?, ?, ?)`).run('S-1', 'Актив', 'npc');
    });

    it('builds a response with event, trace and stateAfter', () => {
        const result = buildTickResponse(baseInput);
        expect(result.response.tickId).toBe('tick-1');
        expect(result.event.id).toBe('tick-1');
        expect(result.event.type).toBe('verbal_input');
        expect(result.actionTrace).toHaveLength(6);
        expect(result.response.stateAfter.core.sensitivity).toBe(50);
        expect(result.response.actionApplied).toBe(true);
    });

    it('is read-only: does not write to the database', () => {
        const before = db.prepare(`SELECT COUNT(*) AS c FROM event_logs`).get() as any;
        buildTickResponse(baseInput);
        const after = db.prepare(`SELECT COUNT(*) AS c FROM event_logs`).get() as any;
        expect(after.c).toBe(before.c);
    });

    it('produces a pending-command.clear effect for an applied command', () => {
        const input = {
            ...baseInput,
            payload: {
                ...baseInput.payload,
                dynamicModifiers: { commandIntent: { type: 'perform_action', actionId: 'stimulate' } },
            },
            commandIntent: { type: 'perform_action', actionId: 'stimulate' },
        };
        const result = buildTickResponse(input);
        expect(result.pendingCommandEffect).toBeDefined();
        expect(result.pendingCommandEffect!.kind).toBe('pending-command.clear');
    });

    it('produces a pending-command.save effect for a refused command', () => {
        const input = {
            ...baseInput,
            payload: {
                ...baseInput.payload,
                dynamicModifiers: { commandIntent: { type: 'perform_action', actionId: 'stimulate' } },
            },
            commandIntent: { type: 'perform_action', actionId: 'stimulate' },
            actionApplied: false,
            addedContextNotes: ['[Система]: Актив мысленно отклоняет действие.'],
        };
        const result = buildTickResponse(input);
        expect(result.pendingCommandEffect).toBeDefined();
        expect(result.pendingCommandEffect!.kind).toBe('pending-command.save');
    });
});
