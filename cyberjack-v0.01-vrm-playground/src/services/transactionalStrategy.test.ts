import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../infrastructure/db';
import {
    strokeValue,
    applyStrokes,
    readStrokeState,
    strokeHunger,
    strokeInitiativeBoost,
    deriveEgoState,
    isGameProne,
} from './transactionalStrategy';
import type { SpeechSemantics } from './socialTransactions';

const semantics = (over: Partial<SpeechSemantics> = {}): SpeechSemantics => ({
    speechAct: 'answer',
    apparentEgoState: 'adult',
    transaction: 'unclear',
    boundary: 'none',
    invitation: 'none',
    openLoop: 'none',
    conversationDisposition: 'continue',
    confidence: 0.8,
    ...over,
});

beforeEach(() => {
    db.prepare('DELETE FROM social_pair_states').run();
});

describe('stroke economy', () => {
    it('values complementary transactions positively', () => {
        expect(strokeValue(semantics({ transaction: 'complementary', speechAct: 'support' }))).toBeGreaterThan(0);
    });

    it('values crossed and ulterior transactions negatively', () => {
        expect(strokeValue(semantics({ transaction: 'crossed' }))).toBeLessThan(0);
        expect(strokeValue(semantics({ transaction: 'ulterior' }))).toBeLessThan(0);
    });

    it('values refusal and provocation negatively', () => {
        expect(strokeValue(semantics({ speechAct: 'refusal' }))).toBeLessThan(0);
        expect(strokeValue(semantics({ speechAct: 'provocation' }))).toBeLessThan(0);
    });

    it('penalizes a violated boundary', () => {
        expect(strokeValue(semantics({ boundary: 'violated' }))).toBeLessThan(0);
    });

    it('applies and clamps strokes to a bounded range', () => {
        applyStrokes('A', 'B', 5);
        expect(readStrokeState('A', 'B').balance).toBe(5);
        // Clamp at +20
        applyStrokes('A', 'B', 100);
        expect(readStrokeState('A', 'B').balance).toBe(20);
        // Clamp at -20
        applyStrokes('A', 'B', -100);
        expect(readStrokeState('A', 'B').balance).toBe(-20);
    });

    it('returns zero balance for a fresh pair', () => {
        expect(readStrokeState('X', 'Y').balance).toBe(0);
    });

    it('maps a deficit to hunger and an initiative boost', () => {
        expect(strokeHunger(0)).toBe(0);
        expect(strokeHunger(-10)).toBe(1);
        expect(strokeHunger(-5)).toBe(0.5);
        expect(strokeInitiativeBoost(-10)).toBeCloseTo(0.15);
        expect(strokeInitiativeBoost(0)).toBe(0);
    });
});

describe('dynamic ego state', () => {
    it('holds the scripted default when safe and resourced', () => {
        const ego = deriveEgoState({
            tension: 20, capacity: 80, openness: 50, plasticity: 50,
            trust: 60, safety: 70, defaultEgoState: 'adult',
        });
        expect(ego).toBe('adult');
    });

    it('escalates a critical_parent into control when overwhelmed', () => {
        const ego = deriveEgoState({
            tension: 85, capacity: 30, openness: 50, plasticity: 50,
            trust: 50, safety: 50, defaultEgoState: 'critical_parent', lifePosition: 'ok_ok',
        });
        expect(ego).toBe('critical_parent');
    });

    it('turns a nurturing_parent into a critic when overwhelmed', () => {
        const ego = deriveEgoState({
            tension: 85, capacity: 30, openness: 50, plasticity: 50,
            trust: 50, safety: 50, defaultEgoState: 'nurturing_parent', lifePosition: 'ok_ok',
        });
        expect(ego).toBe('critical_parent');
    });

    it('collapses an adult to compliance when overwhelmed', () => {
        const ego = deriveEgoState({
            tension: 85, capacity: 30, openness: 50, plasticity: 50,
            trust: 50, safety: 50, defaultEgoState: 'adult', lifePosition: 'ok_ok',
        });
        expect(ego).toBe('adapted_child');
    });

    it('takes control when an adult is threatened', () => {
        const ego = deriveEgoState({
            tension: 30, capacity: 60, openness: 50, plasticity: 50,
            trust: 30, safety: 20, defaultEgoState: 'adult', lifePosition: 'ok_ok',
        });
        expect(ego).toBe('critical_parent');
    });

    it('defies when a free_child is threatened', () => {
        const ego = deriveEgoState({
            tension: 30, capacity: 60, openness: 50, plasticity: 50,
            trust: 30, safety: 20, defaultEgoState: 'free_child', lifePosition: 'ok_ok',
        });
        expect(ego).toBe('rebellious_child');
    });

    it('deepens compliance for an adapted_child under any pressure', () => {
        const ego = deriveEgoState({
            tension: 85, capacity: 30, openness: 50, plasticity: 50,
            trust: 30, safety: 20, defaultEgoState: 'adapted_child', lifePosition: 'ok_ok',
        });
        expect(ego).toBe('adapted_child');
    });

    it('escalates defiance for a rebellious_child under any pressure', () => {
        const ego = deriveEgoState({
            tension: 85, capacity: 30, openness: 50, plasticity: 50,
            trust: 30, safety: 20, defaultEgoState: 'rebellious_child', lifePosition: 'ok_ok',
        });
        expect(ego).toBe('rebellious_child');
    });

    it('applies "I am not OK" stance to compliance regardless of script', () => {
        const ego = deriveEgoState({
            tension: 85, capacity: 30, openness: 50, plasticity: 50,
            trust: 50, safety: 50, defaultEgoState: 'critical_parent', lifePosition: 'not_ok_ok',
        });
        expect(ego).toBe('adapted_child');
    });

    it('applies "you are not OK" stance to control regardless of script', () => {
        const ego = deriveEgoState({
            tension: 30, capacity: 60, openness: 50, plasticity: 50,
            trust: 30, safety: 20, defaultEgoState: 'adapted_child', lifePosition: 'ok_not_ok',
        });
        expect(ego).toBe('rebellious_child');
    });

    it('blends the observed ego when safe', () => {
        const ego = deriveEgoState({
            tension: 20, capacity: 80, openness: 50, plasticity: 50,
            trust: 60, safety: 70, defaultEgoState: 'adult', apparentEgoState: 'free_child',
        });
        expect(ego).toBe('free_child');
    });

    it('ignores an unclear observed ego', () => {
        const ego = deriveEgoState({
            tension: 20, capacity: 80, openness: 50, plasticity: 50,
            trust: 60, safety: 70, defaultEgoState: 'adult', apparentEgoState: 'unclear',
        });
        expect(ego).toBe('adult');
    });

    it('holds the scripted anchor in neutral even with a stale observed ego', () => {
        // A single observed `adult` must NOT permanently override a scripted
        // adapted_child in neutral conditions (the bug that broke game init).
        const ego = deriveEgoState({
            tension: 40, capacity: 60, openness: 50, plasticity: 50,
            trust: 50, safety: 50, defaultEgoState: 'adapted_child',
            lifePosition: 'not_ok_ok', apparentEgoState: 'adult',
        });
        expect(ego).toBe('adapted_child');
    });

    it('drifts an adult toward rebellious_child when need is autonomy', () => {
        // No stress, neutral tension/safety — but the dominant need pulls.
        const ego = deriveEgoState({
            tension: 40, capacity: 60, openness: 50, plasticity: 90,
            trust: 50, safety: 50, defaultEgoState: 'adult',
            lifePosition: 'ok_ok', need: 'autonomy',
        });
        expect(ego).toBe('rebellious_child');
    });

    it('drifts a critical_parent toward free_child when need is connection and satiated', () => {
        // Satiation + connection need pulls even a critical parent down to a child.
        const ego = deriveEgoState({
            tension: 40, capacity: 60, openness: 50, plasticity: 90,
            trust: 60, safety: 70, defaultEgoState: 'critical_parent',
            lifePosition: 'ok_ok', need: 'connection', strokeBalance: 15, attitude: 75,
        });
        expect(ego).toBe('free_child');
    });

    it('drifts toward adapted_child when stroke-deprived, without any stress', () => {
        // No overwhelm/threat — the stroke deficit alone pulls a scripted adult down.
        const ego = deriveEgoState({
            tension: 40, capacity: 60, openness: 50, plasticity: 90,
            trust: 50, safety: 50, defaultEgoState: 'adult',
            lifePosition: 'ok_ok', strokeBalance: -18,
        });
        expect(ego).toBe('adapted_child');
    });

    it('holds the anchor when plasticity is low (rigid character)', () => {
        // Low plasticity means drifts are weak; the script holds despite need.
        const ego = deriveEgoState({
            tension: 40, capacity: 60, openness: 50, plasticity: 10,
            trust: 50, safety: 50, defaultEgoState: 'adult',
            lifePosition: 'ok_ok', need: 'autonomy', strokeBalance: -18,
        });
        expect(ego).toBe('adult');
    });
});

describe('game-proneness', () => {
    it('is game-prone when hungry and in a child state', () => {
        expect(isGameProne({
            tension: 85, capacity: 30, openness: 50, plasticity: 50,
            trust: 50, safety: 50, defaultEgoState: 'adult', strokeBalance: -10,
        })).toBe(true);
    });

    it('is not game-prone when satiated', () => {
        expect(isGameProne({
            tension: 85, capacity: 30, openness: 50, plasticity: 50,
            trust: 50, safety: 50, defaultEgoState: 'adult', strokeBalance: 0,
        })).toBe(false);
    });

    it('is not game-prone when in adult state even if hungry', () => {
        expect(isGameProne({
            tension: 20, capacity: 80, openness: 50, plasticity: 50,
            trust: 60, safety: 70, defaultEgoState: 'adult', strokeBalance: -10,
        })).toBe(false);
    });

    it('is game-prone when a hungry critical_parent (righteous anger)', () => {
        expect(isGameProne({
            tension: 85, capacity: 30, openness: 50, plasticity: 50,
            trust: 30, safety: 20, defaultEgoState: 'critical_parent', lifePosition: 'ok_ok', strokeBalance: -10,
        })).toBe(true);
    });
});
