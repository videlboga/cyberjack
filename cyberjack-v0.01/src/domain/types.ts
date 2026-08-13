import type { CommandIntent } from './resolver';

export interface SubjectCoreState {
    sensitivity: number; // Чувствительность (реакция на физическое воздействие, интенсивность ощущений)
    capacity: number;    // Выносливость / Ресурс (способность выдерживать стресс, сопротивляемость перегрузке)
    openness: number;    // Открытость (восприимчивость к новому опыту, снятие психологических барьеров)
    plasticity: number;  // Пластичность (податливость разума к изменениям, формированию новых привязанностей/трейтов)
    attitude: number;    // Отношение / Лояльность (позитивное/негативное отношение к оператору, покорность)
    tension: number;     // Напряжение: накопленный физиологический/психологический накал для оргазма, перегрузки или срыва
    preferences?: string; // JSON string of preferences (points, actions, contexts, learned semantic tags)
    baselineSensitivity?: number;
    baselineCapacity?: number;
    baselineOpenness?: number;
    baselinePlasticity?: number;
    baselineAttitude?: number;
    flags?: string[];
}

export type CharacterKind = 'subject' | 'player' | 'npc';

export interface Character {
    id: string;
    name: string;
    kind: CharacterKind;
    subjectId?: string | null;
    playerId?: string | null;
    currentSceneId?: string | null;
    profileJson?: string | null;
}

export interface CharacterRelation {
    fromId: string;
    toId: string;
    knows: boolean;
    familiarityLevel?: number; // 0.0 - 1.0 or higher
    generalOpinion?: string; // Text summary of the opinion
    recentMemories?: string[]; // Array of text memories
    present: boolean;
    canInteract: boolean;
    attitude: number;
    openness?: number;
    plasticity?: number;
    baselineAttitude?: number;
    baselineOpenness?: number;
    baselinePlasticity?: number;
    target?: Character;
}

export interface SubjectPointState {
    pointId: string;
    localSensitivity: number; // Локальная чувствительность зоны
    localAttitude: number;    // Локальное отношение (триггер/сопротивление или принятие)
    localOpenness?: number;   // Локальная открытость (готовность зоны к новым видам стимуляции)
    familiarity?: number;     // Привычность воздействия на зону
    exposureCount?: number;   // Счетчик воздействий (выдержка зоны)
    baselineLocalSensitivity?: number;
    baselineLocalAttitude?: number;
    baselineLocalOpenness?: number;
}

export interface ActionSourceInfo {
    presetId?: string;
    rawText?: string;
    parserVersion?: string;
}

export interface TraitRule {
    trigger: {
        requireActionTags?: string[];
        requireAnatomyTags?: string[];
        minIntensity?: number;
    };
    overrides: {
        valence?: number;
        intensityMult?: number;
        attitudeShiftDelta?: number;
        opennessDelta?: number;
        capacityDelta?: number;
        pleasureDelta?: number;
    };
}

export interface ContextConfig {
    type: "pose" | "clothing" | "equipment" | "environment" | "social" | "restraint" | "condition" | "trait" | "status" | "sexual_interaction" | "sensory";
    activeLabel?: string;
    occupiesPoints: string[];
    exclusiveWithinPoint?: boolean;
    blocksPoints?: string[];
    blockedFunctions?: string[];
    boostedFunctions?: string[];
    requiredFunctions?: string[];
    priority?: number;
    duration?: number;
    durationUnit?: "ticks" | "minutes";
    promptEffect?: string;
    requiresItem?: string;
    requiresSceneObject?: string;
    modifiers?: Partial<CompiledAction>;
    traitRules?: TraitRule[];
}

export interface CharacterItem {
    characterId: string;
    itemId: string;
    state?: string;
    charges?: number;
    metadata?: Record<string, unknown>;
}

export interface SceneObject {
    id: string;
    sceneId: string;
    nodeId?: string;
    itemId: string;
    ownerId?: string;
    state?: string;
    metadata?: Record<string, unknown>;
}

export interface SceneLayoutNode {
    id: string;
    label: string;
    type?: string;
    properties?: Record<string, unknown>;
}

export interface SceneLayoutEdge {
    from: string;
    to: string;
    type?: string;
    conditions?: Record<string, unknown>;
}

export interface SceneLayout {
    sceneId: string;
    nodes: SceneLayoutNode[];
    edges: SceneLayoutEdge[];
}

/**
 * Semantic modifiers attached to a tick request by the verbal parser / event
 * router. These are the typed shape of `GameEventPayload.dynamicModifiers`
 * (Этап 9: типизация семантических полей dynamicModifiers).
 */
export interface DynamicModifiers {
    intensity?: number;
    valence?: number;
    contact?: number;
    sharpness?: number;
    novelty?: number;
    pointId?: string;
    tags?: string[];
    mentionedTags?: string[];
    semanticMentions?: { actionIds: string[]; pointIds: string[] };
    commandIntent?: CommandIntent;
    routing?: { actorId?: string; targetId?: string; actionId?: string; confidence?: number; source?: string };
    verbalIntent?: 'conversation' | 'question' | 'praise' | 'insult' | 'command';
    commandSourceText?: string;
    commandDescription?: string;
    pendingCommandRelation?: 'continue' | 'abandon' | 'unrelated';
    pendingCommandSourceText?: string;
    pendingCommandDescription?: string;
    resumedPendingCommand?: boolean;
    model?: string;
    raw?: string;
    contextConfig?: ContextConfig;
    description?: string;
    label?: string;
    sensory?: CompiledAction['sensory'];
}

export interface CompiledAction {
    actionKey: string;
    label: string;
    type: 'physical' | 'verbal' | 'context' | 'system';
    tags: string[];
    source?: ActionSourceInfo;
    intensity: number;
    valence: number;
    contact: number;
    sharpness: number;
    novelty: number;

    intensity_mult?: number;
    valence_mult?: number;
    contact_mult?: number;
    sharpness_mult?: number;
    novelty_mult?: number;

    contextConfig?: ContextConfig;
    requireContexts?: string[];
    removeContexts?: string[];
    requiresItem?: string;
    requiresSceneObject?: string;
    validTargets?: string[];
    /** Authored, non-technical description used to ground the character's perception. */
    description?: string;
    /** Optional sensory facets. Missing facets are inferred from the action vector. */
    sensory?: {
        stimulus?: string;
        texture?: string;
        rhythm?: string;
        bodilyResponse?: string;
        aftereffect?: string;
    };
}

export interface EngineConfig {
    core: { defaults: SubjectCoreState; min: number; max: number; };
    point: { defaults: Omit<SubjectPointState, 'pointId'>; min: number; max: number; };
    action: { defaults: Omit<CompiledAction, 'actionKey' | 'label' | 'type' | 'tags' | 'source'>; ranges: Record<'intensity' | 'valence' | 'contact' | 'sharpness' | 'novelty', [number, number, number]>; };
    formulas: any;
}

export interface TickInput {
    subjectId: string;
    pointId: string;
    action: CompiledAction;
    core: SubjectCoreState;
    point: SubjectPointState;
    // The relationship is deliberately separate from the subject's general
    // disposition: intimate contact is appraised in relation to its initiator.
    relationship?: Pick<CharacterRelation, 'attitude' | 'openness' | 'plasticity' | 'familiarityLevel'>;
    config?: EngineConfig;
    deltaTime?: number;
}

export interface TickResult {
    effectiveSensitivity: number;
    effectiveAttitude: number;
    attitudeShift: number;
    finalValence: number;
    experiencedIntensity: number;
    pleasure: number;
    discomfort: number;
    overload: number;
    engagement: number;
    learningEffect: number;
    sensoryAmplification?: number;
    exceptionalSensoryLoad?: number;
}

export interface TickDelta {
    core: Partial<SubjectCoreState>;
    point: Partial<SubjectPointState>;
}

export interface TickMeta {
    inputs: {
        action: CompiledAction;
        core: SubjectCoreState;
        point: SubjectPointState;
    };
    derived: {
        effectiveSensitivity: number;
        effectiveAttitude: number;
        attitudeShift: number;
        attitudePower: number;
        comfortThreshold?: number;
        emotionalDiscomfort?: number;
        sharpDiscomfort?: number;
        strainDiscomfort?: number;
        overloadDiscomfort?: number;
        physicalDiscomfort?: number;
        sensoryAmplification?: number;
        exceptionalSensoryLoad?: number;
    };
    formulas?: Record<string, string>;
}

export interface TickOutput {
    nextCore: SubjectCoreState;
    nextPoint: SubjectPointState;
    result: TickResult;
    delta: TickDelta;
    tickMeta: TickMeta;
    notableEvent?: 'positive_discharge' | 'peak_overload' | 'breakdown' | 'exhaustion';
}

export interface GameEvent {
    id: string;
    type: 'ui_action' | 'verbal_input' | 'context_change' | 'system_tick' | 'scenario_trigger';
    subjectId: string;
    playerId?: string;
    sceneId?: string;
    pointId?: string;
    timestamp: string;
    payload: Record<string, unknown>;
}
export interface CharacterResource {
    characterId: string;
    resourceKey: string;
    amount: number;
    maxAmount?: number;
    regenRate?: number;
    metadata?: Record<string, unknown>;
}

export interface ResourceState {
    id: string; // character id
    resources: Record<string, CharacterResource>;
}

export interface SceneTransitionRule {
    targetSceneId: string;
    conditions?: {
        requiresActionId?: string;
        minAttitude?: number;
        maxAttitude?: number;
    };
}

export interface ActionCostDefinition {
    require?: Record<string, number>;
    consume?: Record<string, number>;
}

export interface Scene {
    id: string;
    title?: string;
    description?: string;
    availableActions: string[];
    actionCosts?: Record<string, ActionCostDefinition>;
    transitions?: SceneTransitionRule[];
    characters?: SceneCharacterPresence[];
    slots?: string[];
}

export interface SceneCharacterPresence {
    character: Character;
    role: string;
    canAct: boolean;
    presenceState: string;
    slotId?: string;
}
export interface Faction {
    id: string;
    name: string;
    type: 'syndicate' | 'research_center' | 'security' | 'other';
    description?: string;
    meta?: Record<string, unknown>;
}

export interface PlayerFactionState {
    playerId: string;
    factionId: string;
    relation: number;
    trust: number;
    accessLevel: number;
    flags: string[];
}

export interface AssetContractCondition {
    type: 'flag' | 'attitude' | 'trait' | 'resource' | 'custom' | 'preference' | 'acquired_trait';
    key?: string; // e.g. "masochistic_tendencies"
    operator?: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value?: any; 
}

export interface AssetContract {
    id: string;
    issuerId: string; // reference to Faction
    title: string;
    description: string;
    state: 'available' | 'accepted' | 'completed' | 'failed' | 'expired';
    acceptedByPlayerId?: string;
    attachedSubjectId?: string; // legacy field; assets are selected only on delivery
    deadlineTick?: number; 
    conditions: AssetContractCondition[];
    rewards: {
        credits?: number;
        trust?: number;
        items?: string[];
    };
    penalties?: {
        credits?: number;
        trust?: number;
    };
}
export interface AnatomyPointPreset {
    id: string;
    label: string;
    defaults: {
        localSensitivity: number;
        localAttitude: number;
    };
    parentId?: string | null;
    providesFunctions: string[];
    tags: string[];
    isVirtual?: boolean;
}

export interface PromptPayload {
    subjectId: string;
    sceneId?: string;
    relations?: CharacterRelation[];
    currentStateSummary: {
        interpretation: string;
        attitude: number;
        localAttitude: number;
        engagement: number;
        overload: number;
    };
    recentEvents: Array<{
        type: string;
        interpretation: string;
    }>;
    diagnostics?: string[];
    sceneContext?: string;
    longTermMemory?: string[];
    systemPrompt?: string;
    narratorPrompt?: NarratorPromptPayload;
    reactionFrame?: import('../narrative/reactionFrame').ReactionFrame;
    /** Этап 10: структурированная наблюдаемость выбора памяти. */
    memorySelection?: { associations: number; subjective: number; episodes: number; total: number };
}

export interface NarratorPromptPayload {
    subjectId: string;
    recentEventsText: string;
    stateText: string;
    instructions?: string;
    // Narrator B: speech and context for a richer chronicle
    characterSpeech?: string;
    characterName?: string;
    playerSpeech?: string;
    activeContexts?: string[];
    tickResultSummary?: string;
    systemEvents?: string[];
}

export interface ScenePromptPayload {
    subjectId: string;
    actionLabel: string;
    pointLabel: string;
    actorName: string;
    targetName: string;
    stateText: string;
    contextsText: string;
    tickResultText: string;
}

export interface NarratorReply {
    reaction: string;
}

export interface NarratorDecision {
    enabled: boolean;
    reason?: string;
}


export interface ActorDecision {
    actorId: string;
    kind: 'reactive' | 'proactive';
    reason?: string;
    impulse?: {
        id: string;
        primaryIntent: string;
        secondaryConflict: string;
        allowedSpeechActs: string[];
    };
    mechanicalAction?: {
        actionId: string;
        pointId: string;
        targetId: string;
        score?: number;
    };
}

export interface OrchestratedTurn {
    narrator?: NarratorDecision;
    actorDecisions: ActorDecision[];
    diagnostics?: any[];
}

export interface DiagnosticsOutput {
    actionSummary: string;
    reactionSummary: string;
    inferredTraits: Record<string, string>;
    rawDelta: {
        attitudeDelta: number;
        opennessDelta: number;
    };
    physicalEffect?: number;
    emotionalEffect?: number;
    observation?: InteractionObservation;
}

export type BehavioralState = 'responsive' | 'subspace' | 'overload' | 'freeze' | 'panic' | 'defiance' | 'unresponsive';
export type ContextRole = 'behavior' | 'physiology' | 'equipment' | 'pose' | 'restraint' | 'environment' | 'other';

export interface ObservationContext {
    id: string;
    label: string;
    role: ContextRole;
    pointId?: string | null;
}

export interface InteractionObservation {
    action: {
        id: string;
        label: string;
        pointId: string;
        pointLabel?: string;
        description?: string;
        sensory?: CompiledAction['sensory'];
    };
    contact: 'none' | 'partial' | 'full' | 'forced';
    behavioralState: BehavioralState;
    reaction: {
        pleasure: number;
        discomfort: number;
        overload: number;
        engagement: number;
        mixed: boolean;
        /** Psychological appraisal of the action, independently of bodily comfort. */
        appraisal: number;
        experiencedIntensity?: number;
        sensoryAmplification?: number;
        exceptionalSensoryLoad?: number;
    };
    reactionSnapshot?: {
        sensation: { pleasure: number; discomfort: number; overload: number; intensity: number };
        appraisal: { valence: number; willingness: number; agency: number; trust: number };
        affect: { valence: number; arousal: number; control: number; emotion: string };
        behavior: {
            state: BehavioralState;
            resistance: number;
            desiredResponse: 'continue' | 'slow_down' | 'stop' | 'escape' | 'silent_compliance' | 'forced_rationalization' | 'assimilated_acceptance';
        };
        dynamics: { subjectId: string; actorId: string; resistance: number; learnedCompliance: number; dependency: number; dissociation: number; fear: number };
        boundary: null | { request: 'none' | 'slow_down' | 'stop'; ignored: boolean; respected: boolean; intensity: number };
    };
    physicalReaction?: import('../narrative/physicalReaction').PhysicalReactionFrame;
    boundaryExpression?: import('../narrative/boundaryExpression').BoundaryExpressionFrame;
    learning: {
        effect: number;
        familiarityDelta: number;
        sensitivityDelta: number;
        baselineSensitivityDelta: number;
    };
    changes: { tension: number; capacity: number; sensitivity: number; attitude: number; openness: number; plasticity: number; localAttitude: number; localOpenness: number };
    contexts: ObservationContext[];
    currentState: { title: string; description: string };
    transitions: Array<{
        kind: 'state' | 'discharge' | 'overload' | 'breakdown' | 'recovery' | 'contact';
        title: string;
        text: string;
        severity: 'notice' | 'major' | 'danger';
    }>;
    uiText: string;
    subjectiveText: string;
    technicalText: string;
}


export interface TickBundle {
    tickId: string;
    event: GameEvent;
    compiledAction: CompiledAction;
    output: TickOutput;
    stateBefore: {
        core: SubjectCoreState;
        point: SubjectPointState;
    };
    stateAfter: {
        core: SubjectCoreState;
        point: SubjectPointState;
    };
    diagnostics: DiagnosticsOutput;
    prompt: PromptPayload & { systemPrompt: string };
    scenario?: {
        nextSceneId: string | null;
        updatedResources: ResourceState;
        updatedContracts: AssetContract[];
        success: boolean;
        error?: string;
    };
    metadata?: Record<string, unknown>;
    // Whether this tick actually applied any state-changing effects
    actionApplied?: boolean;
    // System messages generated during the tick (refusals, context changes, etc.)
    systemNotes?: string[];
}
