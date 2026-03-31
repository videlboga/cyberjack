import { PlayerState } from '../domain/types';

/**
 * Применяет стоимость действия (или сценария) к ресурсам игрока.
 * Возвращает новый объект PlayerState или выбрасывает ошибку, если ресурсов недостаточно.
 */
export function applyResourceCosts(player: PlayerState, costs: Record<string, number>): PlayerState {
    const updatedResources = { ...player.resources };
    
    for (const [res, cost] of Object.entries(costs)) {
        const current = updatedResources[res] || 0;
        if (current < cost) {
            throw new Error(`Insufficient resources: ${res}. Required: ${cost}, available: ${current}.`);
        }
        updatedResources[res] = current - cost;
    }
    
    return {
        ...player,
        resources: updatedResources
    };
}
