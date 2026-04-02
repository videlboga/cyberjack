import { describe, expect, it } from 'vitest';
import { TAG_LIBRARY } from '../src/orchestration/characterGenerator/tagDefinitions';
import { generateCharacterContext } from '../src/orchestration/characterGenerator/generator';

describe('Lore tag library', () => {
    it('contains unique tags per level', () => {
        for (const [level, tags] of Object.entries(TAG_LIBRARY)) {
            if (!tags.length) {
                continue;
            }
            const ids = new Set(tags.map(tag => tag.id));
            expect(ids.size).toBe(tags.length);
        }
    });
});

describe('Character generator', () => {
    it('produces deterministic output for the same seed', () => {
        const first = generateCharacterContext({ seed: 'S-01' });
        const second = generateCharacterContext({ seed: 'S-01' });
        expect(first.tags.map(tag => tag.id)).toEqual(second.tags.map(tag => tag.id));
        expect(first.loreNotes).toEqual(second.loreNotes);
    });

    it('respects dependency failures for forced tags', () => {
        const tagWithRequires = Object.values(TAG_LIBRARY)
            .flat()
            .find(tag => (tag.requires || []).length > 0);

        if (!tagWithRequires) {
            return;
        }

        expect(() =>
            generateCharacterContext({ includeTags: tagWithRequires.requires })
        ).toThrow(/Requirements/);
    });

    it('avoids picking tags whose dependencies are excluded', () => {
        const ctx = generateCharacterContext({
            seed: 'dependency-test',
            excludeTags: ['world_anomaly_ocean']
        });
        const hasAnomalyDependent = ctx.tags.some(tag =>
            (tag.requires || []).includes('world_anomaly_ocean')
        );
        expect(hasAnomalyDependent).toBe(false);
    });

    it('generates narrative fragments from tags', () => {
        const customIds = Object.values(TAG_LIBRARY)
            .flat()
            .slice(0, 4)
            .map(tag => tag.id);

        if (!customIds.length) {
            return;
        }

        const ctx = generateCharacterContext({
            seed: 'story-test',
            includeTags: customIds
        });
        expect(ctx.narrative?.identityParagraphs.length ?? 0).toBeGreaterThan(0);
    });
});
