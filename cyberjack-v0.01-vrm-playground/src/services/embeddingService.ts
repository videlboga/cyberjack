import crypto from 'crypto';

let cachedKey: Buffer | null = null;

// LRU-ish cache keyed by `${text}\u0000${dimensions}`. The embedding is fully
// deterministic (HMAC over text), so identical requests can reuse the cached
// vector. This satisfies Этап 6: "одинаковый запрос эмбеддинга использует кеш".
const embeddingCache = new Map<string, number[]>();
const EMBEDDING_CACHE_MAX = 4000;

// Cache hit/miss counters (Этап 10: «cache hit/miss для эмбеддингов»).
let cacheHits = 0;
let cacheMisses = 0;

function cacheEmbedding(key: string, vector: number[]): number[] {
    embeddingCache.set(key, vector);
    if (embeddingCache.size > EMBEDDING_CACHE_MAX) {
        const oldest = embeddingCache.keys().next().value;
        if (oldest !== undefined) embeddingCache.delete(oldest);
    }
    return vector;
}

function getKey(): Buffer {
    if (cachedKey) return cachedKey;
    const envKey = process.env.EMBEDDING_SECRET;
    if (envKey) {
        cachedKey = crypto.createHash('sha256').update(envKey).digest();
    } else {
        cachedKey = crypto.createHash('sha256').update(Buffer.alloc(32, 7)).digest();
    }
    return cachedKey;
}

export function buildEmbedding(text: string, dimensions = 64): number[] {
    if (!text) return new Array(dimensions).fill(0);
    const cacheKey = `${text}\u0000${dimensions}`;
    const cached = embeddingCache.get(cacheKey);
    if (cached) {
        cacheHits++;
        return cached;
    }
    cacheMisses++;
    const key = getKey();
    const vector = new Array(dimensions).fill(0);
    for (let i = 0; i < text.length; i++) {
        const hash = crypto.createHmac('sha256', key).update(`${i}:${text[i]}`).digest();
        for (let j = 0; j < dimensions; j++) {
            vector[j] += hash[j % hash.length] / 255;
        }
    }
    const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    const normalized = (!length || !Number.isFinite(length))
        ? vector
        : vector.map(value => value / length);
    return cacheEmbedding(cacheKey, normalized);
}

/** Snapshot of cache hit/miss counters (Этап 10: observability). */
export function embeddingCacheStats() {
    return { hits: cacheHits, misses: cacheMisses, size: embeddingCache.size };
}

/** Test seam: clears the embedding cache between tests. */
export function clearEmbeddingCache() {
    embeddingCache.clear();
    cacheHits = 0;
    cacheMisses = 0;
}
