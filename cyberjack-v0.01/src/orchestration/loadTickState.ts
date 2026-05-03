// src/orchestration/loadTickState.ts
import { subjectRepo, pointStateRepo, resourceRepo, sceneRepo, characterRepo, characterRelationRepo } from '../infrastructure/repositories';
import { contractRepo } from '../infrastructure/contractRepo';
import { SubjectCoreState, SubjectPointState, ResourceState, Scene, CharacterRelation, Character, AssetContract } from '../domain/types';

export interface TickState {
    core: SubjectCoreState;
    point: SubjectPointState;
    resources: ResourceState;
    scene: Scene;
    relation: CharacterRelation;
    subjectCharacter: Character;
    playerCharacter: Character;
    contracts: AssetContract[];
}

export function loadTickState(subjectId: string, pointId: string, playerId: string, sceneId: string): TickState {
    const pId = pointId.toLowerCase();
    const core = subjectRepo.get(subjectId);
    if (!core) throw new Error(`Subject ${subjectId} not found`);

    const point = pointStateRepo.get(subjectId, pId);
    if (!point) throw new Error(`Point ${pId} for Subject ${subjectId} not found`);

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

    // Берем все активные контракты игрока
    const contracts = contractRepo.listForPlayer(playerId).filter(c => c.state === 'accepted');

    return { core, point, resources, scene, relation, subjectCharacter, playerCharacter, contracts };
}
