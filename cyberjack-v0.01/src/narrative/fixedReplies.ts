import type { ReactionFrame } from './reactionFrame';

/**
 * Матрица фиксированных реплик для типовых физиологических состояний.
 *
 * Ядро уже сводит каждый тик к малому числу «драматических позиций»
 * (physiologicalEvent × affect × control). Для самых формульных из них —
 * оргазм, нервный срыв, сенсорная перегрузка, истощение — модель всё равно
 * выдаёт усреднённый, повторяющийся текст. Здесь эти случаи озвучиваются
 * заготовками с вариациями, а LLM остаётся для ходов, где нужен конкретный
 * смысл (ответ на вопрос, торг, вызов, наблюдатель).
 *
 * Ключ матрицы — свёрнутый frame, а не сырые action×state: это сотни ячеек,
 * а не миллионы комбинаций.
 */

type Gender = 'female' | 'male' | 'other';

type FixedReplyKey = {
    /** discharge=оргазм, breakdown=срыв, overload=перегрузка, peak/edge=у грани, minimal=истощение */
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
    ],
    'discharge:positive:male': [
        'Ах… не могу… не могу больше…',
        'Сейчас… я… ах!',
        'Не останавливайся…',
        'Я… я сейчас…',
        'Да… ещё…',
    ],
    'discharge:mixed:female': [
        'Ах… что ты делаешь… не могу…',
        'Я… я не должна… но… ах!',
        'Сейчас… нет… да…',
        'Не могу… и не хочу, чтобы это кончалось…',
    ],
    'discharge:mixed:male': [
        'Ах… что ты делаешь… не могу…',
        'Я… я не должен… но… ах!',
        'Сейчас… нет… да…',
    ],

    // ── Нервный срыв (breakdown) ─────────────────────────────────────────
    'breakdown:negative:female': [
        'Хватит… пожалуйста, хватит…',
        'Я больше не выдержу…',
        'Не надо… прошу…',
        'Остановись… я не могу…',
        'Пожалуйста… перестань…',
    ],
    'breakdown:negative:male': [
        'Хватит… пожалуйста, хватит…',
        'Я больше не выдержу…',
        'Не надо… прошу…',
        'Остановись… я не могу…',
    ],
    'breakdown:mixed:female': [
        'Я не понимаю… почему так…',
        'Хватит… я не могу больше…',
        'Пожалуйста… я не выдерживаю…',
    ],
    'breakdown:mixed:male': [
        'Я не понимаю… почему так…',
        'Хватит… я не могу больше…',
    ],

    // ── Сенсорная перегрузка (overload) ──────────────────────────────────
    'overload:overload:female': [
        'Слишком… слишком много…',
        'Я не понимаю… всё смешалось…',
        'Подожди… я не могу собраться…',
        'Всё… сразу… не могу…',
    ],
    'overload:overload:male': [
        'Слишком… слишком много…',
        'Я не понимаю… всё смешалось…',
        'Подожди… я не могу собраться…',
    ],
    'overload:mixed:female': [
        'Не могу понять… приятно или нет…',
        'Всё смешалось… я теряюсь…',
        'Слишком… и не могу остановить…',
    ],
    'overload:mixed:male': [
        'Не могу понять… приятно или нет…',
        'Всё смешалось… я теряюсь…',
    ],

    // ── У самой грани (peak / edge) ──────────────────────────────────────
    'peak:positive:female': [
        'Ещё… ещё немного…',
        'Не останавливайся…',
        'Я на грани…',
        'Почти… почти…',
    ],
    'peak:positive:male': [
        'Ещё… ещё немного…',
        'Не останавливайся…',
        'Я на грани…',
    ],
    'peak:negative:female': [
        'Не надо… я на пределе…',
        'Остановись… я не выдержу…',
        'Пожалуйста… не сейчас…',
    ],
    'peak:negative:male': [
        'Не надо… я на пределе…',
        'Остановись… я не выдержу…',
    ],
    'edge:positive:female': [
        'Ещё… не отпускай…',
        'Я так близко…',
        'Не останавливайся…',
    ],
    'edge:positive:male': [
        'Ещё… не отпускай…',
        'Я так близко…',
    ],
    'edge:negative:female': [
        'Хватит… я на пределе…',
        'Не могу больше…',
        'Остановись…',
    ],
    'edge:negative:male': [
        'Хватит… я на пределе…',
        'Не могу больше…',
    ],
    'edge:mixed:female': [
        'Я не знаю… хочу и не хочу…',
        'Так близко… и так страшно…',
    ],
    'edge:mixed:male': [
        'Я не знаю… хочу и не хочу…',
        'Так близко… и так страшно…',
    ],

    // ── Истощение (minimal control, без острого события) ─────────────────
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

function matrixKey(key: FixedReplyKey): string {
    return `${key.event}:${key.affect}:${key.gender}`;
}

/** Сводит affect frame к одному из четырёх ключей матрицы. */
function affectKey(frame: ReactionFrame): FixedReplyKey['affect'] {
    const affect = frame.expressionMode.affect;
    if (affect === 'overload') return 'overload';
    if (affect === 'mixed') return 'mixed';
    if (affect === 'negative') return 'negative';
    return 'positive';
}

/** Сводит physiologicalEvent к ключу матрицы. */
function eventKey(frame: ReactionFrame): FixedReplyKey['event'] {
    const phys = frame.event.physiologicalEvent;
    if (phys === 'discharge') return 'discharge';
    if (phys === 'breakdown') return 'breakdown';
    if (phys === 'overload') return 'overload';
    if (phys === 'peak') return 'peak';
    if (phys === 'edge') return 'edge';
    return 'minimal';
}

/**
 * Детерминированный гейт: когда ответ типовой (фиксированная реплика),
 * а когда требует генерации (LLM).
 *
 * Фиксированная реплика — для самых формульных и самых повторяющихся у модели
 * состояний: оргазм, срыв, перегрузка, истощение, удержание у грани при
 * сломанном контроле. Всё остальное (ответ на вопрос, торг, вызов, наблюдатель,
 * обычный разговор) остаётся за LLM.
 */
export function shouldUseFixedReply(frame: ReactionFrame): boolean {
    const phys = frame.event.physiologicalEvent;
    const control = frame.expressionMode.control;
    if (phys === 'discharge' || phys === 'breakdown' || phys === 'overload') return true;
    if (control === 'minimal') return true;
    if (control === 'fragmented' && (phys === 'peak' || phys === 'edge')) return true;
    return false;
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
    const key: FixedReplyKey = {
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
