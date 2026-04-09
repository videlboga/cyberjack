import { Scene, ResourceState } from '../domain/types';
import { presetRepo, sceneCharacterRepo } from '../infrastructure/repositories';

export interface ActionValidationResult {
    allowed: boolean;
    errorReason?: string;
}

/**
 * Проверяет, доступно ли действие в текущей сцене, включая 
 * проверку дистанции (proximity) и доступности самого пресета.
 */
export function validateAction(
    actionId: string, 
    scene: Scene, 
    player?: ResourceState,
    subjectId?: string,
    playerId?: string
): ActionValidationResult {
    // 1. Scene Availability Constraint
    const isGlobalAction = actionId === 'wait' || actionId === 'verbal_pressure';
    const isListedInScene = scene.availableActions.includes(actionId);
    
    if (!isGlobalAction && !isListedInScene) {
        return { allowed: false, errorReason: `Действие "${actionId}" недоступно в сцене "${scene.id}".` };
    }

    // 2. Proximity / Geographical Slot Constraints
    const actionPreset = presetRepo.getActionPreset(actionId);
    if (actionPreset && (actionPreset.type === 'physical' || actionPreset.contact > 0.3) && subjectId && playerId) {
        const presentChars = sceneCharacterRepo.list(scene.id);
        const subjSceneChar = presentChars.find(sc => sc.character.subjectId === subjectId || sc.character.id === subjectId);
        const playerSceneChar = presentChars.find(sc => sc.character.playerId === playerId || sc.character.id === playerId);
        
        if (subjSceneChar && playerSceneChar && subjSceneChar.slotId && playerSceneChar.slotId && subjSceneChar.slotId !== playerSceneChar.slotId) {
            return { allowed: false, errorReason: 'Слишком далеко для физического воздействия. Сначала подойдите в нужную зону (сектор).' };
        }
    }

    // 3. Resource Availability (to be expanded here before charging)
    
    return { allowed: true };
}

// Legacy wrapper to keep existing checks working until fully refactored
export function checkActionAccess(actionId: string, scene: Scene, player: ResourceState): boolean {
    return validateAction(actionId, scene, player).allowed;
}
