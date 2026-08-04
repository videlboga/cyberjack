import { TAG_LIBRARY, findTagById } from './tagDefinitions';
import { buildLoreNotes, getLoreEntry } from './loreSource';
import { buildNarrativeSummary } from './narrativeBuilder';
import {
    CharacterArchetype,
    GeneratedCharacterContext,
    GeneratedTag,
    GeneratorOptions,
    LEVEL_ORDER,
    LoreLevel,
    LoreTagDefinition
} from './types';

const CORE_WORLD_TAGS = [
    'world_omnicron',
    'world_isolation',
    'world_anomaly',
    'world_assets',
    'world_calibrator',
    'world_corporations'
] as const;

const FEMALE_NAMES = ['Эли', 'Никс', 'Лира', 'Джун', 'Мара', 'Иден', 'Нова'];
const MALE_NAMES = ['Рен', 'Кай', 'Сайлас', 'Сет', 'Нейт', 'Рунис', 'Векс', 'Зейн'];

const CORE_TRAIT_IDS = [
    'trait_profile_observant',
    'trait_profile_pragmatic',
    'trait_profile_resilient',
    'trait_profile_cautious',
    'trait_profile_empathic',
    'trait_profile_stubborn',
    'trait_profile_direct',
    'trait_profile_loyal',
    'trait_profile_patient',
    'trait_profile_adaptive'
];

const CORE_WORLD_TARGET =
    CORE_WORLD_TAGS.length + Number(process.env.GENERATOR_EXTRA_WORLD ?? 2);
const CORE_TRAIT_TARGET = Number(process.env.GENERATOR_CORE_TRAITS ?? 2);

function hashSeed(str: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function createRng(seed: number): () => number {
    let value = seed >>> 0;
    return () => {
        value += 0x6d2b79f5;
        let t = Math.imul(value ^ (value >>> 15), value | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function sortByLevel(tags: LoreTagDefinition[]): LoreTagDefinition[] {
    return [...tags].sort(
        (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
    );
}

function ensureTagExists(id: string): LoreTagDefinition {
    const tag = findTagById(id);
    if (!tag) {
        throw new Error(`Unknown tag id: ${id}`);
    }
    return tag;
}

function requirementsMet(tag: LoreTagDefinition, selected: Set<string>): boolean {
    if (!tag.requires?.length) {
        return true;
    }
    return tag.requires.every(req => selected.has(req));
}

function pickWeighted<T extends { weight?: number }>(items: T[], rng: () => number): T {
    const total = items.reduce((sum, item) => sum + Math.max(item.weight ?? 1, 0), 0);
    let roll = rng() * total;
    for (const item of items) {
        roll -= Math.max(item.weight ?? 1, 0);
        if (roll <= 0) {
            return item;
        }
    }
    return items[items.length - 1];
}

function addTag(
    tag: LoreTagDefinition,
    grouped: Record<LoreLevel, GeneratedTag[]>,
    selected: Set<string>
) {
    if (selected.has(tag.id)) return;
    selected.add(tag.id);
    grouped[tag.level].push({ ...tag });
}

function exclusiveSlot(tag: LoreTagDefinition): string | undefined {
    if (tag.id.startsWith('origin_place_')) return 'origin_place';
    if (tag.id.startsWith('origin_activity_')) return 'origin_activity';
    if (tag.id.startsWith('origin_condition_')) return 'origin_condition';
    if (/^origin_(inner|mid|outer)_ring$|^origin_perimeter$/.test(tag.id)) return 'region';
    if (tag.id.startsWith('role_')) return 'former_role';
    if (tag.id.startsWith('mem_')) return 'origin_memory';
    if (tag.level === 'physical' || tag.level === 'psychological' || tag.level === 'state' ||
        tag.level === 'response' || tag.level === 'bias' || tag.level === 'body') return tag.level;
    if (tag.category?.endsWith('_cause')) return 'status_cause';
    return undefined;
}

function tagsCompatible(tag: LoreTagDefinition, selected: Set<string>): boolean {
    if ((tag.excludes || []).some(id => selected.has(id))) return false;
    const slot = exclusiveSlot(tag);
    for (const id of selected) {
        const existing = findTagById(id);
        if (existing?.excludes?.includes(tag.id)) return false;
        if (slot && existing && exclusiveSlot(existing) === slot) return false;
    }
    return requirementsMet(tag, selected);
}

function pickOne(
    pool: LoreTagDefinition[],
    grouped: Record<LoreLevel, GeneratedTag[]>,
    selected: Set<string>,
    excludeSet: Set<string>,
    rng: () => number
): LoreTagDefinition | undefined {
    const selectedTags = Array.from(selected).map(ensureTagExists);
    const candidates = pool
        .filter(tag => !selected.has(tag.id) && !excludeSet.has(tag.id) && tagsCompatible(tag, selected))
        .map(tag => {
            let weight = tag.weight ?? 1;
            for (const chosen of selectedTags) weight += chosen.weightModifiers?.[tag.id] || 0;
            return { ...tag, weight: Math.max(0, weight) };
        })
        .filter(tag => (tag.weight ?? 1) > 0);
    if (!candidates.length) return undefined;
    const chosen = ensureTagExists(pickWeighted(candidates, rng).id);
    addTag(chosen, grouped, selected);
    return chosen;
}

function familyOfFaction(id: string): string {
    return id.match(/^faction_(helix|veil|continuum|lattice)/)?.[1] || id;
}

const REGION_ROLES: Record<string, string[]> = {
    origin_inner_ring: ['role_clerk', 'role_pampered', 'role_researcher'],
    origin_mid_ring: ['role_clerk', 'role_worker', 'role_researcher'],
    origin_outer_ring: ['role_worker', 'role_thug', 'role_cultist'],
    origin_perimeter: ['role_worker', 'role_thug', 'role_cultist']
};

const PSY_TRAITS: Record<string, string[]> = {
    psy_submissive: ['trait_profile_cautious', 'trait_profile_empathic', 'trait_profile_patient', 'trait_profile_adaptive', 'trait_profile_observant'],
    psy_defiant: ['trait_profile_stubborn', 'trait_profile_direct', 'trait_profile_patient', 'trait_profile_resilient', 'trait_profile_observant'],
    psy_curious_masochist: ['trait_profile_observant', 'trait_profile_adaptive', 'trait_profile_direct', 'trait_profile_pragmatic', 'trait_profile_resilient']
};

const PSY_RESPONSES: Record<string, string[]> = {
    psy_submissive: ['response_agree_fast', 'response_silence', 'response_observe'],
    psy_defiant: ['response_push_back', 'response_laugh', 'response_silence'],
    psy_curious_masochist: ['response_observe', 'response_laugh', 'response_silence']
};

const ROLE_PHYSIOLOGY: Record<string, string[]> = {
    role_clerk: ['phys_fragile', 'phys_modified'],
    role_pampered: ['phys_fragile'],
    role_researcher: ['phys_fragile', 'phys_modified'],
    role_worker: ['phys_hardened', 'phys_modified'],
    role_thug: ['phys_hardened', 'phys_modified'],
    role_cultist: ['phys_hardened', 'phys_modified']
};

// No adaptRoleText anymore

export function generateCharacterContext(options: GeneratorOptions = {}): GeneratedCharacterContext {
    const seedSource = options.seed ?? `auto-${Date.now()}-${Math.random()}`;
    const rng = createRng(hashSeed(seedSource));
    const excludeSet = new Set(options.excludeTags ?? []);
    const archetype = options.archetype ?? 'asset';

    const causeCategory = `${archetype}_cause`;

    for (const level of LEVEL_ORDER) {
        for (const tag of TAG_LIBRARY[level] || []) {
            if (tag.archetypes && tag.archetypes.length > 0 && !tag.archetypes.includes(archetype)) {
                excludeSet.add(tag.id);
            }
            // Only include the cause tags for the current archetype
            if (tag.category?.endsWith('_cause') && tag.category !== causeCategory) {
               excludeSet.add(tag.id);
            }
        }
    }

    const grouped: Record<LoreLevel, GeneratedTag[]> = {
        world: [],
        faction: [],
        origin: [],
        persona: [],
        physical: [],
        psychological: [],
        state: [],
        response: [],
        bias: [],
        body: [],
        event: [],
        trait: []
    };
    const selected = new Set<string>();

    const forcedIds = new Set([
        ...CORE_WORLD_TAGS,
        ...(options.includeTags || []),
        ...(options.forced || [])
    ]);
    const forcedTags = sortByLevel(Array.from(forcedIds).map(ensureTagExists));

    for (const tag of forcedTags) {
        if (excludeSet.has(tag.id)) {
            throw new Error(`Forced tag ${tag.id} is also excluded`);
        }
        if (!requirementsMet(tag, selected)) throw new Error(`Requirements for forced tag "${tag.id}" are not met.`);
        if (!tagsCompatible(tag, selected)) throw new Error(`Forced tag "${tag.id}" conflicts with another selected tag.`);
        addTag(tag, grouped, selected);
    }

    // World knowledge: fixed setting plus a small amount of individual emphasis.
    while (grouped.world.length < CORE_WORLD_TARGET) pickOne(TAG_LIBRARY.world, grouped, selected, excludeSet, rng);

    // One coherent origin: place, activity and condition are separate slots.
    for (const prefix of ['origin_place_', 'origin_activity_', 'origin_condition_']) {
        if (!grouped.origin.some(tag => tag.id.startsWith(prefix))) {
            pickOne(TAG_LIBRARY.origin.filter(tag => tag.id.startsWith(prefix)), grouped, selected, excludeSet, rng);
        }
    }

    // One region and a former role compatible with it.
    let region = grouped.persona.find(tag => /^origin_(inner|mid|outer)_ring$|^origin_perimeter$/.test(tag.id));
    if (!region) region = pickOne(TAG_LIBRARY.persona.filter(tag => /^origin_(inner|mid|outer)_ring$|^origin_perimeter$/.test(tag.id)), grouped, selected, excludeSet, rng);
    let role = grouped.persona.find(tag => tag.id.startsWith('role_'));
    if (!role) {
        const roleIds = REGION_ROLES[region?.id || ''] || TAG_LIBRARY.persona.filter(tag => tag.id.startsWith('role_')).map(tag => tag.id);
        role = pickOne(roleIds.map(ensureTagExists), grouped, selected, excludeSet, rng);
    }
    const regionKey = region?.id.replace('origin_', '').replace('_ring', '').replace('perimeter', 'perim');
    pickOne(TAG_LIBRARY.persona.filter(tag => tag.id.startsWith(`mem_${regionKey}_`)), grouped, selected, excludeSet, rng);

    // A single factional perspective; all selected faction notes share a family.
    const forcedFaction = grouped.faction[0];
    const factionFamily = forcedFaction ? familyOfFaction(forcedFaction.id) : familyOfFaction(pickOne(TAG_LIBRARY.faction.filter(tag => /^faction_(helix|veil|continuum|lattice)$/.test(tag.id)), grouped, selected, excludeSet, rng)?.id || '');
    while (grouped.faction.length < 2) {
        if (!pickOne(TAG_LIBRARY.faction.filter(tag => familyOfFaction(tag.id) === factionFamily), grouped, selected, excludeSet, rng)) break;
    }

    // Physiology follows the former role instead of contradicting it by accident.
    if (!grouped.physical.length) {
        const physIds = ROLE_PHYSIOLOGY[role?.id || ''] || TAG_LIBRARY.physical.map(tag => tag.id);
        pickOne(physIds.map(ensureTagExists), grouped, selected, excludeSet, rng);
    }
    const psyche = grouped.psychological[0] || pickOne(TAG_LIBRARY.psychological, grouped, selected, excludeSet, rng);

    if (!grouped.state.length) pickOne(TAG_LIBRARY.state, grouped, selected, excludeSet, rng);
    if (!grouped.response.length) pickOne((PSY_RESPONSES[psyche?.id || ''] || TAG_LIBRARY.response.map(tag => tag.id)).map(ensureTagExists), grouped, selected, excludeSet, rng);
    if (!grouped.bias.length) pickOne(TAG_LIBRARY.bias, grouped, selected, excludeSet, rng);
    if (!grouped.body.length) pickOne(TAG_LIBRARY.body, grouped, selected, excludeSet, rng);

    // Current status has one cause; one additional event provides texture.
    if (!grouped.event.some(tag => tag.category === causeCategory)) pickOne(TAG_LIBRARY.event.filter(tag => tag.category === causeCategory), grouped, selected, excludeSet, rng);
    if (grouped.event.filter(tag => !tag.category?.endsWith('_cause')).length < 1) pickOne(TAG_LIBRARY.event.filter(tag => !tag.category?.endsWith('_cause')), grouped, selected, excludeSet, rng);

    // Two compatible core traits, conditioned by the psychological strategy.
    const traitPool = (PSY_TRAITS[psyche?.id || ''] || CORE_TRAIT_IDS).map(ensureTagExists);
    while (grouped.trait.filter(tag => CORE_TRAIT_IDS.includes(tag.id)).length < CORE_TRAIT_TARGET) {
        if (!pickOne(traitPool, grouped, selected, excludeSet, rng)) break;
    }

    const tags = LEVEL_ORDER.flatMap(level => grouped[level]);
    // `tag.loreRefs` is legacy compatibility metadata ("this physiology fits a
    // worker"), not proof that the character has that biography or knowledge.
    // Runtime knowledge is derived only from tags that were actually selected.
    const loreRefs = Array.from(new Set(tags.map(tag => tag.id).filter(id => Boolean(getLoreEntry(id)))));
    const maxLoreEntries = Number(process.env.GENERATOR_MAX_LORE ?? 12);
    const loreNoteEntries = buildLoreNotes(loreRefs).slice(
        0,
        Number.isFinite(maxLoreEntries) && maxLoreEntries > 0 ? maxLoreEntries : loreRefs.length
    );
    const loreNotes = loreNoteEntries.map(note => note.text);
    const personaNotes = tags
        .filter(
            tag =>
                tag.level !== 'world' &&
                tag.level !== 'faction' &&
                tag.level !== 'origin' &&
                tag.category !== causeCategory
        )
        .flatMap(tag => tag.personaHooks || []);

    const narrative = buildNarrativeSummary(tags);

    const originStatements = Array.from(
        new Set(
            grouped.origin
                .map(tag => (tag.narrative?.identity?.[0] || tag.summary || '').trim())
                .filter(Boolean)
        )
    );
    const assetReasons = Array.from(
        new Set(
            tags
                .filter(tag => tag.category === causeCategory)
                .map(tag => (tag.narrative?.history?.[0] || tag.summary || '').trim())
                .filter(Boolean)
        )
    );

    const baseModifiers: Record<string, number> = {};
    const initialContexts: string[] = [];
    for (const t of tags) {
        if (t.coreModifiers) {
            for (const [k, v] of Object.entries(t.coreModifiers)) {
                baseModifiers[k] = (baseModifiers[k] || 0) + v;
            }
        }
        if (t.initialContexts) {
            initialContexts.push(...t.initialContexts);
        }
    }
    const preferences: { actions: Record<string, number>; points: Record<string, number>; contexts: Record<string, number>; tags: Record<string, number> } = {
        actions: {},
        points: {},
        contexts: {},
        tags: {}
    };
    for (const contextId of new Set(initialContexts)) preferences.contexts[contextId] = 1;

    const gender = options.identity?.gender ?? (rng() < 0.5 ? 'female' : 'male');
    const namePool = gender === 'male' ? MALE_NAMES : FEMALE_NAMES;
    const baseProfile = {
        name: options.identity?.name || namePool[Math.floor(rng() * namePool.length)],
        age: String(options.identity?.age ?? Math.floor(18 + rng() * 15)),
        gender,
        anatomy: options.identity?.anatomy || 'human'
    };

    return {
        archetype,
        tags,
        baseModifiers,
        initialContexts,
        baseProfile,
        grouped,
        loreNotes,
        loreRefs,
        loreEntries: loreNoteEntries,
        personaNotes,
        seed: seedSource,
        narrative,
        originStatements,
        assetReasons,
        preferences
    };
}
