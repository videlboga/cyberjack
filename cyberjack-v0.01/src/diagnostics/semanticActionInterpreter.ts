import { CompiledAction } from '../domain/types';

/**
 * Maps raw intensity/valence vectors into human-readable action summaries.
 */
export function interpretAction(action: CompiledAction): string {
    const i = action.intensity;
    const v = action.valence;
    const c = action.contact;

    let intensityLabel = 'mild';
    if (i > 0.8) intensityLabel = 'extreme';
    else if (i > 0.5) intensityLabel = 'moderate';
    else if (i < 0.2) intensityLabel = 'very subtle';

    let valenceLabel = 'neutral';
    if (v > 0.6) valenceLabel = 'highly pleasant';
    else if (v > 0.2) valenceLabel = 'pleasant';
    else if (v < -0.6) valenceLabel = 'highly aversive';
    else if (v < -0.2) valenceLabel = 'aversive';

    let contactLabel = 'non-physical';
    if (c > 0.7) contactLabel = 'close physical';
    else if (c > 0.3) contactLabel = 'light physical';

    return `A ${intensityLabel}, ${valenceLabel}, ${contactLabel} action`;
}
