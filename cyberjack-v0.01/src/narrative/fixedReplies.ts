import type { ReactionFrame } from './reactionFrame';

/**
 * Матрица фиксированных реплик для физиологических состояний.
 *
 * Ядро сводит каждый тик к малому числу «драматических позиций»
 * (physiologicalEvent × affect). Большинство физиологических реакций
 * (оргазм, срыв, перегрузка, удержание у грани, истощение) формульны и
 * повторяются у модели — их озвучивает гигантская матрица заготовок.
 *
 * LLM остаётся как escape-hatch для случаев, где нужен конкретный смысл:
 *   - наблюдатель (видит чужую реакцию, а не свою);
 *   - незавершённые темы (вопрос/обещание);
 *   - доминирующая компульсия (сложный внутренний конфликт);
 *   - задан вопрос (нужен ответ, а не выкрик).
 *
 * Социальные акты (граница/торг/вызов/предупреждение) всегда генерируются:
 * они по определению про отношения и конкретный смысл.
 *
 * Ключ матрицы — свёрнутый frame (event × affect × gender), а не сырые
 * action×state: это десятки ячеек, а не миллионы комбинаций.
 */

type Gender = 'female' | 'male' | 'other';

type EventKey = {
    event: 'discharge' | 'breakdown' | 'overload' | 'peak' | 'edge' | 'minimal';
    affect: 'positive' | 'negative' | 'mixed' | 'overload';
    gender: Gender;
};

/**
 * Реплики — только произносимые слова, без кавычек, ремарок и описаний.
 * Каждая ячейка — массив вариаций; выбор детерминирован (см. selectFixedReply).
 */
const MATRIX: Record<string, string[]> = {
    // ── Оргазм (discharge) ────────────────────────────────────────────────
    'discharge:positive:female': [
        'Ах… не могу… не могу больше…',
        'Сейчас… я… ах!',
        'Не останавливайся… пожалуйста…',
        'Я… я сейчас…',
        'Господи… да…',
        'Ещё… ещё… ах!',
        'Да… да… да!',
        'Я кончаю…',
        'Не могу сдержаться…',
        'Ах… как хорошо…',
    ],
    'discharge:positive:male': [
        'Ах… не могу… не могу больше…',
        'Сейчас… я… ах!',
        'Не останавливайся…',
        'Я… я сейчас…',
        'Да… ещё…',
        'Да… да… да!',
        'Я кончаю…',
        'Не могу сдержаться…',
    ],
    'discharge:mixed:female': [
        'Ах… что ты делаешь… не могу…',
        'Я… я не должна… но… ах!',
        'Сейчас… нет… да…',
        'Не могу… и не хочу, чтобы это кончалось…',
        'Ах… зачем… но… да…',
        'Я не хотела… но… ах!',
        'Нет… да… не останавливайся…',
    ],
    'discharge:mixed:male': [
        'Ах… что ты делаешь… не могу…',
        'Я… я не должен… но… ах!',
        'Сейчас… нет… да…',
        'Не могу… и не хочу, чтобы это кончалось…',
        'Я не хотел… но… ах!',
    ],

    // ── Нервный срыв (breakdown) ─────────────────────────────────────────
    'breakdown:negative:female': [
        'Хватит… пожалуйста, хватит…',
        'Я больше не выдержу…',
        'Не надо… прошу…',
        'Остановись… я не могу…',
        'Пожалуйста… перестань…',
        'Я не выдерживаю…',
        'Хватит… я умоляю…',
        'Не могу больше… не могу…',
    ],
    'breakdown:negative:male': [
        'Хватит… пожалуйста, хватит…',
        'Я больше не выдержу…',
        'Не надо… прошу…',
        'Остановись… я не могу…',
        'Я не выдерживаю…',
        'Хватит… я умоляю…',
    ],
    'breakdown:mixed:female': [
        'Я не понимаю… почему так…',
        'Хватит… я не могу больше…',
        'Пожалуйста… я не выдерживаю…',
        'Я не знаю, что чувствую…',
        'Не могу… и не понимаю…',
    ],
    'breakdown:mixed:male': [
        'Я не понимаю… почему так…',
        'Хватит… я не могу больше…',
        'Я не знаю, что чувствую…',
    ],

    // ── Сенсорная перегрузка (overload) ──────────────────────────────────
    'overload:overload:female': [
        'Слишком… слишком много…',
        'Я не понимаю… всё смешалось…',
        'Подожди… я не могу собраться…',
        'Всё… сразу… не могу…',
        'Слишком ярко… слишком…',
        'Я теряюсь… не могу…',
        'Всё плывёт… не могу…',
    ],
    'overload:overload:male': [
        'Слишком… слишком много…',
        'Я не понимаю… всё смешалось…',
        'Подожди… я не могу собраться…',
        'Всё… сразу… не могу…',
        'Я теряюсь… не могу…',
    ],
    'overload:mixed:female': [
        'Не могу понять… приятно или нет…',
        'Всё смешалось… я теряюсь…',
        'Слишком… и не могу остановить…',
        'Не понимаю, что чувствую…',
        'И приятно, и невыносимо…',
    ],
    'overload:mixed:male': [
        'Не могу понять… приятно или нет…',
        'Всё смешалось… я теряюсь…',
        'Не понимаю, что чувствую…',
    ],

    // ── У самой грани (peak) ──────────────────────────────────────────────
    'peak:positive:female': [
        'Ещё… ещё немного…',
        'Не останавливайся…',
        'Я на грани…',
        'Почти… почти…',
        'Ещё чуть-чуть…',
        'Я так близко…',
        'Не отпускай…',
    ],
    'peak:positive:male': [
        'Ещё… ещё немного…',
        'Не останавливайся…',
        'Я на грани…',
        'Почти… почти…',
        'Я так близко…',
    ],
    'peak:negative:female': [
        'Не надо… я на пределе…',
        'Остановись… я не выдержу…',
        'Пожалуйста… не сейчас…',
        'Я на пределе… хватит…',
        'Не могу больше…',
    ],
    'peak:negative:male': [
        'Не надо… я на пределе…',
        'Остановись… я не выдержу…',
        'Я на пределе… хватит…',
    ],

    // ── Удержание у грани (edge) ──────────────────────────────────────────
    'edge:positive:female': [
        'Ещё… не отпускай…',
        'Я так близко…',
        'Не останавливайся…',
        'Держи меня здесь…',
        'Ещё немного…',
        'Я почти…',
    ],
    'edge:positive:male': [
        'Ещё… не отпускай…',
        'Я так близко…',
        'Не останавливайся…',
        'Ещё немного…',
    ],
    'edge:negative:female': [
        'Хватит… я на пределе…',
        'Не могу больше…',
        'Остановись…',
        'Я не выдержу…',
        'Пожалуйста… хватит…',
    ],
    'edge:negative:male': [
        'Хватит… я на пределе…',
        'Не могу больше…',
        'Остановись…',
    ],
    'edge:mixed:female': [
        'Я не знаю… хочу и не хочу…',
        'Так близко… и так страшно…',
        'Не могу решить…',
        'И хочу, и боюсь…',
    ],
    'edge:mixed:male': [
        'Я не знаю… хочу и не хочу…',
        'Так близко… и так страшно…',
        'Не могу решить…',
    ],

    // ── Истощение (minimal control) ───────────────────────────────────────
    'minimal:negative:female': [
        'Не могу…',
        'Сил нет…',
        'Я… не могу…',
    ],
    'minimal:negative:male': [
        'Не могу…',
        'Сил нет…',
    ],
    'minimal:overload:female': [
        'Не могу… всё плывёт…',
        'Сил нет… не понимаю…',
    ],
    'minimal:overload:male': [
        'Не могу… всё плывёт…',
    ],
};

function matrixKey(key: EventKey): string {
    return `${key.event}:${key.affect}:${key.gender}`;
}

/** Сводит affect frame к одному из четырёх ключей матрицы. */
function affectKey(frame: ReactionFrame): EventKey['affect'] {
    const affect = frame.expressionMode.affect;
    if (affect === 'overload') return 'overload';
    if (affect === 'mixed') return 'mixed';
    if (affect === 'negative') return 'negative';
    return 'positive';
}

/** Сводит physiologicalEvent к ключу матрицы. */
function eventKey(frame: ReactionFrame): EventKey['event'] {
    const phys = frame.event.physiologicalEvent;
    if (phys === 'discharge') return 'discharge';
    if (phys === 'breakdown') return 'breakdown';
    if (phys === 'overload') return 'overload';
    if (phys === 'peak') return 'peak';
    if (phys === 'edge') return 'edge';
    return 'minimal';
}

const PHYSIOLOGY_EVENTS = new Set(['discharge', 'breakdown', 'overload', 'peak', 'edge']);

/**
 * Детерминированный гейт: когда ответ типовой (фиксированная реплика),
 * а когда требует генерации (LLM).
 *
 * Фиксируем:
 *   - истощение (control = minimal) — физически не может говорить сложно;
 *   - физиологию (оргазм/срыв/перегрузка/у грани) — по умолчанию, если нет
 *     сигнала «нужен конкретный смысл».
 *
 * Оставляем LLM (escape-hatch):
 *   - наблюдатель (не directlyExperienced) — видит чужую реакцию;
 *   - незавершённые темы (вопрос/обещание) — нужен конкретный ответ;
 *   - доминирующая компульсия (level 3) — сложный внутренний конфликт;
 *   - задан вопрос — нужен ответ, а не выкрик;
 *   - социальные акты (граница/торг/вызов/предупреждение) — всегда.
 */
export function shouldUseFixedReply(frame: ReactionFrame): boolean {
    const control = frame.expressionMode.control;
    const phys = frame.event.physiologicalEvent;

    // Истощение — всегда фиксируем.
    if (control === 'minimal') return true;

    // Только физиология (не социальные акты, не разговор).
    if (!PHYSIOLOGY_EVENTS.has(phys)) return false;

    // Наблюдатель — нужен конкретный смысл.
    if (!frame.event.directlyExperienced) return false;

    // Незавершённые темы — нужен конкретный ответ.
    if (frame.continuity.openThreads?.length) return false;

    // Доминирующая компульсия — сложный внутренний конфликт.
    if (frame.compulsions?.some(c => c.level === 3)) return false;

    // Задан вопрос — нужен ответ.
    if (frame.event.playerSpeech?.trim().endsWith('?')) return false;

    return true;
}

// Последняя выбранная вариация на говорящего — чтобы не повторять подряд.
const lastVariation = new Map<string, number>();

function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

/**
 * Выбирает фиксированную реплику по frame, либо null, если для этого состояния
 * заготовки нет (тогда вызывающий идёт в LLM).
 */
export function selectFixedReply(frame: ReactionFrame): string | null {
    const key: EventKey = {
        event: eventKey(frame),
        affect: affectKey(frame),
        gender: frame.speaker.gender || 'other',
    };
    const variants = MATRIX[matrixKey(key)];
    if (!variants || variants.length === 0) return null;

    const speakerId = frame.speaker.id;
    const seed = hashString(`${speakerId}:${frame.event.repetition ?? 1}:${key.event}`);
    const previous = lastVariation.get(speakerId);
    let index = seed % variants.length;
    // Не повторять ту же вариацию подряд, если есть альтернатива.
    if (previous !== undefined && previous === index && variants.length > 1) {
        index = (index + 1) % variants.length;
    }
    lastVariation.set(speakerId, index);
    return variants[index];
}

/** Test hook: сбрасывает карту последних вариаций. */
export function __resetFixedReplyState() {
    lastVariation.clear();
}
