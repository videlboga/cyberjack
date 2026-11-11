import { characterRelationRepo, sceneCharacterRepo } from '../infrastructure/repositories';
import { getLaboratorySpatialContext } from '../scenario/spatialContext';

export const NEUTRAL_VISIBLE_RELATION = {
    attitude: 50,
    openness: 22,
    plasticity: 50,
    familiarity: 0.02,
} as const;

/**
 * Keep social reachability aligned with the laboratory's actual rooms.
 * A first shared audible space creates a modest, two-way acquaintance; it
 * does not imply trust or permission for intimate interaction.
 */
export function syncLaboratorySpatialRelations(playerId = 'PL-1') {
    const sceneId = 'scene_lab_calibrator';
    const presentSubjectIds = sceneCharacterRepo.list(sceneId)
        .filter(entry => entry.presenceState === 'present' && entry.character.subjectId)
        .map(entry => entry.character.subjectId as string);

    for (const fromId of presentSubjectIds) {
        const spatial = getLaboratorySpatialContext(fromId, playerId);
        if (!spatial) continue;
        const visible = new Set(spatial.subjectIds.filter(id => id !== fromId && presentSubjectIds.includes(id)));

        for (const toId of presentSubjectIds) {
            if (toId === fromId) continue;
            const existing = characterRelationRepo.get(fromId, toId);
            if (visible.has(toId)) {
                if (!existing) {
                    characterRelationRepo.ensure(fromId, toId, {
                        knows: true,
                        present: true,
                        canInteract: true,
                        attitude: NEUTRAL_VISIBLE_RELATION.attitude,
                        openness: NEUTRAL_VISIBLE_RELATION.openness,
                        plasticity: NEUTRAL_VISIBLE_RELATION.plasticity,
                        baselineAttitude: NEUTRAL_VISIBLE_RELATION.attitude,
                        baselineOpenness: NEUTRAL_VISIBLE_RELATION.openness,
                        baselinePlasticity: NEUTRAL_VISIBLE_RELATION.plasticity,
                    });
                    characterRelationRepo.updateSocialStats(fromId, toId, {
                        familiarityDelta: NEUTRAL_VISIBLE_RELATION.familiarity,
                        generalOpinion: 'Первое впечатление пока нейтрально.',
                    });
                } else {
                    characterRelationRepo.updateFlags(fromId, toId, { present: true, canInteract: true });
                }
            } else if (existing) {
                characterRelationRepo.updateFlags(fromId, toId, { present: false, canInteract: false });
            }
        }
    }
}

/** A witnessed event makes its participants a little more familiar, not liked. */
export function noteObservedParticipants(observerId: string, participantIds: string[]) {
    for (const participantId of new Set(participantIds)) {
        if (!participantId || participantId === observerId) continue;
        if (!characterRelationRepo.get(observerId, participantId)) continue;
        characterRelationRepo.updateSocialStats(observerId, participantId, { familiarityDelta: 0.005 });
    }
}
