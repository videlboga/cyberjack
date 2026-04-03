import { Scene, PlayerState, SubjectCoreState, Mission } from '../domain/types';
import { resolveSceneTransition } from './resolveSceneTransition';
import { applyMissionProgress } from './applyMissionProgress';

// Типов для scenarioState нет, но мы можем собрать заглушку.
export interface ScenarioState {
    scene: Scene;
    player: PlayerState;
    core: SubjectCoreState;
    mission: Mission | null;
}

export interface ScenarioStepResult {
    nextSceneId: string | null;
    updatedPlayer: PlayerState;
    updatedMission: Mission | null;
    success: boolean;
    error?: string;
}

export interface ScenarioStepContext {
    actionId: string;
}

/**
 * Оркеструет последствия после расчёта тика:
 * проверяет условия переходов сцен, обновляет миссию и передаёт
 * информацию о следующей сцене.
 */
export function runScenarioStep(
    state: ScenarioState,
    context: ScenarioStepContext
): ScenarioStepResult {
    const { scene, player, core, mission } = state;
    let nextPlayer = player;
    
    const nextSceneId = resolveSceneTransition(scene, core, { actionId: context.actionId });
    let nextMission = mission;
    if (mission) {
        nextMission = applyMissionProgress(mission, core, {});
    }

    return {
        nextSceneId,
        updatedPlayer: nextPlayer,
        updatedMission: nextMission,
        success: true
    };
}
