import { describe, expect, it, beforeEach } from 'vitest';
import { shouldUseFixedReply, selectFixedReply, __resetFixedReplyState } from './fixedReplies';
import type { ReactionFrame } from './reactionFrame';

function frame(overrides: Partial<ReactionFrame> = {}): ReactionFrame {
    return {
        speaker: { id: 'NPC-CAND-KATE', name: 'Кейт', gender: 'female', role: 'цель воздействия', core: { values: [], vulnerabilities: [], defenses: [], voice: [] } },
        scene: { presentCharacters: [], contexts: [], roleContext: [] },
        event: {
            action: 'действие', target: 'точка', experience: '', changes: [],
            physiologicalState: '', physiologicalEvent: 'normal',
            mandatoryPhysiologicalFocus: false, requiresSpeech: true, repetition: 1,
            directlyExperienced: true, affectedCharacter: 'Кейт',
        },
        continuity: { recentDialogue: [], relevantEpisodes: [], canonicalFacts: [], relationshipBeliefs: [], openThreads: [] },
        dramaticPosition: { primaryIntent: '', secondaryConflict: '', preferredSpeechAct: 'acknowledge', allowedSpeechActs: ['acknowledge'] },
        expressionMode: { arousal: 'calm', affect: 'neutral', control: 'intact', maxWords: 20, requiresDisruption: false, instructions: [] },
        ...overrides,
    };
}

describe('fixedReplies gate', () => {
    beforeEach(() => __resetFixedReplyState());

    // ── Физиология фиксируется по умолчанию ───────────────────────────────

    it('uses fixed reply for discharge', () => {
        const f = frame({ event: { ...frame().event, physiologicalEvent: 'discharge' } });
        expect(shouldUseFixedReply(f)).toBe(true);
    });

    it('uses fixed reply for breakdown and overload', () => {
        expect(shouldUseFixedReply(frame({ event: { ...frame().event, physiologicalEvent: 'breakdown' } }))).toBe(true);
        expect(shouldUseFixedReply(frame({ event: { ...frame().event, physiologicalEvent: 'overload' } }))).toBe(true);
    });

    it('uses fixed reply for peak and edge', () => {
        expect(shouldUseFixedReply(frame({ event: { ...frame().event, physiologicalEvent: 'peak' } }))).toBe(true);
        expect(shouldUseFixedReply(frame({ event: { ...frame().event, physiologicalEvent: 'edge' } }))).toBe(true);
    });

    it('uses fixed reply for minimal control', () => {
        const f = frame({ expressionMode: { ...frame().expressionMode, control: 'minimal' } });
        expect(shouldUseFixedReply(f)).toBe(true);
    });

    // ── Escape-hatch: нужен конкретный смысл → LLM ────────────────────────

    it('does NOT use fixed reply for observer (not directly experienced)', () => {
        const f = frame({
            event: { ...frame().event, physiologicalEvent: 'discharge', directlyExperienced: false },
        });
        expect(shouldUseFixedReply(f)).toBe(false);
    });

    it('does NOT use fixed reply when there are open threads', () => {
        const f = frame({
            event: { ...frame().event, physiologicalEvent: 'discharge' },
            continuity: { ...frame().continuity, openThreads: ['Без явного ответа осталось: вопрос'] },
        });
        expect(shouldUseFixedReply(f)).toBe(false);
    });

    it('does NOT use fixed reply when a question was asked', () => {
        const f = frame({
            event: { ...frame().event, physiologicalEvent: 'discharge', playerSpeech: 'Что ты чувствуешь?' },
        });
        expect(shouldUseFixedReply(f)).toBe(false);
    });

    it('does NOT use fixed reply for social acts (set_boundary)', () => {
        const f = frame({
            dramaticPosition: { ...frame().dramaticPosition, preferredSpeechAct: 'set_boundary' },
        });
        expect(shouldUseFixedReply(f)).toBe(false);
    });

    it('does NOT use fixed reply for normal conversation', () => {
        expect(shouldUseFixedReply(frame())).toBe(false);
    });

    // ── Повторяющееся физическое действие (repeat:) ────────────────────────

    it('uses fixed reply for repeated physical action (repetition >= 2)', () => {
        const f = frame({
            event: { ...frame().event, repetition: 2, contact: 'partial' },
            expressionMode: { ...frame().expressionMode, affect: 'positive' },
        });
        expect(shouldUseFixedReply(f)).toBe(true);
    });

    it('does NOT use fixed reply for a single physical action (repetition 1)', () => {
        const f = frame({
            event: { ...frame().event, repetition: 1, contact: 'partial' },
            expressionMode: { ...frame().expressionMode, affect: 'positive' },
        });
        expect(shouldUseFixedReply(f)).toBe(false);
    });

    it('does NOT use fixed reply for verbal action (contact none)', () => {
        const f = frame({
            event: { ...frame().event, repetition: 3, contact: 'none' },
        });
        expect(shouldUseFixedReply(f)).toBe(false);
    });

    it('returns a non-empty reply for repeated positive action', () => {
        const f = frame({
            event: { ...frame().event, repetition: 2, contact: 'partial', actionTags: ['affection'] },
            expressionMode: { ...frame().expressionMode, affect: 'positive' },
        });
        const reply = selectFixedReply(f);
        expect(reply).toBeTruthy();
        expect(typeof reply).toBe('string');
    });

    it('returns a non-empty reply for repeated pain action at tier 4', () => {
        const f = frame({
            event: { ...frame().event, repetition: 5, contact: 'full', actionTags: ['pain', 'impact'] },
            expressionMode: { ...frame().expressionMode, affect: 'negative' },
        });
        const reply = selectFixedReply(f);
        expect(reply).toBeTruthy();
    });

    it('fills every repeat cell (category × tier, female)', () => {
        const categories = ['affection', 'pain', 'stimulation', 'intimate', 'restraint', 'clinical'] as const;
        const tiers = [2, 4] as const;
        for (const category of categories) {
            for (const tier of tiers) {
                const f = frame({
                    event: { ...frame().event, repetition: tier, contact: 'partial', actionTags: [category] },
                });
                const reply = selectFixedReply(f);
                expect(reply, `repeat ${category} × ${tier} should have a reply`).toBeTruthy();
            }
        }
    });

    // ── Выбор реплики ──────────────────────────────────────────────────────

    it('returns a non-empty reply for discharge', () => {
        const f = frame({
            event: { ...frame().event, physiologicalEvent: 'discharge' },
            expressionMode: { ...frame().expressionMode, affect: 'positive' },
        });
        const reply = selectFixedReply(f);
        expect(reply).toBeTruthy();
        expect(typeof reply).toBe('string');
    });

    it('returns a non-empty reply for every filled cell (discharge × negative)', () => {
        const f = frame({
            event: { ...frame().event, physiologicalEvent: 'discharge' },
            expressionMode: { ...frame().expressionMode, affect: 'negative' },
        });
        const reply = selectFixedReply(f);
        expect(reply).toBeTruthy();
        expect(typeof reply).toBe('string');
    });

    it('does not repeat the same variation consecutively', () => {
        const f = frame({
            event: { ...frame().event, physiologicalEvent: 'discharge', repetition: 1 },
            expressionMode: { ...frame().expressionMode, affect: 'positive' },
        });
        const first = selectFixedReply(f);
        const second = selectFixedReply(f);
        expect(first).not.toBe(second);
    });

    it('fills every event × affect cell (no null for female)', () => {
        const events = ['discharge', 'breakdown', 'overload', 'peak', 'edge'] as const;
        const affects = ['positive', 'negative', 'mixed', 'overload'] as const;
        for (const ev of events) {
            for (const af of affects) {
                const f = frame({
                    event: { ...frame().event, physiologicalEvent: ev },
                    expressionMode: { ...frame().expressionMode, affect: af, control: 'fragmented' },
                });
                const reply = selectFixedReply(f);
                expect(reply, `${ev} × ${af} should have a reply`).toBeTruthy();
            }
        }
        // minimal — это control-уровень, а не physiologicalEvent; ключ матрицы
        // 'minimal' получается из eventKey при normal/high + control=minimal.
        for (const af of affects) {
            const f = frame({
                event: { ...frame().event, physiologicalEvent: 'normal' },
                expressionMode: { ...frame().expressionMode, affect: af, control: 'minimal' },
            });
            const reply = selectFixedReply(f);
            expect(reply, `minimal × ${af} should have a reply`).toBeTruthy();
        }
    });
});
