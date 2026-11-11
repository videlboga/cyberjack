import { randomUUID } from 'crypto';
import { db } from '../infrastructure/db';
import type { EgoState, LifePosition, SocialNeed, SpeechSemantics } from './socialTransactions';

/**
 * Transactional Analysis Games — a vertical slice of Berne's game-play.
 *
 * A Game is a fixed, ulterior (hidden-motive) sequence of transactions played
 * for a payoff (a "racket feeling" — a substitute emotion). It has:
 * - a THESIS (opening move)
 * - a sequence of MOVES (ulterior transactions)
 * - a SWITCH (role reversal, e.g. Victim → Persecutor)
 * - a PAYOFF (the collected racket feeling)
 *
 * Games are initiated when a character is game-prone (stroke-hungry + in a
 * racket state) AND the situation matches the game's thesis. The partner can
 * co-play (accepting the ulterior level) or break the game with an ANTITHESIS
 * (a crossed transaction that refuses the hidden level).
 *
 * This module is the lifecycle engine; the catalog lives in `GAME_CATALOG`.
 */

export type GameId =
    | 'nigsyb'                    // "Now I've Got You, Son of a Bitch" — trap, righteous anger
    | 'why_dont_you_yes_but'     // reject every suggestion, collect hopelessness
    | 'kick_me'                  // provoke punishment, collect "everyone hits me"
    | 'if_it_werent_for_you'     // blame the partner for one's own choice
    | 'wooden_leg'               // "what can you expect from someone with a wooden leg"
    | 'im_only_trying_to_help'   // rescuer → persecutor on refusal
    | 'aint_it_awful'            // mutual complaint, shared suffering
    | 'rapo';                    // seduction → accusation

export type GamePhase = 'thesis' | 'moves' | 'switch' | 'payoff' | 'resolved';
export type GameRole = 'persecutor' | 'victim' | 'rescuer' | 'bystander';

export interface GameDefinition {
    id: GameId;
    label: string;
    thesis: string;          // opening context the game requires
    /** Natural inner drive the player feels — the character does NOT know this
     *  is a Game, only that they are moved by this impulse. Games are
     *  unconscious (Berne); naming the pattern would break it. */
    drive: string;
    moves: number;           // how many ulterior moves before switch/payoff
    roles: { player: GameRole; partner: GameRole };
    payoff: string;          // the racket feeling collected
    /** Ego-states the player must be in to initiate. */
    initiatorEgos: EgoState[];
}

export const GAME_CATALOG: Record<GameId, GameDefinition> = {
    nigsyb: {
        id: 'nigsyb',
        label: 'Вот я тебя и поймал',
        thesis: 'Дам тебе шанс провалиться, чтобы потом обвинить. Ты делаешь ошибку — я ловлю тебя и гневаюсь.',
        drive: 'Мне кажется, что она что-то скрывает или лукавит. Я хочу дать ей шанс показать себя и поймать на неправде, чтобы восстановить справедливость.',
        moves: 2,
        roles: { player: 'persecutor', partner: 'victim' },
        payoff: 'праведный гнев',
        initiatorEgos: ['critical_parent'],
    },
    why_dont_you_yes_but: {
        id: 'why_dont_you_yes_but',
        label: 'Почему бы тебе не… — Да, но…',
        thesis: 'Прошу помощи, но отвергаю каждый совет. Я остаюсь в тупике и собираю безнадёжность.',
        drive: 'Я в тупике и хочу, чтобы кто-то понял, как мне тяжело. Но никакой совет не поможет — я всё равно останусь в этом состоянии.',
        moves: 3,
        roles: { player: 'victim', partner: 'rescuer' },
        payoff: 'безнадёжность',
        initiatorEgos: ['adapted_child', 'free_child'],
    },
    kick_me: {
        id: 'kick_me',
        label: 'Ударь меня',
        thesis: 'Провоцирую наказание, чтобы потом сказать «меня всегда бьют».',
        drive: 'Мне хочется испытать её границы, подтолкнуть к резкому ответу. Так я почувствую, что меня замечают, даже если это будет больно.',
        moves: 2,
        roles: { player: 'victim', partner: 'persecutor' },
        payoff: '«меня всегда бьют»',
        initiatorEgos: ['adapted_child', 'free_child'],
    },
    if_it_werent_for_you: {
        id: 'if_it_werent_for_you',
        label: 'Если бы не ты',
        thesis: 'Обвиняю партнёра в том, что мой собственный выбор привёл меня сюда.',
        drive: 'Мне обидно, что именно из-за неё я оказался здесь. Хочу дать ей понять, что это её вина.',
        moves: 2,
        roles: { player: 'victim', partner: 'persecutor' },
        payoff: 'обида',
        initiatorEgos: ['adapted_child', 'rebellious_child'],
    },
    wooden_leg: {
        id: 'wooden_leg',
        label: 'Деревянная нога',
        thesis: 'Ссылаюсь на свой изъян как на оправдание, чтобы собрать жалость и снять ответственность.',
        drive: 'Мне хочется напомнить ей, как трудно мне из-за моей слабости, чтобы она не требовала от меня большего, чем я могу.',
        moves: 2,
        roles: { player: 'victim', partner: 'rescuer' },
        payoff: 'жалость',
        initiatorEgos: ['adapted_child'],
    },
    im_only_trying_to_help: {
        id: 'im_only_trying_to_help',
        label: 'Я только пытаюсь помочь',
        thesis: 'Навязываю помощь, а при отказе превращаюсь в обвинителя: «меня не ценят».',
        drive: 'Я искренне хочу ей помочь. Но если она отвергнет мою заботу — меня это ранит, и я почувствую себя неоценённой.',
        moves: 2,
        roles: { player: 'rescuer', partner: 'victim' },
        payoff: '«меня не ценят»',
        initiatorEgos: ['nurturing_parent', 'critical_parent'],
    },
    aint_it_awful: {
        id: 'aint_it_awful',
        label: 'Ах, как это ужасно',
        thesis: 'Совместная жалоба на общую беду, чтобы разделить страдание.',
        drive: 'Мне хочется пожаловаться ей на то, как здесь тяжело, чтобы почувствовать, что мы в этом не одиноки.',
        moves: 3,
        roles: { player: 'victim', partner: 'victim' },
        payoff: 'общее страдание',
        initiatorEgos: ['adapted_child', 'free_child', 'rebellious_child'],
    },
    rapo: {
        id: 'rapo',
        label: 'Рапо',
        thesis: 'Соблазнение, за которым следует обвинение.',
        drive: 'Меня к ней тянет, но я боюсь разочарования. Я хочу её притянуть, а если она ответит — обвинить, что это она меня спровоцировала.',
        moves: 2,
        roles: { player: 'victim', partner: 'persecutor' },
        payoff: 'гнев',
        initiatorEgos: ['rebellious_child', 'free_child'],
    },
};

export interface GameStateRow {
    id: string;
    game_type: GameId;
    phase: GamePhase;
    player_id: string;
    partner_id: string;
    player_role: GameRole;
    partner_role: GameRole;
    moves_played: number;
    max_moves: number;
    racket: string;
    status: string;
    payload: string;
}

export function getActiveGame(playerId: string, partnerId: string): GameStateRow | null {
    const row = db.prepare(
        `SELECT * FROM transactional_games WHERE player_id=? AND partner_id=? AND status='active' ORDER BY updated_world_minute DESC LIMIT 1`,
    ).get(playerId, partnerId) as GameStateRow | undefined;
    return row || null;
}

/** Candidate games that match the player's initiator ego-state. */
export function eligibleGames(egoState: EgoState): GameDefinition[] {
    return Object.values(GAME_CATALOG).filter(game => game.initiatorEgos.includes(egoState));
}

/**
 * Start a game. Returns the created game or null if one is already active.
 * The partner may be the game's victim/rescuer role.
 */
export function startGame(
    playerId: string,
    partnerId: string,
    gameType: GameId,
    worldMinute: number,
    thesisTurnId?: string,
): GameStateRow | null {
    if (getActiveGame(playerId, partnerId)) return null;
    const def = GAME_CATALOG[gameType];
    if (!def) return null;
    const id = randomUUID();
    db.prepare(`
        INSERT INTO transactional_games
        (id, game_type, phase, player_id, partner_id, player_role, partner_role, moves_played, max_moves, racket, thesis_turn_id, status, created_world_minute, updated_world_minute)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, gameType, 'thesis', playerId, partnerId, def.roles.player, def.roles.partner, 0, def.moves, def.payoff, thesisTurnId ?? null, 'active', worldMinute, worldMinute);
    return getActiveGame(playerId, partnerId);
}

/** Advance a game by one move. Returns the new phase. */
export function advanceGame(id: string, worldMinute: number): GamePhase {
    const game = db.prepare('SELECT * FROM transactional_games WHERE id=?').get(id) as GameStateRow | undefined;
    if (!game || game.status !== 'active') return game?.phase || 'resolved';
    const def = GAME_CATALOG[game.game_type];
    const nextMoves = game.moves_played + 1;
    let nextPhase: GamePhase = 'moves';
    if (nextMoves >= def.moves) nextPhase = 'switch';
    db.prepare(`
        UPDATE transactional_games SET moves_played=?, phase=?, updated_world_minute=? WHERE id=?
    `).run(nextMoves, nextPhase, worldMinute, id);
    return nextPhase;
}

/** Complete the switch: the player flips to their switch role and collects payoff. */
export function resolveGamePayoff(id: string, worldMinute: number): void {
    const game = db.prepare('SELECT * FROM transactional_games WHERE id=?').get(id) as GameStateRow | undefined;
    if (!game) return;
    db.prepare(`
        UPDATE transactional_games SET phase='payoff', status='resolved', updated_world_minute=? WHERE id=?
    `).run(worldMinute, id);
}

/**
 * Whether a spoken transaction is an ANTITHESIS that breaks the partner's game.
 * A crossed transaction that refuses the ulterior level breaks the game.
 */
export function isAntithesis(semantics: SpeechSemantics): boolean {
    return semantics.transaction === 'crossed';
}

/** The racket feeling collected by the player of a game. */
export function racketOf(game: GameStateRow): string {
    return game.racket || GAME_CATALOG[game.game_type]?.payoff || '';
}

/** Whether the player is currently in a racket state (game-prone). */


// ---------------------------------------------------------------------------
// Game selection weighting
// ---------------------------------------------------------------------------

/** Per-need affinity: which racket payoff a need tends to collect. */
const NEED_GAME_WEIGHT: Partial<Record<SocialNeed, Partial<Record<GameId, number>>>> = {
    // Approval hunger → games that secure recognition (even negative).
    approval: {
        kick_me: 1.5,               // provoke to be noticed
        why_dont_you_yes_but: 1.0,  // be the centre of help
        if_it_werent_for_you: 1.0,  // be the injured party
    },
    // Autonomy → games that assert control or defy.
    autonomy: {
        nigsyb: 1.5,                // trap the other, be the judge
        rapo: 1.2,                  // control the script, then accuse
        im_only_trying_to_help: 1.2,
    },
    // Safety → games that secure care or deflect blame.
    safety: {
        wooden_leg: 1.5,            // invoke one's weakness for protection
        if_it_werent_for_you: 1.2,  // shift responsibility away
        why_dont_you_yes_but: 1.0,
    },
    // Connection → shared suffering / mutual complaint.
    connection: {
        aint_it_awful: 1.8,
        why_dont_you_yes_but: 1.0,
    },
    // Clarity → games that establish who is right / in charge.
    clarity: {
        nigsyb: 1.5,                // prove the other is at fault
        im_only_trying_to_help: 1.0,
    },
};

/**
 * Score how naturally a game fits the player's CURRENT script signal:
 * life position, dominant need, and the situation (topic / relationship).
 * Higher = more likely the character picks that game.
 *
 * This replaces the flat "first eligible game" with a profile-driven choice:
 * the game a character plays is itself part of their script.
 */
export function scoreGame(
    game: GameDefinition,
    egoState: EgoState,
    need: SocialNeed,
    lifePosition: LifePosition,
    topic: string,
): number {
    let score = 0;

    // Ego-state fit: games whose initiator ego matches get a base bonus.
    if (game.initiatorEgos.includes(egoState)) score += 1.0;

    // Need affinity: a hungry-for-approval character gravitates toward the
    // games that secure recognition.
    score += (NEED_GAME_WEIGHT[need]?.[game.id] ?? 0) * 2.0;

    // Life position shapes the direction of the play.
    if (lifePosition === 'not_ok_ok') {
        // "I'm not OK" → victim/rescuer roles (self-blame or plea for help).
        if (game.roles.player === 'victim') score += 0.8;
    } else if (lifePosition === 'ok_not_ok') {
        // "You're not OK" → persecutor roles (blame the other).
        if (game.roles.player === 'persecutor') score += 0.8;
    } else if (lifePosition === 'not_ok_not_ok') {
        // Hopeless flip: any racket is acceptable.
        score += 0.4;
    }

    // Situation: a topic about boundaries invites persecutor/defiance games.
    if (topic === 'boundaries' && (game.roles.player === 'persecutor' || game.roles.player === 'rescuer')) score += 0.5;

    return score;
}

/**
 * Choose the game a character initiates from the eligible set, weighted by
 * script signal. Deterministic (no RNG) so it is testable; returns null if
 * nothing is eligible.
 */
export function chooseGame(
    egoState: EgoState,
    need: SocialNeed,
    lifePosition: LifePosition,
    topic: string,
): GameDefinition | null {
    const candidates = eligibleGames(egoState);
    if (!candidates.length) return null;
    let best: GameDefinition | null = null;
    let bestScore = -Infinity;
    for (const game of candidates) {
        const s = scoreGame(game, egoState, need, lifePosition, topic);
        if (s > bestScore) { best = game; bestScore = s; }
    }
    return best;
}

export function gameMotive(egoState: EgoState, strokeHunger: number): boolean {
    const racketEgos = new Set<EgoState>(['adapted_child', 'rebellious_child', 'free_child', 'critical_parent']);
    return racketEgos.has(egoState) && strokeHunger >= 0.5;
}
