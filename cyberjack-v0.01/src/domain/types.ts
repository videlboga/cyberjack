export interface SubjectCoreState {
    sensitivity: number;
    capacity: number;
    openness: number;
    plasticity: number;
    attitude: number;
    baselineSensitivity?: number;
    baselineCapacity?: number;
    baselineOpenness?: number;
    baselinePlasticity?: number;
    baselineAttitude?: number;
}

export type CharacterKind = 'subject' | 'player' | 'npc';

export interface Character {
    id: string;
    name: string;
    kind: CharacterKind;
    subjectId?: string | null;
    playerId?: string | null;
    currentSceneId?: string | null;
}

export interface CharacterRelation {
    fromId: string;
    toId: string;
    knows: boolean;
    present: boolean;
    canInteract: boolean;
    attitude: number;
    baselineAttitude?: number;
    target?: Character;
}

export interface SubjectPointState {
    pointId: string;
    localSensitivity: number;
    localAttitude: number;
    familiarity?: number;
    exposureCount?: number;
    baselineLocalSensitivity?: number;
    baselineLocalAttitude?: number;
}

export interface ActionSourceInfo {
    presetId?: string;
    rawText?: string;
    parserVersion?: string;
}

export interface ContextConfig {
    type: "pose" | "clothing" | "equipment" | "environment" | "social" | "restraint" | "condition";
    occupiesPoints: string[];
    exclusiveWithinPoint?: boolean;
    blocksPoints?: string[];
    blockedFunctions?: string[];
    boostedFunctions?: string[];
    requiredFunctions?: string[];
    priority?: number;
    duration?: number;
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
    removeContexts?: string[];
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
export interface ResourceState { id: string; resources: Record<string, number>; }

export interface SceneTransitionRule {
    targetSceneId: string;
    conditions?: {
        requiresActionId?: string;
        minAttitude?: number;
        maxAttitude?: number;
    };
}

export interface Scene {
    id: string;
    title?: string;
    description?: string;
    availableActions: string[];
    actionCosts?: Record<string, Record<string, number>>;
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
export interface Mission { id: string; progress: number; }
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
}

export interface OrchestratedTurn {
    narrator?: NarratorDecision;
    actorDecisions: ActorDecision[];
}

export interface DiagnosticsOutput {
    actionSummary: string;
    reactionSummary: string;
    inferredTraits: Record<string, string>;
    rawDelta: {
        attitudeDelta: number;
        opennessDelta: number;
    };
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
        updatedMission: Mission | null;
        success: boolean;
        error?: string;
    };
    metadata?: Record<string, unknown>;
}
