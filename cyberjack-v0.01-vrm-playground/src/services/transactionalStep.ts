import type { EgoState, LifePosition, SocialNeed, SocialAct } from './socialTransactions';

/**
 * Детерминированный ТА-шаг хода.
 *
 * Ядро само решает СТРУКТУРУ транзакции (тип реакции по Берну, из какого
 * эго отвечать, глубину самораскрытия, направление дуги, сценарий-запрет).
 * LLM получает только готовый «образ-ситуацию» и формулирует слова — ей не
 * нужно интерпретировать ТА-логику, поэтому промпт можно сократить.
 */

export type TransactionReaction = 'complementary' | 'crossed' | 'ulterior';
export type DisclosureDepth = 'low' | 'medium' | 'open';
export type ArcDirection = 'continue' | 'deepen' | 'shift';

export interface IncomingSemantics {
    speechAct?: string;
    transaction?: string;          // complementary|crossed|ulterior
    boundary?: string;             // none|set|accepted|violated
    apparentEgoState?: string;     // из какого эго пришёл стимул
}

export interface TransactionalStepInput {
    myEgo: EgoState;
    incoming?: IncomingSemantics | null;  // если есть входящая реплика
    familiarity: number;                   // 0..1
    lifePosition: LifePosition;
    need: SocialNeed;
    stress: number;                        // 0..100 (tension)
    gameActive?: boolean;
    gameDrive?: string;
}

export interface TransactionalStep {
    reactionType: TransactionReaction;
    responseEgo: EgoState;
    disclosure: DisclosureDepth;
    arc: ArcDirection;
    scriptLimit: string;          // образ-ограничение из жизненной позиции
    racketImage?: string;         // образ рэкет-чувства, если игра
    image: string;                // готовый «образ-ситуация» для промпта
}

// --- Стимул → реакция (схема Берна) ---
function resolveReactionType(input: TransactionalStepInput): TransactionReaction {
    if (!input.incoming) return 'complementary';
    const t = input.incoming.transaction;
    // Уже перекрёстная входящая → мы отвечаем либо комплементарно (деэскалация),
    // либо тоже перекрёстно (эскалация) в зависимости от позиции.
    if (t === 'crossed') {
        // «Я не ок, ты не ок» и автономия → эскалация; безопасность → деэскалация.
        if (input.lifePosition === 'not_ok_not_ok') return 'crossed';
        if (input.lifePosition === 'ok_not_ok' && input.need === 'autonomy') return 'crossed';
        return 'complementary';
    }
    if (t === 'ulterior') {
        // Скрытая транзакция: мы распознаём или подыгрываем. Недоверие → перекрёст.
        if (input.need === 'safety') return 'crossed';
        return 'ulterior';
    }
    if (input.incoming.boundary === 'violated') return 'crossed';
    // Комплементарный стимул: отвечаем комплементарно, но под стрессом
    // ребёнок может пойти в перекрёст (рэкет).
    if (input.stress > 70 && (input.myEgo === 'rebellious_child' || input.myEgo === 'critical_parent')) {
        return 'crossed';
    }
    return 'complementary';
}

// --- Из какого эго отвечаем ---
function resolveResponseEgo(input: TransactionalStepInput): EgoState {
    const reaction = resolveReactionType(input);
    // STRESS_RESPONSE-логика: под угрозой Взрослый регрессирует к Родителю,
    // свободный ребёнок — к адаптированному/бунтарю.
    if (reaction === 'crossed') {
        if (input.myEgo === 'adult') return 'critical_parent';
        if (input.myEgo === 'free_child') return 'rebellious_child';
        if (input.myEgo === 'nurturing_parent') return 'critical_parent';
        return input.myEgo;
    }
    if (reaction === 'ulterior' && input.myEgo === 'adult') return 'rebellious_child';
    return input.myEgo;
}

// --- Глубина самораскрытия по знакомству + позиции ---
function resolveDisclosure(familiarity: number, lifePosition: LifePosition): DisclosureDepth {
    // «Не доверяй» (не-ок позиция) тормозит раскрытие.
    if (lifePosition === 'not_ok_ok' || lifePosition === 'not_ok_not_ok') {
        return familiarity < 0.3 ? 'low' : familiarity < 0.6 ? 'medium' : 'open';
    }
    return familiarity < 0.15 ? 'low' : familiarity < 0.45 ? 'medium' : 'open';
}

// --- Сценарий-запрет → образ-ограничение ---
const SCRIPT_LIMIT_IMAGE: Record<LifePosition, string> = {
    'ok_ok': 'ты не чувствуешь запрета держаться на расстоянии, но и не бросаешься раскрываться',
    'ok_not_ok': 'внутри сидит «не доверяй»: ты не подпускаешь её слишком близко и не веришь в бескорыстие',
    'not_ok_ok': 'ты привыкла, что тебя не слушают, и не ожидаешь, что тебя поймут; говоришь коротко',
    'not_ok_not_ok': 'тебе кажется, что любой разговор кончится плохо; ты держишь дистанцию и ждёшь подвоха',
};

// --- Образ рэкет-чувства по Игре ---
const RACKET_IMAGE: Record<string, string> = {
    'nigsyb': 'внутри поднимается глухое раздражение — она опять увиливает',
    'why_dont_you_yes_but': 'ты почти обижена: ты предлагаешь, а она снова «да, но»',
    'kick_me': 'ты ищешь повод, чтобы она тебя уколола — так привычнее',
    'if_it_werent_for_you': 'ты чувствуешь себя несправедливо задетой её словами',
    'wooden_leg': 'ты готова отмахнуться: «что с меня взять»',
    'im_only_trying_to_help': 'ты чуть снисходительна: она без тебя не справится',
    'ain\u0027t_it_awful': 'ты разделяешь общую беду — так легче',
    'rapo': 'ты слегка провоцируешь, чтобы потом упрекнуть',
};

// --- Образ-тон под эго реакции ---
const RESPONSE_IMAGE: Record<EgoState, string> = {
    critical_parent: 'Ты отвечаешь как человек, который знает, как надо, и не принимает возражений. Голос ровный, но наставляющий.',
    nurturing_parent: 'Ты отвечаешь тепло и заботливо, чуть оберегая её.',
    adult: 'Ты отвечаешь спокойно, по делу, без эмоций — как человек, который говорит на равных.',
    free_child: 'Ты отвечаешь легко и непосредственно, без напряжения.',
    adapted_child: 'Ты отвечаешь осторожно, стараясь не спорить и понравиться.',
    rebellious_child: 'Ты отвечаешь с лёгким вызовом: ты не подчиняешься и отстаиваешь себя.',
};

// --- Направление дуги: не топтаться на месте ---
function resolveArc(reactionType: TransactionReaction, incoming?: IncomingSemantics | null): ArcDirection {
    if (!incoming) return 'continue';
    if (reactionType === 'crossed') return 'shift';      // конфликт → смена направления
    if (incoming.speechAct === 'self_disclosure' || incoming.speechAct === 'question') return 'deepen';
    return 'continue';
}

export function computeTransactionalStep(input: TransactionalStepInput): TransactionalStep {
    const reactionType = resolveReactionType(input);
    const responseEgo = resolveResponseEgo(input);
    const disclosure = resolveDisclosure(input.familiarity, input.lifePosition);
    const arc = resolveArc(reactionType, input.incoming);
    const scriptLimit = SCRIPT_LIMIT_IMAGE[input.lifePosition];
    const racketImage = input.gameActive && input.gameDrive ? RACKET_IMAGE[input.gameDrive] : undefined;

    // Образ-ситуация: конкретно, без ТА-терминов.
    const disclosureImage = disclosure === 'low'
        ? 'Ты не раскрываешь о себе ничего лишнего.'
        : disclosure === 'medium'
            ? 'Ты можешь слегка приоткрыться, но осторожно.'
            : 'Ты готова говорить о себе открыто.';
    const arcImage = arc === 'shift'
        ? 'Разговор пошёл не туда — ты мягко уводишь его в сторону.'
        : arc === 'deepen'
            ? 'Она открывается — можно чуть углубить.'
            : 'Ты продолжаешь нить разговора, не повторяя уже сказанное.';

    const image = [
        RESPONSE_IMAGE[responseEgo],
        scriptLimit + '.',
        disclosureImage,
        racketImage ? racketImage + '.' : undefined,
        arcImage,
    ].filter(Boolean).join(' ');

    return {
        reactionType,
        responseEgo,
        disclosure,
        arc,
        scriptLimit,
        racketImage,
        image,
    };
}
