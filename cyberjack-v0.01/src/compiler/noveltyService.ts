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

    // A couple of repetitions establish a rhythm rather than making an action
    // instantly stale. Habituation starts only after a sustained sequence and
    // then accelerates non-linearly. Older, interrupted repetitions have a
    // much softer effect and need to accumulate before they matter.
    const sustainedRepetitions = Math.max(0, streak - 2);
    const accumulatedRepetitions = Math.max(0, nonStreakMatches - 5);
    const streakFactor = 1 / (1 + 0.055 * Math.pow(sustainedRepetitions, 2));
    const historyFactor = 1 / (1 + 0.015 * Math.pow(accumulatedRepetitions, 1.7));
    const repetitionFactor = streakFactor * historyFactor;

    // Familiarity is long-term habituation. Keep its early values neutral and
    // let it become noticeable only once the zone has substantial experience.
    const learnedFamiliarity = Math.max(0, familiarity - 5);
    const familiarityFactor = 1 / (1 + 0.012 * Math.pow(learnedFamiliarity, 1.5));
    return Math.max(baseNovelty * 0.1, baseNovelty * repetitionFactor * familiarityFactor);
}
