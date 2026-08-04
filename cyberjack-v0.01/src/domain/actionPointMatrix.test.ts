import { describe, expect, it } from 'vitest';
import {
    actionsForBodyPoint,
    isActionAllowedAtBodyPoint,
    pointsForAction,
} from './actionPointMatrix';

describe('action-point mechanical matrix', () => {
    it('expands broad head targets into exact body-map points', () => {
        expect(pointsForAction('act_kiss')).toEqual(
            expect.arrayContaining(['head', 'face', 'lips', 'neck']),
        );
    });

    it('expands broad limb targets but does not leak them into torso points', () => {
        expect(isActionAllowedAtBodyPoint('act_caress', 'hands')).toBe(true);
        expect(isActionAllowedAtBodyPoint('act_caress', 'feet')).toBe(true);
        expect(isActionAllowedAtBodyPoint('act_caress', 'vulva')).toBe(false);
    });

    it('keeps precise intimate targets precise', () => {
        expect(pointsForAction('finger_insertion')).toEqual(['vagina', 'anus']);
        expect(actionsForBodyPoint('vagina').map((action) => action.id)).toContain('finger_insertion');
    });

    it('does not treat clothing presets without targets as universal body actions', () => {
        expect(pointsForAction('eq_clothe_dress')).toEqual([]);
    });
});
