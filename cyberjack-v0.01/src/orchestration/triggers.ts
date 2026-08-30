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
    // Positive outcome means the character wants it and is on the peak: the
    // discharge happens. Pleasure shapes the *quality* of the orgasm (trust
    // gain in resolveTickConsequences), not whether it occurs. A hard pleasure
    // floor here stranded wary characters (pleasure ~4) on tension 100 forever.
    if (decision.outcome === 'positive') {
        return true;
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
    // activation into a nervous breakdown. The SIGN of the appraisal decides the
    // outcome; the floor is a small positive threshold (activationBalance >= 5)
    // that separates a genuinely mixed peak (~2) from a wary-but-willing
    // character (~13) who would otherwise strand in the overload dead-zone.
    const positive = !blockedByContext && input.core.capacity > 10 && recentBalance >= 0.05;
    const breakdown = recentBalance < 0;
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
