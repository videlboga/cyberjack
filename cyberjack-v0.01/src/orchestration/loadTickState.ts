// src/orchestration/loadTickState.ts
import { subjectRepo, pointStateRepo, playerRepo, sceneRepo } from '../infrastructure/repositories';
import { SubjectCoreState, SubjectPointState, PlayerState, Scene } from '../domain/types';

export interface TickState {
    core: SubjectCoreState;
    point: SubjectPointState;
    player: PlayerState;
    scene: Scene;
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

    return { core, point, player, scene };
}
