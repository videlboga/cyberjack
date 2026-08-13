/**
 * Resolves a generic "undress" verbal command into the set of active clothing
 * contexts. Extracted from runGameTick so command resolution (applyCommandEffects)
 * does not depend on the tick orchestrator (Этап 8: no reverse dependency).
 */
export function resolveGenericUndressContexts(
    text: string,
    activeActionIds: string[],
    tagsForAction: (actionId: string) => string[],
): string[] | null {
    const generic = /(?:сними(?:те)?\s+(?:всю\s+)?одежду|раздень(?:ся|тесь)|сними(?:те)?\s+вс[её])/iu.test(text);
    if (!generic) return null;
    return [...new Set(activeActionIds.filter(actionId => tagsForAction(actionId).includes('clothing')))];
}
