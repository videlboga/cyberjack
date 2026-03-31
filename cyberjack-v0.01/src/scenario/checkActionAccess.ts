import { Scene, PlayerState } from '../domain/types';

/**
 * Проверяет, доступно ли действие в текущей сцене.
 * Позже можно расширить проверкой инвентаря/ресурсов игрока.
 */
export function checkActionAccess(actionId: string, scene: Scene, player: PlayerState): boolean {
    return scene.availableActions.includes(actionId);
}
