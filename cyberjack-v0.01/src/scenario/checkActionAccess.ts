import { Scene, ResourceState } from '../domain/types';
import { presetRepo, sceneCharacterRepo, characterItemsRepo, sceneObjectsRepo, activeContextsRepo } from '../infrastructure/repositories';
import { isActionTargetAllowed } from '../domain/actionTargets';

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
    playerId?: string,
    pointId?: string
): ActionValidationResult {
    // 1. Scene Availability Constraint
    const isGlobalAction = actionId === 'wait' || actionId === 'verbal_pressure';
    const isListedInScene = scene.availableActions.includes(actionId);

    if (!isGlobalAction && !isListedInScene) {
        return { allowed: false, errorReason: `Действие "${actionId}" недоступно в сцене "${scene.id}".` };
    }

    const actionPreset = presetRepo.getActionPreset(actionId);

    if (actionPreset && pointId && !isActionTargetAllowed(actionPreset.validTargets, pointId)) {
        return { allowed: false, errorReason: `Действие «${actionPreset.label || actionId}» нельзя применить к точке «${pointId}».` };
    }
    
    // 2. Proximity / Geographical Slot Constraints
    // Proximity check: only enforce sector proximity for explicitly physical actions
    // that are not considered global actions (like 'verbal_pressure').
    // Previously we allowed contact>0.3 to trigger this, which caused some
    // non-local interactions to be blocked. Also treat known global actions
    // as exempt even if their preset type is 'physical'.
    if (actionPreset && actionPreset.type === 'physical' && !isGlobalAction && subjectId && playerId) {
        const presentChars = sceneCharacterRepo.list(scene.id);
        const subjSceneChar = presentChars.find(sc => sc.character.subjectId === subjectId || sc.character.id === subjectId);
        const playerSceneChar = presentChars.find(sc => sc.character.playerId === playerId || sc.character.id === playerId);
        
        if (subjSceneChar && playerSceneChar && subjSceneChar.slotId && playerSceneChar.slotId && subjSceneChar.slotId !== playerSceneChar.slotId) {
            return { allowed: false, errorReason: 'Слишком далеко для физического воздействия. Сначала подойдите в нужную зону (сектор).' };
        }
    }

    // 3. Items and Scene Objects Requirements
    if (actionPreset && playerId) {
        const requiredItem = actionPreset.requiresItem || actionPreset.contextConfig?.requiresItem;
        if (requiredItem) {
            // playerId currently serves as the initiator ID. In the future this should be `initiatorId` mapping to `characterId`
            const theChar = sceneCharacterRepo.list(scene.id).find(c => c.character.playerId === playerId || c.character.id === playerId)?.character;
            if (!theChar) {
                return { allowed: false, errorReason: `Персонаж-инициатор не найден в сцене.` };
            }
            const item = characterItemsRepo.get(theChar.id, requiredItem);
            if (!item || item.state === 'consumed' || item.state === 'broken' || item.charges === 0) {
                return { allowed: false, errorReason: `Требуется предмет "${requiredItem}" в инвентаре для этого действия.` };
            }
        }

        const requiredSceneObject = actionPreset.requiresSceneObject || actionPreset.contextConfig?.requiresSceneObject;
        if (requiredSceneObject) {
            const objects = sceneObjectsRepo.listForScene(scene.id);
            const obj = objects.find(o => o.itemId === requiredSceneObject);
            if (!obj || obj.state === 'broken' || obj.state === 'offline') {
                return { allowed: false, errorReason: `В сцене отсутствует или не работает объект "${requiredSceneObject}".` };
            }
            // Optional: check proximity to the node if the object is tied to a node_id
            const theChar = sceneCharacterRepo.list(scene.id).find(c => c.character.playerId === playerId || c.character.id === playerId);
            if (obj.nodeId && theChar?.slotId && obj.nodeId !== theChar.slotId) {
                return { allowed: false, errorReason: `Слишком далеко от объекта "${requiredSceneObject}". Сначала подойдите к нему.` };
            }
        }
    }

    // 3.5. Context-based requirements: some actions only allowed when the target
    // subject already has specific active contexts (e.g. 'release' requires 'suspend').
    // We check requireContexts defined on the preset's vector or top-level field.
    const requiredContexts: string[] | undefined = (actionPreset && ((actionPreset.vector && (actionPreset.vector as any).requireContexts) || (actionPreset as any).requireContexts)) || undefined;
    if (requiredContexts && requiredContexts.length > 0 && subjectId) {
        const active = activeContextsRepo.getAllForSubject(subjectId).map((c: any) => c.actionId);
        const missing = requiredContexts.filter(rc => !active.includes(rc));
        if (missing.length) {
            return { allowed: false, errorReason: `Действие требует, чтобы у субъекта были состояния: ${requiredContexts.join(', ')}.` };
        }
    }

    // 4. Resource Availability: проверим требования к ресурсам (включая AP) до списания
    const actionSceneCosts = scene.actionCosts?.[actionId];
    if (actionSceneCosts && player) {
        if (actionSceneCosts.require) {
            for (const [resKey, required] of Object.entries(actionSceneCosts.require)) {
                const available = player.resources?.[resKey]?.amount ?? 0;
                if (available < required) {
                    return { allowed: false, errorReason: `Недостаточно ресурса '${resKey}' (требуется: ${required}, в наличии: ${available}).` };
                }
            }
        }
        if (actionSceneCosts.consume) {
            for (const [resKey, cost] of Object.entries(actionSceneCosts.consume)) {
                const available = player.resources?.[resKey]?.amount ?? 0;
                if (available < cost) {
                    return { allowed: false, errorReason: `Недостаточно ресурса '${resKey}' для оплаты действия (стоимость: ${cost}, в наличии: ${available}).` };
                }
            }
        }
    }
    return { allowed: true };
}

// Legacy wrapper to keep existing checks working until fully refactored
export function checkActionAccess(actionId: string, scene: Scene, player: ResourceState): boolean {
    return validateAction(actionId, scene, player).allowed;
}
