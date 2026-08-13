import { loadTickState } from './loadTickState';
import { relationshipDynamicsRepo } from '../infrastructure/relationshipDynamicsRepo';
import type { TickEffect } from './tickEffectPlan';

export interface LoadTickSnapshotInput {
    subjectId: string;
    pointId: string;
    playerId: string;
    sceneId: string;
    initiatorId: string;
    presetId: string;
    deltaTime?: number;
}

export interface LoadTickSnapshotResult {
    state: ReturnType<typeof loadTickState>;
    stateBefore: { core: any; point: any };
    relationalDynamics: ReturnType<typeof relationshipDynamicsRepo.get>;
    elapsedTime: number;
    preTickContextNotes: string[];
    tickEffects: TickEffect[];
    labRelocationApplied: boolean;
}

/**
 * Stage: load the subject's tick state and initialize the tick execution
 * context (state-before snapshot, relational dynamics, elapsed-time unit,
 * effect collection arrays). Read-only — does not write to the database.
 */
export function loadTickSnapshot(input: LoadTickSnapshotInput): LoadTickSnapshotResult {
    const { subjectId, pointId, playerId, sceneId, initiatorId, presetId, deltaTime } = input;
    const state = loadTickState(subjectId, pointId, playerId, sceneId, initiatorId);
    const stateBefore = {
        core: { ...state.core },
        point: { ...state.point }
    };
    const relationalDynamics = relationshipDynamicsRepo.get(subjectId, initiatorId);
    const elapsedTime = deltaTime ?? (presetId === 'wait' ? 20 : 1);
    return {
        state,
        stateBefore,
        relationalDynamics,
        elapsedTime,
        preTickContextNotes: [],
        tickEffects: [],
        labRelocationApplied: false,
    };
}
