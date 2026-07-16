import { activeConfig } from '../../prompts/config';
import { db } from '../../infrastructure/db';
import { generateCharacterContext } from './generator';
import { composePromptSections } from './promptComposer';
import { compileGeneratedProfile, PROFILE_GENERATOR_REVISION } from './profileV2';
import { CharacterArchetype, GeneratedProfileV2, GeneratorOptions } from './types';
import { roleHistoryPrompt } from '../../scenario/characterLifecycle';

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
    if (canonical.recruitment || ['candidate', 'assistant', 'staff', 'person'].includes(status)) return 'person';
    if (['asset', 'broker', 'client', 'observer'].includes(status)) return status;
    if (character && db.prepare('SELECT 1 FROM character_resources WHERE character_id = ? AND resource_key = ?').get(character.id, 'store_catalog')) {
        return 'broker';
    }
    return 'asset';
}

function withLifecycle(profile: GeneratedProfileV2, character?: CharacterRow, canonical: Record<string, any> = {}): GeneratedProfileV2 {
    if (!character) return profile;
    const canonicalBiography = String(canonical.origin?.biography || '').trim();
    const lifecycle = roleHistoryPrompt(character.id);
    const canonicalBlock = canonicalBiography ? `[Каноническая биография — имеет приоритет]\n${canonicalBiography}` : '';
    const additions = [canonicalBlock, lifecycle].filter(Boolean).join('\n\n');
    if (!additions) return profile;
    return {
        ...profile,
        personaText: `${profile.personaText}\n\n${additions}`,
        systemPrompt: `${profile.systemPrompt || profile.personaText}\n\n${additions}`
    };
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

function applyCanonicalPersonality(profile: GeneratedProfileV2, canonical: Record<string, any>): GeneratedProfileV2 {
    const personality = canonical.personality;
    if (!personality || typeof personality !== 'object') return profile;
    const traits = Array.isArray(personality.traits)
        ? personality.traits.map((value: any) => String(value).trim()).filter(Boolean)
        : [];
    const quirks = Array.isArray(personality.quirks)
        ? personality.quirks.map((value: any) => String(value).trim()).filter(Boolean)
        : [];
    const belief = String(personality.coreBelief || '').trim();
    const speechStyle = String(personality.speechStyle || '').trim();
    const profession = `${canonical.origin?.professionId || ''} ${canonical.origin?.biography || ''}`;
    const traitText = traits.join(' ');
    const attentionFocus = Array.from(new Set([
        /наблюд|вниматель|свер/i.test(`${traitText} ${quirks.join(' ')}`) ? 'change' : undefined,
        /практич|клиник|санитар|техник|оператор/i.test(`${traitText} ${profession}`) ? 'technique' : undefined,
        /эмпат|собеседник|реакци/i.test(`${traitText} ${quirks.join(' ')}`) ? 'person' : undefined,
        /осторож|риск|безопас/i.test(`${traitText} ${belief}`) ? 'risk' : undefined,
        /протокол|правил|измер|контрол/i.test(`${belief} ${profession}`) ? 'rules' : undefined
    ].filter(Boolean))) as GeneratedProfileV2['behavioralCore']['attentionFocus'];
    if (!traits.length && !quirks.length && !belief && !speechStyle) return profile;

    const values = [belief, ...traits.map((trait: string) => `Устойчивая черта: ${trait}`)].filter(Boolean);
    return {
        ...profile,
        behavioralCore: {
            ...profile.behavioralCore,
            values: Array.from(new Set([...values, ...profile.behavioralCore.values])).slice(0, 5),
            // Authored personality is the character's normal voice. Procedural
            // role colour remains available only as a secondary influence.
            voice: speechStyle ? [speechStyle] : profile.behavioralCore.voice,
            mannerisms: Array.from(new Set([...quirks, ...profile.behavioralCore.mannerisms])).slice(0, 4),
            // A complete authored dossier must not silently acquire a random
            // phobia, hostility script or conditional equipment trigger.
            vulnerabilities: [],
            defenses: [],
            conditionalReactions: [],
            attentionFocus: attentionFocus?.slice(0, 3),
            speechDisposition: /молчал|немногослов|редко говорит/i.test(`${speechStyle} ${traitText}`) ? 'quiet' : 'normal'
        }
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
    return applyCanonicalPersonality(compileGeneratedProfile(subjectId, context, sections), canonical);
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
        return withLifecycle(existing as GeneratedProfileV2, character, canonical);
    }

    const generated = buildProfile(subjectId, character, canonical);
    if (character) persistProfile(character, canonical, generated);
    return withLifecycle(generated, character, canonical);
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
    return withLifecycle(generated, character, canonical);
}
