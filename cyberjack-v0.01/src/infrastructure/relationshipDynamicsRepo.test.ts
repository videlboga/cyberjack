import { describe, expect, it } from 'vitest';
import { relationshipDynamicsRepo } from './relationshipDynamicsRepo';

describe('relationship dynamics', () => {
    it('keeps compliance, dependency and dissociation independent from attitude', () => {
        const subjectId = `dyn-sub-${Date.now()}`;
        const actorId = `dyn-actor-${Date.now()}`;
        expect(relationshipDynamicsRepo.get(subjectId, actorId)).toMatchObject({
            resistance: 0, learnedCompliance: 0, dependency: 0, dissociation: 0, fear: 0,
        });
        const changed = relationshipDynamicsRepo.change(subjectId, actorId, {
            learnedCompliance: 20, dependency: 8, dissociation: 12, fear: 30,
        });
        expect(changed).toMatchObject({ learnedCompliance: 20, dependency: 8, dissociation: 12, fear: 30 });
        const recovered = relationshipDynamicsRepo.recoverAlone(subjectId, 10);
        expect(relationshipDynamicsRepo.get(subjectId, actorId).fear).toBeLessThan(30);
        expect(relationshipDynamicsRepo.get(subjectId, actorId).learnedCompliance).toBe(20);
        expect(recovered).toBeUndefined();
    });
});
