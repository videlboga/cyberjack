import { db } from '../infrastructure/db';
import type { EgoState, LifePosition, SocialNeed, SpeechSemantics } from '../services/socialTransactions';

/**
 * Transactional Analysis (Eric Berne) strategy layer for cyberjack.
 *
 * Two foundations that the later game-play (transactional plans, Games) build on:
 *
 * 1. STROKE ECONOMY — every social transaction exchanges strokes (units of
 *    recognition). Positive strokes (warmth, praise, support) and negative
 *    strokes (criticism, punishment, refusal) BOTH fill the balance, because
 *    "any stroke is better than none". A deficit ("stroke hunger") drives a
 *    character to initiate more transactions and to accept negative ones.
 *
 * 2. DYNAMIC EGO STATE — the current ego-state is not a fixed profile field.
 *    It is DERIVED from the character's live state (tension, capacity, trust,
 *    safety) plus the ego-state the LLM actually observed in the last exchange
 *    (`apparentEgoState`). A stressed character regresses toward child states;
 *    a safe, resourced one holds adult. This makes ego a behavior driver that
 *    evolves, not a static tag.
 *
 * This module is deliberately pure where possible (stroke valuation, ego
 * derivation) so it is unit-testable without a live LLM.
 */

export const STROKE_NEUTRAL = 0;
export const STROKE_POSITIVE = 1;
export const STROKE_NEGATIVE = -1;

/** How much a single transaction is worth in strokes, from its semantics. */
export function strokeValue(semantics: SpeechSemantics): number {
    let value = 0;
    // Complementary transactions exchange recognition; crossed/ulterior are
    // negative strokes (they still count — the character is being noticed).
    if (semantics.transaction === 'complementary') value += 1;
    else if (semantics.transaction === 'crossed') value -= 1;
    else if (semantics.transaction === 'ulterior') value -= 0.5;

    // Speech acts carry their own stroke sign.
    switch (semantics.speechAct) {
        case 'support':
        case 'self_disclosure':
            value += 1;
            break;
        case 'refusal':
            value -= 1;
            break;
        case 'provocation':
            value -= 1;
            break;
        case 'boundary':
            value -= 0.5;
            break;
        default:
            break;
    }

    // A violated boundary is a strong negative stroke.
    if (semantics.boundary === 'violated') value -= 1;

    return value;
}

export interface StrokeState {
    /** Running stroke balance for the pair (positive = surplus, negative = deficit). */
    balance: number;
}

export function readStrokeState(fromId: string, toId: string): StrokeState {
    const row = db.prepare('SELECT strokes FROM social_pair_states WHERE from_id = ? AND to_id = ?')
        .get(fromId, toId) as { strokes?: number } | undefined;
    return { balance: Number(row?.strokes ?? 0) };
}

/**
 * Apply a stroke exchange to a pair. `delta` is the stroke value of the
 * transaction as experienced by `fromId` toward `toId`. The balance is clamped
 * to a bounded range so a single exchange cannot permanently starve or satiate.
 */
export function applyStrokes(fromId: string, toId: string, delta: number): number {
    const current = readStrokeState(fromId, toId).balance;
    const next = Math.max(-20, Math.min(20, current + delta));
    db.prepare(`
        INSERT INTO social_pair_states (from_id, to_id, trust, safety, strokes)
        VALUES (?, ?, 50, 50, ?)
        ON CONFLICT(from_id, to_id) DO UPDATE SET strokes = excluded.strokes
    `).run(fromId, toId, next);
    return next;
}

/**
 * Stroke hunger: how much a character wants recognition right now.
 * 0 = satiated, 1 = starving. A deficit (negative balance) drives initiative
 * and willingness to accept negative strokes.
 */
export function strokeHunger(balance: number): number {
    return Math.max(0, Math.min(1, -balance / 10));
}

/** Initiative boost from stroke hunger, added to the autonomous probability. */
export function strokeInitiativeBoost(balance: number): number {
    return strokeHunger(balance) * 0.15;
}

// ---------------------------------------------------------------------------
// Dynamic ego state
// ---------------------------------------------------------------------------

export interface EgoDerivationInput {
    tension: number;
    capacity: number;
    openness: number;
    plasticity: number;
    trust: number;
    safety: number;
    /** The ego-state the LLM observed in the last exchange, if any. */
    apparentEgoState?: EgoState | 'unclear';
    /** The character's scripted default ego-state (from profile). */
    defaultEgoState?: EgoState;
    /** The character's scripted life position. */
    lifePosition?: LifePosition;
    /** The character's current dominant need. */
    need?: SocialNeed;
    /** The running stroke balance toward the partner (positive = satiated). */
    strokeBalance?: number;
    /** Attitude toward the partner (0..100). */
    attitude?: number;
}

/**
 * Derive the CURRENT ego-state from live state + observed ego + script.
 *
 * The scripted default is the anchor, but stress and safety move it:
 * - High tension + low capacity (overwhelmed) → regress toward child states.
 * - Low safety (threat) → adapted_child (comply) or rebellious_child (defy),
 *   depending on life position.
 * - High safety + low tension + resourced → hold adult (or the scripted state).
 * - The observed `apparentEgoState` is blended in so the character's ego is
 *   not frozen: repeated observed states pull the current ego toward them.
 */
const ALL_EGOS: EgoState[] = ['nurturing_parent', 'critical_parent', 'adult', 'free_child', 'adapted_child', 'rebellious_child'];

// Stress direction per scripted ego: under pressure a character follows their
// script (parent → control, child → comply/defy, adult → control/comply).
const STRESS_RESPONSE: Record<EgoState, { overwhelm: EgoState; threat: EgoState }> = {
    nurturing_parent:  { overwhelm: 'critical_parent', threat: 'critical_parent' },
    critical_parent:   { overwhelm: 'critical_parent', threat: 'rebellious_child' },
    adult:             { overwhelm: 'adapted_child',   threat: 'critical_parent' },
    free_child:        { overwhelm: 'adapted_child',   threat: 'rebellious_child' },
    adapted_child:     { overwhelm: 'adapted_child',   threat: 'adapted_child' },
    rebellious_child:  { overwhelm: 'rebellious_child', threat: 'rebellious_child' },
};

// Life position sets the DIRECTION of both stress and drift response.
function lifePositionEgo(lifePosition: LifePosition): Partial<Record<EgoState, number>> {
    switch (lifePosition) {
        case 'not_ok_ok':     return { adapted_child: 0.8 };              // "I'm not OK" → comply
        case 'ok_not_ok':     return { critical_parent: 0.8, rebellious_child: 0.6 }; // "you're not OK" → control/defy
        case 'not_ok_not_ok': return { adapted_child: 0.4, rebellious_child: 0.4 };  // hopeless flip
        default:              return {};                                   // ok_ok → scripted tendency
    }
}

// Dominant need pulls the ego toward the state that serves it.
const NEED_EGO: Partial<Record<SocialNeed, EgoState>> = {
    safety:     'adapted_child',
    approval:   'adapted_child',
    autonomy:   'rebellious_child',
    connection: 'free_child',
    clarity:    'adult',
};

// Stroke balance: satiation drifts up (adult/free), deprivation drifts down (child).
const SATIATED_EGOS: Array<{ ego: EgoState; weight: number }> = [
    { ego: 'adult', weight: 1.0 },
    { ego: 'free_child', weight: 0.8 },
];
const DEPRIVED_EGOS: Array<{ ego: EgoState; weight: number }> = [
    { ego: 'adapted_child', weight: 1.5 },
    { ego: 'rebellious_child', weight: 1.3 },
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Derive the CURRENT ego-state as a WEIGHTED BLEND of every live signal,
 * not just stress. Each signal adds score to the ego-states it favours; the
 * scripted anchor always contributes the most, so it is the stable baseline,
 * and recovery is automatic (when a signal's weight fades, the anchor wins).
 *
 * Signals:
 * - scripted anchor (baseline, strongest)
 * - life position (directional bias)
 * - dominant need (pulls toward the serving state)
 * - stroke balance (satiation up, deprivation down)
 * - stress (overwhelm/threat, per script)
 * - observed ego (drift, scaled by plasticity)
 * - attitude toward partner (warm → adult/free, cold → adapted/critical)
 *
 * Plasticity scales the NON-anchor drifts: a plastic character shifts easily,
 * a rigid one holds the script.
 */
export function deriveEgoState(input: EgoDerivationInput): EgoState {
    const base = input.defaultEgoState || 'adult';
    const tension = Math.max(0, Math.min(100, input.tension || 0));
    const capacity = Math.max(0, Math.min(100, input.capacity || 50));
    const safety = Math.max(0, Math.min(100, input.safety || 50));
    const openness = Math.max(0, Math.min(100, input.openness || 50));
    const plasticity = Math.max(0, Math.min(100, input.plasticity || 50));
    const lifePosition = input.lifePosition || 'ok_ok';
    const strokeBalance = Math.max(-20, Math.min(20, input.strokeBalance ?? 0));
    const attitude = Math.max(0, Math.min(100, input.attitude ?? 50));

    // Non-anchor drift strength scales with plasticity: rigid holds the script.
    const driftScale = 0.15 + clamp01(plasticity / 100) * 0.85;

    const scores: Record<EgoState, number> = {
        nurturing_parent: 0, critical_parent: 0, adult: 0,
        free_child: 0, adapted_child: 0, rebellious_child: 0,
    };
    // Scripted anchor: the stable baseline. Kept below stress weight so a
    // clear overwhelm/threat can flip it, but above any single weak drift so
    // the script holds in neutral.
    scores[base] += 1.0;

    // Life position directional bias.
    for (const [ego, w] of Object.entries(lifePositionEgo(lifePosition))) {
        scores[ego as EgoState] += (w as number) * driftScale;
    }

    // Dominant need pulls toward the serving state.
    const needEgo = input.need ? NEED_EGO[input.need] : undefined;
    if (needEgo && needEgo !== base) scores[needEgo] += 1.6 * driftScale;

    // Stroke satiation/deprivation drift.
    if (strokeBalance > 0) {
        const sat = clamp01(strokeBalance / 20);
        for (const { ego, weight } of SATIATED_EGOS) scores[ego] += weight * sat * driftScale;
    } else if (strokeBalance < 0) {
        const dep = clamp01(-strokeBalance / 20);
        for (const { ego, weight } of DEPRIVED_EGOS) scores[ego] += weight * dep * driftScale;
    }

    // Stress: overwhelm/threat follow the scripted stress direction. Decisive
    // enough to override the anchor when present.
    const overwhelmed = tension > 70 && capacity < 40;
    const threatened = safety < 30;
    if (overwhelmed) scores[stressResponseEgo(base, lifePosition, 'overwhelm')] += 2.0;
    if (threatened) scores[stressResponseEgo(base, lifePosition, 'threat')] += 2.0;

    // Observed ego: strong when safe/resourced (open to shift), weak in neutral
    // (a single observed state must not permanently override the script).
    if (input.apparentEgoState && input.apparentEgoState !== 'unclear') {
        const safe = safety >= 60 && tension < 50;
        scores[input.apparentEgoState] += (safe ? 2.0 : 0.8) * driftScale;
    }

    // Attitude toward partner: warmth → adult/free, cold → adapted/critical.
    if (attitude >= 60) scores[input.need === 'connection' ? 'free_child' : 'adult'] += 0.3 * driftScale;
    else if (attitude <= 40) scores[input.need === 'autonomy' ? 'rebellious_child' : 'adapted_child'] += 0.3 * driftScale;

    // Pick the highest-scoring state, breaking ties toward the scripted anchor.
    let best = base;
    let bestScore = scores[base];
    for (const ego of ALL_EGOS) {
        if (scores[ego] > bestScore + 1e-9) { best = ego; bestScore = scores[ego]; }
    }
    return best;
}

// Kept for stress-direction mapping (used by deriveEgoState).
function stressResponseEgo(scriptedEgo: EgoState, lifePosition: LifePosition, kind: 'overwhelm' | 'threat'): EgoState {
    const isParent = scriptedEgo === 'nurturing_parent' || scriptedEgo === 'critical_parent';
    switch (lifePosition) {
        case 'not_ok_ok': return 'adapted_child';
        case 'ok_not_ok': return isParent || scriptedEgo === 'adult' ? 'critical_parent' : 'rebellious_child';
        case 'not_ok_not_ok': return scriptedEgo === 'rebellious_child' ? 'rebellious_child' : 'adapted_child';
        case 'ok_ok':
        default: return STRESS_RESPONSE[scriptedEgo][kind];
    }
}


/**
 * Whether a character is currently in a "game-prone" state: stroke-hungry and
 * in a child ego-state. This is the precondition for ulterior/game moves.
 */
export function isGameProne(input: EgoDerivationInput & { strokeBalance: number }): boolean {
    const ego = deriveEgoState(input);
    const hungry = strokeHunger(input.strokeBalance) >= 0.5;
    // Racket-producing states: child states + critical_parent (righteous anger).
    // These are the states from which ulterior/game moves are played.
    const racketState = ego === 'adapted_child' || ego === 'rebellious_child' || ego === 'free_child' || ego === 'critical_parent';
    return hungry && racketState;
}
