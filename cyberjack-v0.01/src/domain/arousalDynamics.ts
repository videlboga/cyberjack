import type { CompiledAction } from './types';

const INTIMATE_POINTS = new Set([
    'lips', 'chest', 'nipples', 'inner_thighs', 'groin', 'vulva', 'vagina',
    'clitoris', 'penis', 'testicles', 'anus', 'prostate', 'buttocks',
]);

export type ArousalDirection = {
    excitation: number;
    regulation: number;
    reason: 'stimulating' | 'distressing' | 'neutral' | 'slowing' | 'stopping' | 'grounding';
};

/**
 * Pleasure/discomfort describe the quality and strength of an experience.
 * This function separately describes whether that experience drives bodily
 * activation upward or helps it settle.
 */
export function arousalDirection(
    action: Partial<CompiledAction>,
    pointId: string,
    appraisal: number,
    tension: number,
): ArousalDirection {
    const id = String(action.actionKey || '');
    const tags = new Set(action.tags || []);
    const intimate = INTIMATE_POINTS.has(pointId) || tags.has('sexual') || tags.has('intimate') || tags.has('penetration');

    if (/(?:^|_)(?:stop|end|deactivate|disconnect)(?:_|$)/i.test(id)) {
        return { excitation: 0, regulation: 1, reason: 'stopping' };
    }
    if (/(?:decrease|slower|slow_down)/i.test(id)) {
        return { excitation: 0, regulation: .48, reason: 'slowing' };
    }
    if (/^(?:pose_sitting|pose_lying_down)$/.test(id) || /(?:remove|release).*(?:restraint|cuff|collar|belt)/i.test(id)) {
        return { excitation: 0, regulation: .42, reason: 'grounding' };
    }
    if (id === 'verbal_pressure') {
        return appraisal >= 0
            ? { excitation: 0, regulation: tension >= 60 ? .14 : 0, reason: 'neutral' }
            : { excitation: .22, regulation: 0, reason: 'distressing' };
    }
    if (!intimate && tension >= 60 && appraisal >= 0 && /^(?:gentle_stroke|feather_stroke|deep_massage|breath_blow)$/.test(id)) {
        const regulation = id === 'deep_massage' ? .18 : .28;
        return { excitation: 0, regulation, reason: 'grounding' };
    }
    if (intimate || tags.has('pain') || tags.has('stimulation') || tags.has('electronic')) {
        return { excitation: 1, regulation: 0, reason: 'stimulating' };
    }
    return { excitation: .45, regulation: 0, reason: 'neutral' };
}

/**
 * Slow physiological settling while world time passes without an ongoing
 * stimulus. This is intentionally much gentler than the legacy explicit
 * `wait` action: around 0.45 points per minute in the middle of the scale and
 * 0.61 near an edge state.
 */
export function passiveArousalAfterMinutes(tension: number, minutes = 1): number {
    let next = Math.max(0, Number(tension) || 0);
    const elapsed = Math.max(0, Math.round(Number(minutes) || 0));
    for (let minute = 0; minute < elapsed && next > 0; minute++) {
        next = Math.max(0, next - (.25 + next * .004));
    }
    return next;
}
