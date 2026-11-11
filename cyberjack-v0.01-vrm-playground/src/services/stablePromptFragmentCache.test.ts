import { describe, expect, it } from 'vitest';
import { getStablePromptFragment, clearStablePromptFragmentCache, stablePromptFragmentStats } from './stablePromptFragmentCache';

describe('stable prompt fragment cache (Этап 10)', () => {
    it('reuses a fragment for the same key', () => {
        clearStablePromptFragmentCache();
        let builds = 0;
        const first = getStablePromptFragment('k1', () => { builds++; return 'value'; });
        const second = getStablePromptFragment('k1', () => { builds++; return 'value'; });
        expect(first).toBe('value');
        expect(second).toBe('value');
        expect(builds).toBe(1);
    });

    it('separates fragments by key', () => {
        clearStablePromptFragmentCache();
        const a = getStablePromptFragment('x', () => 'A');
        const b = getStablePromptFragment('y', () => 'B');
        expect(a).toBe('A');
        expect(b).toBe('B');
    });

    it('tracks hit/miss counters', () => {
        clearStablePromptFragmentCache();
        getStablePromptFragment('m', () => 'M');
        getStablePromptFragment('m', () => 'M');
        const stats = stablePromptFragmentStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
        expect(stats.size).toBe(1);
    });

    it('does not cache an empty key', () => {
        clearStablePromptFragmentCache();
        let builds = 0;
        getStablePromptFragment('', () => { builds++; return 'v'; });
        getStablePromptFragment('', () => { builds++; return 'v'; });
        expect(builds).toBe(2);
    });
});
