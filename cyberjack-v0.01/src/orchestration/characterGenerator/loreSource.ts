import fs from 'node:fs';
import path from 'node:path';

export interface WorldInfoEntry {
    uid: string;
    comment?: string;
    content: string;
    keys?: string[];
    position?: string;
    enabled?: boolean;
    insertion_order?: number;
}

interface WorldInfoFile {
    entries: WorldInfoEntry[];
}

let loreCache: Map<string, WorldInfoEntry> | null = null;

function resolveLoreDir(): string {
    return path.resolve(process.cwd(), 'lore');
}

function discoverLoreFiles(): string[] {
    const dir = resolveLoreDir();
    if (!fs.existsSync(dir)) {
        return [];
    }
    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) {
        return [];
    }

    const files = fs
        .readdirSync(dir)
        .map(name => path.join(dir, name))
        .filter(file => {
            const info = fs.statSync(file);
            return info.isFile() && file.toLowerCase().endsWith('.json');
        });

    // Backwards compat: если нет файлов, попробуем старый путь
    if (!files.length) {
        const legacy = path.join(dir, 'Omnicron_Lore.json');
        if (fs.existsSync(legacy)) {
            files.push(legacy);
        }
    }

    return files;
}

function loadLoreCache(): Map<string, WorldInfoEntry> {
    if (loreCache) {
        return loreCache;
    }

    const files = discoverLoreFiles();
    const map = new Map<string, WorldInfoEntry>();

    for (const filePath of files) {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw) as WorldInfoFile;
            const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
            entries.forEach(entry => {
                if (!entry?.uid) return;
                map.set(entry.uid, entry);
            });
        } catch (error) {
            console.warn(`[LoreSource] Failed to parse ${filePath}:`, (error as Error).message);
        }
    }

    loreCache = map;
    return loreCache;
}

export function getLoreEntry(uid: string): WorldInfoEntry | undefined {
    return loadLoreCache().get(uid);
}

export interface LoreNote {
    uid: string;
    text: string;
    entry?: WorldInfoEntry;
}

export function buildLoreNotes(refs: string[]): LoreNote[] {
    const notes: LoreNote[] = [];
    const seen = new Set<string>();

    for (const ref of refs) {
        if (!ref || seen.has(ref)) continue;
        seen.add(ref);
        const entry = getLoreEntry(ref);
        if (entry?.content) {
            const titleParts = [
                entry.comment,
                entry.keys && entry.keys.length ? entry.keys.join(', ') : undefined
            ].filter(Boolean);
            const title = titleParts.join(' — ') || ref;
            notes.push({
                uid: ref,
                text: `${title}:\n${entry.content}`.trim(),
                entry
            });
        }
    }

    return notes;
}
