import { describe, expect, it } from 'vitest';
import { completeActionSensoryProfile } from './actionSensoryProfile';

describe('character-facing sensory profiles', () => {
    it('infers embodied material for a current action id', () => {
        const profile = completeActionSensoryProfile({ id: 'act_slap', name: 'Пощечина', tags: ['impact', 'pain', 'demeaning'] });
        expect(profile.sensory.stimulus).toBeTruthy();
        expect(profile.sensory.texture).toBeTruthy();
        expect(profile.sensory.bodilyResponse || profile.sensory.rhythm).toBeTruthy();
        expect(profile.sensory.aftereffect).toBeTruthy();
        expect(Object.values(profile.sensory).join(' ')).not.toMatch(/\b(?:intensity|valence|contact|sharpness|novelty|коэффициент|показатель)\b/iu);
    });

    it('prefers the authored lived experience over generic inference', () => {
        const profile = completeActionSensoryProfile({ id: 'act_kiss', name: 'Поцелуй', tags: ['affection', 'intimate'], sensory: { stimulus: 'Ты чувствуешь короткое прикосновение тёплых губ.' } });
        expect(profile.sensory.stimulus).toContain('тёплых губ');
    });
});
