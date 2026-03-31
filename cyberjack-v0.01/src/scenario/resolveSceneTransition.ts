import { Scene, SubjectCoreState } from '../domain/types';

/**
 * Проверяет, соблюдаются ли условия для перехода к следующей сцене.
 * Пока это заглушка, возвращающая текущую сцену, если условия перехода не заданы.
 */
export function resolveSceneTransition(
    currentScene: Scene, 
    core: SubjectCoreState, 
    transitions: Array<{ targetSceneId: string; condition: (c: SubjectCoreState) => boolean }>
): string | null {
    for (const transition of transitions) {
        if (transition.condition(core)) {
            return transition.targetSceneId;
        }
    }
    return null; // Нет перехода
}
