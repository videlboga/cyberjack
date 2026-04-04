import { GeneratedCharacterContext } from './types';

interface PromptSectionsOptions {
    identity: string;
    history: string;
    instructions: string;
    traitsTitle?: string;
    loreTitle?: string;
    identityBlocks?: string[];
    historyBlocks?: string[];
    activationBlocks?: string[];
    originBlocks?: string[];
    assetBlocks?: string[];
    originTitle?: string;
    assetTitle?: string;
}

export interface PromptSectionsResult {
    personaText: string;
    personaWithoutTraits: string;
    traitBlock: string;
    loreBlock: string;
    systemPrompt: string;
    identityText: string;
    historyText: string;
    activationText: string;
    originText?: string;
    assetText?: string;
}

export function composePromptSections(
    context: GeneratedCharacterContext,
    options: PromptSectionsOptions
): PromptSectionsResult {
    const traitsTitle = options.traitsTitle || '[Характер и повадки]';
    const loreTitle = options.loreTitle || '[Записки из лора]';
    const originTitle = options.originTitle || '[Происхождение]';
    const assetTitle = options.assetTitle || '[Почему ты стал активом]';

    const hasIdentityBlocks = Array.isArray(options.identityBlocks);
    const hasHistoryBlocks = Array.isArray(options.historyBlocks);
    const hasActivationBlocks = Array.isArray(options.activationBlocks);

    const identityParagraphs =
        hasIdentityBlocks ? options.identityBlocks || [] : [options.identity];
    const historyParagraphs =
        hasHistoryBlocks ? options.historyBlocks || [] : [options.history];
    const activationParagraphs = hasActivationBlocks ? options.activationBlocks || [] : [];
    const originParagraphs = Array.isArray(options.originBlocks) ? options.originBlocks : [];
    const assetParagraphs = Array.isArray(options.assetBlocks) ? options.assetBlocks : [];

    const traitBlock = context.personaNotes.length
        ? context.personaNotes.map((note, idx) => `${idx + 1}. ${note}`).join('\n')
        : '1. Черты характера не заданы.';

    const identityText = identityParagraphs.filter(Boolean).join(' ');
    const historyText = historyParagraphs.filter(Boolean).join('\n\n');
    const activationText = activationParagraphs.filter(Boolean).join('\n\n');
    const originText = originParagraphs.filter(Boolean).join('\n');
    const assetText = assetParagraphs.filter(Boolean).join('\n');

    const originBlock = originText ? `${originTitle}\n${originText}` : '';
    const assetBlock = assetText ? `${assetTitle}\n${assetText}` : '';

    const personaWithoutTraits = [identityText, historyText, activationText]
        .filter(Boolean)
        .join('\n\n');

    const personaText = [
        personaWithoutTraits,
        originBlock,
        assetBlock,
        `${traitsTitle}\n${traitBlock}`
    ]
        .filter(Boolean)
        .join('\n\n');

    const loreBlock = context.loreNotes.length
        ? `${loreTitle}\n${context.loreNotes.join('\n\n')}`
        : '';

    const systemPrompt = [
        [personaWithoutTraits, originBlock, assetBlock].filter(Boolean).join('\n\n'),
        loreBlock,
        `[Инструкции]: ${options.instructions}`
    ]
        .filter(Boolean)
        .join('\n\n');

    return {
        personaText,
        personaWithoutTraits,
        traitBlock,
        loreBlock,
        systemPrompt,
        identityText,
        historyText,
        activationText,
        originText,
        assetText
    };
}
