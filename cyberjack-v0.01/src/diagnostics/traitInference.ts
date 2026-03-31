import { SubjectCoreState } from '../domain/types';

/**
 * Maps raw core stats back to string descriptors for ST or UI.
 * E.g., translates "attitude: 80" into "Very cooperative".
 */
export function inferTraits(core: SubjectCoreState): Record<string, string> {
    const getLevel = (val: number, labels: [string, string, string, string, string]) => {
        if (val < 20) return labels[0];
        if (val < 40) return labels[1];
        if (val < 60) return labels[2];
        if (val < 80) return labels[3];
        return labels[4];
    };

    return {
        attitude: getLevel(core.attitude, ['Hostile', 'Defensive', 'Neutral', 'Receptive', 'Devoted']),
        openness: getLevel(core.openness, ['Closed off', 'Guarded', 'Cautious', 'Open', 'Completely open']),
        sensitivity: getLevel(core.sensitivity, ['Numb', 'Dull', 'Normal', 'Sensitive', 'Hypersensitive']),
        capacity: getLevel(core.capacity, ['Fragile', 'Vulnerable', 'Average', 'Resilient', 'Unbreakable']),
        plasticity: getLevel(core.plasticity, ['Rigid', 'Stubborn', 'Adaptable', 'Malleable', 'Highly impressionable'])
    };
}
