import { ResourceState, ActionCostDefinition } from '../domain/types';

/**
 * Применяет стоимость действия (или сценария) к ресурсам игрока.
 * Возвращает новый объект ResourceState или выбрасывает ошибку, если ресурсов недостаточно.
 */
export function applyResourceCosts(player: ResourceState, costs: ActionCostDefinition): ResourceState {
    const updatedResources = { ...player.resources };
    
    // Проверка require (просто наличие, без списания)
    if (costs.require) {
        for (const [res, req] of Object.entries(costs.require)) {
            const current = updatedResources[res]?.amount || 0;
            if (current < req) {
                throw new Error(`Insufficient resources: ${res}. Required: ${req}, available: ${current}.`);
            }
        }
    }

    // Списание consume
    if (costs.consume) {
        for (const [res, cost] of Object.entries(costs.consume)) {
            if (!updatedResources[res]) {
                updatedResources[res] = { characterId: player.id, resourceKey: res, amount: 0 };
            }
            const current = updatedResources[res].amount;
            if (current < cost) {
                throw new Error(`Insufficient resources: ${res}. Consume: ${cost}, available: ${current}.`);
            }
            updatedResources[res] = { ...updatedResources[res], amount: current - cost };
        }
    }
    
    return {
        ...player,
        resources: updatedResources
    };
}
