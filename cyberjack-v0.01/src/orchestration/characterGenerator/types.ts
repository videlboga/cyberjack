export type LoreLevel = 'world' | 'faction' | 'origin' | 'event' | 'trait' | 'persona' | 'physical' | 'psychological';

export interface LoreTagDefinition {
    id: string;
    level: LoreLevel;
    title: string;
    summary: string;
    stKeywords: string[];
    loreRefs: string[];
    weight?: number;
    requires?: string[];
    excludes?: string[];
    personaHooks?: string[];
    narrative?: TagNarrative;
    category?: string;
    coreModifiers?: Record<string, number>;
    weightModifiers?: Record<string, number>;
    initialContexts?: string[];
    archetypes?: CharacterArchetype[];
}

export interface TagNarrative {
    identity?: string[];
    history?: string[];
    activation?: string[];
}

export interface TagNarrativeFragment {
    identityHooks?: string[];
    historyHooks?: string[];
    activationHooks?: string[];
}

export type CharacterArchetype = 'asset' | 'broker' | 'client' | 'observer';

export interface GeneratorOptions {
    seed?: string;
    levelPickCounts?: Partial<Record<LoreLevel, number>>;
    includeTags?: string[];
    excludeTags?: string[];
    forced?: string[];
    archetype?: CharacterArchetype;
}

export interface GeneratedTag extends LoreTagDefinition {
    note?: string;
}

export interface GeneratedCharacterContext {
    archetype: CharacterArchetype;
    tags: GeneratedTag[];
    grouped: Record<LoreLevel, GeneratedTag[]>;
    loreNotes: string[];
    loreRefs: string[];
    loreEntries: Array<{ uid: string; text: string; entry?: any }>;
    personaNotes: string[];
    seed: string;
    narrative?: NarrativeSummary;
    originStatements?: string[];
    assetReasons?: string[];
    baseModifiers?: Record<string, number>;
    initialContexts?: string[];
    baseProfile?: {
        name: string;
        age: string;
        anatomy: string;
    };
    // Preferences to be serialized into subject state (actions, points, contexts)
    preferences?: {
        actions?: Record<string, number>;
        points?: Record<string, number>;
        contexts?: Record<string, number>;
    };
}

export interface NarrativeSummary {
    identityParagraphs: string[];
    historyParagraphs: string[];
    activationParagraphs: string[];
}

export const LEVEL_ORDER: LoreLevel[] = ['world', 'origin', 'faction', 'persona', 'physical', 'psychological', 'event', 'trait'];
