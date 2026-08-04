import { SubjectCoreState } from './types';

export type InterpretableCoreMetric = 'sensitivity' | 'capacity' | 'openness' | 'plasticity';

/**
 * Population references are deliberately separate from character baselines.
 * They are presentation/prompt calibration values and do not affect the engine.
 */
export const HUMAN_CORE_NORMS: Record<InterpretableCoreMetric, number> = {
    sensitivity: 50,
    capacity: 60,
    openness: 50,
    plasticity: 50
};

export const HUMAN_POINT_SENSITIVITY_NORMS: Record<string, number> = {
    posture: 50,
    mind_state: 50,
    head: 30,
    hair: 25,
    face: 60,
    lips: 85,
    neck: 80,
    shoulders: 30,
    chest: 85,
    nipples: 95,
    belly: 50,
    back: 40,
    waist: 65,
    arms: 20,
    hands: 70,
    inner_thighs: 85,
    legs: 25,
    knees: 20,
    feet: 75,
    buttocks: 50,
    anus: 100,
    penis: 100,
    testicles: 100,
    prostate: 100,
    vulva: 95,
    vagina: 100,
    clitoris: 100,
    systemic: 50,
    slot_room: 50,
    slot_social: 50
};

export type ParameterInterpretation = {
    value: number;
    humanNorm: number;
    personalBaseline: number;
    humanPercent: number;
    personalPercent: number;
    humanRatio: number;
    personalRatio: number;
};

const finite = (value: unknown, fallback: number) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const ratio = (value: number, reference: number) => reference > 0 ? value / reference : 1;

export function interpretParameter(value: number, humanNorm: number, personalBaseline?: number): ParameterInterpretation {
    const safeNorm = Math.max(0.001, finite(humanNorm, 50));
    const safeValue = Math.max(0, finite(value, safeNorm));
    const safeBaseline = Math.max(0.001, finite(personalBaseline, safeValue || safeNorm));
    const humanRatio = ratio(safeValue, safeNorm);
    const personalRatio = ratio(safeValue, safeBaseline);
    return {
        value: safeValue,
        humanNorm: safeNorm,
        personalBaseline: safeBaseline,
        humanRatio,
        personalRatio,
        // The engine index is a latent response coefficient, not a linear
        // physiological percentage. Squaring the population ratio keeps the
        // norm at 100% while making extreme calibration visibly superhuman.
        humanPercent: Math.round(humanRatio * humanRatio * 100),
        personalPercent: Math.round(personalRatio * 100)
    };
}

export function interpretCoreMetric(
    key: InterpretableCoreMetric,
    value: number,
    personalBaseline?: number
): ParameterInterpretation {
    return interpretParameter(value, HUMAN_CORE_NORMS[key], personalBaseline);
}

export function humanPointSensitivityNorm(pointId?: string | null): number {
    const canonical = String(pointId || 'systemic').trim().toLowerCase();
    return HUMAN_POINT_SENSITIVITY_NORMS[canonical] ?? HUMAN_POINT_SENSITIVITY_NORMS.systemic;
}

export function interpretPointSensitivity(
    pointId: string | null | undefined,
    value: number,
    personalBaseline?: number
): ParameterInterpretation {
    return interpretParameter(value, humanPointSensitivityNorm(pointId), personalBaseline);
}

export function interpretPointAttitude(value: number, personalBaseline?: number): ParameterInterpretation {
    return interpretParameter(value, 50, personalBaseline);
}

export function sensitivityBand(value: ParameterInterpretation): string {
    if (value.humanRatio >= 3) return 'запредельно высокий, несовместимый с обычной человеческой сенсорикой';
    if (value.humanRatio >= 2) return 'сверхчеловечески высокий';
    if (value.humanRatio >= 1.5) return 'аномально высокий';
    if (value.personalRatio >= 1.5) return 'резко усиленный относительно привычного';
    if (value.personalRatio >= 1.15) return 'усиленный относительно привычного';
    if (value.personalRatio <= 0.65) return 'сильно притуплённый относительно привычного';
    if (value.personalRatio <= 0.85) return 'притуплённый относительно привычного';
    if (value.humanRatio >= 1.35) return 'выше человеческой нормы';
    if (value.humanRatio <= 0.65) return 'ниже человеческой нормы';
    return 'в пределах нормы';
}

export function parameterMagnitudeBand(value: ParameterInterpretation): string {
    if (value.humanRatio >= 3) return 'запредельное значение';
    if (value.humanRatio >= 2) return 'сверхчеловеческое значение';
    if (value.humanRatio >= 1.5) return 'аномально высокое значение';
    if (value.humanRatio >= 1.15) return 'выше нормы';
    if (value.humanRatio <= 0.5) return 'аномально низкое значение';
    if (value.humanRatio <= 0.85) return 'ниже нормы';
    return 'в пределах нормы';
}

export function exceptionalCoreStateLines(core: SubjectCoreState): string[] {
    const descriptions: Array<[InterpretableCoreMetric, string, string]> = [
        ['sensitivity', 'Общая чувствительность', 'Даже слабые стимулы ощущаются непропорционально сильно; обычная реакция тела невозможна.'],
        ['plasticity', 'Пластичность', 'Нервная система закрепляет изменения с аномальной скоростью и глубиной; последствия воздействия должны ощущаться исключительными.'],
        ['openness', 'Открытость', 'Психологические фильтры и защитная дистанция практически отсутствуют; степень восприимчивости выходит за обычный человеческий диапазон.'],
        ['capacity', 'Выносливость', 'Функциональный резерв превышает обычные человеческие возможности; персонаж способен переносить неестественно длительную нагрузку.']
    ];
    return descriptions.flatMap(([key, label, consequence]) => {
        const interpreted = interpretCoreMetric(key, core[key]);
        if (interpreted.humanRatio < 1.5) return [];
        const severity = interpreted.humanRatio >= 3
            ? 'ЗАПРЕДЕЛЬНОЕ ЗНАЧЕНИЕ'
            : interpreted.humanRatio >= 2
                ? 'СВЕРХЧЕЛОВЕЧЕСКОЕ ЗНАЧЕНИЕ'
                : 'АНОМАЛЬНОЕ ЗНАЧЕНИЕ';
        return [`[${severity}: ${label}] ${consequence} Индекс ${Math.round(interpreted.value)}, ${interpreted.humanPercent}% нормы.`];
    });
}

export function isAcquiredHyperSensitivity(value: ParameterInterpretation): boolean {
    return value.value - value.personalBaseline >= 10 && value.personalRatio >= 1.15;
}

export function coreBaselineFor(
    core: SubjectCoreState,
    key: InterpretableCoreMetric
): number {
    const baselineKeys: Record<InterpretableCoreMetric, keyof SubjectCoreState> = {
        sensitivity: 'baselineSensitivity',
        capacity: 'baselineCapacity',
        openness: 'baselineOpenness',
        plasticity: 'baselinePlasticity'
    };
    return finite(core[baselineKeys[key]], core[key]);
}

export function formatRelativeValue(value: ParameterInterpretation): string {
    return `${value.humanPercent}% нормы · индекс ${Math.round(value.value)} · ${parameterMagnitudeBand(value)}`;
}
