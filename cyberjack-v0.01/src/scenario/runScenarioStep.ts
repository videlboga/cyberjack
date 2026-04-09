import { Scene, ResourceState, SubjectCoreState, Mission } from '../domain/types';
import { resolveSceneTransition } from './resolveSceneTransition';
import { applyMissionProgress } from './applyMissionProgress';

// Типов для scenarioState нет, но мы можем собрать заглушку.
export interface ScenarioState {
    scene: Scene;
    resources: ResourceState;
    core: SubjectCoreState;
    mission: Mission | null;
}

export interface ScenarioStepResult {
    nextSceneId: string | null;
    updatedResources: ResourceState;
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
    const { scene, resources, core, mission } = state;
    let nextResources = resources;
    
    const nextSceneId = resolveSceneTransition(scene, core, { actionId: context.actionId });
    let nextMission = mission;
    if (mission) {
        nextMission = applyMissionProgress(mission, core, {});
    }

    return {
        nextSceneId,
        updatedResources: nextResources,
        updatedMission: nextMission,
        success: true
    };
}
