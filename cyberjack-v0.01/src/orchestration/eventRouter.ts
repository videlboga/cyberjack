// src/orchestration/eventRouter.ts
import { runGameTick, GameEventPayload } from './runGameTick';
import { parseVerbalInput } from '../parser/verbalParser';
import { presetRepo } from '../infrastructure/repositories';

export interface RouteResponse {
    bundle: Awaited<ReturnType<typeof runGameTick>>;
    dynamicModifiers?: any;
    pointIdUsed: string;
}

/**
 * Basic router to handle incoming game events.
 * Handles extracting semantic meaning from text messages, overriding targets,
 * and routing into the engine tick.
 */
export async function dispatchEvent(payload: any): Promise<RouteResponse> {
    let pointId = payload.pointId || 'general';
    let dynamicModifiers = undefined;

    // Optional text semantic classification
    if (payload.textMessage) {
        dynamicModifiers = await parseVerbalInput(payload.textMessage);
        if (dynamicModifiers.pointId) {
            // Check repo instead of direct db query
            if (presetRepo.pointPresetExists(dynamicModifiers.pointId)) {
                pointId = dynamicModifiers.pointId;
            } else {
                console.log(`[EventRouter] Unknown pointId "${dynamicModifiers.pointId}" from LLM. Falling back to "general".`);
                pointId = 'general';
            }
        }
    }

    // Run engine logic
    const bundle = await runGameTick({
        subjectId: payload.subjectId || 'S-01',
        playerId: payload.playerId || 'PL-1',
        pointId,
        sceneId: payload.sceneId || 'lab',
        presetId: payload.presetId || payload.actionId || 'verbal_pressure',
        playerIntensity: payload.intensity !== undefined ? payload.intensity : 1.0,
        dynamicModifiers,
        eventType: payload.eventType,
        textMessage: payload.textMessage,
        parserVersion: dynamicModifiers?.model,
        customPayload: payload.payload
    });

    return { bundle, dynamicModifiers, pointIdUsed: pointId };
}
