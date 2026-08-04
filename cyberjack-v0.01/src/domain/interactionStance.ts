import type { CompiledAction } from './types';
import { OVERLOAD_CRITICAL, OVERLOAD_PROTECTIVE } from './overloadScale';

export type InteractionRequest = 'none' | 'slow_down' | 'stop';

export interface InteractionStance {
    subjectId: string;
    actorId: string;
    request: InteractionRequest;
    scopePoints: string[];
    scopeTags: string[];
    intensity: number;
    sourceActionId?: string | null;
    ignoredCount: number;
}

const supportivePattern = /(?:^|_)(?:stop|release|remove|end)(?:_|$)/i;

export function boundaryAcknowledgementStrength(text?: string | null): number {
    const value = String(text || '').trim().toLocaleLowerCase();
    if (!value) return 0;
    if (/(?:остановил(?:ся)?|перестал|больше не буду|не повторится|прекратил|я остановлю|сейчас останов)/iu.test(value)) return 1;
    if (/(?:извини|прости|понял(?:а)?|услышал(?:а)?|хорошо|ладно)/iu.test(value)) return .65;
    return 0;
}

export function actionRespectsStance(action: Partial<CompiledAction>): boolean {
    return supportivePattern.test(action.actionKey || '');
}

export function actionConflictsWithStance(
    stance: InteractionStance | null,
    action: Partial<CompiledAction>,
    pointId: string,
): boolean {
    if (!stance || stance.request === 'none' || stance.intensity <= 0 || actionRespectsStance(action)) return false;
    if (Number(action.contact || 0) <= 0.05) return false;
    const pointMatches = stance.scopePoints.length === 0 || stance.scopePoints.includes(pointId) || stance.scopePoints.includes('systemic');
    const tags = action.tags || [];
    const tagMatches = stance.scopeTags.length === 0 || stance.scopeTags.some(tag => tags.includes(tag)) || stance.scopeTags.includes('contact');
    return pointMatches && tagMatches;
}

export function boundaryValencePenalty(stance: InteractionStance): number {
    const base = stance.request === 'stop' ? 0.65 : 0.25;
    return Math.min(1.5, base + stance.intensity * 0.75 + stance.ignoredCount * 0.1);
}

export function requestedStanceFromReaction(input: {
    subjectId: string;
    actorId: string;
    action: Partial<CompiledAction>;
    pointId: string;
    appraisal: number;
    discomfort: number;
    overload: number;
}): InteractionStance | null {
    const isContact = Number(input.action.contact || 0) > 0.05;
    // Conversations can change attitude, but cannot silently create a bodily
    // boundary. Contact boundaries belong to an actual physical interaction.
    if (!isContact) return null;

    const negative = Math.max(0, -input.appraisal);
    const distress = Math.min(1, (input.discomfort + input.overload * 0.5) / 12);
    let request: InteractionRequest;
    let intensity: number;

    // Pain and liking are separate. A masochistic or otherwise positively
    // appraised experience may be physically painful without meaning "stop".
    // Only genuine sensory overload creates a protective limit on its own.
    if (negative < 0.15) {
        if (input.overload >= OVERLOAD_CRITICAL) {
            request = 'stop';
            intensity = Math.min(1, input.overload / 100);
        } else if (input.overload >= OVERLOAD_PROTECTIVE) {
            request = 'slow_down';
            intensity = Math.max(0.35, Math.min(0.7, input.overload / 100));
        } else {
            return null;
        }
    } else {
        // Once the experience is actually unwanted, bodily distress controls
        // urgency while the negative appraisal supplies the direction.
        intensity = Math.max(negative, distress);
        if (intensity < 0.35) return null;
        request = intensity >= 0.58 ? 'stop' : 'slow_down';
    }
    return {
        subjectId: input.subjectId,
        actorId: input.actorId,
        request,
        scopePoints: [input.pointId],
        scopeTags: ['contact'],
        intensity,
        sourceActionId: input.action.actionKey,
        ignoredCount: 0,
    };
}
