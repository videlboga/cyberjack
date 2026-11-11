import { Scene, SubjectCoreState, SceneTransitionRule } from '../domain/types';

export interface TransitionContext {
    actionId: string;
}

function matchesConditions(rule: SceneTransitionRule, core: SubjectCoreState, ctx: TransitionContext): boolean {
    const conditions = rule.conditions;
    if (!conditions) return true;

    if (conditions.requiresActionId && conditions.requiresActionId !== ctx.actionId) {
        return false;
    }
    if (conditions.minAttitude !== undefined && core.attitude < conditions.minAttitude) {
        return false;
    }
    if (conditions.maxAttitude !== undefined && core.attitude > conditions.maxAttitude) {
        return false;
    }
    return true;
}

/**
 * Проверяет, можно ли перейти на другую сцену согласно правилам.
 */
export function resolveSceneTransition(
    currentScene: Scene,
    core: SubjectCoreState,
    ctx: TransitionContext
): string | null {
    const transitions = currentScene.transitions || [];
    for (const rule of transitions) {
        if (matchesConditions(rule, core, ctx)) {
            return rule.targetSceneId;
        }
    }
    return null;
}
