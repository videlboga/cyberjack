import { describe, expect, it } from 'vitest';
import { TAG_LIBRARY } from '../src/orchestration/characterGenerator/tagDefinitions';
import { generateCharacterContext } from '../src/orchestration/characterGenerator/generator';
import { ensureGeneratedProfile, regenerateGeneratedProfile } from '../src/orchestration/characterGenerator/profileManager';
import { db } from '../src/infrastructure/db';

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

    it('loads mechanical metadata, archetype restrictions and all declared levels', () => {
        expect(TAG_LIBRARY.physical.some(tag => Object.keys(tag.coreModifiers || {}).length > 0)).toBe(true);
        expect(TAG_LIBRARY.event.some(tag => (tag.archetypes || []).length > 0)).toBe(true);
        for (const level of ['state', 'response', 'bias', 'body'] as const) {
            expect(TAG_LIBRARY[level].length).toBeGreaterThan(0);
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

    it('keeps mutually dependent slots coherent across a large seed sample', () => {
        const allowedPhysiology: Record<string, string[]> = {
            role_clerk: ['phys_fragile', 'phys_modified'],
            role_pampered: ['phys_fragile'],
            role_researcher: ['phys_fragile', 'phys_modified'],
            role_worker: ['phys_hardened', 'phys_modified'],
            role_thug: ['phys_hardened', 'phys_modified'],
            role_cultist: ['phys_hardened', 'phys_modified']
        };

        for (let index = 0; index < 500; index++) {
            const ctx = generateCharacterContext({ seed: `audit-${index}` });
            const ids = ctx.tags.map(tag => tag.id);
            const roles = ids.filter(id => id.startsWith('role_'));
            const regions = ids.filter(id => /^origin_(inner|mid|outer)_ring$|^origin_perimeter$/.test(id));
            const places = ids.filter(id => id.startsWith('origin_place_'));
            const factions = ids.filter(id => /^faction_(helix|veil|continuum|lattice)/.test(id));
            const families = new Set(factions.map(id => id.match(/^faction_([^_]+)/)?.[1]));
            const physiology = ids.find(id => id.startsWith('phys_'));

            expect(roles).toHaveLength(1);
            expect(regions).toHaveLength(1);
            expect(places).toHaveLength(1);
            expect(families.size).toBe(1);
            expect(allowedPhysiology[roles[0]]).toContain(physiology);
            expect(ids.includes('psy_submissive') && ids.includes('trait_profile_stubborn')).toBe(false);
            expect(ids.includes('psy_defiant') && ids.includes('trait_profile_adaptive')).toBe(false);
        }
    });

    it('stores profile v2 in canonical character JSON and preserves identity', () => {
        const subjectId = 'profile-v2-test';
        const canonical = {
            base: { name: 'Тестовая Мира', age: 29, gender: 'female', anatomy: 'none', status: 'asset' },
            personality: {
                traits: ['наблюдательная'],
                quirks: ['сверяется с показаниями'],
                speechStyle: 'Говорит коротко и профессионально.',
                coreBelief: 'Сначала нужно измерить последствия.'
            }
        };
        db.prepare("INSERT INTO characters (id, name, kind, subject_id, profile_json) VALUES (?, ?, 'subject', ?, ?)")
            .run(subjectId, canonical.base.name, subjectId, JSON.stringify(canonical));

        const first = ensureGeneratedProfile(subjectId);
        const second = regenerateGeneratedProfile(subjectId, { seed: 'replacement-seed' });
        const stored = JSON.parse((db.prepare('SELECT profile_json FROM characters WHERE id = ?').get(subjectId) as any).profile_json);

        expect(first.version).toBe(2);
        expect(first.identity).toMatchObject({ name: canonical.base.name, age: 29, gender: 'female' });
        expect(second.seed).toBe('replacement-seed');
        expect(stored.base).toEqual(canonical.base);
        expect(stored.personality).toEqual(canonical.personality);
        expect(stored.generatedProfile.sourceTags).toEqual(second.sourceTags);
        expect(stored.generatedProfile.behavioralCore.centralConflict.desire).toBeTruthy();
        expect(stored.generatedProfile.behavioralCore.values[0]).toBe(canonical.personality.coreBelief);
        expect(stored.generatedProfile.behavioralCore.voice[0]).toBe(canonical.personality.speechStyle);
        expect(stored.generatedProfile.behavioralCore.mannerisms[0]).toBe(canonical.personality.quirks[0]);
        db.prepare('DELETE FROM characters WHERE id = ?').run(subjectId);
    });
});
