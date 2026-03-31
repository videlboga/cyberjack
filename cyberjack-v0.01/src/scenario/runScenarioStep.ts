import { Scene, PlayerState, SubjectCoreState, Mission } from '../domain/types';
import { checkActionAccess } from './checkActionAccess';
import { applyResourceCosts } from './applyResourceCosts';
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

/**
 * Оркеструет логику сценария: применяется ли действие, 
 * снимает стоимость, проверяет не перешли ли на следующую сцену 
 * и повысила ли действие наш статус в миссии.
 */
export function runScenarioStep(
    actionId: string, 
    actionCosts: Record<string, number>, 
    state: ScenarioState
): ScenarioStepResult {
    const { scene, player, core, mission } = state;
    
    // 1. Проверить доступность в сцене
    if (!checkActionAccess(actionId, scene, player)) {
        return {
            nextSceneId: null,
            updatedPlayer: player,
            updatedMission: mission,
            success: false,
            error: 'Action not available in current scene.'
        };
    }
    
    let nextPlayer = player;
    
    // 2. Спишем ресурсы (если есть стоимость)
    try {
        if (actionCosts && Object.keys(actionCosts).length > 0) {
            nextPlayer = applyResourceCosts(player, actionCosts);
        }
    } catch (err: any) {
        return {
            nextSceneId: null,
            updatedPlayer: player, // откатываем
            updatedMission: mission,
            success: false,
            error: err.message
        };
    }
    
    // 3. Проверить переходы по сцене. 
    // Пока передаём пустые условия (всегда null). 
    // В будущем тут будут динамически грузится rule engine из БД.
    const ruleEngineTransitions: any[] = []; 
    const nextSceneId = resolveSceneTransition(scene, core, ruleEngineTransitions);
    
    // 4. Проверить прогресс в миссии.
    let nextMission = mission;
    if (mission) {
        // Заглушка, где мы ничего не меняем по сути, просто вызываем функцию
        nextMission = applyMissionProgress(mission, core, {});
    }

    // Успешно прошли сценарные проверки перед передачей на просчёт движка (или после)
    return {
        nextSceneId,
        updatedPlayer: nextPlayer,
        updatedMission: nextMission,
        success: true
    };
}
