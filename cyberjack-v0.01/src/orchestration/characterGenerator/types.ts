export type LoreLevel = 'world' | 'faction' | 'origin' | 'event' | 'trait' | 'persona' | 'physical' | 'psychological' | 'state' | 'response' | 'bias' | 'body';

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
    reactionTriggers?: Array<{ facts: string[]; response: string }>;
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

export type CharacterArchetype = 'person' | 'asset' | 'broker' | 'client' | 'observer';

export interface GeneratorOptions {
    seed?: string;
    includeTags?: string[];
    excludeTags?: string[];
    forced?: string[];
    archetype?: CharacterArchetype;
    identity?: {
        name: string;
        age?: number | string;
        gender?: 'male' | 'female' | 'other';
        anatomy?: string;
    };
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
        gender: 'male' | 'female' | 'other';
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

export const LEVEL_ORDER: LoreLevel[] = ['world', 'origin', 'faction', 'persona', 'physical', 'psychological', 'state', 'response', 'bias', 'body', 'event', 'trait'];

export interface GeneratedProfileV2 {
    version: 2;
    generatorRevision: number;
    subjectId: string;
    seed: string;
    identity: {
        name: string;
        age: number;
        gender: 'male' | 'female' | 'other';
        anatomy: string;
        archetype: CharacterArchetype;
    };
    biography: {
        origin: string[];
        formerRole?: string;
        statusCause?: string;
        formativeEvents: string[];
    };
    behavioralCore: {
        values: string[];
        needs: string[];
        vulnerabilities: string[];
        defenses: string[];
        voice: string[];
        mannerisms: string[];
        centralConflict: { desire: string; fear: string };
        conditionalReactions?: Array<{ facts: string[]; response: string }>;
        attentionFocus?: Array<'technique' | 'person' | 'body' | 'risk' | 'rules' | 'change'>;
        speechDisposition?: 'quiet' | 'normal' | 'expressive';
    };
    knowledgeRefs: string[];
    mechanicalSeed: {
        coreModifiers: Record<string, number>;
        initialContexts: string[];
        preferences: { actions: Record<string, number>; points: Record<string, number>; contexts: Record<string, number>; tags: Record<string, number> };
    };
    sourceTags: string[];
    storySeed?: {
        unresolvedPast: string;
        externalLink: string;
        concealedFact: string;
        pressure: string;
        activationTriggers: string[];
        possibleDirections: string[];
    };
    personaText: string;
    personaWithoutTraits?: string;
    traitBlock?: string;
    loreNotes?: string[];
    loreRefs?: string[];
    systemPrompt?: string;
    identityText?: string;
    historyText?: string;
    activationText?: string;
    updatedAt: string;
    authored?: boolean;
    authoredProfile?: Record<string, any>;
}
