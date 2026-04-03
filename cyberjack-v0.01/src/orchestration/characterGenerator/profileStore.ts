import fs from 'node:fs';
import path from 'node:path';

export interface StoredProfile {
    subjectId: string;
    personaText: string;
    personaWithoutTraits?: string;
    traitBlock?: string;
    loreNotes?: string[];
    loreRefs?: string[];
    systemPrompt?: string;
    identityText?: string;
    historyText?: string;
    activationText?: string;
    seed?: string;
    updatedAt: string;
}

const STORE_PATH = path.resolve(process.cwd(), 'prompt_snapshot.json');
const cache = new Map<string, StoredProfile>();

function loadFromDisk() {
    if (!fs.existsSync(STORE_PATH)) {
        return;
    }
    try {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        const subjects = parsed?.subjects as Record<string, unknown> | undefined;
        if (!subjects) {
            return;
        }
        for (const [subjectId, profile] of Object.entries(subjects)) {
            if (profile && typeof profile === 'object' && typeof (profile as any).personaText === 'string') {
                cache.set(subjectId, profile as StoredProfile);
            }
        }
    } catch (error) {
        console.warn('[ProfileStore] Failed to load prompt snapshot:', (error as Error).message);
    }
}

function persist() {
    const payload: Record<string, StoredProfile> = {};
    for (const [subjectId, profile] of cache.entries()) {
        payload[subjectId] = profile;
    }
    const data = { subjects: payload };
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

loadFromDisk();

export function setGeneratedProfile(subjectId: string, profile: Omit<StoredProfile, 'subjectId' | 'updatedAt'>) {
    const entry: StoredProfile = {
        subjectId,
        ...profile,
        updatedAt: new Date().toISOString()
    };
    cache.set(subjectId, entry);
    persist();
}

export function getGeneratedProfile(subjectId: string): StoredProfile | undefined {
    return cache.get(subjectId);
}
