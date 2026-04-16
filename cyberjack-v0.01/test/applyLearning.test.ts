import { describe, it, expect } from 'vitest';
import { applyLearning } from '../src/engine/applyLearning';
import { DEFAULT_CONFIG } from '../src/engine/config';

describe('applyLearning metadata whitelist', () => {
    it('preserves whitelist fields (preferences, flags, name, profileJson)', () => {
        const core: any = {
            sensitivity: 50,
            capacity: 50,
            openness: 40,
            plasticity: 50,
            attitude: 50,
            // extra metadata we expect to be preserved
            preferences: JSON.stringify({ actions: { 'a1': 1 }, points: {}, contexts: {} }),
            flags: ['status:raw'],
            name: 'Тестовый',
            profileJson: JSON.stringify({ bio: 'тест' })
        };

        const point: any = { pointId: 'general', localSensitivity: 50, localAttitude: 50, familiarity: 0, exposureCount: 0 };
        const action: any = { actionKey: 'test', label: 'Test', type: 'physical', tags: [], intensity: 0.5, valence: 0, contact: 0.5, sharpness: 0.5, novelty: 0.5 };

        const result = {
            experiencedIntensity: 1,
            overload: 0,
            pleasure: 0,
            discomfort: 0,
            learningEffect: 0
        };

        const { nextCore } = applyLearning(core, point, action, result, DEFAULT_CONFIG);

    expect((nextCore as any).preferences).toBe(core.preferences);
    expect((nextCore as any).flags).toEqual(core.flags);
    expect((nextCore as any).name).toBe(core.name);
    expect((nextCore as any).profileJson).toBe(core.profileJson);
    });
});
