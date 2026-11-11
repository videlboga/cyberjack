import { describe, expect, it } from 'vitest';
import { correctionImpact, memoryAppraisalModifier } from './memoryCorrection';

describe('memory correction mechanics', () => {
    it('lets a strong relevant memory noticeably colour appraisal without exceeding its cap', () => {
        expect(memoryAppraisalModifier(1.8)).toBeCloseTo(.32);
        expect(memoryAppraisalModifier(-1.8)).toBeCloseTo(-.32);
    });
    it('makes a conflicting wide correction costlier than a reinforcing one', () => {
        const reinforce = correctionImpact({ intensity: .7, plasticity: 60, operation: 'reinforce', linkedTags: 1 });
        const reframe = correctionImpact({ intensity: .7, plasticity: 60, operation: 'reframe', linkedTags: 3 });
        expect(reframe.capacityCost).toBeGreaterThan(reinforce.capacityCost);
        expect(reframe.dissociationDelta).toBeGreaterThan(0);
    });
});
