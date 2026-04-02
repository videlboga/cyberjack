export type LoreLevel = 'world' | 'faction' | 'origin' | 'event' | 'trait';

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

export interface GeneratorOptions {
    seed?: string;
    levelPickCounts?: Partial<Record<LoreLevel, number>>;
    includeTags?: string[];
    excludeTags?: string[];
    forced?: string[];
}

export interface GeneratedTag extends LoreTagDefinition {
    note?: string;
}

export interface GeneratedCharacterContext {
    tags: GeneratedTag[];
    grouped: Record<LoreLevel, GeneratedTag[]>;
    loreNotes: string[];
    loreRefs: string[];
    loreEntries: Array<{ uid: string; text: string; entry?: any }>;
    personaNotes: string[];
    seed: string;
    narrative?: NarrativeSummary;
}

export interface NarrativeSummary {
    identityParagraphs: string[];
    historyParagraphs: string[];
    activationParagraphs: string[];
}

export const LEVEL_ORDER: LoreLevel[] = ['world', 'faction', 'origin', 'event', 'trait'];
