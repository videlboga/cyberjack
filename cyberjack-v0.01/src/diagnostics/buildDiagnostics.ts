import { SubjectCoreState, CompiledAction, TickOutput, DiagnosticsOutput } from '../domain/types';
import { interpretAction } from './semanticActionInterpreter';
import { inferTraits } from './traitInference';
import { buildInteractionObservation } from '../narrative/interactionObservation';

/**
 * Builds a readable diagnostic object from a completed tick.
 * Useful for building the LLM Prompt or showing tooltips in the Debug UI.
 */
export function buildDiagnostics(
    action: CompiledAction,
    previousCore: SubjectCoreState,
    output: TickOutput,
    subjectId?: string,
    pointLabel?: string,
    observationOptions?: { previousContextIds?: string[]; notableEvent?: 'positive_discharge' | 'breakdown' | 'exhaustion' }
): DiagnosticsOutput {
    
    const reactionSummary = buildReactionSummary(output.result);
    // Use baseAction for semantic description if available to avoid calling 'Обычная беседа' an extreme action because of posture/restraints
    const actionToInterpret = (action as any)._baseAction || action;
    const point = output.tickMeta?.inputs?.point || (output as any).nextPoint;

    const observation = subjectId ? buildInteractionObservation({
        subjectId,
        pointId: output.tickMeta?.inputs?.point?.pointId || output.nextPoint.pointId,
        pointLabel,
        action: actionToInterpret,
        previousCore,
        output,
        ...observationOptions,
    }) : undefined;

    return {
        actionSummary: interpretAction(actionToInterpret, output.result, previousCore, point),
        reactionSummary,
        inferredTraits: inferTraits(output.nextCore),
        rawDelta: {
            attitudeDelta: output.nextCore.attitude - previousCore.attitude,
            opennessDelta: output.nextCore.openness - previousCore.openness,
        },
        physicalEffect: (output.result.pleasure || 0) - (output.result.discomfort || 0),
        emotionalEffect: output.result.attitudeShift || 0,
        observation
    };
}

function buildReactionSummary(result: any): string {
    const parts = [];
    if (result.pleasure > 20) parts.push("сильное удовольствие");
    else if (result.pleasure > 5) parts.push("заметное удовольствие");
    else if (result.pleasure > 0.5) parts.push("слабое удовольствие");
    
    if (result.discomfort > 20) parts.push("сильный дискомфорт");
    else if (result.discomfort > 5) parts.push("заметный дискомфорт");
    else if (result.discomfort > 0.5) parts.push("слабый дискомфорт");

    if (result.overload > 10) parts.push("сенсорная перегрузка");
    if (result.engagement > 20) parts.push("активная вовлеченность");

    if (parts.length === 0) return "нейтральная реакция";
    return parts.join(", ");
}
