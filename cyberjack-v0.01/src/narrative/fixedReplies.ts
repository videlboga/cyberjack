import type { ReactionFrame } from './reactionFrame';

/**
 * Матрица фиксированных реплик для истощения (control = minimal).
 *
 * Единственный случай, где персонаж физически не может выдать сложный ответ
 * с отсылками на отношения, историю или предыдущие действия — это истощение
 * (control = minimal): почти без речи, только короткие выкрики. Всё остальное —
 * включая оргазм, срыв, перегрузку при fragmented — генерится LLM, потому что
 * там персонаж ещё может говорить и выдать осмысленную, личную реплику.
 *
 * Социальные акты (граница/торг/вызов/предупреждение) всегда генерируются:
 * они по определению про отношения и конкретный смысл, который заготовка
 * не передаст.
 */

type Gender = 'female' | 'male' | 'other';

const MATRIX: Record<string, string[]> = {
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

function affectKey(frame: ReactionFrame): 'negative' | 'overload' {
    const affect = frame.expressionMode.affect;
    if (affect === 'overload' || affect === 'mixed') return 'overload';
    return 'negative';
}

/**
 * Детерминированный гейт: фиксируем только истощение (control = minimal),
 * где персонаж реально не может выдать сложный ответ. Всё остальное — LLM.
 */
export function shouldUseFixedReply(frame: ReactionFrame): boolean {
    return frame.expressionMode.control === 'minimal';
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
    if (frame.expressionMode.control !== 'minimal') return null;
    const gender = frame.speaker.gender || 'other';
    const variants = MATRIX[`minimal:${affectKey(frame)}:${gender}`];
    if (!variants || variants.length === 0) return null;

    const speakerId = frame.speaker.id;
    const seed = hashString(`${speakerId}:${frame.event.repetition ?? 1}:minimal`);
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
