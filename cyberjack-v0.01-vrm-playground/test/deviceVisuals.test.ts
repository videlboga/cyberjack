import { describe, expect, it } from 'vitest';
import { resolveExistingDeviceVisual } from '../src/domain/characterVisuals';

describe('existing device visual resolver', () => {
    it('uses generated sex-machine assets and falls back to a supported affect', () => {
        expect(resolveExistingDeviceVisual({
            characterSlug: 'nika', family: 'sex_machine', configuration: 'restrained',
            wardrobe: 'underwear', affect: 'neutral', phase: 'sustain',
        })).toBe('/character-images/interactions-expanded/nika/sex_machine/restrained/underwear__machine__receptive__sustain.png');
    });

    it('uses generated capsule assets', () => {
        expect(resolveExistingDeviceVisual({
            characterSlug: 'iona', family: 'capsule', configuration: 'electric',
            wardrobe: 'device_outfit', affect: 'subspace', phase: 'intense',
        })).toBe('/character-images/interactions-expanded/iona/capsule/electric/device_outfit__machine__subspace__intense.png');
    });

    it('returns null for an unsupported wardrobe instead of constructing a broken URL', () => {
        expect(resolveExistingDeviceVisual({
            characterSlug: 'mira', family: 'capsule', configuration: 'hmd',
            wardrobe: 'underwear', affect: 'receptive', phase: 'sustain',
        })).toBeNull();
    });
});
