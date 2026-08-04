import { describe, expect, it } from 'vitest';
import { AUTHORED_SENSORY_PROFILES, completeActionSensoryProfile } from './actionSensoryProfile';

describe('character-facing sensory profiles', () => {
    it('gives every authored legacy action concrete embodied material', () => {
        expect(Object.keys(AUTHORED_SENSORY_PROFILES).length).toBeGreaterThanOrEqual(30);
        for (const [id, sensory] of Object.entries(AUTHORED_SENSORY_PROFILES)) {
            expect(sensory.stimulus, id).toMatch(/^Ты(?:\s|$)/u);
            expect(sensory.texture, id).toBeTruthy();
            expect(sensory.bodilyResponse || sensory.rhythm, id).toBeTruthy();
            expect(sensory.aftereffect, id).toBeTruthy();
            expect(Object.values(sensory).join(' '), id).not.toMatch(/\b(?:intensity|valence|contact|sharpness|novelty|коэффициент|показатель)\b/iu);
        }
    });

    it('prefers the authored lived experience over generic inference', () => {
        const profile = completeActionSensoryProfile({ id: 'breath_blow', name: 'Обдать дыханием' });
        expect(profile.sensory.stimulus).toContain('направленный поток чужого дыхания');
        expect(profile.sensory.texture).toContain('тепло скользит по поверхности');
        expect(profile.sensory.aftereffect).toContain('кажется теплее');
    });
});
