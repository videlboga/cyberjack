import { clamp } from '../engine/utils';

export function memoryAppraisalModifier(associationSignal: number, isVerbal = false) {
    // Associations colour appraisal strongly enough to matter, but can never
    // erase the independently calculated bodily cost of an action.
    return clamp(associationSignal * (isVerbal ? .08 : .18), -.32, .32);
}

export function correctionImpact(input: { intensity: number; plasticity: number; operation: string; linkedTags: number }) {
    const intensity = clamp(input.intensity, .1, 1);
    const plasticity = clamp(input.plasticity / 100, 0, 1);
    const conflict = input.operation === 'reframe' || input.operation === 'anxiety';
    const scope = 1 + Math.max(0, input.linkedTags - 1) * .16;
    return {
        capacityCost: (2 + intensity * 7) * scope,
        plasticityCost: (1 + intensity * 3) * (conflict ? 1 : .55),
        resistanceDelta: conflict ? (1 - plasticity) * intensity * 8 * scope : 0,
        fearDelta: input.operation === 'anxiety' ? intensity * 7 * scope : 0,
        dissociationDelta: conflict ? intensity * (1 - plasticity * .55) * 5 * scope : 0,
    };
}
