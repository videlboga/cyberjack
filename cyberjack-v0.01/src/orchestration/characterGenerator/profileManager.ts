import { activeConfig } from '../../prompts/config';
import { generateCharacterContext } from './generator';
import { composePromptSections } from './promptComposer';
import { getGeneratedProfile, setGeneratedProfile, StoredProfile } from './profileStore';
import { db } from '../../infrastructure/db';
import { CharacterArchetype } from './types';

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

    let isBroker = false;
    let archetype: CharacterArchetype = 'asset';
    try {
        const brokerRes = db.prepare('SELECT character_id FROM character_resources WHERE character_id = ? AND resource_key = ?').get(subjectId, 'store_catalog');
        if (brokerRes) {
            isBroker = true;
            archetype = 'broker';
        }
    } catch (e) {
        // Ignored
    }
    // Note: Future roles like 'client' could be determined similarly

    const context = generateCharacterContext({ seed: subjectId, archetype });
    const narrative = context.narrative || buildFallbackNarrative();

    const hasGeneratedNarrative = true;

    const identityBlocks = narrative.identityParagraphs?.length 
        ? narrative.identityParagraphs 
        : [];
    const historyBlocks = narrative.historyParagraphs?.length 
        ? narrative.historyParagraphs 
        : [];
    const activationBlocks = narrative.activationParagraphs || [];    
    
    const archConfig = activeConfig.character.archetypes?.[archetype] || {};

    const archetypeBlockLines = [];
    if (archConfig.identity) archetypeBlockLines.push(archConfig.identity);
    if (archConfig.history) archetypeBlockLines.push(archConfig.history);
    const archetypeBlock = archetypeBlockLines.join(' ');

    const sections = composePromptSections(context, {
        identity: activeConfig.character.identity,
        history: activeConfig.character.history,
        instructions: archConfig.formatInstructions || activeConfig.character.formatInstructions,
        archetypeBlock,
        identityBlocks,
        historyBlocks,
        activationBlocks,
        originBlocks: context.originStatements,
        assetBlocks: context.assetReasons,
        assetTitle: archetype === 'asset' ? '[Почему ты стал активом]' : 
                   archetype === 'broker' ? '[Твой путь в торговлю]' : 
                   archetype === 'client' ? '[Почему ты представляешь фракцию]' : 
                   '[О твоей роли]'
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
