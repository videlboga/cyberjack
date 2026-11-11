import type {
    EgoState,
    SocialAct,
    SocialNeed,
    LifePosition,
    SocialObservation,
} from './socialTransactions';

/**
 * ТА-мотивация проактивного социального хода.
 *
 * Персонаж начинает разговор не случайно, а потому что его ведёт сценарий
 * жизни и потребность. Мотив (encounter/deepen/game/stroke_need) определяет:
 *  - почему персонаж вообще обращается к другому,
 *  - о чём он говорит (тема + личный крючок),
 *  - какой социальный акт выбирает.
 *
 * Игра (по Берну) остаётся бессознательной: мотив `game` не называет Игру,
 * а рендерит естественное влечение (drive).
 */

export type SocialMotivation = 'encounter' | 'deepen' | 'game' | 'stroke_need';

export interface MotivationInput {
    familiarity: number;            // 0..1, из отношения
    strokeBalance: number;          // экономика поглаживаний (отрицательный = голод)
    need: SocialNeed;
    lifePosition: LifePosition;
    egoState: EgoState;
    /** Активная или только что инициированная Игра (gameId) — сигнал к мотиву game. */
    activeGameId?: string | null;
    /** Первая встреча в комнате. */
    firstEncounter?: boolean;
}

/**
 * Выбирает ТА-мотив проактивного хода по состоянию персонажа.
 * Приоритет: игра > голод поглаживаний > знакомство > углубление.
 */
export function deriveSocialMotivation(input: MotivationInput): SocialMotivation {
    // 1. Активная Игра (по сценарию) — приоритет: персонаж ведёт Игру.
    if (input.activeGameId) return 'game';

    // 2. Сильный голод поглаживаний: человек ищет признание/одобрение/внимание.
    const strokeHungry = input.strokeBalance < -8;
    if (strokeHungry && (input.need === 'approval' || input.need === 'connection')) {
        return 'stroke_need';
    }

    // 3. Первая встреча — знакомство, первая транзакция.
    if (input.firstEncounter || input.familiarity < 0.12) return 'encounter';

    // 4. Иначе — углубление связи (перебор транзакций до комплиментарных).
    return 'deepen';
}

/**
 * Готовый текст-обоснование для промпта: почему персонаж заговорил и о чём.
 * Сжато (2-3 строки), это ориентир, а не текст для цитирования.
 */
export function motivationContext(
    motivation: SocialMotivation,
    input: {
        speakerName: string;
        recipientName: string;
        need: SocialNeed;
        egoState: EgoState;
        lifePosition: LifePosition;
        hook?: string;               // conversationHook / личный крючок
        observation?: SocialObservation | null;
    },
): string {
    const needText = needPhrase(input.need);
    const tone = egoTone(input.egoState);

    switch (motivation) {
        case 'encounter':
            return [
                `Ты только знакомишься с ${input.recipientName} и хочешь осторожно узнать её получше.`,
                `${needText} Ты обращаешься к ней, чтобы установить первый контакт.`,
                input.hook ? `Тебе легче говорить о: ${input.hook}.` : '',
                tone,
            ].filter(Boolean).join(' ');

        case 'deepen':
            return [
                `Вы уже знакомы, и ты хочешь углубить связь с ${input.recipientName}.`,
                `${needText} Ты осторожно делишься личным или наблюдениями, проверяя, насколько можно доверять.`,
                input.hook ? `Тебя тянет поговорить о: ${input.hook}.` : '',
                tone,
            ].filter(Boolean).join(' ');

        case 'stroke_need':
            return [
                `Тебе сейчас важно, чтобы тебя заметили. Ты обращаешься к ${input.recipientName}, чтобы получить внимание и признание.`,
                `${needText} Ты ищешь отклик, но не выпрашиваешь его прямо.`,
                input.hook ? `Ты тянешься к теме: ${input.hook}.` : '',
                tone,
            ].filter(Boolean).join(' ');

        case 'game':
            // Игра бессознательна: показываем только естественное влечение,
            // не называя саму Игру. Дополнительный drive добавляется в стимуле.
            return [
                `Тебя необъяснимо тянет к ${input.recipientName} — внутри поднимается сильное чувство, которое ты не можешь до конца объяснить.`,
                `${needText} Ты реагируешь на это влечение, не называя его причину.`,
                tone,
            ].filter(Boolean).join(' ');

        default:
            return `${needText} Ты обращаешься к ${input.recipientName}, чтобы поговорить.`;
    }
}

/** Предпочтительный социальный акт по мотиву (Игра — приоритетна вне этой таблицы). */
export function motivationPreferredAct(motivation: SocialMotivation, egoState: EgoState): SocialAct {
    switch (motivation) {
        case 'encounter':
            return 'introduce';
        case 'deepen':
            return egoState === 'critical_parent' || egoState === 'rebellious_child' ? 'ask_boundary' : 'check_in';
        case 'stroke_need':
            return 'check_in';
        case 'game':
            return egoState === 'critical_parent' || egoState === 'rebellious_child' ? 'ask_boundary' : 'offer_support';
        default:
            return 'check_in';
    }
}

function needPhrase(need: SocialNeed): string {
    switch (need) {
        case 'safety': return 'Тебе важно чувствовать себя в безопасности.';
        case 'clarity': return 'Тебе важно понимать, что происходит вокруг.';
        case 'approval': return 'Тебе важно, чтобы тебя одобряли и принимали.';
        case 'autonomy': return 'Тебе важно сохранять независимость и контроль.';
        case 'connection': return 'Тебе важно чувствовать близость и связь с кем-то.';
        default: return '';
    }
}

function egoTone(egoState: EgoState): string {
    switch (egoState) {
        case 'critical_parent': return 'Ты говоришь требовательно, оценивая и направляя.';
        case 'nurturing_parent': return 'Ты говоришь тёпло, заботливо, оберегающе.';
        case 'adult': return 'Ты говоришь спокойно, фактологично, по делу.';
        case 'free_child': return 'Ты говоришь живо, спонтанно, легко.';
        case 'adapted_child': return 'Ты говоришь осторожно, мягко, ищешь одобрения.';
        case 'rebellious_child': return 'Ты говоришь дерзко, независимо, с вызовом.';
        default: return '';
    }
}
