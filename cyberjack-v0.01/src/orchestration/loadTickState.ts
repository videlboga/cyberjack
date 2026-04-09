// src/orchestration/loadTickState.ts
import { subjectRepo, pointStateRepo, resourceRepo, sceneRepo, characterRepo, characterRelationRepo } from '../infrastructure/repositories';
import { SubjectCoreState, SubjectPointState, ResourceState, Scene, CharacterRelation, Character } from '../domain/types';

export interface TickState {
    core: SubjectCoreState;
    point: SubjectPointState;
    resources: ResourceState;
    scene: Scene;
    relation: CharacterRelation;
    subjectCharacter: Character;
    playerCharacter: Character;
}

export function loadTickState(subjectId: string, pointId: string, playerId: string, sceneId: string): TickState {
    const core = subjectRepo.get(subjectId);
    if (!core) throw new Error(`Subject ${subjectId} not found`);

    const point = pointStateRepo.get(subjectId, pointId);
    if (!point) throw new Error(`Point ${pointId} for Subject ${subjectId} not found`);

    const resources = resourceRepo.get(playerId);
    if (!resources) throw new Error(`Resources for ${playerId} not found`);

    const scene = sceneRepo.get(sceneId);
    if (!scene) throw new Error(`Scene ${sceneId} not found`);

    const subjectCharacter = characterRepo.ensureSubject(subjectId, core.name || subjectId);
    const playerCharacter = characterRepo.ensureCharacter(playerId, playerId);
    const relation = characterRelationRepo.ensure(subjectCharacter.id, playerCharacter.id, {
        attitude: core.attitude,
        baselineAttitude: core.baselineAttitude ?? core.attitude
    });

    return { core, point, resources, scene, relation, subjectCharacter, playerCharacter };
}
