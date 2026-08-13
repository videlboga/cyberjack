/**
 * Этап 10. Кеш стабильных prompt-фрагментов.
 *
 * Некоторые фрагменты системного промпта персонажа (характер, манера речи,
 * форма ответа) не меняются между ходами. Кешируем отрендеренные строки по
 * ключу — повторная сборка стабильной части не пересобирает их заново.
 *
 * Ключ включает идентичность персонажа, поэтому разные активы не пересекаются.
 */

const promptFragmentCache = new Map<string, string>();
const PROMPT_FRAGMENT_CACHE_MAX = 2000;

// Cache hit/miss counters (Этап 10: «cache hit/miss для стабильных prompt-фрагментов»).
let cacheHits = 0;
let cacheMisses = 0;

function cacheFragment(key: string, value: string): string {
    promptFragmentCache.set(key, value);
    if (promptFragmentCache.size > PROMPT_FRAGMENT_CACHE_MAX) {
        const oldest = promptFragmentCache.keys().next().value;
        if (oldest !== undefined) promptFragmentCache.delete(oldest);
    }
    return value;
}

/**
 * Возвращает стабильный фрагмент из кеша или строит его через `build`.
 * Фрагмент считается стабильным, если `stableKey` одинаков — то есть
 * фрагмент не зависит от текущего тика/наблюдения.
 */
export function getStablePromptFragment(
    stableKey: string,
    build: () => string,
): string {
    if (stableKey === '') return build();
    const cached = promptFragmentCache.get(stableKey);
    if (cached !== undefined) {
        cacheHits++;
        return cached;
    }
    cacheMisses++;
    const value = build();
    return cacheFragment(stableKey, value);
}

/** Снапшот hit/miss (Этап 10: observability). */
export function stablePromptFragmentStats() {
    return { hits: cacheHits, misses: cacheMisses, size: promptFragmentCache.size };
}

/** Test seam: очищает кеш между тестами. */
export function clearStablePromptFragmentCache() {
    promptFragmentCache.clear();
    cacheHits = 0;
    cacheMisses = 0;
}
