import type { Scene, SceneCharacterPresence } from '../../domain/types';

/**
 * Этап 8. Единые DTO для сцены.
 *
 * Транспортный контракт между HTTP/WS и application-слоем для сцен,
 * контекстов и раскладок.
 */

/** Сцена в списке — сцена + присутствующие персонажи. */
export interface SceneListItem {
  id: string;
  title?: string;
  description?: string;
  availableActions: string[];
  actionCosts?: Scene['actionCosts'];
  transitions?: Scene['transitions'];
  slots?: string[];
  characters: SceneCharacterPresence[];
}

export function toSceneListItem(scene: Scene): SceneListItem {
  return {
    id: scene.id,
    title: scene.title,
    description: scene.description,
    availableActions: scene.availableActions,
    actionCosts: scene.actionCosts,
    transitions: scene.transitions,
    slots: scene.slots,
    characters: scene.characters || [],
  };
}

/** Ответ списка сцен. */
export interface ScenesResponse {
  success: boolean;
  scenes: SceneListItem[];
}

/** Ответ контекстов субъекта. */
export interface ContextsResponse {
  success: boolean;
  allPresets: unknown[];
  activeIds: unknown[];
}

/** Ответ переключения контекста. */
export interface ToggleContextResponse {
  success: boolean;
  narratives: string[];
}

/** Ответ раскладки сцены. */
export interface SceneLayoutResponse {
  success: boolean;
  layout: unknown;
}
