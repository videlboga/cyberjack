import fs from 'node:fs';
import path from 'node:path';
import { LoreTagDefinition, LoreLevel, LEVEL_ORDER } from './types';

type TagLibrary = Record<LoreLevel, LoreTagDefinition[]>;

function createEmptyLibrary(): TagLibrary {
    return {
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
}

function ensureStringArray(value: any): string[] {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value
            .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
            .filter(Boolean);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
    }
    return [];
}

function normalizeTag(raw: any): LoreTagDefinition | null {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const level = raw.level as LoreLevel;
    if (!id || !level || !LEVEL_ORDER.includes(level)) return null;

    const text = typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : typeof raw.text === 'string'
            ? raw.text.trim()
            : '';

    const personaHooks = ensureStringArray(raw.personaHooks);
    if (!personaHooks.length && text) {
        personaHooks.push(text);
    }

    const narrativeIdentity = ensureStringArray(raw.narrative?.identity);

    const narrativeHistory = ensureStringArray(raw.narrative?.history);
    const narrativeActivation = ensureStringArray(raw.narrative?.activation);

    return {
        id,
        level,
        title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : id,
        summary: text || raw.summary || '',
        stKeywords: ensureStringArray(raw.stKeywords || raw.keys),
        loreRefs: ensureStringArray(raw.loreRefs),
        weight: typeof raw.weight === 'number' ? raw.weight : undefined,
        requires: ensureStringArray(raw.requires),
        excludes: ensureStringArray(raw.excludes),
        personaHooks: personaHooks.length ? personaHooks : undefined,
        narrative:
            narrativeIdentity.length ||
            narrativeHistory.length ||
            narrativeActivation.length
                ? {
                      identity: narrativeIdentity.length ? narrativeIdentity : undefined,
                      history: narrativeHistory.length ? narrativeHistory : undefined,
                      activation: narrativeActivation.length ? narrativeActivation : undefined
                  }
                : undefined,
        category: typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : undefined,
        coreModifiers: raw.coreModifiers,
        initialContexts: Array.isArray(raw.initialContexts) ? raw.initialContexts : undefined,
        weightModifiers: raw.weightModifiers && typeof raw.weightModifiers === 'object' ? raw.weightModifiers : undefined,
        archetypes: Array.isArray(raw.archetypes) ? raw.archetypes : undefined
    };
}

function loadCustomTagLibrary(): TagLibrary {
    const dir = path.resolve(process.cwd(), 'lore', 'tags');
    const library = createEmptyLibrary();
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return library;
    }

    const files = fs
        .readdirSync(dir)
        .filter(file => file.toLowerCase().endsWith('.json'))
        .map(file => path.join(dir, file));

    const perLevelMaps: Record<LoreLevel, Map<string, LoreTagDefinition>> = {
        world: new Map(),
        faction: new Map(),
        origin: new Map(),
        persona: new Map(),
        physical: new Map(),
        psychological: new Map(),
        state: new Map(),
        response: new Map(),
        bias: new Map(),
        body: new Map(),
        event: new Map(),
        trait: new Map()
    };

    for (const filePath of files) {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            const collections: any[] = [];
            if (Array.isArray(parsed)) {
                collections.push(parsed);
            } else if (parsed && typeof parsed === 'object') {
                if (Array.isArray(parsed.tags)) {
                    collections.push(parsed.tags);
                }
                for (const level of LEVEL_ORDER) {
                    if (Array.isArray(parsed[level])) {
                        collections.push(parsed[level]);
                    }
                }
            }

            for (const collection of collections) {
                for (const item of collection) {
                    const normalized = normalizeTag(item);
                    if (normalized) {
                        if (perLevelMaps[normalized.level].has(normalized.id)) {
                            console.warn(`[TagLoader] Duplicate tag ${normalized.id}; later definition overrides earlier one`);
                        }
                        perLevelMaps[normalized.level].set(normalized.id, normalized);
                    }
                }
            }
        } catch (error) {
            console.warn('[TagLoader] Failed to parse', filePath, (error as Error).message);
        }
    }

    for (const level of LEVEL_ORDER) {
        library[level] = Array.from(perLevelMaps[level].values());
    }

    return library;
}

export const TAG_LIBRARY: TagLibrary = loadCustomTagLibrary();

export function findTagById(id: string): LoreTagDefinition | undefined {
    for (const level of LEVEL_ORDER) {
        const tag = TAG_LIBRARY[level].find(entry => entry.id === id);
        if (tag) return tag;
    }
    return undefined;
}
