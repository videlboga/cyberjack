import { computeResult } from '../src/engine/computeResult';
import { DEFAULT_CONFIG } from '../src/engine/config';

// Проверка: буст принятия растёт линейно со временем эджинга, применяется ко всем точкам.
const action = {
    actionKey: 'touch',
    intensity: 5,
    valence: 0.5,
    sharpness: 2,
    contact: 3,
    novelty: 2,
    tags: ['physical'],
} as any;

// Неинтимная точка (руки) — буст должен применяться и к ней.
const core = { sensitivity: 50, capacity: 60, openness: 50, plasticity: 50, attitude: 30, tension: 95 };
const point = { pointId: 'hands', localSensitivity: 50, localAttitude: 10, localOpenness: 50 };

function run(edgeHoldMinutes: number) {
    const { result } = computeResult(action, core, point, DEFAULT_CONFIG, undefined, edgeHoldMinutes);
    return {
        edgeHoldMinutes,
        effectiveAttitude: result.effectiveAttitude.toFixed(1),
        finalValence: result.finalValence.toFixed(3),
        baseFinalValence: result.baseFinalValence?.toFixed(3),
    };
}

console.log('tension=95 (tensionFactor=0.667), maxBoost=120, edgeHoldMaxMinutes=120');
console.log('Ожидание: буст = 0.667 * (min/120) * 120 = 0.667 * min');
console.log('');
for (const m of [0, 15, 30, 60, 90, 120, 180]) {
    console.log(JSON.stringify(run(m)));
}
