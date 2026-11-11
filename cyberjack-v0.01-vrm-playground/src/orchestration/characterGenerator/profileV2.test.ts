import { describe, expect, it } from 'vitest';
import { compileGeneratedProfile, PROFILE_GENERATOR_REVISION } from './profileV2';

describe('generated behavioral core', () => {
    it('does not reuse one hook as a value, vulnerability and defense', () => {
        const shared = 'Всегда сохраняет терпение';
        const context = {
            archetype: 'person',
            tags: [],
            grouped: {
                world: [], faction: [], origin: [], event: [], persona: [], physical: [],
                psychological: [{ id: 'psy_custom', personaHooks: [shared, 'Боится потерять важное'], summary: '', level: 'psychological', title: '', stKeywords: [], loreRefs: [] }],
                state: [],
                response: [{ id: 'response_custom', personaHooks: [shared, 'Отвечает сухой шуткой'], summary: '', level: 'response', title: '', stKeywords: [], loreRefs: [] }],
                bias: [],
                body: [],
                trait: [{ id: 'trait_custom', personaHooks: [shared], summary: '', level: 'trait', title: '', stKeywords: [], loreRefs: [] }]
            },
            loreNotes: [], loreRefs: [], loreEntries: [], personaNotes: [], seed: 'test',
            baseProfile: { name: 'Тест', age: '30', gender: 'female', anatomy: 'human' }
        } as any;
        const sections = {
            personaText: '', personaWithoutTraits: '', traitBlock: '', loreBlock: '',
            systemPrompt: '', identityText: '', historyText: '', activationText: ''
        };

        const profile = compileGeneratedProfile('test', context, sections);
        const allRoles = [
            ...profile.behavioralCore.values,
            ...profile.behavioralCore.vulnerabilities,
            ...profile.behavioralCore.defenses
        ];

        expect(PROFILE_GENERATOR_REVISION).toBe(10);
        expect(allRoles.filter(value => value === shared)).toHaveLength(1);
        expect(profile.behavioralCore.defenses).toContain('Отвечает сухой шуткой');
        expect(profile.storySeed).toMatchObject({
            activationTriggers:expect.arrayContaining(['recruitment','biography_chat']),
        });
        expect(profile.storySeed?.possibleDirections).toHaveLength(3);
    });
});
