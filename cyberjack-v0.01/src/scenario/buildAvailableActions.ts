import { Scene, PlayerState } from '../domain/types';

/**
 * Объединяет все доступные действия (из текущей сцены, инвентаря игрока и глобального состояния).
 * Вернет массив action ID.
 */
export function buildAvailableActions(scene: Scene, player: PlayerState, globalActions: string[] = []): string[] {
    const list = new Set([
        ...scene.availableActions,
        ...globalActions
    ]);
    
    // Тут можно фильтровать по ресурсам игрока
    // ...
    
    return Array.from(list);
}
