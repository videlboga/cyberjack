import { describe, expect, it } from 'vitest';
import { buildEmbedding, clearEmbeddingCache, embeddingCacheStats } from './embeddingService';

describe('embeddingService', () => {
    it('is deterministic: identical text yields an identical vector', () => {
        const a = buildEmbedding('тестовая фраза');
        const b = buildEmbedding('тестовая фраза');
        expect(a).toEqual(b);
    });

    it('is normalized to unit length', () => {
        const v = buildEmbedding('что-то длинное и важное', 128);
        const length = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
        expect(length).toBeCloseTo(1, 2);
    });

    it('returns the cached vector for an identical request (Этап 6)', () => {
        clearEmbeddingCache();
        const first = buildEmbedding('кэшируемый текст', 64);
        // Same reference on the second identical request proves the cache hit.
        const second = buildEmbedding('кэшируемый текст', 64);
        expect(second).toBe(first);
    });

    it('distinguishes different dimensions', () => {
        clearEmbeddingCache();
        const v64 = buildEmbedding('текст', 64);
        const v128 = buildEmbedding('текст', 128);
        expect(v64).not.toBe(v128);
        expect(v64).toHaveLength(64);
        expect(v128).toHaveLength(128);
    });

    it('tracks cache hit/miss counters (Этап 10)', () => {
        clearEmbeddingCache();
        buildEmbedding('первый');   // miss
        buildEmbedding('первый');   // hit
        buildEmbedding('второй');   // miss
        const stats = embeddingCacheStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(2);
        expect(stats.size).toBe(2);
    });
});
