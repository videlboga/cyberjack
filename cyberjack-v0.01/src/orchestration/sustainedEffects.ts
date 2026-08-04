export interface SustainedContextLike {
    actionId: string;
    pointId?: string;
}

export interface SustainedPulsePlan {
    sourceActionId: string;
    presetId: 'sustained_vibration_pulse' | 'sustained_electro_pulse' | 'sustained_sexual_pulse';
    pointId: string;
    pulses: number;
    label: string;
}

const physicalPulsePoint = (pointId: string | undefined, fallback: string) =>
    pointId && !pointId.startsWith('active_') ? pointId : fallback;

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
            pointId: physicalPulsePoint(vibration.pointId, 'clitoris'),
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
            pointId: physicalPulsePoint(electro.pointId, 'clitoris'),
            pulses,
            label: boosted ? 'Интенсивная продолжительная электростимуляция' : 'Продолжительная электростимуляция'
        });
    }

    const sexual = contexts.find(context => context.actionId === 'act_start_penetration') ||
        contexts.find(context => context.actionId === 'finger_insertion');
    if (sexual) {
        const boosted = ids.has('act_increase_friction');
        const manual = sexual.actionId === 'finger_insertion';
        const sexualPulses = boosted ? Math.min(6, pulses * 2) : pulses;
        plans.push({
            sourceActionId: sexual.actionId,
            presetId: 'sustained_sexual_pulse',
            pointId: physicalPulsePoint(sexual.pointId, 'vagina'),
            pulses: sexualPulses,
            label: boosted
                ? (manual ? 'Быстрая стимуляция пальцами' : 'Быстрые фрикции')
                : (manual ? 'Продолжительная стимуляция пальцами' : 'Продолжительное проникновение')
        });
    }

    return plans;
}
