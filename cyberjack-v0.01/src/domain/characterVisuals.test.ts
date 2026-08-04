import { describe, expect, it } from 'vitest';
import {
    buildCalibrationVisualDescriptorV4,
    calibrationAvatarCandidatesV4,
    resolveCalibrationAvatarV4,
    activeVisualInteractionFromContexts,
    resolveIntimacyInteractionVisual,
} from './characterVisuals';

const context = (actionId: string) => ({ actionId, ticksActive: 0 });

describe('calibration pose resolution', () => {
    it.each([
        ['NPC-CAND-SUMI', '/character-images/rendered/sumi/standing__nude__none__neutral.png'],
        ['NPC-CAND-GEN-02', '/character-images/rendered/eli/standing__nude__none__neutral.png'],
        ['NPC-CAND-GEN-04', '/character-images/rendered/mai/standing__nude__none__neutral.png'],
    ])('keeps a visible character-specific fallback for %s without unrestrained core frames', (id, expected) => {
        const descriptor = buildCalibrationVisualDescriptorV4(id, {
            contexts: [context('eq_clothe_underwear')],
            tension: 0,
            attitude: 50,
            openness: 50,
        });
        expect(resolveCalibrationAvatarV4(descriptor)).toBe(expected);
    });

    it('resolves presented feet to the expanded v4 matrix before legacy fallbacks', () => {
        const descriptor = buildCalibrationVisualDescriptorV4('S-AV-01', {
            contexts: [
                context('act_present_feet'),
                { ...context('act_apply_handcuffs'), pointId: 'left_hand' },
                { ...context('act_apply_handcuffs'), pointId: 'right_hand' }
            ],
            tension: 0,
            attitude: 50,
            openness: 50
        });

        expect(descriptor.pose).toBe('feet_presented');
        expect(descriptor.equipmentPreset).toBe('wrist_cuffs');
        expect(calibrationAvatarCandidatesV4(descriptor)[0]).toContain('/calibration-v4/mira/feet_presented/');
        expect(resolveCalibrationAvatarV4(descriptor)).toBe(
            '/character-images/calibration-v4/mira/feet_presented/nude__wrist_cuffs__neutral.png'
        );
    });

    it('does not lose stockings when no separate dress context is active', () => {
        const descriptor = buildCalibrationVisualDescriptorV4('S-AV-01', {
            contexts: [
                context('act_present_feet'),
                context('eq_clothe_stockings')
            ],
            tension: 0,
            attitude: 70,
            openness: 70
        });

        expect(descriptor.clothing).toBe('dress_stockings');
        expect(resolveCalibrationAvatarV4(descriptor)).toBe(
            '/character-images/calibration-v4/mira/feet_presented/dress_stockings__none__receptive.png'
        );
    });

    it.each([
        [['act_hold_exposure'], 'standing_exposed'],
        [['act_hold_exposure', 'pose_standing'], 'standing_exposed'],
        [['act_hold_exposure', 'pose_sitting'], 'sitting_spread'],
        [['act_hold_exposure', 'pose_kneeling'], 'covering'],
        [['act_end_exposure', 'pose_standing'], 'covering'],
        [['pose_sitting'], 'sitting']
    ])('maps contexts %j to pose %s', (actionIds, expectedPose) => {
        const descriptor = buildCalibrationVisualDescriptorV4('NPC-LAB-01', {
            contexts: actionIds.map(context),
            tension: 0,
            attitude: 50,
            openness: 50
        });
        expect(descriptor.pose).toBe(expectedPose);
    });

    it('uses an available expanded sitting frame before falling back to standing', () => {
        const descriptor = buildCalibrationVisualDescriptorV4('NPC-CAND-SUMI', {
            contexts: [context('pose_sitting'), context('eq_clothe_underwear')],
            tension: 0,
            attitude: 50,
            openness: 50,
        });

        expect(resolveCalibrationAvatarV4(descriptor)).toBe(
            '/character-images/calibration-v4/sumi/sitting_spread/underwear__none__neutral.png',
        );
    });

    it('uses the newest persistent visual when stale pose contexts overlap', () => {
        expect(activeVisualInteractionFromContexts([
            { ...context('act_present_feet'), ticksActive: 1 },
            context('act_hold_exposure')
        ])).toMatchObject({
            family: 'exposure',
            variant: 'standing'
        });
    });

    it.each([
        [
            [{ ...context('finger_insertion'), pointId: 'anus' }],
            '/character-images/intimacy/mira/manual/anal_fingering/nude__sustain__receptive.png',
        ],
        [
            [{ ...context('act_start_penetration'), pointId: 'vagina' }, context('pose_all_fours')],
            '/character-images/intimacy/mira/penetration/vaginal_doggy/nude__sustain__receptive.png',
        ],
        [
            [{ ...context('act_start_vibrator'), pointId: 'clitoris' }, context('eq_clothe_underwear')],
            '/character-images/intimacy/mira/toy/external_vibrator/underwear_displaced__sustain__receptive.png',
        ],
        [
            [
                { ...context('finger_insertion'), pointId: 'anus' },
                context('act_apply_handcuffs'),
                context('eq_blindfold_apply'),
            ],
            '/character-images/intimacy/mira/manual/anal_fingering/nude__wrists_bound__blindfold__sustain__receptive.png',
        ],
    ])('resolves active mechanics through the intimacy matrix', (contexts, expected) => {
        const interaction = activeVisualInteractionFromContexts(contexts)!;
        expect(resolveIntimacyInteractionVisual({
            characterSlug: 'mira',
            interaction,
            contexts,
            tension: 30,
            attitude: 70,
            behavioralState: 'responsive',
        })).toBe(expected);
    });

    it('prioritizes an active intimacy scene over the base pose', () => {
        const contexts = [
            { ...context('finger_insertion'), pointId: 'vagina' },
            context('pose_all_fours'),
        ];
        expect(resolveIntimacyInteractionVisual({
            characterSlug: 'nika',
            interaction: activeVisualInteractionFromContexts(contexts)!,
            contexts,
            tension: 90,
            attitude: 50,
            behavioralState: 'responsive',
        // The unrestrained nude matrix has no authored mixed frame, so the
        // resolver deliberately falls back to the nearest receptive frame.
        })).toBe('/character-images/intimacy/nika/manual/vaginal_fingering/nude__sustain__receptive.png');
    });
});
