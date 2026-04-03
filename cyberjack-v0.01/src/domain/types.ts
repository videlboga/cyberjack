export interface SubjectCoreState {
    sensitivity: number;
    capacity: number;
    openness: number;
    plasticity: number;
    attitude: number;
}

export interface SubjectPointState {
    pointId: string;
    localSensitivity: number;
    localAttitude: number;
    familiarity?: number;
    exposureCount?: number;
}

export interface ActionSourceInfo {
    presetId?: string;
    rawText?: string;
    parserVersion?: string;
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
export interface PlayerState { id: string; resources: Record<string, number>; }

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
}

export interface ContextPreset {
    id: string;
    label: string;
    point_id?: string; // fallback if needed
    modifiers: Partial<CompiledAction>;
    
    type: "pose" | "clothing" | "equipment" | "environment" | "social" | "restraint" | "condition";
    slot: string;
    exclusiveWithinSlot?: boolean;
    blocksSlots?: string[];
    affectedPointIds?: string[];
    blockedFunctions?: string[];
    boostedFunctions?: string[];
    requiredFunctions?: string[];
    priority?: number;
}

export interface PromptPayload {
    subjectId: string;
    sceneId?: string;
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
        updatedPlayer: PlayerState;
        updatedMission: Mission | null;
        success: boolean;
        error?: string;
    };
    metadata?: Record<string, unknown>;
}
