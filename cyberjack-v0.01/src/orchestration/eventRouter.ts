// src/orchestration/eventRouter.ts
import { runGameTick, GameEventPayload } from './runGameTick';
import { parseVerbalInput } from '../parser/verbalParser';
import { presetRepo, sceneRepo, sceneCharacterRepo } from '../infrastructure/repositories';
import { getLaboratorySpatialContext, listLaboratoryDestinations } from '../scenario/spatialContext';

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
    let pointId = payload.pointId || 'systemic';
    let dynamicModifiers = undefined;
    const sceneId = payload.sceneId || 'scene_lab_calibrator';

    // Optional text semantic classification
    if (payload.textMessage) {
        let sceneContextStr = '';
        let sceneCharacters: { id: string; name: string }[] = [];
        try {
            const scene = sceneRepo.get(sceneId);
            const spatial = sceneId === 'scene_lab_calibrator'
                ? getLaboratorySpatialContext(payload.subjectId || 'S-01', payload.playerId || 'PL-1')
                : null;
            const audibleIds = spatial ? new Set(spatial.characterIds) : null;
            const chars = sceneCharacterRepo.list(sceneId).filter(c => !audibleIds || audibleIds.has(c.character.id));
            const nodesLine = scene?.slots?.length ? `Доступные зоны (сектора): ${scene.slots.map(s => typeof s === 'string' ? s : (s as any).id || s).join(', ')}` : 'Доступные зоны: не определены';
            const charsLine = chars.length ? `Персонажи рядом: ${chars.map(c => c.character.name || c.character.id).join(', ')}` : 'Персонажи рядом: никого';
            const destinations = spatial ? `Доступные места и ориентиры: ${listLaboratoryDestinations(payload.playerId || 'PL-1').join(', ')}.` : '';
            sceneContextStr = `${spatial ? `Текущее место: ${spatial.locationTitle}. ${spatial.description}` : nodesLine}. ${charsLine}. ${destinations}`;
            sceneCharacters = chars.map(c => ({ id: c.character.id, name: c.character.name || c.character.id }));
        } catch (err) {
            sceneContextStr = '';
        }

        dynamicModifiers = await parseVerbalInput(payload.textMessage, sceneContextStr, sceneCharacters, payload.playerId);

        if (dynamicModifiers.pointId) {
            // Check repo instead of direct db query
            if (presetRepo.pointPresetExists(dynamicModifiers.pointId)) {
                pointId = dynamicModifiers.pointId;
            } else {
                console.log(`[EventRouter] Unknown pointId "${dynamicModifiers.pointId}" from LLM. Falling back to "general".`);
                pointId = 'systemic';
            }
        }
    }

    // Run engine logic
    const bundle = await runGameTick({
        subjectId: payload.subjectId || 'S-01',
        playerId: payload.playerId || 'PL-1',
        pointId,
        sceneId: payload.sceneId || 'scene_lab_calibrator',
        presetId: payload.presetId || payload.actionId || 'verbal_pressure',
        playerIntensity: payload.intensity !== undefined ? payload.intensity : 1.0,
        dynamicModifiers,
        eventType: payload.eventType,
        textMessage: payload.textMessage,
        parserVersion: dynamicModifiers?.model,
        customPayload: payload.payload,
        deltaTime: payload.deltaTime
    });

    return { bundle, dynamicModifiers, pointIdUsed: pointId };
}
