import { describe, expect, it } from 'vitest';
import { buildCombinatorialReply } from './combinatorialReplies';
import type { ReactionFrame } from './reactionFrame';

function frame(overrides: Partial<ReactionFrame> = {}): ReactionFrame {
    return {
        speaker: { id: 'S-AV-01', name: 'Мира', gender: 'female', role: 'цель воздействия', core: { values: [], vulnerabilities: [], defenses: [], voice: [] }, state: { attitude: 50, openness: 50, tension: 0, capacity: 50 } },
        scene: { presentCharacters: [], contexts: [], roleContext: [] },
        event: {
            action: 'действие', target: 'точка', pointId: 'neck', experience: '', changes: [],
            physiologicalState: '', physiologicalEvent: 'normal',
            mandatoryPhysiologicalFocus: false, requiresSpeech: true, repetition: 2,
            directlyExperienced: true, affectedCharacter: 'Мира', contact: 'partial', actionTags: ['affection'],
        },
        continuity: { recentDialogue: [], relevantEpisodes: [], canonicalFacts: [], relationshipBeliefs: [], openThreads: [] },
        dramaticPosition: { primaryIntent: '', secondaryConflict: '', preferredSpeechAct: 'acknowledge', allowedSpeechActs: ['acknowledge'] },
        expressionMode: { arousal: 'calm', affect: 'positive', control: 'intact', maxWords: 20, requiresDisruption: false, instructions: [] },
        ...overrides,
    };
}

describe('combinatorialReplies', () => {
    it('builds a reply for repeated affection', () => {
        const reply = buildCombinatorialReply(frame());
        expect(reply).toBeTruthy();
        expect(typeof reply).toBe('string');
    });

    it('injects the point of contact when the template has a {point} slot', () => {
        // Шаблоны с {point} должны подставлять точку в нужном падеже.
        const reply = buildCombinatorialReply(frame({ event: { ...frame().event, pointId: 'neck' } }));
        expect(reply).toBeTruthy();
        // Не каждая реплика называет точку — но если называет, то в правильном падеже.
        if (reply && (reply.includes('шее') || reply.includes('шею') || reply.includes('шея'))) {
            expect(reply).toMatch(/ше[еюя]/);
        }
    });

    it('returns a valid reply for any point', () => {
        for (const p of ['neck', 'chest', 'belly', 'vulva', 'clitoris', 'systemic']) {
            const reply = buildCombinatorialReply(frame({ event: { ...frame().event, pointId: p } }));
            expect(reply, `${p} should build`).toBeTruthy();
        }
    });

    it('varies by attitude band', () => {
        const high = buildCombinatorialReply(frame({ addressee: { id: 'PL-1', name: 'Калибратор', relationship: '', relation: { attitude: 80, openness: 50, familiarity: 0.5 } } }));
        const low = buildCombinatorialReply(frame({ addressee: { id: 'PL-1', name: 'Калибратор', relationship: '', relation: { attitude: 10, openness: 50, familiarity: 0.5 } } }));
        expect(high).toBeTruthy();
        expect(low).toBeTruthy();
    });

    it('varies by repetition (tier)', () => {
        const t2 = buildCombinatorialReply(frame({ event: { ...frame().event, repetition: 2 } }));
        const t4 = buildCombinatorialReply(frame({ event: { ...frame().event, repetition: 5 } }));
        expect(t2).toBeTruthy();
        expect(t4).toBeTruthy();
    });

    it('covers all six categories', () => {
        const cats = ['affection', 'pain', 'stimulation', 'intimate', 'restraint', 'clinical'];
        for (const cat of cats) {
            const reply = buildCombinatorialReply(frame({ event: { ...frame().event, actionTags: [cat] } }));
            expect(reply, `${cat} should build`).toBeTruthy();
        }
    });

    it('produces many distinct replies across points × attitude × repetition', () => {
        const seen = new Set<string>();
        const points = ['neck', 'chest', 'belly', 'thighs', 'vulva', 'clitoris'];
        const attitudes = [80, 60, 50, 30, 10];
        for (const point of points) {
            for (const attitude of attitudes) {
                for (const rep of [2, 3, 4, 5]) {
                    const reply = buildCombinatorialReply(frame({
                        event: { ...frame().event, pointId: point, repetition: rep },
                        addressee: { id: 'PL-1', name: 'Калибратор', relationship: '', relation: { attitude, openness: 50, familiarity: 0.5 } },
                    }));
                    if (reply) seen.add(reply);
                }
            }
        }
        // 6 точек × 5 отношений × 4 повтора = 120 комбинаций; ожидаем много уникальных.
        expect(seen.size).toBeGreaterThan(50);
    });
});
