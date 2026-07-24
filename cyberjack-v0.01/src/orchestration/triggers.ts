import { clamp } from '../engine/utils';
import { SubjectCoreState, TickResult } from '../domain/types';

export type TensionDischargeOutcome = 'positive' | 'breakdown';

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
    blockedByContext: boolean;
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

function signedActivation(result: Partial<TickResult>): number {
    const pleasure = result.pleasure || 0;
    const discomfort = result.discomfort || 0;
    const overload = result.overload || 0;
    const magnitude = pleasure + discomfort + overload * 0.5;
    if (magnitude <= 0) return 0;
    return clamp((pleasure - discomfort - overload * 0.5) / magnitude, -1, 1);
}

export function evaluateTensionDischarge(input: TensionDischargeInput): TensionDischargeDecision {
    const historical = (input.recentEvents || [])
        .map(resultFromEvent)
        .filter((value): value is Partial<TickResult> => !!value)
        .slice(0, 5);
    const samples = [input.result, ...historical];
    let weightedBalance = 0;
    let totalWeight = 0;
    samples.forEach((sample, index) => {
        const weight = index === 0 ? 2 : Math.max(0.35, 1 - index * 0.15);
        weightedBalance += signedActivation(sample) * weight;
        totalWeight += weight;
    });
    const recentBalance = totalWeight > 0 ? weightedBalance / totalWeight : 0;
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
    const positive = !blockedByContext && input.core.capacity > 10 && score >= 0.05;

    return {
        outcome: positive ? 'positive' : 'breakdown',
        score,
        recentBalance,
        blockedByContext,
    };
}
