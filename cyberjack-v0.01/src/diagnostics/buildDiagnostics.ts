import { SubjectCoreState, CompiledAction, TickOutput, DiagnosticsOutput } from '../domain/types';
import { interpretAction } from './semanticActionInterpreter';
import { inferTraits } from './traitInference';

/**
 * Builds a readable diagnostic object from a completed tick.
 * Useful for building the LLM Prompt or showing tooltips in the Debug UI.
 */
export function buildDiagnostics(
    action: CompiledAction,
    previousCore: SubjectCoreState,
    output: TickOutput
): DiagnosticsOutput {
    
    const reactionSummary = buildReactionSummary(output.result);
    // Use baseAction for semantic description if available to avoid calling 'Обычная беседа' an extreme action because of posture/restraints
    const actionToInterpret = (action as any)._baseAction || action;
    const point = output.tickMeta?.inputs?.point || (output as any).nextPoint;

    return {
        actionSummary: interpretAction(actionToInterpret, output.result, previousCore, point),
        reactionSummary,
        inferredTraits: inferTraits(output.nextCore),
        rawDelta: {
            attitudeDelta: output.nextCore.attitude - previousCore.attitude,
            opennessDelta: output.nextCore.openness - previousCore.openness,
        },
        physicalEffect: (output.result.pleasure || 0) - (output.result.discomfort || 0),
        emotionalEffect: output.result.attitudeShift || 0
    };
}

function buildReactionSummary(result: any): string {
    const parts = [];
    if (result.pleasure > 70) parts.push("подавляющее удовольствие");
    else if (result.pleasure > 30) parts.push("явное удовольствие");
    
    if (result.discomfort > 70) parts.push("сильный дискомфорт");
    else if (result.discomfort > 30) parts.push("заметный дискомфорт");

    if (result.overload > 50) parts.push("сенсорная перегрузка");
    if (result.engagement > 80) parts.push("высокая активная вовлеченность");

    if (parts.length === 0) return "нейтральная реакция";
    return parts.join(", ");
}
