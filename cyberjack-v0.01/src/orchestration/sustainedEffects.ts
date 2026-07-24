export interface SustainedContextLike {
    actionId: string;
    pointId?: string;
}

export interface SustainedPulsePlan {
    sourceActionId: string;
    presetId: 'sustained_vibration_pulse' | 'sustained_electro_pulse';
    pointId: string;
    pulses: number;
    label: string;
}

/** Turns active continuous-device contexts into periodic engine actions. */
export function planSustainedPulses(contexts: SustainedContextLike[], elapsedTime: number): SustainedPulsePlan[] {
    const ids = new Set(contexts.map(context => context.actionId));
    const pulses = Math.max(1, Math.min(4, Math.floor(Math.max(1, elapsedTime) / 4)));
    const plans: SustainedPulsePlan[] = [];

    const vibration = contexts.find(context => context.actionId === 'act_activate_plug') ||
        contexts.find(context => context.actionId === 'act_start_vibrator');
    if (vibration) {
        const boosted = ids.has('act_adjust_vibration');
        plans.push({
            sourceActionId: vibration.actionId,
            presetId: 'sustained_vibration_pulse',
            pointId: vibration.pointId || 'groin',
            pulses,
            label: boosted ? 'Интенсивная продолжительная вибрация' : 'Продолжительная вибрация'
        });
    }

    const electro = contexts.find(context => context.actionId === 'act_start_electrostimulation');
    if (electro) {
        const boosted = ids.has('act_adjust_electrostimulation');
        plans.push({
            sourceActionId: electro.actionId,
            presetId: 'sustained_electro_pulse',
            pointId: electro.pointId || 'groin',
            pulses,
            label: boosted ? 'Интенсивная продолжительная электростимуляция' : 'Продолжительная электростимуляция'
        });
    }

    return plans;
}
