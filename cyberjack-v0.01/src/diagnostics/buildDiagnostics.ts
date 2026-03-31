import { SubjectCoreState, CompiledAction, TickOutput } from '../domain/types';
import { interpretAction } from './semanticActionInterpreter';
import { inferTraits } from './traitInference';

export interface DiagnosticsOutput {
    actionSummary: string;
    reactionSummary: string;
    inferredTraits: Record<string, string>;
    rawDelta: {
        attitudeDelta: number;
        opennessDelta: number;
    }
}

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

    return {
        actionSummary: interpretAction(action),
        reactionSummary,
        inferredTraits: inferTraits(output.nextCore),
        rawDelta: {
            attitudeDelta: output.nextCore.attitude - previousCore.attitude,
            opennessDelta: output.nextCore.openness - previousCore.openness,
        }
    };
}

function buildReactionSummary(result: any): string {
    const parts = [];
    if (result.pleasure > 70) parts.push("overwhelming pleasure");
    else if (result.pleasure > 30) parts.push("clear pleasure");

    if (result.discomfort > 70) parts.push("severe discomfort");
    else if (result.discomfort > 30) parts.push("noticeable discomfort");

    if (result.overload > 50) parts.push("sensory overload");
    if (result.engagement > 80) parts.push("high active engagement");

    if (parts.length === 0) return "neutral/mixed reaction";
    return parts.join(", ");
}
