// src/orchestration/runGameTick.ts
import { loadTickState } from './loadTickState';
import { saveTickState } from './saveTickState';
import { compileAction } from '../compiler/compileAction';
import { runTick } from '../engine/runTick';
import { eventQueries } from '../infrastructure/eventQueries';
import { TickOutput } from '../domain/types';

export interface GameEventPayload {
    subjectId: string;
    pointId: string;
    playerId: string;
    sceneId: string;
    presetId: string; // The base action id
    playerIntensity?: number;
}

export function runGameTick(payload: GameEventPayload): TickOutput {
    // 1. Load state
    const state = loadTickState(payload.subjectId, payload.pointId, payload.playerId, payload.sceneId);

    // 2. Validate access through scenario layer (Stub for Phase 6)
    // checkActionAccess(state.player, state.scene, payload.presetId);
    // applyResourceCosts(state.player, payload.presetId);

    // 3. Get history for novelty
    const history = eventQueries.getRecentLogs(payload.subjectId, 5);

    // 4. Compile Action Vector
    const compiledAction = compileAction({
        presetId: payload.presetId,
        eventId: payload.sceneId, // Treat sceneId as the root event contexts are bound to for now
        playerIntensity: payload.playerIntensity,
        history: history
    });

    // 5. Run Engine Tick
    const engineOutput = runTick({
        action: compiledAction,
        core: state.core,
        point: state.point
    });

    // 6. Save new state
    saveTickState(payload.subjectId, payload.pointId, compiledAction, engineOutput);

    // 7. Return complete Tick Bundle
    return engineOutput;
}
