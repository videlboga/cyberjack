import { clamp } from './utils';

export type CapacityLoadInput = {
    experiencedIntensity: number;
    pleasure?: number;
    discomfort?: number;
    overload?: number;
    tension?: number;
    isRest?: boolean;
    deltaTime?: number;
};

/**
 * Physical endurance is spent by the amount of stimulation, not by whether
 * the character likes it. Pleasantness softens the cost a little, while pain,
 * overload and high activation make the same work more tiring.
 */
export function estimateCapacityLoss(input: CapacityLoadInput, formulas: any): number {
    if (input.isRest) return 0;

    const intensity = Math.max(0, Number(input.experiencedIntensity) || 0);
    const pleasure = Math.max(0, Number(input.pleasure) || 0);
    const discomfort = Math.max(0, Number(input.discomfort) || 0);
    const overload = Math.max(0, Number(input.overload) || 0);
    const tension = Math.max(0, Number(input.tension) || 0);
    // A zero-duration secondary pulse is still an actual pulse. Its outer
    // stateDeltaScale decides how much it contributes to the minute.
    const activeDuration = Math.max(1, Number(input.deltaTime) || 1);
    const pleasantShare = pleasure / Math.max(1, pleasure + discomfort + overload);
    const pleasureRelief = formulas.capacityPleasureReliefMax ?? 0.25;

    let loss = (
        intensity * (formulas.capacityLoadFromIntensity ?? 0.015) +
        discomfort * (formulas.capacityLoadFromDiscomfort ?? 0.02) +
        overload * (formulas.capacityDropMultiplier ?? 0.25)
    ) * activeDuration;
    loss *= 1 - clamp(pleasantShare, 0, 1) * pleasureRelief;

    if (tension > 85) {
        const edgeDistressFactor = pleasure > discomfort * 1.35 ? 0.25
            : discomfort > pleasure * 1.35 ? 1 : 0.65;
        loss += (tension - 85) * (formulas.edgingCapacityDropRate ?? 0.08) * edgeDistressFactor * activeDuration;
    }

    const tensionModifier = 1 + Math.min(tension, 100) / 100 * 0.5;
    return loss * tensionModifier;
}
