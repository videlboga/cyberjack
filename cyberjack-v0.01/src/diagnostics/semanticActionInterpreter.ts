import { CompiledAction } from '../domain/types';

/**
 * Maps raw intensity/valence vectors into human-readable action summaries.
 */
export function interpretAction(action: CompiledAction): string {
    const i = action.intensity;
    const v = action.valence;
    const c = action.contact;

    let intensityLabel = 'мягкое';
    if (i > 0.8) intensityLabel = 'экстремальное';
    else if (i > 0.5) intensityLabel = 'умеренное';
    else if (i < 0.2) intensityLabel = 'очень легкое';

    let valenceLabel = 'нейтральное';
    if (v > 0.75) valenceLabel = 'крайне позитивное';
    else if (v > 0.2) valenceLabel = 'позитивное';
    else if (v < -0.75) valenceLabel = 'крайне негативное';
    else if (v < -0.2) valenceLabel = 'негативное';

    let contactLabel = 'бесконтактное';
    if (c > 0.7) contactLabel = 'тесное физическое';
    else if (c > 0.3) contactLabel = 'легкое физическое';

    return `${intensityLabel}, ${valenceLabel}, ${contactLabel} действие`;
}
