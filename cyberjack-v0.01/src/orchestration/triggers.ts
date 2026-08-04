import { clamp } from '../engine/utils';
import { SubjectCoreState, TickResult } from '../domain/types';
import { deriveActivationPressure } from '../domain/edgeState';
import { OVERLOAD_NOTICEABLE } from '../domain/overloadScale';

export type TensionDischargeOutcome = 'positive' | 'overload' | 'breakdown';

export interface TensionDischargeInput {
    core: SubjectCoreState;
    result: TickResult;
    recentEvents?: any[];
    activeContextIds?: string[];
}

export interface TensionDischargeDecision {
    outcome: TensionDischargeOutcome;
    score: number;
    recentBalance: number;
    activationBalance: number;
    blockedByContext: boolean;
}

export function peakResolutionReady(
    decision: Pick<TensionDischargeDecision, 'outcome'>,
    result: Pick<TickResult, 'pleasure' | 'discomfort' | 'overload' | 'experiencedIntensity'>,
    capacity: number,
    forced = false,
): boolean {
    if (forced) return true;
    if (decision.outcome === 'positive') {
        const releaseImpulse = Math.max(0, result.pleasure || 0);
        const dynamicThreshold = Math.max(6, Math.min(14, (result.experiencedIntensity || 0) * 0.18));
        return releaseImpulse >= dynamicThreshold;
    }
    if (decision.outcome === 'breakdown') {
        return capacity <= 10 || (result.discomfort || 0) + (result.overload || 0) * 0.5 >= 10;
    }
    return capacity <= 10 || (result.overload || 0) >= OVERLOAD_NOTICEABLE;
}

const NEGATIVE_PEAK_CONTEXTS = new Set([
    'effect_panic',
    'effect_apathy',
    'effect_chronic_apathy',
    'effect_active_defiance',
    'effect_sensory_overload',
    'effect_freeze',
]);

function resultFromEvent(event: any): Partial<TickResult> | null {
    return event?.resultPayload?.result || event?.result?.result || event?.result || null;
}

export function evaluateTensionDischarge(input: TensionDischargeInput): TensionDischargeDecision {
    const historical = (input.recentEvents || [])
        .map(resultFromEvent)
        .filter((value): value is Partial<TickResult> => !!value)
        .slice(0, 5);
    const pressure = deriveActivationPressure(
        [input.result, ...historical].map(reaction => ({ reaction }))
    );
    const recentBalance = pressure.activationBalance / 100;
    const attitudeSignal = clamp((input.core.attitude - 50) / 50, -1, 1);
    const opennessSignal = clamp((input.core.openness - 50) / 50, -1, 1);
    const capacitySignal = clamp((input.core.capacity - 20) / 80, -0.25, 1);
    const overloadPenalty = clamp((input.result.overload || 0) / 100, 0, 1);
    const blockedByContext = (input.activeContextIds || []).some(id => NEGATIVE_PEAK_CONTEXTS.has(id));

    const score =
        recentBalance * 0.45 +
        attitudeSignal * 0.25 +
        opennessSignal * 0.2 +
        capacitySignal * 0.1 -
        overloadPenalty * 0.25;
    // Peak outcome is driven by the legible character of activation. Acceptance
    // can affect the diagnostic score, but cannot secretly turn pleasurable
    // activation into a nervous breakdown.
    const positive = !blockedByContext && input.core.capacity > 10 && recentBalance >= 0.2;
    const breakdown = recentBalance <= -0.2;
    const outcome: TensionDischargeOutcome = positive
        ? 'positive'
        : breakdown
            ? 'breakdown'
            : 'overload';

    return {
        outcome,
        score,
        recentBalance,
        activationBalance: pressure.activationBalance,
        blockedByContext,
    };
}
