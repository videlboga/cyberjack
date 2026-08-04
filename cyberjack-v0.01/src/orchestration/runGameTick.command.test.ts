import { describe, expect, it } from 'vitest';
import { resolveGenericUndressContexts } from './runGameTick';

describe('generic clothing commands', () => {
    const tags: Record<string, string[]> = {
        eq_clothe_calibration_set: ['clothing', 'calibration'],
        pose_sitting: ['pose'],
    };

    it('resolves generic undressing against clothing actually worn', () => {
        expect(resolveGenericUndressContexts(
            'Я рад. Сними одежду',
            ['eq_clothe_calibration_set', 'pose_sitting'],
            id => tags[id] || [],
        )).toEqual(['eq_clothe_calibration_set']);
    });

    it('does not reinterpret a specific clothing instruction', () => {
        expect(resolveGenericUndressContexts(
            'Сними комбинезон',
            ['eq_clothe_calibration_set'],
            id => tags[id] || [],
        )).toBeNull();
    });
});
