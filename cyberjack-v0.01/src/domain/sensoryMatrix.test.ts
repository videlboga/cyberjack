import { describe, it, expect } from 'vitest';
import { loadSensoryMatrix, resolveSensoryVariant, resolveDeviceVariant } from './sensoryMatrix';

describe('sensoryMatrix', () => {
    it('loads the matrix with all cells filled', () => {
        const matrix = loadSensoryMatrix();
        expect(matrix.cells.length).toBeGreaterThan(0);
        for (const cell of matrix.cells) {
            for (const variant of cell.variants) {
                expect(variant.stimulus).toBeTruthy();
                expect(variant.texture).toBeTruthy();
                expect(variant.rhythm).toBeTruthy();
                expect(variant.bodilyResponse).toBeTruthy();
                expect(variant.aftereffect).toBeTruthy();
            }
        }
    });

    it('resolves a point variant deterministically', () => {
        const a = resolveSensoryVariant('act_slap', 'face', 1);
        const b = resolveSensoryVariant('act_slap', 'face', 1);
        expect(a).toEqual(b);
        expect(a?.stimulus).toBeTruthy();
    });

    it('returns null for unknown action/point', () => {
        expect(resolveSensoryVariant('nonexistent', 'face')).toBeNull();
    });

    it('resolves device variants', () => {
        const v = resolveDeviceVariant('lab_sex_machine', 'circular_saw', 0);
        expect(v?.stimulus).toBeTruthy();
    });
});
