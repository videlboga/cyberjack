import { describe, expect, it } from 'vitest';
import { acquiredTraitValue } from '../domain/conditioning';
import { applyCharacterStartingTraits } from './characterStartingTraits';

const profile = (subjectId: string) => ({
    version: 2 as const,
    generatorRevision: 1,
    subjectId,
    seed: subjectId,
    identity: { name: subjectId, age: 20, gender: 'female' as const, anatomy: 'human', archetype: 'person' as const },
    biography: { origin: [], formativeEvents: [] },
    behavioralCore: { values: [], needs: [], vulnerabilities: [], defenses: [], voice: [], mannerisms: [], centralConflict: { desire: '', fear: '' } },
    knowledgeRefs: [],
    mechanicalSeed: { coreModifiers: {}, initialContexts: [], preferences: { actions: {}, points: {}, contexts: {}, tags: {} } },
    sourceTags: [], personaText: '', personaWithoutTraits: '', traitBlock: '', identityText: '', historyText: '', activationText: '', updatedAt: '',
});

describe('character starting traits', () => {
    it('gives Mai level-two masochism through the normal conditioning model', () => {
        const result = applyCharacterStartingTraits(profile('NPC-CAND-GEN-04'));
        expect(acquiredTraitValue(result.mechanicalSeed.preferences, 'trait_masochist')).toBe(2);
    });

    it('keeps starting tendencies evolvable semantic preferences', () => {
        const result = applyCharacterStartingTraits(profile('NPC-CAND-GEN-03'));
        expect(result.mechanicalSeed.preferences.tags).toMatchObject({ electronic: 2, machine: 2 });
    });
});
