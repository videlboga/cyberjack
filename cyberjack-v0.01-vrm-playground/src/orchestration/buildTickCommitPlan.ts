import type { CompiledAction, TickOutput } from '../domain/types';
import type { TickEffect } from './tickEffectPlan';
import type { TickCommitPlan } from './commitTickOutcome';

export interface BuildTickCommitPlanInput {
    tickId: string;
    subjectId: string;
    pointId: string;
    initiatorId: string;
    presetId: string;
    compiledAction: CompiledAction;
    output: TickOutput;
    observation: unknown;
    eventMetadata?: unknown;
    learningScale: number;
    stateBefore: { core: any; point: any };
    resources: unknown;
    peakEvent: unknown;
    commandEvent: { attempted: boolean; applied: boolean; narrative?: string };
    effects: TickEffect[];
}

/**
 * Stage: assemble the commit plan (the object handed to `commitTickOutcome`).
 * Pure — performs no database writes and no side effects.
 */
export function buildTickCommitPlan(input: BuildTickCommitPlanInput): TickCommitPlan {
    return {
        tickId: input.tickId,
        subjectId: input.subjectId,
        pointId: input.pointId,
        initiatorId: input.initiatorId,
        presetId: input.presetId,
        compiledAction: input.compiledAction,
        output: input.output,
        observation: input.observation as any,
        eventMetadata: input.eventMetadata as any,
        learningScale: input.learningScale,
        stateBefore: { core: input.stateBefore.core },
        resources: input.resources as any,
        peakEvent: input.peakEvent as any,
        commandEvent: input.commandEvent,
        effects: input.effects,
    };
}
