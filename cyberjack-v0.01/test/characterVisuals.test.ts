import { describe, expect, it } from 'vitest';
import {
    activeVisualInteractionFromContexts,
    buildCalibrationVisualDescriptorV4,
    equipmentPresetFromContexts,
    expandedInteractionAssetPath,
    INTERACTION_VISUAL_RULES,
    resolveCalibrationAvatarV4,
    resolveFirstAvailableVisual,
    visualAssetExists,
} from '../src/domain/characterVisuals';

describe('continuous interaction visuals', () => {
    it('indexes current assets but excludes the archived rmbg matrix', () => {
        expect(visualAssetExists('/character-images/calibration-core/nika/sitting/underwear__blindfold__neutral.png')).toBe(true);
        expect(visualAssetExists('/character-images/rendered/nika/sitting__underwear__none__neutral.png')).toBe(true);
        expect(visualAssetExists('/character-images/rendered/mira/rmbg_v1/standing__underwear__blindfold__neutral.png')).toBe(false);
    });

    it('resolves fallback before assigning an image URL', () => {
        expect(resolveFirstAvailableVisual([
            '/character-images/calibration-v4/nika/missing.png',
            '/character-images/rendered/nika/sitting__underwear__none__neutral.png',
        ])).toBe('/character-images/rendered/nika/sitting__underwear__none__neutral.png');
    });

    it('normalizes persistent equipment contexts into a named preset', () => {
        expect(equipmentPresetFromContexts([
            { actionId: 'act_apply_handcuffs' },
            { actionId: 'eq_blindfold_apply' },
        ])).toBe('wrist_cuffs_blindfold');
        expect(equipmentPresetFromContexts([
            { actionId: 'eq_blindfold_apply' },
            { actionId: 'eq_gag_apply' },
        ])).toBe('blindfold_gag');
        expect(equipmentPresetFromContexts([{ actionId: 'act_suspend_wrists' }])).toBe('suspension');
    });

    it('uses calibration-core for supported calibration equipment', () => {
        const descriptor = buildCalibrationVisualDescriptorV4('NPC-CAND-01', {
            tension: 20,
            attitude: 70,
            openness: 60,
            contexts: [
                { actionId: 'pose_sitting' },
                { actionId: 'eq_clothe_underwear' },
                { actionId: 'eq_blindfold_apply' },
            ],
        });
        expect(descriptor).toMatchObject({
            characterSlug: 'nika',
            mode: 'calibration',
            pose: 'sitting',
            clothing: 'underwear',
            equipmentPreset: 'blindfold',
            affect: 'receptive',
            representedEquipment: ['eq_blindfold_apply'],
            unrepresentedEquipment: [],
        });
        expect(resolveCalibrationAvatarV4(descriptor)).toBe(
            '/character-images/calibration-core/nika/sitting/underwear__blindfold__receptive.png',
        );
    });

    it('registers only mechanics with a persistent start context', () => {
        expect(INTERACTION_VISUAL_RULES.map(rule => rule.startActionId)).toEqual([
            'finger_insertion',
            'act_start_electrostimulation',
            'act_activate_plug',
            'act_start_vibrator',
            'act_start_penetration',
            'act_hold_exposure',
            'act_present_feet',
        ]);
        expect(INTERACTION_VISUAL_RULES.some(rule => rule.startActionId === 'act_examine')).toBe(false);
        expect(INTERACTION_VISUAL_RULES.some(rule => rule.startActionId === 'tickle')).toBe(false);
    });

    it('selects the exposure variant from the held pose', () => {
        const interaction = activeVisualInteractionFromContexts([
            { actionId: 'pose_sitting' },
            { actionId: 'act_hold_exposure', ticksActive: 3 },
        ], 72)!;
        expect(interaction).toMatchObject({ family: 'exposure', variant: 'sitting_spread', phase: 'sustain' });
        expect(expandedInteractionAssetPath({
            characterSlug: 'nika',
            interaction,
            contexts: [
                { actionId: 'pose_sitting' },
                { actionId: 'act_hold_exposure' },
                { actionId: 'eq_clothe_lab_gown' },
            ],
            attitude: 60,
        })).toBe('/character-images/interactions-expanded/nika/exposure/sitting_spread/underwear__free__receptive__sustain.png');
    });

    it('selects bare or stocking foot presentation from clothing', () => {
        expect(activeVisualInteractionFromContexts([
            { actionId: 'act_present_feet' },
        ], 40)).toMatchObject({ family: 'foot', variant: 'bare_presented', phase: 'sustain' });
        const interaction = activeVisualInteractionFromContexts([
            { actionId: 'eq_clothe_stockings' },
            { actionId: 'act_present_feet' },
        ], 90)!;
        expect(interaction).toMatchObject({ variant: 'pantyhose_presented', phase: 'sustain' });
        expect(expandedInteractionAssetPath({
            characterSlug: 'iona',
            interaction,
            contexts: [
                { actionId: 'eq_clothe_stockings' },
                { actionId: 'act_apply_handcuffs' },
            ],
            attitude: 35,
        })).toBe('/character-images/interactions-expanded/iona/foot/pantyhose_presented/stockings__wrists__guarded__sustain.png');
    });

    it('uses the handheld vibration sustain visual while the device is active', () => {
        expect(activeVisualInteractionFromContexts([
            { actionId: 'act_start_vibrator', ticksActive: 4 },
        ], 40)).toMatchObject({
            family: 'vibration',
            variant: 'handheld',
            phase: 'sustain',
            sourceActionId: 'act_start_vibrator',
            startedAtTick: 4,
        });
    });

    it('switches to the intense visual after vibration is boosted', () => {
        expect(activeVisualInteractionFromContexts([
            { actionId: 'act_start_vibrator', ticksActive: 7 },
            { actionId: 'act_adjust_vibration', ticksActive: 2 },
        ], 50)).toMatchObject({
            variant: 'handheld',
            phase: 'intense',
            sourceActionId: 'act_adjust_vibration',
        });
    });

    it('uses the peak visual near the edge and clears when contexts are gone', () => {
        expect(activeVisualInteractionFromContexts([
            { actionId: 'act_activate_plug', ticksActive: 3 },
        ], 88)).toMatchObject({ variant: 'internal', phase: 'peak' });
        expect(activeVisualInteractionFromContexts([], 88)).toBeUndefined();
    });

    it('uses tension to intensify an unmodified persistent interaction', () => {
        expect(activeVisualInteractionFromContexts([
            { actionId: 'act_activate_plug', ticksActive: 2 },
        ], 70)).toMatchObject({ variant: 'internal', phase: 'intense', intensity: 0.85, targetPointId: 'vagina' });
    });

    it('selects an electrostimulation visual from the electrode target', () => {
        expect(activeVisualInteractionFromContexts([
            { actionId: 'act_connect_tens', pointId: 'nipples' },
            { actionId: 'act_start_electrostimulation', pointId: 'nipples', ticksActive: 5 },
        ], 45)).toMatchObject({
            family: 'electrostimulation',
            variant: 'clamps',
            phase: 'sustain',
            sourceItemId: 'eq_tens_unit',
            targetPointId: 'nipples',
        });

        expect(activeVisualInteractionFromContexts([
            { actionId: 'act_connect_tens', pointId: 'vulva' },
            { actionId: 'act_start_electrostimulation', pointId: 'vulva' },
            { actionId: 'act_adjust_electrostimulation', pointId: 'vulva' },
        ], 55)).toMatchObject({ variant: 'genital', phase: 'intense' });
    });

    it('builds an exact expanded path from clothing, restraint and affect', () => {
        const interaction = activeVisualInteractionFromContexts([
            { actionId: 'act_connect_tens', pointId: 'nipples' },
            { actionId: 'act_start_electrostimulation', pointId: 'nipples' },
            { actionId: 'act_adjust_electrostimulation', pointId: 'nipples' },
        ], 70)!;
        expect(expandedInteractionAssetPath({
            characterSlug: 'mira',
            interaction,
            contexts: [
                { actionId: 'eq_clothe_lab_gown' },
                { actionId: 'act_apply_handcuffs' },
            ],
            attitude: 30,
            behavioralState: 'defiance',
        })).toBe('/character-images/interactions-expanded/mira/electrostimulation/clamps/open_top__wrists__high_negative__intense.png');
    });

    it('maps clothed internal vibration to a generated compatible combination', () => {
        const interaction = activeVisualInteractionFromContexts([
            { actionId: 'act_activate_plug' },
        ], 35)!;
        expect(expandedInteractionAssetPath({
            characterSlug: 'iona',
            interaction,
            contexts: [{ actionId: 'eq_clothe_jumpsuit' }],
            attitude: 70,
        })).toBe('/character-images/interactions-expanded/iona/vibration/internal/underwear__free__receptive__sustain.png');
    });
});
