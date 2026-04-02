// src/orchestration/runGameTick.ts
import { randomUUID } from 'crypto';
import { loadTickState } from './loadTickState';
import { saveTickState } from './saveTickState';
import { compileAction } from '../compiler/compileAction';
import { applyDynamicContexts } from '../compiler/dynamicModifiers';
import { runTick } from '../engine/runTick';
import { eventQueries } from '../infrastructure/eventQueries';
import { activeContextsRepo } from '../infrastructure/repositories';
import { CompiledAction, TickBundle, GameEvent } from '../domain/types';
import { buildDiagnostics } from '../diagnostics/buildDiagnostics';
import { buildPromptPayload } from '../prompts/buildPromptPayload';

export interface GameEventPayload {
    subjectId: string;
    pointId: string;
    playerId: string;
    sceneId: string;
    presetId: string; // The base action id
    playerIntensity?: number;
    dynamicModifiers?: Partial<CompiledAction>;
    eventType?: GameEvent['type'];
    textMessage?: string;
    parserVersion?: string;
}

export async function runGameTick(payload: GameEventPayload): Promise<TickBundle> {
    // 1. Load state
    const state = loadTickState(payload.subjectId, payload.pointId, payload.playerId, payload.sceneId);
    const stateBefore = {
        core: { ...state.core },
        point: { ...state.point }
    };
    
    // 2. Validate access through scenario layer (Stub for Phase 6)
    // checkActionAccess(state.player, state.scene, payload.presetId);
    // applyResourceCosts(state.player, payload.presetId);

    // 3. Get history for novelty
    const history = eventQueries.getRecentLogs(payload.subjectId, 5);
    
    // 4. Compile Action Vector
    let compiledAction = compileAction({
        presetId: payload.presetId,
        eventId: payload.sceneId, // Treat sceneId as the root event contexts are bound to for now
        playerIntensity: payload.playerIntensity,
        history: history,
        dynamicModifiers: payload.dynamicModifiers,
        sourceText: payload.textMessage,
        parserVersion: payload.parserVersion
    });

    // 4.5 Apply Virtual Contexts (Mental and Body point overloads)
    const baseAction = (compiledAction as any)._baseAction;
    compiledAction = applyDynamicContexts(compiledAction, state.core, state.point);
    (compiledAction as any)._baseAction = baseAction || compiledAction;

    // 5. Run Engine Tick
    const engineOutput = runTick({
        subjectId: payload.subjectId,
        pointId: payload.pointId,
        action: compiledAction,
        core: state.core,
        point: state.point,
        config: undefined
    });

    if (engineOutput.tickMeta?.inputs) {
        (engineOutput.tickMeta.inputs.action as any)._baseAction = (compiledAction as any)._baseAction;
    }

    // 6. Save new state
    const tickId = randomUUID();

    saveTickState(payload.subjectId, payload.pointId, payload.presetId, compiledAction, engineOutput, tickId);

    // 6.5 Update context strain (Escalation / Decay)
    activeContextsRepo.applyStrain(payload.sceneId, { actionIntensity: compiledAction.intensity });

    const diagnostics = buildDiagnostics(
        engineOutput.tickMeta.inputs.action,
        state.core,
        engineOutput
    );

    const prompt = await buildPromptPayload(payload.subjectId, engineOutput, payload.sceneId);

    const event: GameEvent = {
        id: tickId,
        type: payload.eventType || (payload.textMessage ? 'verbal_input' : 'ui_action'),
        subjectId: payload.subjectId,
        playerId: payload.playerId,
        sceneId: payload.sceneId,
        pointId: payload.pointId,
        timestamp: new Date().toISOString(),
        payload: {
            presetId: payload.presetId,
            playerIntensity: payload.playerIntensity,
            dynamicModifiers: payload.dynamicModifiers
        }
    };

    return {
        tickId,
        event,
        compiledAction,
        output: engineOutput,
        stateBefore,
        stateAfter: {
            core: engineOutput.nextCore,
            point: engineOutput.nextPoint
        },
        diagnostics,
        prompt,
        metadata: {
            commandIntent: payload.dynamicModifiers && (payload.dynamicModifiers as any).commandIntent
        }
    };
}
