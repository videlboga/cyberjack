import type { LifePosition } from './socialTransactions';

/**
 * Детерминированная эволюция жизненного сценария персонажа через ТА.
 *
 * Убеждение — это не статичный текст, а жизненный сценарий по Берну,
 * состоящий из осей (запрет / драйвер / позиция / рэкет-чувство). Каждая
 * ось СМЯГЧАЕТСЯ или УКРЕПЛЯЕТСЯ от накопленного опыта. Ядро вычисляет
 * это детерминированно по agency эпизодов и типу транзакции — без LLM.
 */

/** Ось сценария. */
export type ScriptAxis =
    | { kind: 'prohibition'; label: string; conviction: number }   // «Не доверяй»
    | { kind: 'driver'; label: string; conviction: number }        // «Будь сильной»
    | { kind: 'position'; value: LifePosition; conviction: number }
    | { kind: 'racket'; label: string; conviction: number };       // рэкет-чувство

export type BeliefState = {
    lifePosition: LifePosition;
    /** 0..1 — насколько позиция укрепилась опытом (не менялась = 0.5). */
    conviction: number;
    shiftedLifePosition?: LifePosition;
    /** Текущий сценарий: запрет, драйвер, рэкет-чувство (с conviction). */
    axes: ScriptAxis[];
    /** Образный текст сценария для промпта. */
    scriptText: string;
};

/** Вход сценария из профиля (ta.script вида «Запрет / Драйвер»). */
export type ScriptSeed = {
    script: string;        // «Не доверяй / Будь сильной»
    lifePosition: LifePosition;
    racket: string;        // «Праведный гнев / недоверие»
    game?: string;
};

/** Опыт периода, влияющий на сценарий. */
export type ScriptExperience = {
    agencies: string[];    // agency эпизодов
    cooperativeCount: number; // комплементарные транзакции (доверие оправдалось)
};

/** Насколько каждый agency укрепляет/ослабляет оси. */
const AGENCY_EFFECT: Record<string, number> = {
    wanted: 0.02,
    mixed: 0.0,
    endured: -0.04,
    resisted: -0.03,
    lost_control: -0.06,
};

const BASE_TEXTS: Record<LifePosition, string> = {
    'ok_ok': 'Я в порядке, и другие в порядке — можно доверять и быть открытой.',
    'ok_not_ok': 'Я в порядке, но другим не стоит доверять — полагаться можно только на себя.',
    'not_ok_ok': 'Я не на высоте, но другие — в порядке; я хочу их одобрения.',
    'not_ok_not_ok': 'Никто никому не нужен, всё безнадёжно.',
};

/** Сдвиг позиции при сильном ослаблении conviction. */
const POSITION_SHIFT: Array<{ from: LifePosition; to: LifePosition; threshold: number; text: string }> = [
    { from: 'not_ok_ok', to: 'not_ok_not_ok', threshold: 0.3, text: 'Мир меня использует, и я уже не знаю, кому можно верить.' },
    { from: 'ok_not_ok', to: 'not_ok_not_ok', threshold: 0.3, text: 'Я перестаю верить, что могу на что-то влиять.' },
];

/** Делит строку сценария «Запрет / Драйвер» на ось. */
function splitScript(script: string): { prohibition: string; driver: string } {
    const idx = script.indexOf('/');
    if (idx < 0) return { prohibition: script.trim(), driver: '' };
    return { prohibition: script.slice(0, idx).trim(), driver: script.slice(idx + 1).trim() };
}

/** Суммарное изменение позиции от agency. */
export function beliefConvictionDelta(agencies: string[]): number {
    let total = 0;
    for (const agency of agencies) total += AGENCY_EFFECT[agency] ?? 0;
    return Math.max(-1, Math.min(1, total));
}

/**
 * Детерминированный расчёт текущего сценария.
 * @param seed базовый сценарий из профиля
 * @param experience накопленный опыт периода
 */
export function evolveBelief(seed: ScriptSeed, experience: ScriptExperience): BeliefState {
    const { prohibition, driver } = splitScript(seed.script);
    const delta = beliefConvictionDelta(experience.agencies);

    // Позиция сдвигается от agency; комплементарные транзакции смягчают «не доверяй».
    const conviction = Math.max(0, Math.min(1, 0.5 + delta));
    let shifted: LifePosition | undefined;
    let shiftedText: string | undefined;
    for (const shift of POSITION_SHIFT) {
        if (shift.from === seed.lifePosition && conviction <= shift.threshold) {
            shifted = shift.to;
            shiftedText = shift.text;
            break;
        }
    }

    // Запрет смягчается позитивным опытом (комплементарные, wanted).
    const trustGain = (experience.cooperativeCount * 0.04) + (experience.agencies.filter(a => a === 'wanted').length * 0.02);
    const prohibitionConviction = Math.max(0.2, Math.min(1, 0.5 - trustGain + (delta < 0 ? -delta : 0)));
    // Драйвер укрепляется при endured/resisted (приходилось держаться).
    const driverGain = experience.agencies.filter(a => a === 'endured' || a === 'resisted').length * 0.03;
    const driverConviction = Math.min(1, 0.5 + driverGain);

    const axes: ScriptAxis[] = [
        { kind: 'prohibition', label: prohibition, conviction: prohibitionConviction },
        { kind: 'driver', label: driver, conviction: driverConviction },
        { kind: 'position', value: shifted || seed.lifePosition, conviction },
        { kind: 'racket', label: seed.racket, conviction: 0.5 },
    ];

    // Образный текст сценария.
    let scriptText: string;
    if (shiftedText) {
        scriptText = shiftedText;
    } else if (prohibitionConviction < 0.3) {
        scriptText = `Ты по привычке держишь «${prohibition}», но в последнее время доверие несколько раз оправдалось — и ты начинаешь сомневаться в этом правиле.`;
    } else if (driverConviction > 0.7) {
        scriptText = `Ты привыкла требовать от себя «${driver}» — это помогает держаться, но не даёт расслабиться.`;
    } else {
        scriptText = BASE_TEXTS[seed.lifePosition];
    }

    return {
        lifePosition: seed.lifePosition,
        conviction,
        ...(shifted ? { shiftedLifePosition: shifted } : {}),
        axes,
        scriptText,
    };
}
