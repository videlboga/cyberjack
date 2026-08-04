import { describe, expect, it } from 'vitest';
import {
    acquiredTraitLevel,
    acquiredTraitValue,
    conditioningSignal,
    clothingConditioningTags,
    contextConditioningTags,
    deriveAcquiredTraits,
    isLearnablePreferenceContext,
    parsePreferences,
    preferenceValenceModifier,
} from './conditioning';
import { contractConditionValue, evaluateAssetContract } from '../scenario/evaluateAssetContract';

const preferences = {
    actions: {},
    points: {},
    contexts: {},
    tags: { pain: 4.6, impact: 4.4, restraint: 3.7, exposure: -2 },
};

describe('persistent conditioning', () => {
    it('keeps old preference payloads backward compatible', () => {
        expect(parsePreferences('{"actions":{"slap":2}}')).toEqual({
            actions: { slap: 2 },
            points: {},
            contexts: {},
            tags: {},
        });
    });

    it('changes psychological valence without erasing physical action fields', () => {
        expect(preferenceValenceModifier(['pain'], preferences)).toBeCloseTo(0.644, 3);
        expect(preferenceValenceModifier(['exposure'], preferences)).toBeCloseTo(-0.28, 3);
    });

    it('derives named trait levels from generalized preferences', () => {
        expect(acquiredTraitValue(preferences, 'trait_masochist')).toBe(3);
        expect(acquiredTraitValue(preferences, 'trait_restraint_fetish')).toBe(2);
        expect(deriveAcquiredTraits(preferences).find(trait => trait.id === 'trait_exhibitionist')?.level).toBe(0);
    });

    it('learns accepted controlled pain at a visible pace', () => {
        const signal = conditioningSignal({
            pleasure: 4.7,
            discomfort: 2.4,
            overload: 0,
            finalValence: 0.29,
            attitudeShift: -0.22,
            learningEffect: 12,
            engagement: 25,
            corePlasticity: 99,
            relationAttitude: 81,
            relationPlasticity: 99,
        });
        expect(signal.modifiers.acceptedDiscomfort).toBeGreaterThan(0);
        expect(signal.generalizedDelta).toBeGreaterThan(0.025);
    });

    it('does not unlearn pain when discomfort is positively appraised', () => {
        const signal = conditioningSignal({
            pleasure: 1.56,
            discomfort: 3.86,
            overload: 2.02,
            finalValence: 0.105,
            attitudeShift: -0.029,
            learningEffect: 6.07,
            engagement: 18.94,
            corePlasticity: 61,
            relationAttitude: 65.45,
            relationPlasticity: 60,
        });
        expect(signal.reward).toBeGreaterThan(0);
        expect(signal.generalizedDelta).toBeGreaterThan(0);
    });

    it('does not let ordinary subspace load reverse accepted pain', () => {
        const signal = conditioningSignal({
            pleasure: 2.79,
            discomfort: 5.82,
            overload: 6.94,
            finalValence: 0.155,
            attitudeShift: 0.042,
            learningEffect: 5.15,
            engagement: 18.61,
            corePlasticity: 61.57,
            relationAttitude: 68.51,
            relationPlasticity: 60,
        });
        expect(signal.reward).toBeGreaterThan(0);
        expect(signal.generalizedDelta).toBeGreaterThan(0);
    });

    it('makes an established level-two trait mechanically obvious', () => {
        expect(preferenceValenceModifier(['pain'], { tags: { pain: 3.5 } }))
            .toBeCloseTo(0.49, 3);
        expect(acquiredTraitLevel(3.49)).toBe(2);
    });

    it('makes acute overload outweigh even a positively appraised experience', () => {
        const signal = conditioningSignal({
            pleasure: 12,
            discomfort: 10,
            overload: 70,
            finalValence: 0.7,
            learningEffect: 20,
            engagement: 30,
            corePlasticity: 80,
            relationAttitude: 70,
            relationPlasticity: 70,
        });
        expect(signal.reward).toBeLessThan(0);
        expect(signal.generalizedDelta).toBeLessThan(0);
    });

    it('keeps overwhelming pain strongly aversive', () => {
        const signal = conditioningSignal({
            pleasure: 0,
            discomfort: 49.5,
            overload: 26,
            finalValence: -0.57,
            learningEffect: 16,
            engagement: 2,
            corePlasticity: 99,
            relationAttitude: 81,
            relationPlasticity: 99,
        });
        expect(signal.modifiers.acceptedDiscomfort).toBe(0);
        expect(signal.reward).toBeLessThan(-20);
        expect(signal.generalizedDelta).toBeLessThan(0);
    });

    it('lets resignation first weaken and then reverse unavoidable negative learning', () => {
        const experience = {
            pleasure: 1,
            discomfort: 9,
            overload: 0,
            finalValence: -.6,
            learningEffect: 30,
            engagement: 45,
            corePlasticity: 80,
            lackOfControl: 1,
        };
        const resisting = conditioningSignal({ ...experience, learnedCompliance: 0 });
        const resigning = conditioningSignal({ ...experience, learnedCompliance: 50 });
        const assimilated = conditioningSignal({ ...experience, learnedCompliance: 90 });
        expect(resisting.generalizedDelta).toBeLessThan(0);
        expect(resigning.generalizedDelta).toBeLessThan(0);
        expect(resigning.generalizedDelta).toBeGreaterThan(resisting.generalizedDelta);
        expect(assimilated.modifiers.forcedAcceptance).toBeGreaterThan(0);
        expect(assimilated.generalizedDelta).toBeGreaterThan(0);
    });

    it('treats a nervous breakdown as aversive even after assimilation', () => {
        const signal = conditioningSignal({
            pleasure: 12, discomfort: 20, overload: 35, finalValence: .45,
            learningEffect: 30, engagement: 50, corePlasticity: 90,
            learnedCompliance: 100, lackOfControl: 1, breakdown: true,
        });
        expect(signal.modifiers.criticalConsequence).toBeGreaterThan(0);
        expect(signal.reward).toBeLessThan(0);
        expect(signal.generalizedDelta).toBeLessThan(0);
    });

    it('keeps pathological states outside preference buckets', () => {
        expect(isLearnablePreferenceContext('effect_panic')).toBe(false);
        expect(isLearnablePreferenceContext('effect_sensory_overload')).toBe(false);
        expect(isLearnablePreferenceContext('effect_freeze')).toBe(false);
        expect(isLearnablePreferenceContext('act_suspend_wrists')).toBe(true);
    });

    it('does not positively reframe a negative experience that remains controllable', () => {
        const signal = conditioningSignal({
            pleasure: 0, discomfort: 8, overload: 0, finalValence: -.7,
            learningEffect: 30, engagement: 40, corePlasticity: 90,
            learnedCompliance: 100, lackOfControl: 0,
        });
        expect(signal.modifiers.forcedAcceptance).toBe(0);
        expect(signal.generalizedDelta).toBeLessThan(0);
    });

    it('uses trust and relational receptivity as conditioning modifiers', () => {
        const experience = {
            pleasure: 3,
            discomfort: 4,
            overload: 0,
            finalValence: 0.25,
            learningEffect: 25,
            engagement: 40,
            corePlasticity: 70,
        };
        const neutral = conditioningSignal(experience);
        const bonded = conditioningSignal({
            ...experience,
            relationAttitude: 85,
            relationPlasticity: 85,
        });
        expect(bonded.reward).toBeGreaterThan(neutral.reward);
        expect(bonded.generalizedDelta).toBeGreaterThan(neutral.generalizedDelta);
    });

    it('carries embodied context tags into combined conditioning', () => {
        expect(contextConditioningTags([
            { id: 'act_suspend_wrists', type: 'equipment', tags: ['restraint', 'pain', 'vulnerable', 'suspension'] },
        ], ['stimulation', 'sexual'])).toEqual([
            { tag: 'restraint', sourceId: 'act_suspend_wrists', weight: 0.55 },
            { tag: 'pain', sourceId: 'act_suspend_wrists', weight: 0.55 },
            { tag: 'vulnerable', sourceId: 'act_suspend_wrists', weight: 0.4 },
        ]);
    });

    it('does not count a semantic tag twice when it is direct and contextual', () => {
        expect(contextConditioningTags([
            { id: 'act_suspend_wrists', type: 'equipment', tags: ['restraint', 'pain'] },
        ], ['pain'])).toEqual([
            { tag: 'restraint', sourceId: 'act_suspend_wrists', weight: 0.55 },
        ]);
    });

    it('uses clothing as an associative context rather than a direct reward', () => {
        expect(clothingConditioningTags({
            contextIds: ['eq_clothe_stockings'], directTags: ['tickling'], pointId: 'feet', contact: .3,
        })).toEqual(expect.arrayContaining([
            { tag: 'sexual', sourceId: 'eq_clothe_stockings', weight: .3 },
            { tag: 'feet', sourceId: 'eq_clothe_stockings', weight: .7 },
            { tag: 'tickling', sourceId: 'eq_clothe_stockings', weight: .9 },
        ]));
        expect(clothingConditioningTags({
            contextIds: ['eq_clothe_underwear'], directTags: ['sexual'], pointId: 'vulva', contact: .8,
        })).toEqual([]);
    });

    it('makes nudity, gowns, dresses and jumpsuits condition distinct meanings', () => {
        expect(clothingConditioningTags({ contextIds: [], directTags: ['sexual'], pointId: 'vulva', contact: .8 }))
            .toContainEqual({ tag: 'exposure', sourceId: 'nude', weight: .85 });
        expect(clothingConditioningTags({ contextIds: ['eq_clothe_lab_gown'], directTags: ['pain'], pointId: 'arms', contact: .2 }))
            .toContainEqual({ tag: 'medical', sourceId: 'eq_clothe_lab_gown', weight: .65 });
        expect(clothingConditioningTags({ contextIds: ['eq_clothe_jumpsuit'], directTags: ['pain'], pointId: 'arms', contact: .2 }))
            .toContainEqual({ tag: 'deprivation', sourceId: 'eq_clothe_jumpsuit', weight: .6 });
        expect(clothingConditioningTags({ contextIds: ['eq_clothe_dress'], directTags: ['pain'], pointId: 'chest', contact: .5 }))
            .toContainEqual({ tag: 'sexual', sourceId: 'eq_clothe_dress', weight: .3 });
    });

    it('makes stockings focus learning on legs and especially foot tickling', () => {
        const neutral = clothingConditioningTags({
            contextIds: ['eq_clothe_stockings'], directTags: ['pain'], pointId: 'arms', contact: .4,
        });
        expect(neutral).toEqual([{ tag: 'sexual', sourceId: 'eq_clothe_stockings', weight: .3 }]);

        const legTickling = clothingConditioningTags({
            contextIds: ['eq_clothe_stockings'], directTags: ['tickling'], pointId: 'knees', contact: .4,
        });
        const footTickling = clothingConditioningTags({
            contextIds: ['eq_clothe_stockings'], directTags: ['tickling'], pointId: 'feet', contact: .4,
        });
        expect(legTickling).toContainEqual({ tag: 'tickling', sourceId: 'eq_clothe_stockings', weight: .55 });
        expect(footTickling).toContainEqual({ tag: 'tickling', sourceId: 'eq_clothe_stockings', weight: .9 });
    });

    it('derives the new embodied traits from meaningful learned tags', () => {
        const traits = deriveAcquiredTraits({ tags: { tickling: 3.5, electronic: 3.5, sexual: 3.5 } });
        expect(traits.find(trait => trait.id === 'trait_knismolagnia')?.level).toBe(2);
        expect(traits.find(trait => trait.id === 'trait_electrophile')?.level).toBe(2);
        expect(traits.find(trait => trait.id === 'trait_sexual_dependency')?.level).toBe(2);
    });

    it('uses only the strongest active source for a shared context tag', () => {
        expect(contextConditioningTags([
            { id: 'pose_spread_eagle', type: 'pose', tags: ['vulnerable'] },
            { id: 'act_suspend_wrists', type: 'equipment', tags: ['vulnerable'] },
        ])).toHaveLength(1);
    });

    it('evaluates preference and acquired-trait contract conditions', () => {
        const core: any = {
            sensitivity: 50, capacity: 50, openness: 50, plasticity: 50,
            attitude: 50, tension: 0, preferences: JSON.stringify(preferences),
        };
        expect(contractConditionValue(
            { type: 'preference', key: 'pain', operator: '>=', value: 4 },
            core,
            {},
        )).toBe(4.6);
        expect(evaluateAssetContract({
            id: 'test',
            issuerId: 'test',
            title: 'test',
            description: '',
            state: 'accepted',
            conditions: [
                { type: 'acquired_trait', key: 'trait_masochist', operator: '>=', value: 2 },
            ],
            rewards: {},
        }, core, {}).metRequirements).toBe(true);
    });
});
