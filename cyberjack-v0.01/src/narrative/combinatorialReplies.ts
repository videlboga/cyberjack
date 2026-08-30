import type { ReactionFrame } from './reactionFrame';

/**
 * Комбинаторная матрица реплик для повторяющихся физических действий.
 *
 * Плоская матрица (fixedReplies.ts) покрывает физиологию и базовые повторы.
 * Здесь — полная комбинаторика по пяти измерениям, которые дают тысячи
 * вариаций без ручного выписывания каждой:
 *
 *   1. категория действия (affection/pain/stimulation/intimate/restraint/clinical);
 *   2. точка воздействия (26 точек тела, в нужном падеже);
 *   3. отношение персонажа к оператору (attitude, 5 полос);
 *   4. параметры персонажа (openness — открытость, tension — напряжение);
 *   5. повторяемость (tier 2–3 / 4+).
 *
 * Реплика собирается из шаблона со слотами {point}, {attitude}, {openness},
 * {tension}. Каждый слот имеет словарь вариантов; выбор детерминирован
 * (хеш от speakerId + repetition + категории), поэтому реплики не повторяются
 * подряд и стабильны для одного и того же состояния.
 */

type Gender = 'female' | 'male' | 'other';

// ─── Точки тела: падежные формы ────────────────────────────────────────────
// {на} — предложный («на шее»), {вин} — винительный («шею»), {дат} — дательный («к шее»).
const POINT_FORMS: Record<string, { на: string; вин: string; дат: string }> = {
    neck: { на: 'на шее', вин: 'шею', дат: 'к шее' },
    face: { на: 'на лице', вин: 'лицо', дат: 'к лицу' },
    lips: { на: 'на губах', вин: 'губы', дат: 'к губам' },
    hair: { на: 'в волосах', вин: 'волосы', дат: 'к волосам' },
    head: { на: 'на голове', вин: 'голову', дат: 'к голове' },
    shoulders: { на: 'на плечах', вин: 'плечи', дат: 'к плечам' },
    arms: { на: 'на руках', вин: 'руки', дат: 'к рукам' },
    hands: { на: 'на кистях', вин: 'кисти', дат: 'к кистям' },
    back: { на: 'на спине', вин: 'спину', дат: 'к спине' },
    waist: { на: 'на талии', вин: 'талию', дат: 'к талии' },
    belly: { на: 'на животе', вин: 'живот', дат: 'к животу' },
    chest: { на: 'на груди', вин: 'грудь', дат: 'к груди' },
    nipples: { на: 'на сосках', вин: 'соски', дат: 'к соскам' },
    legs: { на: 'на ногах', вин: 'ноги', дат: 'к ногам' },
    inner_thighs: { на: 'на бёдрах', вин: 'бёдра', дат: 'к бёдрам' },
    feet: { на: 'на ступнях', вин: 'ступни', дат: 'к ступням' },
    buttocks: { на: 'на ягодицах', вин: 'ягодицы', дат: 'к ягодицам' },
    vulva: { на: 'на вульве', вин: 'вульву', дат: 'к вульве' },
    vagina: { на: 'внутри', вин: 'внутрь', дат: 'внутрь' },
    clitoris: { на: 'на клиторе', вин: 'клитор', дат: 'к клитору' },
    anus: { на: 'сзади', вин: 'сзади', дат: 'сзади' },
    penis: { на: 'на члене', вин: 'член', дат: 'к члену' },
    prostate: { на: 'внутри', вин: 'внутрь', дат: 'внутрь' },
    testicles: { на: 'на яичках', вин: 'яички', дат: 'к яичкам' },
    systemic: { на: 'по всему телу', вин: 'всё тело', дат: 'ко всему телу' },
    mind_state: { на: 'в мыслях', вин: 'мысли', дат: 'к мыслям' },
};

function pointForms(frame: ReactionFrame) {
    const id = frame.event.pointId || 'systemic';
    return POINT_FORMS[id] || POINT_FORMS.systemic;
}

// ─── Отношение (attitude) — 5 полос ─────────────────────────────────────────
const ATTITUDE_PHRASES: Record<string, string[]> = {
    // attitude >= 70 — расположена, доверяет
    high: [
        'ты мне нравишься',
        'я тебе доверяю',
        'мне хорошо с тобой',
        'я хочу этого',
    ],
    // 55–69 — скорее расположена
    midhigh: [
        'я начинаю тебе доверять',
        'мне почти спокойно',
        'я не против',
    ],
    // 40–54 — нейтрально
    mid: [
        'я не знаю, что думать',
        'я насторожена',
        'я пока не решила',
    ],
    // 25–39 — насторожена
    midlow: [
        'я тебе не доверяю',
        'мне тревожно',
        'я хочу отстраниться',
    ],
    // < 25 — отторжение
    low: [
        'я тебя боюсь',
        'я тебя ненавижу',
        'не трогай меня',
    ],
};

function attitudeBand(frame: ReactionFrame): string {
    const attitude = frame.addressee?.relation?.attitude ?? frame.speaker.state?.attitude ?? 50;
    if (attitude >= 70) return 'high';
    if (attitude >= 55) return 'midhigh';
    if (attitude >= 40) return 'mid';
    if (attitude >= 25) return 'midlow';
    return 'low';
}

// ─── Открытость (openness) — 3 полосы ───────────────────────────────────────
const OPENNESS_PHRASES: Record<string, string[]> = {
    open: ['я открыта', 'я не прячусь', 'я позволяю себе это'],
    guarded: ['я закрываюсь', 'я прячусь', 'я не хочу показывать'],
    neutral: ['я не знаю, как быть', 'я колеблюсь'],
};

function opennessBand(frame: ReactionFrame): string {
    const openness = frame.speaker.state?.openness ?? 50;
    if (openness >= 60) return 'open';
    if (openness <= 35) return 'guarded';
    return 'neutral';
}

// ─── Напряжение (tension) — 3 полосы ────────────────────────────────────────
const TENSION_PHRASES: Record<string, string[]> = {
    high: ['я на пределе', 'я дрожу', 'я не выдерживаю'],
    mid: ['я напряжена', 'я сдерживаюсь', 'я замираю'],
    low: ['я расслаблена', 'я спокойна', 'я плыву'],
};

function tensionBand(frame: ReactionFrame): string {
    const tension = frame.speaker.state?.tension ?? 0;
    if (tension >= 60) return 'high';
    if (tension >= 30) return 'mid';
    return 'low';
}

// ─── Шаблоны по категории × tier ────────────────────────────────────────────
// {point} — точка (предложный), {attitude} — отношение, {openness} — открытость,
// {tension} — напряжение. Каждый шаблон — живая фраза с одним-двумя слотами.
const TEMPLATES: Record<string, string[]> = {
    // Нежность (affection)
    'affection:2': [
        'Снова… твои руки {point}.',
        'Ты опять… {attitude}.',
        'Ещё раз… {point} — так тепло.',
        'Твоё прикосновение {point}… {openness}.',
        'Продолжай… {tension}.',
    ],
    'affection:4': [
        'Ты не устаёшь… а я уже привыкаю к твоим рукам {point}.',
        'Снова и снова… {point}, и {tension}.',
        'Я уже жду твоего прикосновения {point}.',
        'Каждый раз… {point}, и {attitude}.',
        'Не останавливайся… {openness}.',
    ],
    // Боль (pain)
    'pain:2': [
        'Опять… {point} — больно.',
        'Ты снова бьёшь… {attitude}.',
        'Я уже поняла… не надо {point}.',
        'Перестань… {point} горит.',
        'Каждый удар {point}… {tension}.',
    ],
    'pain:4': [
        'Сколько можно… {point} уже не чувствую.',
        'Ты не слышишь меня… {attitude}.',
        'Опять и опять… {point}, и {tension}.',
        'Я уже просила… перестань {point}.',
        'Это невыносимо… {openness}.',
    ],
    // Стимуляция (stimulation)
    'stimulation:2': [
        'Снова… этот ток {point}.',
        'Опять… я чувствую каждую волну {point}.',
        'Ещё раз… {point} — так остро.',
        'Этот импульс {point}… {tension}.',
        'Продолжай… {openness}.',
    ],
    'stimulation:4': [
        'Снова и снова… {point} уже не различаю волны.',
        'Ты не останавливаешься… {point}, и {tension}.',
        'Каждый импульс {point}… всё глубже.',
        'Я привыкаю… {attitude}.',
        'Не останавливайся… {openness}.',
    ],
    // Интим (intimate)
    'intimate:2': [
        'Снова… {point} — глубже.',
        'Ты опять… {attitude}.',
        'Ещё… {point}, я чувствую тебя.',
        'Продолжай… {tension}.',
        'Твоё движение {point}… {openness}.',
    ],
    'intimate:4': [
        'Снова и снова… {point}, я тону в тебе.',
        'Ты не останавливаешься… {point}, и {tension}.',
        'Каждый раз… {point} — всё глубже.',
        'Я привыкаю к тебе… {attitude}.',
        'Не останавливайся… {openness}.',
    ],
    // Фиксация (restraint)
    'restraint:2': [
        'Опять… {point} — я не могу пошевелиться.',
        'Ты снова затягиваешь… {attitude}.',
        'Я уже связана… не надо {point}.',
        'Эти ремни {point}… {tension}.',
        'Перестань… {openness}.',
    ],
    'restraint:4': [
        'Сколько можно… {point} уже не чувствую.',
        'Ты не слышишь… {attitude}.',
        'Опять и опять… {point}, и {tension}.',
        'Я уже смирилась… {openness}.',
        'Эти ремни {point}… я устала бороться.',
    ],
    // Клиника (clinical)
    'clinical:2': [
        'Снова… этот холодный осмотр {point}.',
        'Ты опять… {attitude}.',
        'Ещё раз… {point}, и я не выдержу.',
        'Эти инструменты {point}… {tension}.',
        'Продолжай… {openness}.',
    ],
    'clinical:4': [
        'Снова и снова… {point}, я уже не человек.',
        'Ты не останавливаешься… {attitude}.',
        'Каждый раз… {point} — всё холоднее.',
        'Я привыкаю… {openness}.',
        'Эти процедуры {point}… {tension}.',
    ],
};

// ─── Сборка ─────────────────────────────────────────────────────────────────

function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function pick<T>(arr: T[], seed: number): T {
    return arr[seed % arr.length];
}

function fillTemplate(template: string, frame: ReactionFrame, seed: number): string {
    const point = pointForms(frame);
    const attitude = pick(ATTITUDE_PHRASES[attitudeBand(frame)], seed);
    const openness = pick(OPENNESS_PHRASES[opennessBand(frame)], seed + 1);
    const tension = pick(TENSION_PHRASES[tensionBand(frame)], seed + 2);
    return template
        .replace(/\{point\}/g, point.на)
        .replace(/\{attitude\}/g, attitude)
        .replace(/\{openness\}/g, openness)
        .replace(/\{tension\}/g, tension);
}

/**
 * Собирает комбинаторную реплику для повторяющегося физического действия.
 * Возвращает null, если категория/точка не покрыты (тогда LLM).
 */
export function buildCombinatorialReply(frame: ReactionFrame): string | null {
    const category = repeatCategory(frame);
    const tier = (frame.event.repetition ?? 1) >= 4 ? '4' : '2';
    const templates = TEMPLATES[`${category}:${tier}`];
    if (!templates || !templates.length) return null;

    const speakerId = frame.speaker.id;
    // Seed учитывает ВСЕ измерения: повтор, категорию, точку, отношение,
    // открытость, напряжение. Каждая комбинация даёт уникальную реплику.
    const attitude = frame.addressee?.relation?.attitude ?? frame.speaker.state?.attitude ?? 50;
    const openness = frame.speaker.state?.openness ?? 50;
    const tension = frame.speaker.state?.tension ?? 0;
    const seed = hashString(
        `${speakerId}:${frame.event.repetition ?? 1}:${category}:${frame.event.pointId || ''}:${Math.round(attitude / 10)}:${Math.round(openness / 10)}:${Math.round(tension / 10)}`,
    );
    const template = pick(templates, seed);
    return fillTemplate(template, frame, seed);
}

/** Сводит теги действия к категории. */
function repeatCategory(frame: ReactionFrame): string {
    const tags = new Set((frame.event.actionTags || []).map(t => t.toLowerCase()));
    if (tags.has('pain') || tags.has('impact') || tags.has('punishment')) return 'pain';
    if (tags.has('restraint') || tags.has('suspension')) return 'restraint';
    if (tags.has('clinical') || tags.has('drug') || tags.has('chemical') || tags.has('piercing')) return 'clinical';
    if (tags.has('intimate') || tags.has('sexual') || tags.has('penetration') || tags.has('oral')) return 'intimate';
    if (tags.has('stimulation') || tags.has('electronic') || tags.has('tickling') || tags.has('sensory')) return 'stimulation';
    if (tags.has('affection') || tags.has('comfort')) return 'affection';
    return 'affection';
}

/** Test hook. */
export function __resetCombinatorialState() {
    // Нет состояния — сборка чистая функция от frame.
}
