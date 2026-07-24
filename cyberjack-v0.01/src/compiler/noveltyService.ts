// src/compiler/noveltyService.ts
import { CompiledAction } from '../domain/types';

/**
 * Calculates current novelty based on action history.
 */
export function computeNovelty(actionData: Partial<CompiledAction>, history: any[], familiarity: number = 0): number {
    const baseNovelty = actionData.novelty ?? 0.5;
    const actionKey = actionData.actionKey || actionData.source?.presetId;
    if (!actionKey) return baseNovelty;

    const historyKeys = history
        .map(entry => entry?.actionPayload?.presetId || entry?.actionPayload?.action?.actionKey || entry?.presetId || entry?.actionKey)
        .filter(Boolean);
    let streak = 0;
    for (const key of historyKeys) {
        if (key !== actionKey) break;
        streak += 1;
    }
    const recentMatches = historyKeys.filter(key => key === actionKey).length;
    const nonStreakMatches = Math.max(0, recentMatches - streak);
    const repetitionFactor = Math.pow(0.65, streak) * Math.pow(0.9, nonStreakMatches);
    const familiarityFactor = 1 / (1 + Math.max(0, familiarity) * 0.08);
    return Math.max(baseNovelty * 0.1, baseNovelty * repetitionFactor * familiarityFactor);
}
