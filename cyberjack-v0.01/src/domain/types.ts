// src/domain/types.ts

// --- Core State Contracts ---

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

// --- Engine Engine Config ---
export interface EngineConfig {
    core: {
        defaults: SubjectCoreState;
        min: number;
        max: number;
    };
    point: {
        defaults: SubjectPointState;
        min: number;
        max: number;
    };
    action: {
        defaults: CompiledAction;
        ranges: Record<keyof CompiledAction, [number, number, number]>;
    };
    formulas: any; // We'll type this fully later
}

// --- Orchestration Contracts ---

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

// Stubs for future phases:

export interface GameEvent {
    type: string;
    payload: any;
}

export interface PromptPayload {
    stateSummary: string;
    recentEvents: string[];
}

export interface PlayerState {
    id: string;
    resources: Record<string, number>;
}

export interface Scene {
    id: string;
    availableActions: string[];
}

export interface Mission {
    id: string;
    progress: number;
}

export interface ContextPreset {
    id: string;
    modifiers: Partial<CompiledAction>;
}
