export interface SubjectCoreState {
    sensitivity: number;
    capacity: number;
    openness: number;
    plasticity: number;
    attitude: number;
    preferences?: string; // JSON string of preferences (points, actions, contexts)
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
    localSensitivity: number;
    localAttitude: number;
    localOpenness?: number;
    familiarity?: number;
    exposureCount?: number;
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
    type: "pose" | "clothing" | "equipment" | "environment" | "social" | "restraint" | "condition" | "trait";
    occupiesPoints: string[];
    exclusiveWithinPoint?: boolean;
    blocksPoints?: string[];
    blockedFunctions?: string[];
    boostedFunctions?: string[];
    requiredFunctions?: string[];
    priority?: number;
    duration?: number;
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
    config?: EngineConfig;
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
    };
    formulas?: Record<string, string>;
}

export interface TickOutput {
    nextCore: SubjectCoreState;
    nextPoint: SubjectPointState;
    result: TickResult;
    delta: TickDelta;
    tickMeta: TickMeta;
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
    type: 'flag' | 'attitude' | 'trait' | 'resource' | 'custom';
    key?: string; // e.g. "masochistic_tendencies"
    operator?: '>' | '<' | '==' | '!=';
    value?: any; 
}

export interface AssetContract {
    id: string;
    issuerId: string; // reference to Faction
    title: string;
    description: string;
    state: 'available' | 'accepted' | 'completed' | 'failed' | 'expired';
    acceptedByPlayerId?: string;
    attachedSubjectId?: string; // asset assigned to order
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
}

export interface NarratorPromptPayload {
    subjectId: string;
    recentEventsText: string;
    stateText: string;
    instructions?: string;
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
}
