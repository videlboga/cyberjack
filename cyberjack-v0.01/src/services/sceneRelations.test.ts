import { describe, expect, it } from 'vitest';
import { NEUTRAL_VISIBLE_RELATION } from './sceneRelations';

describe('visible scene relation defaults', () => {
    it('starts as neutral acquaintance rather than intimacy', () => {
        expect(NEUTRAL_VISIBLE_RELATION.attitude).toBe(50);
        expect(NEUTRAL_VISIBLE_RELATION.openness).toBeGreaterThan(0);
        expect(NEUTRAL_VISIBLE_RELATION.openness).toBeLessThan(50);
        expect(NEUTRAL_VISIBLE_RELATION.familiarity).toBeGreaterThan(0);
    });
});
