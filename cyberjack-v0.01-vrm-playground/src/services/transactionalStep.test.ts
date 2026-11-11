import { describe, expect, it } from 'vitest';
import { computeTransactionalStep, TransactionalStepInput } from './transactionalStep';

function base(over: Partial<TransactionalStepInput> = {}): TransactionalStepInput {
    return {
        myEgo: 'adult',
        familiarity: 0.1,
        lifePosition: 'ok_ok',
        need: 'clarity',
        stress: 30,
        gameActive: false,
        ...over,
    };
}

describe('deterministic TA step', () => {
    it('complementary reply stays in my ego state', () => {
        const step = computeTransactionalStep(base({
            myEgo: 'adult',
            incoming: { transaction: 'complementary', speechAct: 'question' },
        }));
        expect(step.reactionType).toBe('complementary');
        expect(step.responseEgo).toBe('adult');
        expect(step.arc).toBe('deepen');
    });

    it('crossed incoming under "not ok not ok" position escalates, not de-escalates', () => {
        const step = computeTransactionalStep(base({
            myEgo: 'adult',
            lifePosition: 'not_ok_not_ok',
            incoming: { transaction: 'crossed' },
        }));
        expect(step.reactionType).toBe('crossed');
        expect(step.arc).toBe('shift');
    });

    it('crossed incoming under safety need de-escalates (complementary)', () => {
        const step = computeTransactionalStep(base({
            myEgo: 'adult',
            lifePosition: 'ok_ok',
            need: 'safety',
            incoming: { transaction: 'crossed' },
        }));
        expect(step.reactionType).toBe('complementary');
    });

    it('ulterior incoming under safety need is met with a crossed reply', () => {
        const step = computeTransactionalStep(base({
            need: 'safety',
            incoming: { transaction: 'ulterior' },
        }));
        expect(step.reactionType).toBe('crossed');
    });

    it('low disclosure for mistrusting position with low familiarity', () => {
        const step = computeTransactionalStep(base({
            lifePosition: 'not_ok_ok',
            familiarity: 0.1,
        }));
        expect(step.disclosure).toBe('low');
        expect(step.scriptLimit).toContain('не слушают');
        expect(step.image).toContain('не раскрываешь');
    });

    it('high stress adult regresses to critical parent on crossed transaction', () => {
        const step = computeTransactionalStep(base({
            myEgo: 'adult',
            stress: 80,
            incoming: { transaction: 'complementary' },
        }));
        // complementary under stress keeps ego; crossed forces regression
        expect(step.responseEgo).toBe('adult');
    });

    it('high stress rebellious child goes crossed', () => {
        const step = computeTransactionalStep(base({
            myEgo: 'rebellious_child',
            stress: 80,
            incoming: { transaction: 'complementary' },
        }));
        expect(step.reactionType).toBe('crossed');
    });

    it('racket image appears for an active game', () => {
        const step = computeTransactionalStep(base({
            gameActive: true,
            gameDrive: 'nigsyb',
        }));
        expect(step.racketImage).toContain('раздражение');
    });
});
