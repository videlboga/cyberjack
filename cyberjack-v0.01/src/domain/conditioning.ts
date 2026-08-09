import { OVERLOAD_CRITICAL, OVERLOAD_NOTICEABLE } from './overloadScale';

export type PreferenceData = {
    actions: Record<string, number>;
    points: Record<string, number>;
    contexts: Record<string, number>;
    tags: Record<string, number>;
};

export type AcquiredTrait = {
    id: string;
    label: string;
    level: number;
    strength: number;
};

export type CompulsionSignal = {
    traitId: string;
    label: string;
    level: number;
    pressure: number;
    cueTags: string[];
    impulse: string;
    actionTags: string[];
};

export type ConditioningSignalInput = {
    pleasure?: number;
    discomfort?: number;
    overload?: number;
    finalValence?: number;
    attitudeShift?: number;
    learningEffect?: number;
    engagement?: number;
    corePlasticity?: number;
    relationAttitude?: number;
    relationPlasticity?: number;
    learnedCompliance?: number;
    lackOfControl?: number;
    distressState?: boolean;
    breakdown?: boolean;
};

export type ConditioningSignal = {
    reward: number;
    generalizedDelta: number;
    modifiers: {
        bondedDiscomfort: number;
        acceptedDiscomfort: number;
        appraisalBonus: number;
        forcedAcceptance: number;
        criticalConsequence: number;
        learningQuality: number;
    };
};

const EMPTY_BUCKET = () => ({} as Record<string, number>);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function parsePreferences(value: unknown): PreferenceData {
    let parsed: any = value;
    if (typeof value === 'string') {
        try { parsed = JSON.parse(value || '{}'); } catch { parsed = {}; }
    }
    if (!parsed || typeof parsed !== 'object') parsed = {};
    return {
        actions: parsed.actions || EMPTY_BUCKET(),
        points: parsed.points || EMPTY_BUCKET(),
        contexts: parsed.contexts || EMPTY_BUCKET(),
        tags: parsed.tags || EMPTY_BUCKET(),
    };
}

export const LEARNABLE_PREFERENCE_TAGS = new Set([
    'pain', 'tickling',
    'restraint', 'control', 'command', 'pressure', 'submission',
    'exposure', 'humiliation', 'demeaning', 'vulnerable',
    'clinical', 'medical', 'drug', 'chemical',
    'electronic', 'machine',
    'feet', 'oral', 'penetration', 'sexual',
    'deprivation',
]);

export const NON_LEARNABLE_STATE_CONTEXTS = new Set([
    'effect_panic',
    'effect_sensory_overload',
    'effect_freeze',
    'effect_apathy',
    'effect_chronic_apathy',
    'effect_active_defiance',
    'effect_refractory',
]);

export function isLearnablePreferenceContext(actionId: string): boolean {
    return !NON_LEARNABLE_STATE_CONTEXTS.has(actionId);
}

/**
 * Turns one experienced action into a persistent semantic preference change.
 * Positively appraised, controlled discomfort can become desirable when the
 * subject trusts the actor; raw distress and overload remain strongly negative.
 */
export function conditioningSignal(input: ConditioningSignalInput): ConditioningSignal {
    const pleasure = Math.max(0, input.pleasure || 0);
    const discomfort = Math.max(0, input.discomfort || 0);
    const overload = Math.max(0, input.overload || 0);
    const appraisal = Math.max(-1, Math.min(1, input.finalValence || 0));
    const sympathy = clamp01(((input.relationAttitude ?? 50) - 50) / 50);
    const submissiveness = clamp01(((input.relationPlasticity ?? 50) - 50) / 50);
    const plasticity = clamp01((input.corePlasticity ?? 50) / 100);

    // Trust and relational receptivity let a subject reinterpret part of
    // discomfort without pretending that its physical component disappeared.
    const bondedDiscomfort = discomfort * sympathy * submissiveness * Math.max(0, appraisal);
    const controlled = clamp01(1 - overload / OVERLOAD_CRITICAL);
    const acceptedDiscomfort = discomfort * Math.max(0, appraisal) * controlled *
        (0.2 + sympathy * 0.35 + submissiveness * 0.25);
    const appraisalBonus = Math.max(0, appraisal) * (pleasure + discomfort) * 0.2;
    // Conditioning follows what the experience meant to the character, not
    // the raw nociceptive balance. Pain may remain physically uncomfortable
    // while being positively appraised (masochism, trust, chosen intensity).
    // Using pleasure - discomfort here made such an experience erase the very
    // preference that caused its positive appraisal.
    const appraisedExperience = appraisal * (pleasure + discomfort);
    // A small overload reading is already represented in the felt experience;
    // acute overload is a separate aversive consequence and must dominate.
    // Ordinary sensory load must not reverse a positively appraised painful
    // experience. The rest of the kernel treats ~15 as the beginning of
    // meaningful overload; only the excess above that becomes an acute
    // conditioning penalty.
    const overloadPenalty = overload * 0.12 + Math.max(0, overload - OVERLOAD_NOTICEABLE) * 1.5;
    const baseReward = appraisedExperience - overloadPenalty + (input.attitudeShift || 0) * 0.2 +
        bondedDiscomfort + acceptedDiscomfort + appraisalBonus;
    // Repeated experience that the subject cannot change may eventually be
    // justified and assimilated. This affects persistent learning only: the
    // immediate appraisal and felt discomfort remain negative. At moderate
    // resignation it merely weakens aversive conditioning; only established
    // resignation can reverse it into a positive association.
    const resignation = clamp01((input.learnedCompliance || 0) / 100);
    const lackOfControl = clamp01(input.lackOfControl || 0);
    const negativeExperience = Math.max(0, -appraisedExperience);
    const reframingStrength = Math.pow(resignation, 1.35) * 1.6;
    const forcedAcceptance = negativeExperience * lackOfControl * reframingStrength *
        (0.35 + plasticity * 0.65);
    // Panic and overload are consequences, not desirable objects. While they
    // are active they keep an experience aversive; a breakdown is a decisive
    // negative outcome and cannot be positively reframed on the same tick.
    const distressConsequence = input.distressState
        ? discomfort * 0.45 + overload * 0.55
        : 0;
    const breakdownConsequence = input.breakdown
        ? 15 + pleasure + discomfort + overload
        : 0;
    const criticalConsequence = distressConsequence + breakdownConsequence;
    const reward = input.breakdown
        ? Math.min(-1, baseReward - criticalConsequence)
        : baseReward + forcedAcceptance - criticalConsequence;

    // A useful experience no longer needs near-perfect telemetry to matter.
    // The square root rewards moderate engagement/learning while saturation in
    // the preference bucket still slows the upper trait levels.
    const learning = clamp01((input.learningEffect || 0) / 100);
    const engagement = clamp01((input.engagement || 0) / 100);
    const learningQuality = 0.25 + 0.75 * Math.sqrt(learning * engagement);
    const rewardSignal = Math.tanh(reward / 15);
    const overloadConsequence = reward < 0 ? 1 + clamp01(overload / 50) * 0.35 : 1;
    const generalizedDelta = rewardSignal * 0.35 * plasticity * learningQuality * overloadConsequence;

    return {
        reward,
        generalizedDelta,
        modifiers: { bondedDiscomfort, acceptedDiscomfort, appraisalBonus, forcedAcceptance, criticalConsequence, learningQuality },
    };
}

const LEGACY_ACTION_TAGS: Record<string, string[]> = {
    gentle_stroke: ['affection'],
    tickle: ['tickling'],
    feather_stroke: ['tickling'],
    light_kiss: ['sexual'],
    deep_kiss: ['sexual', 'oral'],
    licking: ['sexual', 'oral'],
    deep_massage: ['stimulation'],
    ice_cube: ['stimulation', 'sensory'],
    hot_wax: ['pain'],
    firm_grip: ['pain', 'blunt'],
    light_bite: ['pain'],
    hard_bite: ['pain'],
    pinch: ['pain'],
    scratching: ['pain'],
    slap: ['pain', 'impact', 'humiliation'],
    hard_slap: ['pain', 'impact', 'humiliation'],
    needle_prick: ['pain', 'clinical', 'medical'],
    whip_strike: ['pain', 'impact'],
    taser_shock: ['pain', 'electronic'],
    hair_pull: ['pain', 'control'],
    finger_insertion: ['penetration', 'sexual'],
    vibrator_pulse: ['electronic', 'stimulation'],
    pose_kneeling: ['submission'],
    pose_spread_eagle: ['exposure', 'vulnerable'],
    act_hold_exposure: ['exposure', 'vulnerable'],
    act_present_feet: ['feet', 'exposure'],
    verbal_pressure: ['command', 'pressure'],
};

export function conditioningTags(actionKey: string | undefined, authoredTags: string[] = []): string[] {
    return Array.from(new Set([...(authoredTags || []), ...(actionKey ? LEGACY_ACTION_TAGS[actionKey] || [] : [])]));
}

export type ContextConditioningSource = {
    id: string;
    type?: string;
    tags: string[];
};

export type WeightedContextTag = {
    tag: string;
    sourceId: string;
    weight: number;
};

/**
 * Resolves semantic tags that were present as part of an ongoing embodied
 * context rather than the immediate action. The strongest source wins when
 * several contexts expose the same tag, preventing stacked equipment from
 * multiplying one learning signal.
 */
export function contextConditioningTags(
    contexts: ContextConditioningSource[],
    directTags: string[] = [],
): WeightedContextTag[] {
    const direct = new Set(directTags);
    const resolved = new Map<string, WeightedContextTag>();
    const weightFor = (tag: string, type?: string) => {
        if (['pain', 'restraint', 'deprivation'].includes(tag)) return 0.55;
        if (['electronic', 'machine', 'stimulation', 'sexual', 'penetration'].includes(tag)) return 0.45;
        if (['vulnerable', 'exposure', 'control', 'submission', 'humiliation', 'demeaning'].includes(tag)) return 0.4;
        return type === 'pose' ? 0.3 : 0.35;
    };

    for (const context of contexts) {
        if (!['equipment', 'restraint', 'sexual_interaction', 'pose', 'sensory'].includes(context.type || '')) continue;
        for (const tag of new Set(context.tags || [])) {
            if (direct.has(tag) || !LEARNABLE_PREFERENCE_TAGS.has(tag)) continue;
            const candidate = { tag, sourceId: context.id, weight: weightFor(tag, context.type) };
            const previous = resolved.get(tag);
            if (!previous || candidate.weight > previous.weight) resolved.set(tag, candidate);
        }
    }
    return [...resolved.values()];
}

export function clothingConditioningTags(input: {
    contextIds: string[];
    directTags: string[];
    pointId: string;
    contact: number;
}): WeightedContextTag[] {
    if (input.contact <= .05) return [];
    const ids = new Set(input.contextIds);
    const tags = new Set(input.directTags);
    const result: WeightedContextTag[] = [];
    const add = (tag: string, sourceId: string, weight: number) => result.push({ tag, sourceId, weight });
    if (ids.has('eq_clothe_lab_gown')) add('medical', 'eq_clothe_lab_gown', .65);
    if (ids.has('eq_clothe_stockings')) {
        // Stockings carry a weak erotic association by themselves. Their more
        // specific meaning is learned only while the covered legs/feet are the
        // focus of an action, with foot tickling as the strongest pairing.
        add('sexual', 'eq_clothe_stockings', .3);
        if (input.pointId === 'feet') add('feet', 'eq_clothe_stockings', .7);
        else if (['legs', 'knees', 'inner_thighs'].includes(input.pointId)) add('feet', 'eq_clothe_stockings', .4);
        if (tags.has('tickling') && input.pointId === 'feet') add('tickling', 'eq_clothe_stockings', .9);
        else if (tags.has('tickling') && ['legs', 'knees', 'inner_thighs'].includes(input.pointId)) {
            add('tickling', 'eq_clothe_stockings', .55);
        }
    }
    if (ids.has('eq_clothe_jumpsuit')) add('deprivation', 'eq_clothe_jumpsuit', .6);
    if (ids.has('eq_clothe_dress')) add('sexual', 'eq_clothe_dress', .3);
    const dressed = [...ids].some(id => id.startsWith('eq_clothe_') && !id.endsWith('_remove'));
    if (!dressed) add('exposure', 'nude', tags.has('sexual') ? .85 : .55);
    return result;
}

export function preferenceValenceModifier(tags: string[] = [], preferences: unknown): number {
    const learned = parsePreferences(preferences).tags;
    const values = Array.from(new Set(tags))
        .filter(tag => LEARNABLE_PREFERENCE_TAGS.has(tag))
        .map(tag => learned[tag])
        .filter((value): value is number => Number.isFinite(value));
    if (!values.length) return 0;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    // A deeply learned preference may reinterpret an experience, but cannot
    // erase its physical sharpness, strain or overload.
    // Established traits must be immediately legible in play. At strength
    // 3.5 (a stable level-two disposition) this contributes about ±0.49,
    // enough to meaningfully reinterpret a moderate action without touching
    // its physical intensity, sharpness, discomfort or overload.
    return Math.max(-0.7, Math.min(0.7, (average / 5) * 0.7));
}

const positiveMean = (tags: Record<string, number>, keys: string[]) => {
    const values = keys.map(key => tags[key]).filter((value): value is number => Number.isFinite(value));
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
};

export function acquiredTraitLevel(strength: number): number {
    // Leave a little stability around authored starting values: a level-two
    // trait seeded at 3.5 should not disappear after one mildly bad episode.
    return strength >= 4.5 ? 3 : strength >= 3.25 ? 2 : strength >= 1.75 ? 1 : 0;
}

export function deriveAcquiredTraits(preferences: unknown): AcquiredTrait[] {
    const tags = parsePreferences(preferences).tags;
    const definitions = [
        { id: 'trait_masochist', label: 'Мазохизм', strength: tags.pain || 0 },
        { id: 'trait_knismolagnia', label: 'Книсмолагния', strength: tags.tickling || 0 },
        { id: 'trait_restraint_fetish', label: 'Фетиш фиксации', strength: tags.restraint || 0 },
        { id: 'trait_conditioned_submission', label: 'Обусловленная покорность', strength: positiveMean(tags, ['control', 'command', 'submission']) },
        { id: 'trait_exhibitionist', label: 'Эксгибиционизм', strength: positiveMean(tags, ['exposure', 'humiliation']) },
        { id: 'trait_clinical_fetish', label: 'Медицинский фетиш', strength: positiveMean(tags, ['clinical', 'medical']) },
        { id: 'trait_electrophile', label: 'Электрофетиш', strength: tags.electronic || 0 },
        { id: 'trait_technophile', label: 'Машинный фетиш', strength: tags.machine || 0 },
        { id: 'trait_sexual_dependency', label: 'Сексуальная зависимость', strength: tags.sexual || 0 },
        { id: 'trait_sensory_deprivation', label: 'Тяга к сенсорной изоляции', strength: tags.deprivation || 0 },
    ];
    return definitions.map(definition => ({
        ...definition,
        level: acquiredTraitLevel(definition.strength),
    }));
}

const COMPULSION_DEFINITIONS: Array<{
    traitId: string;
    cueTags: string[];
    impulse: string;
    actionTags: string[];
}> = [
    { traitId:'trait_masochist', cueTags:['pain'], impulse:'искать или не прерывать болезненное воздействие', actionTags:['pain'] },
    { traitId:'trait_knismolagnia', cueTags:['tickling'], impulse:'искать щекочущее ощущение и возвращаться к нему мыслями', actionTags:['tickling'] },
    { traitId:'trait_restraint_fetish', cueTags:['restraint'], impulse:'сохранять или искать фиксацию', actionTags:['restraint'] },
    { traitId:'trait_conditioned_submission', cueTags:['control','command','submission'], impulse:'подчиниться направляющему импульсу', actionTags:['control','command','submission'] },
    { traitId:'trait_exhibitionist', cueTags:['exposure','humiliation','vulnerable'], impulse:'оставаться открытой чужому вниманию', actionTags:['exposure','humiliation','vulnerable'] },
    { traitId:'trait_clinical_fetish', cueTags:['clinical','medical'], impulse:'искать медицински оформленное воздействие', actionTags:['clinical','medical'] },
    { traitId:'trait_electrophile', cueTags:['electronic'], impulse:'искать электрическую стимуляцию', actionTags:['electronic'] },
    { traitId:'trait_technophile', cueTags:['machine'], impulse:'не прерывать машинное воздействие', actionTags:['machine'] },
    { traitId:'trait_sexual_dependency', cueTags:['sexual','penetration','oral'], impulse:'сохранить или получить сексуальную стимуляцию', actionTags:['sexual','penetration','oral'] },
    { traitId:'trait_sensory_deprivation', cueTags:['deprivation'], impulse:'искать отстранение от внешних раздражителей', actionTags:['deprivation'] },
];

/**
 * Deterministic motivational pressure from acquired traits. It is produced
 * only by a matching present cue; a trait is not a permanent instruction to
 * behave the same way in every scene.
 */
export function deriveCompulsionSignals(preferences: unknown, cueTags: string[] = []): CompulsionSignal[] {
    const cues = new Set(cueTags);
    if (!cues.size) return [];
    const traits = new Map(deriveAcquiredTraits(preferences).map(trait => [trait.id, trait]));
    const pressureForLevel = [0, .28, .58, .92];
    return COMPULSION_DEFINITIONS.flatMap(definition => {
        const trait = traits.get(definition.traitId);
        if (!trait || trait.level <= 0) return [];
        const matched = definition.cueTags.filter(tag => cues.has(tag));
        if (!matched.length) return [];
        return [{
            traitId:trait.id,
            label:trait.label,
            level:trait.level,
            pressure:pressureForLevel[trait.level] || 0,
            cueTags:matched,
            impulse:definition.impulse,
            actionTags:definition.actionTags,
        }];
    }).sort((left, right) => right.pressure - left.pressure);
}

export function acquiredTraitValue(preferences: unknown, traitId: string): number {
    return deriveAcquiredTraits(preferences).find(trait => trait.id === traitId)?.level || 0;
}
