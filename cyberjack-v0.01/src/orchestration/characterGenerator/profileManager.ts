import { activeConfig } from '../../prompts/config';
import { db } from '../../infrastructure/db';
import { generateCharacterContext } from './generator';
import { composePromptSections } from './promptComposer';
import { compileGeneratedProfile, PROFILE_GENERATOR_REVISION } from './profileV2';
import { CharacterArchetype, GeneratedProfileV2, GeneratorOptions } from './types';

type CharacterRow = {
    id: string;
    name: string;
    subject_id: string | null;
    profile_json: string | null;
};

function parseJson(value?: string | null): Record<string, any> {
    try {
        const parsed = JSON.parse(value || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function findCharacter(subjectId: string): CharacterRow | undefined {
    return db.prepare('SELECT id, name, subject_id, profile_json FROM characters WHERE subject_id = ? OR id = ? LIMIT 1')
        .get(subjectId, subjectId) as CharacterRow | undefined;
}

function determineArchetype(character: CharacterRow | undefined, canonical: Record<string, any>): CharacterArchetype {
    const status = canonical.base?.status;
    if (['asset', 'broker', 'client', 'observer'].includes(status)) return status;
    if (character && db.prepare('SELECT 1 FROM character_resources WHERE character_id = ? AND resource_key = ?').get(character.id, 'store_catalog')) {
        return 'broker';
    }
    return 'asset';
}

function identityFrom(character: CharacterRow | undefined, canonical: Record<string, any>): NonNullable<GeneratorOptions['identity']> {
    const base = canonical.base || canonical.identity || {};
    const gender = ['male', 'female', 'other'].includes(base.gender) ? base.gender : 'other';
    return {
        name: base.name || character?.name || character?.subject_id || character?.id || 'Без имени',
        age: base.age ?? 25,
        gender,
        anatomy: base.anatomy || 'human'
    };
}

function buildProfile(
    subjectId: string,
    character: CharacterRow | undefined,
    canonical: Record<string, any>,
    options: Pick<GeneratorOptions, 'seed' | 'includeTags' | 'excludeTags' | 'forced'> = {}
): GeneratedProfileV2 {
    const archetype = determineArchetype(character, canonical);
    const context = generateCharacterContext({
        ...options,
        seed: options.seed || subjectId,
        archetype,
        identity: identityFrom(character, canonical)
    });
    const narrative = context.narrative || { identityParagraphs: [], historyParagraphs: [], activationParagraphs: [] };
    const archConfig = activeConfig.character.archetypes?.[archetype] || {};
    const archetypeBlock = [archConfig.identity, archConfig.history].filter(Boolean).join(' ');
    const sections = composePromptSections(context, {
        identity: activeConfig.character.identity,
        history: activeConfig.character.history,
        instructions: archConfig.formatInstructions || activeConfig.character.formatInstructions,
        archetypeBlock,
        identityBlocks: narrative.identityParagraphs || [],
        historyBlocks: narrative.historyParagraphs || [],
        activationBlocks: narrative.activationParagraphs || [],
        originBlocks: context.originStatements,
        assetBlocks: context.assetReasons,
        assetTitle: archetype === 'asset' ? '[Почему ты стал активом]' : '[Причина текущего статуса]'
    });
    return compileGeneratedProfile(subjectId, context, sections);
}

function persistProfile(character: CharacterRow, canonical: Record<string, any>, generatedProfile: GeneratedProfileV2) {
    const next = generatedProfile.version === 2 && canonical.version === 2
        ? { generatedProfile }
        : { ...canonical, generatedProfile };
    db.prepare('UPDATE characters SET profile_json = ? WHERE id = ?').run(JSON.stringify(next), character.id);
}

export function ensureGeneratedProfile(subjectId: string): GeneratedProfileV2 {
    const character = findCharacter(subjectId);
    const canonical = parseJson(character?.profile_json);
    const existing = canonical.generatedProfile || (canonical.version === 2 ? canonical : undefined);
    if (existing?.version === 2 && existing.generatorRevision >= PROFILE_GENERATOR_REVISION) {
        return existing as GeneratedProfileV2;
    }

    const generated = buildProfile(subjectId, character, canonical);
    if (character) persistProfile(character, canonical, generated);
    return generated;
}

export function regenerateGeneratedProfile(
    subjectId: string,
    options: Pick<GeneratorOptions, 'seed' | 'includeTags' | 'excludeTags' | 'forced'> = {}
): GeneratedProfileV2 {
    const character = findCharacter(subjectId);
    if (!character) throw new Error(`Character for subject ${subjectId} does not exist`);
    const canonical = parseJson(character.profile_json);
    const generated = buildProfile(subjectId, character, canonical, options);
    persistProfile(character, canonical, generated);
    return generated;
}
