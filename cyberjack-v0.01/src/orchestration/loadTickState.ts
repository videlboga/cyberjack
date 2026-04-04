// src/orchestration/loadTickState.ts
import { subjectRepo, pointStateRepo, playerRepo, sceneRepo, characterRepo, characterRelationRepo } from '../infrastructure/repositories';
import { SubjectCoreState, SubjectPointState, PlayerState, Scene, CharacterRelation, Character } from '../domain/types';

export interface TickState {
    core: SubjectCoreState;
    point: SubjectPointState;
    player: PlayerState;
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

    const player = playerRepo.get(playerId);
    if (!player) throw new Error(`Player ${playerId} not found`);

    const scene = sceneRepo.get(sceneId);
    if (!scene) throw new Error(`Scene ${sceneId} not found`);

    const subjectCharacter = characterRepo.ensureSubject(subjectId, core.name || subjectId);
    const playerCharacter = characterRepo.ensurePlayer(playerId, playerId);
    const relation = characterRelationRepo.ensure(subjectCharacter.id, playerCharacter.id, {
        attitude: core.attitude,
        baselineAttitude: core.baselineAttitude ?? core.attitude
    });

    return { core, point, player, scene, relation, subjectCharacter, playerCharacter };
}
