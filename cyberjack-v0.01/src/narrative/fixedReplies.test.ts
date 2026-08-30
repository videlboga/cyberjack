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

    it('uses fixed reply for minimal control', () => {
        const f = frame({ expressionMode: { ...frame().expressionMode, control: 'minimal' } });
        expect(shouldUseFixedReply(f)).toBe(true);
    });

    it('does NOT use fixed reply for discharge (fragmented)', () => {
        const f = frame({
            event: { ...frame().event, physiologicalEvent: 'discharge' },
            expressionMode: { ...frame().expressionMode, control: 'fragmented' },
        });
        expect(shouldUseFixedReply(f)).toBe(false);
    });

    it('does NOT use fixed reply for breakdown', () => {
        const f = frame({ event: { ...frame().event, physiologicalEvent: 'breakdown' } });
        expect(shouldUseFixedReply(f)).toBe(false);
    });

    it('does NOT use fixed reply for overload', () => {
        const f = frame({ event: { ...frame().event, physiologicalEvent: 'overload' } });
        expect(shouldUseFixedReply(f)).toBe(false);
    });

    it('does NOT use fixed reply for social acts (set_boundary)', () => {
        const f = frame({
            event: { ...frame().event, repetition: 3 },
            dramaticPosition: { ...frame().dramaticPosition, preferredSpeechAct: 'set_boundary' },
        });
        expect(shouldUseFixedReply(f)).toBe(false);
    });

    it('does NOT use fixed reply for normal conversation', () => {
        expect(shouldUseFixedReply(frame())).toBe(false);
    });

    it('returns a non-empty reply for minimal control', () => {
        const f = frame({
            expressionMode: { ...frame().expressionMode, control: 'minimal', affect: 'negative' },
        });
        const reply = selectFixedReply(f);
        expect(reply).toBeTruthy();
        expect(typeof reply).toBe('string');
    });

    it('returns null for a non-minimal state', () => {
        const f = frame({
            event: { ...frame().event, physiologicalEvent: 'discharge' },
            expressionMode: { ...frame().expressionMode, control: 'fragmented', affect: 'positive' },
        });
        expect(selectFixedReply(f)).toBeNull();
    });

    it('does not repeat the same variation consecutively', () => {
        const f = frame({
            expressionMode: { ...frame().expressionMode, control: 'minimal', affect: 'negative' },
        });
        const first = selectFixedReply(f);
        const second = selectFixedReply(f);
        expect(first).not.toBe(second);
    });
});
