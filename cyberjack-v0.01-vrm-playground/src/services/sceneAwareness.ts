import { buildEmbedding } from './embeddingService';
import { conditioningTags } from '../domain/conditioning';
import {
    characterRelationRepo,
    characterRepo,
    memoryRepo,
    subjectPreferencesRepo,
    subjectRepo,
} from '../infrastructure/repositories';
import { getLaboratorySpatialContext } from '../scenario/spatialContext';
import { noteObservedParticipants, syncLaboratorySpatialRelations } from './sceneRelations';

type ObservableSceneAction = {
    sceneId: string;
    playerId?: string;
    actorId: string;
    targetId: string;
    actionId: string;
    actionLabel: string;
    pointId?: string;
    pointLabel?: string;
    actionTags?: string[];
    finalValence?: number;
    notable?: boolean;
    background?: boolean;
    worldMinute?: number;
    spokenText?: string;
    outcomeText?: string;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * A witnessed event is intentionally much weaker than a direct experience.
 * It affects what an NPC notices and becomes curious or wary about, without
 * transferring the target's bodily reaction into the observer.
 */
export function observationalLearningDelta(input: {
    observerToTargetAttitude?: number;
    finalValence?: number;
}): number {
    const attachment = clamp(((input.observerToTargetAttitude ?? 50) - 50) / 50, -1, 1);
    const visibleValence = clamp(Number(input.finalValence || 0), -1, 1);
    return clamp(visibleValence * (0.012 + Math.abs(attachment) * 0.028), -0.04, 0.04);
}

/** Persist the visible fact of an action for every character able to witness it. */
export function recordSceneObservation(action: ObservableSceneAction) {
    if (action.sceneId !== 'scene_lab_calibrator') return;
    // Repeating minute-level device pulses are represented by their phase
    // changes; otherwise they would bury every meaningful observed episode.
    if (action.background && !action.notable) return;
    syncLaboratorySpatialRelations(action.playerId || 'PL-1');

    const spatial = getLaboratorySpatialContext(action.targetId, action.playerId || 'PL-1');
    if (!spatial || spatial.isolated) return;

    const actorCharacter = characterRepo.get(action.actorId);
    const actorName = actorCharacter?.name || subjectRepo.get(action.actorId)?.name || 'Калибратор';
    const targetName = subjectRepo.get(action.targetId)?.name || action.targetId;
    const actionTags = conditioningTags(action.actionId, action.actionTags || []);
    const text = `Действие «${action.actionLabel}» от ${actorName} было направлено на ${targetName}${action.pointLabel ? ` в области «${action.pointLabel}»` : ''}${action.spokenText ? `: «${action.spokenText}»` : ''}.`;

    for (const observerId of new Set(spatial.subjectIds)) {
        if (!observerId || observerId === action.targetId || observerId === action.actorId) continue;
        if (!subjectRepo.get(observerId)) continue;

        const relation = characterRelationRepo.get(observerId, action.targetId);
        const delta = observationalLearningDelta({
            observerToTargetAttitude: relation?.attitude,
            finalValence: action.finalValence,
        });

        memoryRepo.save({
            subjectId: observerId,
            text: `Я видела: ${text}`,
            embedding: buildEmbedding(`${observerId} ${text}`),
            tags: ['scene_observation', ...actionTags],
            relatedSubjects: [action.actorId, action.targetId],
            type: 'episode_v2',
            metadata: {
                observed: true,
                sceneId: action.sceneId,
                worldMinute: action.worldMinute ?? null,
                actorId: action.actorId,
                actorName,
                targetId: action.targetId,
                targetName,
                actionId: action.actionId,
                actionLabel: action.actionLabel,
                pointId: action.pointId || null,
                pointLabel: action.pointLabel || null,
                playerSpeech: action.spokenText || '',
                observedOutcome: action.outcomeText || '',
            },
        });

        if (delta !== 0) {
            subjectPreferencesRepo.adjust(observerId, 'actions', action.actionId, delta);
            if (action.pointId) subjectPreferencesRepo.adjust(observerId, 'points', action.pointId, delta * 0.7);
            for (const tag of actionTags) subjectPreferencesRepo.adjust(observerId, 'tags', tag, delta * 0.45);
        }
        noteObservedParticipants(observerId, [action.actorId, action.targetId]);
    }
}
