import { TAG_LIBRARY, findTagById } from './tagDefinitions';
import { buildLoreNotes } from './loreSource';
import { buildNarrativeSummary } from './narrativeBuilder';
import {
    GeneratedCharacterContext,
    GeneratedTag,
    GeneratorOptions,
    LEVEL_ORDER,
    LoreLevel,
    LoreTagDefinition
} from './types';

const DEFAULT_LEVEL_COUNTS: Record<LoreLevel, number> = {
    world: 3,
    faction: 2,
    origin: 2,
    event: 2,
    trait: 2
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
    const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    let roll = rng() * total;
    for (const item of items) {
        roll -= item.weight ?? 1;
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

export function generateCharacterContext(options: GeneratorOptions = {}): GeneratedCharacterContext {
    const seedSource = options.seed ?? `auto-${Date.now()}-${Math.random()}`;
    const rng = createRng(hashSeed(seedSource));
    const excludeSet = new Set(options.excludeTags ?? []);
    const grouped: Record<LoreLevel, GeneratedTag[]> = {
        world: [],
        faction: [],
        origin: [],
        event: [],
        trait: []
    };
    const selected = new Set<string>();

    const forcedIds = new Set([...(options.includeTags || []), ...(options.forced || [])]);
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

    for (const level of LEVEL_ORDER) {
        const target = options.levelPickCounts?.[level] ?? DEFAULT_LEVEL_COUNTS[level];
        if (target <= grouped[level].length) {
            continue;
        }

        const availablePool = TAG_LIBRARY[level].filter(
            tag => !excludeSet.has(tag.id)
        );

        while (grouped[level].length < target) {
            const allowed = availablePool.filter(
                tag => !selected.has(tag.id) && requirementsMet(tag, selected)
            );
            if (!allowed.length) {
                break;
            }
            const picked = pickWeighted(allowed, rng);
            addTag(picked, grouped, selected);
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
        .filter(tag => tag.level !== 'world' && tag.level !== 'faction')
        .flatMap(tag => tag.personaHooks || []);
    const narrative = buildNarrativeSummary(tags);

    return {
        tags,
        grouped,
        loreNotes,
        loreRefs,
        loreEntries: loreNoteEntries,
        personaNotes,
        seed: seedSource,
        narrative
    };
}

export { DEFAULT_LEVEL_COUNTS };
