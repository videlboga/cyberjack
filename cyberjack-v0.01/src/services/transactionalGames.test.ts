import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../infrastructure/db';
import {
    GAME_CATALOG,
    eligibleGames,
    scoreGame,
    chooseGame,
    startGame,
    getActiveGame,
    advanceGame,
    resolveGamePayoff,
    isAntithesis,
    racketOf,
    gameMotive,
} from './transactionalGames';
import type { SpeechSemantics } from './socialTransactions';

const semantics = (over: Partial<SpeechSemantics> = {}): SpeechSemantics => ({
    speechAct: 'answer',
    apparentEgoState: 'adult',
    transaction: 'complementary',
    boundary: 'none',
    invitation: 'none',
    openLoop: 'none',
    conversationDisposition: 'continue',
    confidence: 0.8,
    ...over,
});

beforeEach(() => {
    db.prepare('DELETE FROM transactional_games').run();
});

describe('game catalog', () => {
    it('covers the canonical Berne games relevant to the setting', () => {
        const ids: Array<keyof typeof GAME_CATALOG> = ['nigsyb', 'why_dont_you_yes_but', 'kick_me', 'if_it_werent_for_you', 'wooden_leg', 'im_only_trying_to_help', 'aint_it_awful', 'rapo'];
        for (const id of ids) {
            expect(GAME_CATALOG[id]).toBeDefined();
        }
    });

    it('maps each game to a racket payoff and roles', () => {
        expect(GAME_CATALOG.kick_me.payoff).toBe('«меня всегда бьют»');
        expect(GAME_CATALOG.kick_me.roles.player).toBe('victim');
        expect(GAME_CATALOG.nigsyb.roles.player).toBe('persecutor');
    });

    it('filters games by initiator ego-state', () => {
        const persecutorGames = eligibleGames('critical_parent').map(g => g.id);
        expect(persecutorGames).toContain('nigsyb');
        expect(persecutorGames).toContain('im_only_trying_to_help');
        // A critical_parent does not play victim games.
        expect(persecutorGames).not.toContain('kick_me');
        expect(persecutorGames).not.toContain('why_dont_you_yes_but');
    });

    it('lets an adapted_child play victim games', () => {
        const victimGames = eligibleGames('adapted_child').map(g => g.id);
        expect(victimGames).toContain('kick_me');
        expect(victimGames).toContain('why_dont_you_yes_but');
        expect(victimGames).toContain('if_it_werent_for_you');
        expect(victimGames).toContain('wooden_leg');
    });
});

describe('game lifecycle', () => {
    it('starts a game and returns the active row', () => {
        const game = startGame('A', 'B', 'kick_me', 100);
        expect(game).not.toBeNull();
        expect(game!.phase).toBe('thesis');
        expect(game!.player_role).toBe('victim');
        expect(game!.status).toBe('active');
        expect(getActiveGame('A', 'B')!.game_type).toBe('kick_me');
    });

    it('does not start a second game while one is active', () => {
        startGame('A', 'B', 'kick_me', 100);
        const second = startGame('A', 'B', 'nigsyb', 100);
        expect(second).toBeNull();
    });

    it('advances through moves and reaches the switch', () => {
        const game = startGame('A', 'B', 'kick_me', 100)!;
        // kick_me has 2 moves, so after 2 advances it reaches switch.
        expect(advanceGame(game.id, 101)).toBe('moves');
        expect(advanceGame(game.id, 102)).toBe('switch');
    });

    it('resolves the payoff and marks the game resolved', () => {
        const game = startGame('A', 'B', 'kick_me', 100)!;
        advanceGame(game.id, 101);
        advanceGame(game.id, 102);
        resolveGamePayoff(game.id, 103);
        const row = getActiveGame('A', 'B');
        expect(row).toBeNull();
        const resolved = db.prepare('SELECT phase, status FROM transactional_games WHERE id=?').get(game.id) as any;
        expect(resolved.status).toBe('resolved');
    });

    it('returns the racket feeling of a game', () => {
        const game = startGame('A', 'B', 'why_dont_you_yes_but', 100)!;
        expect(racketOf(game)).toBe('безнадёжность');
    });
});

describe('antithesis', () => {
    it('a crossed transaction breaks a game', () => {
        expect(isAntithesis(semantics({ transaction: 'crossed' }))).toBe(true);
    });

    it('a complementary transaction does not break a game', () => {
        expect(isAntithesis(semantics({ transaction: 'complementary' }))).toBe(false);
    });
});

describe('game motive', () => {
    it('requires a racket ego-state and stroke hunger', () => {
        expect(gameMotive('adapted_child', 0.8)).toBe(true);
        expect(gameMotive('critical_parent', 0.8)).toBe(true);
        expect(gameMotive('adult', 0.8)).toBe(false);
        expect(gameMotive('adapted_child', 0.2)).toBe(false);
    });
});


describe('game selection weighting', () => {
    it('an approval-hungry victim chooses a recognition game, not a control game', () => {
        const chosen = chooseGame('adapted_child', 'approval', 'not_ok_ok', 'shared_cell');
        expect(chosen).not.toBeNull();
        // Approval need strongly favours kick_me / why_dont_you_yes_but over nigsyb.
        expect(chosen!.roles.player).toBe('victim');
        expect(chosen!.id).not.toBe('nigsyb');
        // Kick Me tops approval-seeking victim games.
        expect(chosen!.id).toBe('kick_me');
    });

    it('an autonomy-driven critical_parent chooses a control game', () => {
        const chosen = chooseGame('critical_parent', 'autonomy', 'ok_not_ok', 'boundaries');
        expect(chosen).not.toBeNull();
        expect(chosen!.roles.player).toBe('persecutor');
        expect(chosen!.id).toBe('nigsyb');
    });

    it('a connection-needing free_child prefers aint_it_awful', () => {
        const chosen = chooseGame('free_child', 'connection', 'not_ok_not_ok', 'shared_room');
        expect(chosen).not.toBeNull();
        expect(chosen!.id).toBe('aint_it_awful');
    });

    it('a safety-seeking adapted_child prefers wooden_leg', () => {
        const chosen = chooseGame('adapted_child', 'safety', 'not_ok_ok', 'shared_cell');
        expect(chosen).not.toBeNull();
        expect(chosen!.id).toBe('wooden_leg');
    });

    it('scores higher for a matching need', () => {
        const kickMe = GAME_CATALOG.kick_me;
        const nigsyb = GAME_CATALOG.nigsyb;
        const approvalScore = scoreGame(kickMe, 'adapted_child', 'approval', 'not_ok_ok', 'shared_cell');
        const nonMatching = scoreGame(nigsyb, 'adapted_child', 'approval', 'not_ok_ok', 'shared_cell');
        expect(approvalScore).toBeGreaterThan(nonMatching);
    });

    it('returns null when no game matches the ego-state', () => {
        expect(chooseGame('adult', 'clarity', 'ok_ok', 'shared_cell')).toBeNull();
    });
});


describe('game drives stay unconscious', () => {
    it('every game defines a natural inner drive', () => {
        for (const game of Object.values(GAME_CATALOG)) {
            expect(game.drive).toBeTruthy();
            expect(game.drive.length).toBeGreaterThan(20);
        }
    });

    it('no drive names the game or its payoff as a "game"', () => {
        // The character feels the impulse; they never know they are in a Game.
        for (const game of Object.values(GAME_CATALOG)) {
            const drive = game.drive.toLowerCase();
            expect(drive).not.toContain('игр');
            expect(drive).not.toContain('kick me');
            expect(drive).not.toContain('nigsyb');
        }
    });

    it('drives are felt from the first person, not analytically', () => {
        for (const game of Object.values(GAME_CATALOG)) {
            expect(game.drive).toMatch(/мне|я /);
        }
    });
});
