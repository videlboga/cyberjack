import { activeConfig } from '../../prompts/config';
import { db } from '../../infrastructure/db';
import { generateCharacterContext } from './generator';
import { composePromptSections } from './promptComposer';
import { compileGeneratedProfile, PROFILE_GENERATOR_REVISION } from './profileV2';
import { CharacterArchetype, GeneratedProfileV2, GeneratorOptions } from './types';
import { roleHistoryPrompt } from '../../scenario/characterLifecycle';
import { compileAuthoredProfile } from '../../scenario/characters/authoredProfiles';
import { applyCharacterStartingTraits } from '../../scenario/characterStartingTraits';

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

function effectiveCurrentRole(character: CharacterRow | undefined, canonical: Record<string, any>): string | undefined {
    if (!character) return canonical.currentRole;
    const presence = db.prepare(`
        SELECT role FROM scene_characters
        WHERE character_id = ? AND presence_state = 'present'
        ORDER BY CASE role WHEN 'asset' THEN 0 WHEN 'staff' THEN 1 ELSE 2 END
        LIMIT 1
    `).get(character.id) as { role?: string } | undefined;
    if (presence?.role && ['asset', 'staff'].includes(presence.role)) return presence.role;
    return canonical.currentRole;
}

function determineArchetype(character: CharacterRow | undefined, canonical: Record<string, any>): CharacterArchetype {
    const status = canonical.base?.status;
    if (canonical.recruitment || ['candidate', 'assistant', 'staff', 'person', 'calibrator'].includes(status)) return 'person';
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
    const personalityText = `${traitText} ${quirks.join(' ')} ${belief} ${speechStyle}`;
    const attentionFocus = Array.from(new Set([
        /наблюд|вниматель|свер/i.test(`${traitText} ${quirks.join(' ')}`) ? 'change' : undefined,
        /практич|клиник|санитар|техник|оператор/i.test(`${traitText} ${profession}`) ? 'technique' : undefined,
        /эмпат|собеседник|реакци/i.test(`${traitText} ${quirks.join(' ')}`) ? 'person' : undefined,
        /осторож|риск|безопас/i.test(`${traitText} ${belief}`) ? 'risk' : undefined,
        /протокол|правил|измер|контрол/i.test(`${belief} ${profession}`) ? 'rules' : undefined
    ].filter(Boolean))) as GeneratedProfileV2['behavioralCore']['attentionFocus'];
    if (!traits.length && !quirks.length && !belief && !speechStyle) return profile;

    const values = [belief, ...traits.map((trait: string) => `Устойчивая черта: ${trait}`)].filter(Boolean);
    const authoredDefenses = [
        /язв|сарказ|ирон/i.test(personalityText) ? 'При уязвимости сначала возвращает себе контроль иронией или колкостью, а не прямым признанием.' : '',
        /молчал|немногослов|сдержан|закрыт/i.test(personalityText) ? 'Под давлением сокращает речь и скрывает значимую реакцию за молчанием или сухим ответом.' : '',
        /упрям|дерз|непокор|независ/i.test(personalityText) ? 'Когда решение навязывают, оспаривает рамку или ставит встречное условие, даже если само действие переносимо.' : '',
        /рацион|аналит|точн|практич|клиник|техник/i.test(personalityText) ? 'При тревоге переводит внимание на конкретные факты, технику и управляемый следующий шаг.' : '',
        /мягк|эмпат|забот|добр/i.test(personalityText) ? 'Собственное раздражение сначала выражает через заботу о другом или попытку снизить конфликт.' : ''
    ].filter(Boolean);
    const authoredVulnerabilities = [
        /контрол|независ|свобод|субъект/i.test(personalityText) ? 'Особенно остро реагирует, когда её выбор считают несущественным.' : '',
        /точн|ошиб|опас|безопас|ответствен/i.test(personalityText) ? 'Боится пропустить важный риск или сделать вывод на недостаточных данных.' : '',
        /довер|предат|обман/i.test(personalityText) ? 'Уязвима к непоследовательности между словами и поступками.' : ''
    ].filter(Boolean);
    return {
        ...profile,
        behavioralCore: {
            ...profile.behavioralCore,
            values: Array.from(new Set([...values, ...profile.behavioralCore.values])).slice(0, 5),
            // Authored personality is the character's normal voice. Procedural
            // role colour remains available only as a secondary influence.
            voice: speechStyle ? [speechStyle] : profile.behavioralCore.voice,
            mannerisms: Array.from(new Set([...quirks, ...profile.behavioralCore.mannerisms])).slice(0, 4),
            // Deterministic defenses are derived from authored traits. This
            // preserves psychological mechanisms without adding random lore.
            vulnerabilities: authoredVulnerabilities.slice(0, 2),
            defenses: authoredDefenses.slice(0, 3),
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
    const archConfig = (activeConfig.character.archetypes as Record<string, { identity?: string; history?: string; formatInstructions?: string }> | undefined)?.[archetype] || {};
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
    const generated = applyCanonicalPersonality(compileGeneratedProfile(subjectId, context, sections), canonical);
    return canonical.storySeed ? { ...generated, storySeed:canonical.storySeed } : generated;
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
    const authored = compileAuthoredProfile(subjectId, effectiveCurrentRole(character, canonical), canonical.roleState);
    if (authored) return withLifecycle(applyCharacterStartingTraits(authored), character, canonical);
    const existing = canonical.generatedProfile || (canonical.version === 2 ? canonical : undefined);
    if (existing?.version === 2 && existing.authored === true) {
        return withLifecycle(applyCharacterStartingTraits(existing as GeneratedProfileV2), character, canonical);
    }
    if (existing?.version === 2 && existing.generatorRevision >= PROFILE_GENERATOR_REVISION) {
        return withLifecycle(applyCharacterStartingTraits(existing as GeneratedProfileV2), character, canonical);
    }

    const generated = buildProfile(subjectId, character, canonical);
    if (character) persistProfile(character, canonical, generated);
    return withLifecycle(applyCharacterStartingTraits(generated), character, canonical);
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
    return withLifecycle(applyCharacterStartingTraits(generated), character, canonical);
}
