import { TAG_LIBRARY, findTagById } from './tagDefinitions';
import { buildLoreNotes } from './loreSource';
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

const NAMES_POOL = ['Эли', 'Рен', 'Кай', 'Сайлас', 'Никс', 'Лира', 'Сет', 'Титан', 'Джун', 'Нейт', 'Рунис', 'Векс', 'Зейн', 'Мара', 'Иден', 'Нова'];
const BODY_KNOWLEDGE_POOL = [
    'Абсолютно не понимает процессы в своём теле. Воспринимает любую боль, мышечный спазм или удовольствие со страхом и слепым замешательством.',
    'Слабое знание тела. Ориентируется лишь на базовые животные инстинкты — отдернуть руку от боли, сжаться при страхе.',
    'Среднее знание собственного тела. Знает свои пределы выносливости, но совершенно не умеет контролировать мелкую моторику, дрожь или сбитое дыхание.',
    'Хорошее чувство тела. Различает виды боли и стимуляции, умеет частично отключать восприятие или терпеть, сцепив зубы.',
    'Острое телесное сознание. Детально осознает каждую мышцу, связку и сокращение. Способен к тонкому самоконтролю даже при перегрузке нервной системы.'
];

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
const MIN_ASSET_CAUSE_TAGS = Number(process.env.GENERATOR_ASSET_CAUSE ?? 1);
const ASSET_CAUSE_CATEGORY = 'asset_cause';

const DEFAULT_LEVEL_COUNTS: Record<LoreLevel, number> = {
    world: Math.max(CORE_WORLD_TARGET, CORE_WORLD_TAGS.length),
    faction: 2,
    origin: 2,
    persona: 2,
    physical: 1,
    psychological: 1,
    event: 2,
    trait: Math.max(CORE_TRAIT_TARGET + 1, 2)
};

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

function pickCoreTraitProfiles(
    grouped: Record<LoreLevel, GeneratedTag[]>,
    selected: Set<string>,
    excludeSet: Set<string>,
    rng: () => number,
    targetCount: number
) {
    if (targetCount <= 0) return;
    const pool = CORE_TRAIT_IDS.map(id => findTagById(id)).filter(
        (tag): tag is LoreTagDefinition =>
            !!tag && !excludeSet.has(tag.id) && !selected.has(tag.id) && !!requirementsMet(tag as any, selected)
    );

    let picks = Math.min(targetCount, pool.length);
    while (picks > 0 && pool.length) {
        const idx = Math.floor(rng() * pool.length);
        const [tag] = pool.splice(idx, 1);
        addTag(tag, grouped, selected);
        picks -= 1;
    }
}

function pickCategoryTags(
    level: LoreLevel,
    category: string,
    grouped: Record<LoreLevel, GeneratedTag[]>,
    selected: Set<string>,
    excludeSet: Set<string>,
    rng: () => number,
    targetCount: number
) {
    if (targetCount <= 0) return;
    const pool = TAG_LIBRARY[level].filter(
        tag =>
            tag.category === category &&
            !selected.has(tag.id) &&
            tag && !excludeSet.has(tag.id) &&
            requirementsMet(tag, selected)
    );
    let picks = Math.min(targetCount, pool.length);
    while (picks > 0 && pool.length) {
        const idx = Math.floor(rng() * pool.length);
        const [tag] = pool.splice(idx, 1);
        addTag(tag, grouped, selected);
        picks -= 1;
    }
}

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
        if (!requirementsMet(tag, selected)) {
            throw new Error(`Requirements for forced tag "${tag.id}" are not met.`);
        }
        addTag(tag, grouped, selected);
    }

    pickCoreTraitProfiles(grouped, selected, excludeSet, rng, CORE_TRAIT_TARGET);
    pickCategoryTags('event', causeCategory, grouped, selected, excludeSet, rng, MIN_ASSET_CAUSE_TAGS);

    for (const level of LEVEL_ORDER) {
        const target = options.levelPickCounts?.[level] ?? DEFAULT_LEVEL_COUNTS[level];
        if (target <= grouped[level].length) {
            continue;
        }

        const availablePool = TAG_LIBRARY[level].filter(
            tag => tag && !excludeSet.has(tag.id)
        );

        while (grouped[level].length < target) {
            const allowed = availablePool.filter(
                tag => !selected.has(tag.id) && requirementsMet(tag, selected)
            );
            if (!allowed.length) {
                break;
            }

            // Calculate effective weights based on weightModifiers of already selected tags
            const selectedTags = Array.from(selected).map(ensureTagExists);
            const candidates = allowed.map(tag => {
                let effectiveWeight = tag.weight ?? 1;
                for (const sTag of selectedTags) {
                    if (sTag.weightModifiers && sTag.weightModifiers[tag.id]) {
                        effectiveWeight += sTag.weightModifiers[tag.id];
                    }
                }
                return { ...tag, weight: Math.max(effectiveWeight, 0) };
            });

            const picked = pickWeighted(candidates, rng);
            addTag(ensureTagExists(picked.id), grouped, selected);
        }
    }

    const tags = LEVEL_ORDER.flatMap(level => grouped[level]);
    const loreRefs = Array.from(new Set(tags.flatMap(tag => tag.loreRefs)));
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
    
    const baseProfile = {
        name: NAMES_POOL[Math.floor(rng() * NAMES_POOL.length)],
        age: Math.floor(18 + rng() * 15).toString(),
        anatomy: 'Голова, Лицо, Шея, Грудь, Спина, Левая рука, Правая рука, Губы, Ноги, Живот'
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
        assetReasons
    };
}

export { DEFAULT_LEVEL_COUNTS };
