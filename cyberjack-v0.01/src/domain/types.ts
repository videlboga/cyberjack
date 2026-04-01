export interface SubjectCoreState {
    sensitivity: number;
    capacity: number;
    openness: number;
    plasticity: number;
    attitude: number;
}
export interface SubjectPointState {
    localSensitivity: number;
    localAttitude: number;
}
export interface CompiledAction {
    intensity: number;
    valence: number;
    contact: number;
    sharpness: number;
    novelty: number;
}
export interface EngineConfig {
    core: { defaults: SubjectCoreState; min: number; max: number; };
    point: { defaults: SubjectPointState; min: number; max: number; };
    action: { defaults: CompiledAction; ranges: Record<keyof CompiledAction, [number, number, number]>; };
    formulas: any;
}
export interface TickInput {
    action: CompiledAction;
    core: SubjectCoreState;
    point: SubjectPointState;
}
export interface TickOutput {
    nextCore: SubjectCoreState;
    nextPoint: SubjectPointState;
    result: Record<string, any>;
    tickMeta?: any;
}
export interface GameEvent { type: string; payload: any; }
export interface PlayerState { id: string; resources: Record<string, number>; }
export interface Scene { id: string; availableActions: string[]; }
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
    stateSummary: string;
    recentEvents: string[];
    systemPrompt?: string;
}
