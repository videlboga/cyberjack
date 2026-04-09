import { activeConfig } from '../../prompts/config';
import { generateCharacterContext } from './generator';
import { composePromptSections } from './promptComposer';
import { getGeneratedProfile, setGeneratedProfile, StoredProfile } from './profileStore';

function buildFallbackNarrative() {
    return {
        identityParagraphs: [],
        historyParagraphs: [],
        activationParagraphs: []
    };
}

export function ensureGeneratedProfile(subjectId: string): StoredProfile {
    const existing = getGeneratedProfile(subjectId);
    if (existing) {
        return existing;
    }

    const context = generateCharacterContext({ seed: subjectId });
    const narrative = context.narrative || buildFallbackNarrative();

    const hasGeneratedNarrative = true;

    const identityBlocks = narrative.identityParagraphs?.length
        ? narrative.identityParagraphs
        : [];
    const historyBlocks = narrative.historyParagraphs?.length
        ? narrative.historyParagraphs
        : [];
    const activationBlocks = narrative.activationParagraphs || [];    const sections = composePromptSections(context, {
        identity: activeConfig.character.identity,
        history: activeConfig.character.history,
        instructions: activeConfig.character.formatInstructions,
        identityBlocks,
        historyBlocks,
        activationBlocks,
        originBlocks: context.originStatements,
        assetBlocks: context.assetReasons
    });

    const draftProfile = {
        personaText: sections.personaText,
        personaWithoutTraits: sections.personaWithoutTraits,
        traitBlock: sections.traitBlock,
        loreNotes: context.loreNotes,
        loreRefs: context.loreRefs,
        systemPrompt: sections.systemPrompt,
        identityText: sections.identityText,
        historyText: sections.historyText,
        activationText: sections.activationText,
        seed: context.seed
    };

    setGeneratedProfile(subjectId, draftProfile);
    const stored = getGeneratedProfile(subjectId);
    if (!stored) {
        throw new Error('Failed to persist generated profile');
    }
    return stored;
}
