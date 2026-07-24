import visualAssetIndex from '../infrastructure/data/visual/visual-asset-index-v4.generated.json';

export type VisualPhase = 'sustain' | 'intense' | 'peak' | 'recovery';

export type InteractionFamily =
    | 'none'
    | 'vibration'
    | 'sex_machine'
    | 'electrostimulation'
    | 'exposure'
    | 'foot'
    | 'oral'
    | 'penetration'
    | 'capsule'
    | 'lesbian';

export type VisualAffect =
    | 'neutral'
    | 'receptive'
    | 'guarded'
    | 'high_positive'
    | 'high_negative'
    | 'subspace'
    | 'climax'
    | 'unconscious';

export interface ActiveVisualInteraction {
    family: Exclude<InteractionFamily, 'none'>;
    variant: string;
    phase: VisualPhase;
    intensity: number;
    sourceActionId: string;
    sourceItemId?: string;
    targetPointId?: string;
    startedAtTick: number;
}

export interface CharacterVisualDescriptor {
    characterId: string;
    characterSlug: string;
    pose: string;
    clothing: string;
    restraint: string;
    affect: VisualAffect;
    activation: 'calm' | 'working' | 'intense' | 'peak';
    event?: 'discharge';
    interaction?: ActiveVisualInteraction;
}

export type VisualContext = { actionId: string; ticksActive?: number; pointId?: string | null };

type CalibrationVisualState = {
    contexts?: VisualContext[];
    tension?: number;
    attitude?: number;
    openness?: number;
};

export type EquipmentPreset =
    | 'none' | 'blindfold' | 'gag' | 'blindfold_gag' | 'collar'
    | 'wrist_cuffs' | 'wrist_cuffs_blindfold' | 'ankle_cuffs'
    | 'wrist_ankle_cuffs' | 'restraint_belt' | 'table_straps'
    | 'restraint_frame' | 'suspension';

export type CharacterVisualDescriptorV4 = {
    characterId: string;
    characterSlug: string;
    mode: 'calibration' | 'calibration_interaction' | 'device';
    pose?: string;
    clothing: string;
    equipmentPreset?: EquipmentPreset;
    affect: VisualAffect;
    interaction?: ActiveVisualInteraction;
    device?: { deviceId: string; configuration: string; phase: VisualPhase };
    representedEquipment: string[];
    unrepresentedEquipment: string[];
};

type InteractionRuleContext = {
    contexts: VisualContext[];
    ids: Set<string>;
    tension: number;
    start: VisualContext;
};

export type InteractionVisualRule = {
    id: string;
    startActionId: string;
    modifierActionIds?: string[];
    family: ActiveVisualInteraction['family'];
    variant: string | ((context: InteractionRuleContext) => string);
    sourceItemId?: string;
    defaultIntensity: number;
    intenseIntensity?: number;
    modifiedIntensity?: number;
    targetPoint?: (context: InteractionRuleContext) => string | undefined;
    phases?: Partial<Record<'sustain' | 'intense' | 'peak', VisualPhase>>;
};

type ExpandedVisualInput = {
    characterSlug: string;
    interaction: ActiveVisualInteraction;
    contexts?: VisualContext[];
    tension?: number;
    attitude?: number;
    openness?: number;
    behavioralState?: string;
    discharged?: boolean;
};

const hasAny = (ids: Set<string>, values: string[]) => values.some(value => ids.has(value));

const indexedVisualAssets = new Set<string>(visualAssetIndex.assets);

const normalizedAssetPath = (assetPath: string) => {
    try {
        return assetPath.startsWith('http://') || assetPath.startsWith('https://')
            ? new URL(assetPath).pathname
            : assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
    } catch {
        return assetPath;
    }
};

export const visualAssetExists = (assetPath?: string | null): assetPath is string =>
    Boolean(assetPath && indexedVisualAssets.has(normalizedAssetPath(assetPath)));

export const resolveFirstAvailableVisual = (candidates: Array<string | null | undefined>): string | null => {
    for (const candidate of candidates) if (visualAssetExists(candidate)) return candidate;
    return null;
};

export const equipmentPresetFromContexts = (contexts: VisualContext[] = []): EquipmentPreset => {
    const ids = new Set(contexts.map(context => context.actionId));
    if (ids.has('act_suspend_wrists')) return 'suspension';
    if (ids.has('lab_restraint_frame')) return 'restraint_frame';
    if (ids.has('lab_diagnostic_table')) return 'table_straps';
    if (ids.has('act_apply_handcuffs') && ids.has('eq_blindfold_apply')) return 'wrist_cuffs_blindfold';
    if (ids.has('eq_blindfold_apply') && ids.has('eq_gag_apply')) return 'blindfold_gag';
    if (ids.has('act_apply_handcuffs') && ids.has('act_apply_ankle_cuffs')) return 'wrist_ankle_cuffs';
    if (ids.has('act_apply_restraint_belt')) return 'restraint_belt';
    if (ids.has('act_apply_handcuffs')) return 'wrist_cuffs';
    if (ids.has('act_apply_ankle_cuffs')) return 'ankle_cuffs';
    if (ids.has('eq_blindfold_apply')) return 'blindfold';
    if (ids.has('eq_gag_apply')) return 'gag';
    if (ids.has('act_apply_collar')) return 'collar';
    return 'none';
};

const characterSlugFor = (characterId: string) => characterId === 'S-AV-01' ? 'mira'
    : characterId === 'NPC-LAB-01' ? 'iona'
        : characterId === 'NPC-CAND-01' ? 'nika'
            : characterId.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const calibrationPoseFromContexts = (contexts: VisualContext[] = []) => {
    const ids = new Set(contexts.map(context => context.actionId));
    if (ids.has('act_present_feet')) return 'feet_presented';
    if (ids.has('act_suspend_wrists')) return 'suspended';
    if (ids.has('pose_spread_eagle')) return 'spread_eagle';
    if (ids.has('pose_all_fours')) return 'all_fours';
    if (ids.has('pose_lying_down')) return 'lying';
    if (ids.has('pose_kneeling')) return 'kneeling';
    if (ids.has('pose_sitting')) return ids.has('act_hold_exposure') ? 'sitting_spread' : 'sitting';
    if (ids.has('act_hold_exposure')) return 'standing_exposed';
    return 'standing';
};

const calibrationClothingFromContexts = (contexts: VisualContext[] = []) => {
    const ids = new Set(contexts.map(context => context.actionId));
    if (ids.has('eq_clothe_jumpsuit')) return 'jumpsuit';
    if (ids.has('eq_clothe_calibration_set')) return 'calibration_set';
    if (ids.has('eq_clothe_lab_gown')) return 'lab_gown';
    if (ids.has('eq_clothe_dress') && ids.has('eq_clothe_stockings')) return 'dress_stockings';
    if (ids.has('eq_clothe_dress')) return 'dress';
    if (ids.has('eq_clothe_underwear') || ids.has('eq_clothe_panties')) return 'underwear';
    return 'nude';
};

const calibrationAffect = (
    state: CalibrationVisualState | null,
    behavioralState?: string,
    climax = false,
): VisualAffect => {
    const ids = new Set((state?.contexts || []).map(context => context.actionId));
    if (climax) return 'climax';
    if (behavioralState === 'unresponsive' || ids.has('effect_apathy') || ids.has('effect_chronic_apathy')) return 'unconscious';
    if (behavioralState === 'subspace' || ids.has('effect_subspace')) return 'subspace';
    if ((state?.tension || 0) >= 82) return (state?.attitude || 0) >= 50 ? 'high_positive' : 'high_negative';
    if ((state?.attitude || 0) <= 35 || ['panic', 'defiance', 'freeze'].includes(behavioralState || '')) return 'guarded';
    if ((state?.attitude || 0) >= 65 && (state?.openness || 0) >= 50) return 'receptive';
    return 'neutral';
};

const representedEquipmentContexts = (contexts: VisualContext[]) => contexts
    .map(context => context.actionId)
    .filter(actionId => [
        'act_suspend_wrists', 'lab_restraint_frame', 'lab_diagnostic_table',
        'act_apply_handcuffs', 'act_apply_ankle_cuffs', 'act_apply_restraint_belt',
        'eq_blindfold_apply', 'eq_gag_apply', 'act_apply_collar',
    ].includes(actionId));

export const buildCalibrationVisualDescriptorV4 = (
    characterId: string,
    state: CalibrationVisualState | null,
    behavioralState?: string,
    climax = false,
): CharacterVisualDescriptorV4 => {
    const contexts = state?.contexts || [];
    const equipmentPreset = equipmentPresetFromContexts(contexts);
    const descriptor: CharacterVisualDescriptorV4 = {
        characterId,
        characterSlug: characterSlugFor(characterId),
        mode: 'calibration',
        pose: calibrationPoseFromContexts(contexts),
        clothing: calibrationClothingFromContexts(contexts),
        equipmentPreset,
        affect: calibrationAffect(state, behavioralState, climax),
        representedEquipment: [],
        unrepresentedEquipment: [],
    };
    const corePath = `/character-images/calibration-core/${descriptor.characterSlug}/${descriptor.pose}/${descriptor.clothing}__${equipmentPreset}__${descriptor.affect}.png`;
    const exactPath = `/character-images/calibration-v4/${descriptor.characterSlug}/${descriptor.pose}/${descriptor.clothing}__${equipmentPreset}__${descriptor.affect}.png`;
    const equipmentContexts = representedEquipmentContexts(contexts);
    if (visualAssetExists(corePath) || visualAssetExists(exactPath)) descriptor.representedEquipment = equipmentContexts;
    else descriptor.unrepresentedEquipment = equipmentContexts;
    return descriptor;
};

const calibrationCoreEquipmentFallbacks: Partial<Record<EquipmentPreset, EquipmentPreset[]>> = {
    blindfold_gag: ['blindfold', 'gag'],
    wrist_cuffs_blindfold: ['blindfold', 'wrist_cuffs'],
    wrist_ankle_cuffs: ['wrist_cuffs', 'ankle_cuffs'],
};

export const calibrationAvatarCandidatesV4 = (descriptor: CharacterVisualDescriptorV4): string[] => {
    const equipmentPreset = descriptor.equipmentPreset || 'none';
    const coreEquipment = [equipmentPreset, ...(calibrationCoreEquipmentFallbacks[equipmentPreset] || [])];
    const core = coreEquipment.flatMap(equipment => [
        `/character-images/calibration-core/${descriptor.characterSlug}/${descriptor.pose}/${descriptor.clothing}__${equipment}__${descriptor.affect}.png`,
        `/character-images/calibration-core/${descriptor.characterSlug}/${descriptor.pose}/${descriptor.clothing}__${equipment}__neutral.png`,
    ]);
    const exact = `/character-images/calibration-v4/${descriptor.characterSlug}/${descriptor.pose}/${descriptor.clothing}__${descriptor.equipmentPreset || 'none'}__${descriptor.affect}.png`;
    const legacy = `/character-images/rendered/${descriptor.characterSlug}/${descriptor.pose}__${descriptor.clothing}__none__${descriptor.affect}.png`;
    const legacyNeutral = `/character-images/rendered/${descriptor.characterSlug}/${descriptor.pose}__${descriptor.clothing}__none__neutral.png`;
    return [...core, exact, legacy, legacyNeutral];
};

export const resolveCalibrationAvatarV4 = (descriptor: CharacterVisualDescriptorV4): string | null =>
    resolveFirstAvailableVisual(calibrationAvatarCandidatesV4(descriptor));

const nearestDeviceAffects: Record<VisualPhase, VisualAffect[]> = {
    sustain: ['receptive', 'guarded'],
    intense: ['high_positive', 'high_negative', 'subspace'],
    peak: ['climax', 'high_negative'],
    recovery: ['receptive', 'guarded'],
};

export const resolveExistingDeviceVisual = (input: {
    characterSlug: string;
    family: 'sex_machine' | 'capsule';
    configuration: string;
    wardrobe: 'nude' | 'underwear' | 'device_outfit';
    affect: VisualAffect;
    phase: VisualPhase;
}): string | null => {
    const phase = input.phase === 'recovery' ? 'sustain' : input.phase;
    const available = nearestDeviceAffects[phase];
    const positive = ['neutral', 'receptive', 'high_positive', 'subspace', 'climax'].includes(input.affect);
    const ordered = [
        input.affect,
        ...available.filter(affect => positive
            ? ['receptive', 'high_positive', 'subspace', 'climax'].includes(affect)
            : ['guarded', 'high_negative'].includes(affect)),
        ...available,
    ];
    return resolveFirstAvailableVisual([...new Set(ordered)].map(affect =>
        `/character-images/interactions-expanded/${input.characterSlug}/${input.family}/${input.configuration}/${input.wardrobe}__machine__${affect}__${phase}.png`
    ));
};

const electroTargetPoint = ({ contexts, start }: InteractionRuleContext) =>
    start.pointId || contexts.find(entry => entry.actionId === 'act_connect_tens')?.pointId || undefined;

/**
 * Registry of mechanics that can hold an interaction visual over multiple ticks.
 * One-shot actions deliberately do not belong here.
 */
export const INTERACTION_VISUAL_RULES: readonly InteractionVisualRule[] = [
    {
        id: 'electrostimulation',
        startActionId: 'act_start_electrostimulation',
        modifierActionIds: ['act_adjust_electrostimulation'],
        family: 'electrostimulation',
        variant: context => electroTargetPoint(context) === 'groin' ? 'genital' : 'clamps',
        sourceItemId: 'eq_tens_unit',
        defaultIntensity: 0.65,
        modifiedIntensity: 0.9,
        targetPoint: electroTargetPoint,
    },
    {
        id: 'internal-vibration',
        startActionId: 'act_activate_plug',
        family: 'vibration',
        variant: 'internal',
        sourceItemId: 'eq_plug',
        defaultIntensity: 0.55,
        intenseIntensity: 0.85,
    },
    {
        id: 'handheld-vibration',
        startActionId: 'act_start_vibrator',
        modifierActionIds: ['act_adjust_vibration'],
        family: 'vibration',
        variant: 'handheld',
        sourceItemId: 'eq_vibrator',
        defaultIntensity: 0.55,
        modifiedIntensity: 0.85,
    },
    {
        id: 'held-exposure',
        startActionId: 'act_hold_exposure',
        family: 'exposure',
        variant: ({ ids }) => ids.has('pose_spread_eagle') ? 'spread_eagle'
            : ids.has('pose_sitting') ? 'sitting_spread'
                : ids.has('pose_standing') ? 'standing' : 'covering',
        defaultIntensity: 0.35,
        phases: { intense: 'sustain' },
    },
    {
        id: 'feet-presented',
        startActionId: 'act_present_feet',
        family: 'foot',
        variant: ({ ids }) => ids.has('eq_clothe_stockings') || ids.has('eq_stockings')
            ? 'pantyhose_presented' : 'bare_presented',
        defaultIntensity: 0.25,
        phases: { intense: 'sustain', peak: 'sustain' },
    },
] as const;

export const expandedInteractionAssetPath = (input: ExpandedVisualInput): string => {
    const ids = new Set((input.contexts || []).map(context => context.actionId));
    const { family, variant, phase } = input.interaction;

    const hasStockings = ids.has('eq_clothe_stockings');
    const hasOpenTop = hasAny(ids, ['eq_clothe_lab_gown', 'eq_clothe_dress']);
    const hasUnderwear = hasAny(ids, [
        'eq_clothe_underwear', 'eq_clothe_panties', 'eq_clothe_calibration_set', 'eq_clothe_jumpsuit'
    ]);

    let wardrobe = hasStockings ? 'stockings' : hasOpenTop ? 'open_top' : hasUnderwear ? 'underwear' : 'nude';
    let restraint = hasAny(ids, ['act_apply_handcuffs', 'act_apply_restraint_belt']) ? 'wrists'
        : hasAny(ids, ['act_apply_ankle_cuffs', 'lab_diagnostic_table', 'lab_restraint_frame']) ? 'spread'
        : 'free';

    // Each generated variant has an intentionally restricted compatibility set.
    if (family === 'vibration') {
        if (wardrobe === 'open_top') wardrobe = 'underwear';
        restraint = restraint === 'wrists' ? 'wrists' : 'free';
    } else if (family === 'electrostimulation' && variant === 'clamps') {
        wardrobe = wardrobe === 'nude' ? 'nude' : 'open_top';
    } else if (family === 'electrostimulation' && variant === 'genital') {
        wardrobe = wardrobe === 'nude' ? 'nude' : 'underwear';
        restraint = restraint === 'spread' ? 'spread' : 'free';
    } else if (family === 'exposure') {
        if (variant === 'standing') restraint = restraint === 'wrists' ? 'wrists' : 'free';
        else if (variant === 'sitting_spread') {
            if (wardrobe === 'open_top') wardrobe = 'underwear';
            restraint = restraint === 'spread' ? 'spread' : 'free';
        } else if (variant === 'spread_eagle') {
            wardrobe = wardrobe === 'nude' ? 'nude' : 'underwear';
            restraint = 'spread';
        } else {
            if (wardrobe === 'stockings') wardrobe = 'underwear';
            restraint = 'free';
        }
    } else if (family === 'foot') {
        if (variant === 'pantyhose_presented') {
            wardrobe = 'stockings';
            restraint = restraint === 'wrists' ? 'wrists' : 'free';
        } else {
            wardrobe = wardrobe === 'nude' ? 'nude' : 'underwear';
            restraint = 'free';
        }
    }

    const negative = (input.attitude ?? 50) < 45 || ['panic', 'defiance', 'freeze'].includes(input.behavioralState || '');
    const affect = phase === 'peak'
        ? negative ? 'high_negative' : 'climax'
        : phase === 'intense'
            ? input.behavioralState === 'subspace' ? 'subspace' : negative ? 'high_negative' : 'high_positive'
            : negative ? 'guarded' : 'receptive';

    return `/character-images/interactions-expanded/${input.characterSlug}/${family}/${variant}/${wardrobe}__${restraint}__${affect}__${phase}.png`;
};

export const activeVisualInteractionFromContexts = (
    contexts: VisualContext[] = [],
    tension = 0,
): ActiveVisualInteraction | undefined => {
    const ids = new Set(contexts.map(context => context.actionId));
    const rule = INTERACTION_VISUAL_RULES.find(candidate => ids.has(candidate.startActionId));
    if (!rule) return undefined;

    const start = contexts.find(entry => entry.actionId === rule.startActionId)!;
    const ruleContext: InteractionRuleContext = { contexts, ids, tension, start };
    const modifier = rule.modifierActionIds
        ?.map(actionId => contexts.find(entry => entry.actionId === actionId))
        .find(Boolean);
    const rawPhase: 'sustain' | 'intense' | 'peak' = tension >= 85
        ? 'peak'
        : modifier || tension >= 65 ? 'intense' : 'sustain';
    const phase = rule.phases?.[rawPhase] || rawPhase;
    const targetPointId = rule.targetPoint?.(ruleContext)
        || (rule.id === 'internal-vibration' ? 'groin' : start.pointId || undefined);

    return {
        family: rule.family,
        variant: typeof rule.variant === 'function' ? rule.variant(ruleContext) : rule.variant,
        phase,
        intensity: modifier
            ? rule.modifiedIntensity ?? rule.intenseIntensity ?? rule.defaultIntensity
            : rawPhase !== 'sustain' ? rule.intenseIntensity ?? rule.defaultIntensity : rule.defaultIntensity,
        sourceActionId: modifier?.actionId || rule.startActionId,
        sourceItemId: rule.sourceItemId,
        targetPointId,
        startedAtTick: start.ticksActive || 0,
    };
};

export const visualPhaseFor = (tension: number, discharged = false): CharacterVisualDescriptor['activation'] => {
    if (discharged || tension >= 85) return 'peak';
    if (tension >= 65) return 'intense';
    if (tension >= 20) return 'working';
    return 'calm';
};

export const interactionAssetPath = (
    descriptor: CharacterVisualDescriptor,
    family: string,
    variant: string,
    phase: VisualPhase,
) => `/character-images/interactions/${descriptor.characterSlug}/${family}/${variant}__${phase}.png`;
