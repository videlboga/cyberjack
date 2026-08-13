// src/orchestration/eventRouter.ts
import { runGameTick, GameEventPayload } from './runGameTick';
import { parseSemanticVerbalInput } from '../parser/semanticVerbalParser';
import { presetRepo, sceneRepo, sceneCharacterRepo, chatMemoryRepo } from '../infrastructure/repositories';
import { getLaboratorySpatialContext, listLaboratoryDestinations } from '../scenario/spatialContext';
import { pendingCommandRepo } from '../infrastructure/pendingCommandRepo';
import type { DynamicModifiers } from '../domain/types';

export interface RouteResponse {
    bundle: Awaited<ReturnType<typeof runGameTick>>;
    dynamicModifiers?: DynamicModifiers;
    pointIdUsed: string;
    subjectIdUsed: string;
    actorIdUsed: string;
}

export function resolveCommandRoute(
    routing: { actorId?: string; targetId?: string } | undefined,
    playerId: string,
    fallbackSubjectId: string,
) {
    if (!routing) return { subjectId: fallbackSubjectId, actorId: playerId };

    const actorId = !routing.actorId || routing.actorId === 'initiator'
        ? playerId
        : routing.actorId;
    const targetId = !routing.targetId || routing.targetId === 'initiator'
        ? playerId
        : routing.targetId;

    // For an NPC command, the NPC is the subject whose willingness to obey is
    // evaluated. When the player describes their own action, there is no NPC
    // executor: the recipient must be the simulation subject and respondent.
    return {
        subjectId: actorId === playerId ? targetId : actorId,
        actorId,
    };
}

/**
 * Basic router to handle incoming game events.
 * Handles extracting semantic meaning from text messages, overriding targets,
 * and routing into the engine tick.
 */
export async function dispatchEvent(payload: any): Promise<RouteResponse> {
    let pointId = payload.pointId || 'systemic';
    let dynamicModifiers: DynamicModifiers | undefined = undefined;
    const sceneId = payload.sceneId || 'scene_lab_calibrator';
    let routedSubjectId = payload.subjectId || 'S-01';
    let routedActorId = payload.playerId || 'PL-1';
    let routedPresetId = payload.presetId || payload.actionId || 'verbal_pressure';

    // Optional text semantic classification
    if (payload.textMessage) {
        const pendingSubjectId = payload.addressedCharacterId || payload.subjectId || 'S-01';
        const pendingPlayerId = payload.playerId || 'PL-1';
        // The parser (or its fallback) always assigns dynamicModifiers below;
        // this guard narrows the type for the rest of the block.
        if (!dynamicModifiers) dynamicModifiers = {};
        let pendingCommand = pendingCommandRepo.get(pendingSubjectId, pendingPlayerId);
        if (pendingCommand && pendingCommand.sceneId !== sceneId) {
            pendingCommandRepo.clear(pendingSubjectId, pendingPlayerId);
            pendingCommand = null;
        }
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

        try {
            dynamicModifiers = await parseSemanticVerbalInput(
                payload.textMessage,
                sceneContextStr,
                sceneCharacters,
                payload.addressedCharacterId || payload.playerId || 'PL-1',
                payload.subjectId || 'S-01',
                [...chatMemoryRepo.getRecent(payload.subjectId || 'S-01', 8)]
                    .reverse()
                    .find(message => message.role === 'assistant')?.content || '',
                payload.playerId || 'PL-1',
                pendingCommand ? { description: pendingCommand.description } : null,
            );
        } catch (error: any) {
            // Parsing must never make ordinary dialogue unavailable. On an
            // embedding/classifier outage, preserve the line as neutral speech
            // and execute no command.
            console.error('[EventRouter] Semantic parser unavailable:', error?.message || error);
            dynamicModifiers = {
                intensity: 0.3, valence: 0, contact: 0, sharpness: 0, novelty: 0.5,
                pointId: 'systemic', verbalIntent: 'conversation', commandIntent: { type: 'none' },
                semanticMentions: { actionIds: [], pointIds: [] }, mentionedTags: [],
                raw: error?.message || String(error), model: 'semantic-parser-v2:fallback'
            };
        }
        // Cancelling the conversational focus takes priority over a spurious
        // action mapping extracted from a negative prohibition such as
        // "забудь, не раздевайся".
        if (pendingCommand && dynamicModifiers?.pendingCommandRelation === 'abandon') {
            pendingCommandRepo.clear(pendingSubjectId, pendingPlayerId);
            dynamicModifiers = { ...dynamicModifiers, commandIntent: { type: 'none' }, routing: undefined };
            pendingCommand = null;
        }
        const parsedCommand = dynamicModifiers?.commandIntent;
        const hasNewCommand = Boolean(parsedCommand?.type && parsedCommand.type !== 'none');
        if (!hasNewCommand && pendingCommand) {
            if (dynamicModifiers?.pendingCommandRelation === 'continue') {
                dynamicModifiers = {
                    ...dynamicModifiers,
                    commandIntent: pendingCommand.intent,
                    routing: pendingCommand.routing,
                    resumedPendingCommand: true,
                    pendingCommandSourceText: pendingCommand.sourceText,
                    pendingCommandDescription: pendingCommand.description,
                };
            } else {
                pendingCommandRepo.clear(pendingSubjectId, pendingPlayerId);
            }
        } else if (hasNewCommand && parsedCommand) {
            // A new explicit instruction supersedes the previous conversational focus.
            pendingCommandRepo.clear(pendingSubjectId, pendingPlayerId);
            const commandDescription = (() => {
                if (parsedCommand.type === 'perform_action') return parsedCommand.actionId === 'command_remove_worn_clothing'
                    ? 'снять надетую одежду'
                    : presetRepo.getActionPreset(parsedCommand.actionId)?.label || parsedCommand.actionId;
                if (parsedCommand.type === 'activate_context' || parsedCommand.type === 'deactivate_context') {
                    return presetRepo.getActionPreset(parsedCommand.targetContextId)?.label || parsedCommand.targetContextId;
                }
                if (parsedCommand.type === 'move') return `переместиться: ${parsedCommand.targetLocation}`;
                if (parsedCommand.type === 'change_current_interaction') return `${parsedCommand.goal} текущее взаимодействие`;
                return payload.textMessage;
            })();
            dynamicModifiers = { ...dynamicModifiers, commandSourceText: payload.textMessage, commandDescription };
        }
        if (dynamicModifiers.routing) {
            const route = resolveCommandRoute(
                dynamicModifiers.routing,
                payload.playerId || 'PL-1',
                routedSubjectId,
            );
            routedSubjectId = route.subjectId;
            // The carrier event is still the player's spoken command. The NPC
            // executor lives in commandIntent/routing and is handled by the
            // command resolver; treating that NPC as the verbal initiator
            // turns dialogue history and relationship appraisal into a
            // conversation with herself.
            routedActorId = payload.playerId || 'PL-1';
            pointId = dynamicModifiers.pointId || 'systemic';
        }
        console.info('[EventRouter][CommandRoute]', JSON.stringify({
            text: payload.textMessage,
            addressedCharacterId: payload.addressedCharacterId || null,
            requestedSubjectId: payload.subjectId || null,
            parsedRouting: dynamicModifiers.routing || null,
            commandIntent: dynamicModifiers.commandIntent || null,
            routedSubjectId,
            routedActorId,
            pointId,
        }));
            const verbalPresentation = {
                conversation: { label: 'Беседа', tags: ['mental'] },
                question: { label: 'Вопрос', tags: ['mental'] },
                praise: { label: 'Похвала', tags: ['mental', 'comfort'] },
                insult: { label: 'Вербальное давление', tags: ['mental', 'pressure', 'demeaning'] },
                command: { label: 'Команда', tags: ['mental', 'pressure', 'command'] }
            } as const;
            const verbalIntent = dynamicModifiers.commandIntent?.type && dynamicModifiers.commandIntent.type !== 'none'
                ? 'command'
                : dynamicModifiers.verbalIntent || 'conversation';
            dynamicModifiers = {
                ...dynamicModifiers,
                verbalIntent,
                ...verbalPresentation[verbalIntent as keyof typeof verbalPresentation],
                tags: [
                    ...verbalPresentation[verbalIntent as keyof typeof verbalPresentation].tags,
                    ...(dynamicModifiers.mentionedTags || [])
                ]
            };

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
        subjectId: routedSubjectId,
        playerId: payload.playerId || 'PL-1',
        actingCharacterId: routedActorId,
        pointId,
        sceneId: payload.sceneId || 'scene_lab_calibrator',
        presetId: routedPresetId,
        playerIntensity: payload.intensity !== undefined ? payload.intensity : 1.0,
        dynamicModifiers,
        eventType: payload.eventType,
        textMessage: payload.textMessage,
        parserVersion: dynamicModifiers?.model,
        customPayload: payload.payload,
        deltaTime: payload.deltaTime,
        stateDeltaScale:payload.stateDeltaScale,
        skipPrompt:payload.skipPrompt,
        skipContextTimeAdvance:payload.skipContextTimeAdvance,
    });

    return { bundle, dynamicModifiers, pointIdUsed: pointId, subjectIdUsed: routedSubjectId, actorIdUsed: routedActorId };
}
