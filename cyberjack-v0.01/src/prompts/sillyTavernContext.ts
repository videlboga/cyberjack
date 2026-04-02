import { activeConfig } from './config';

interface STContextSnapshot {
    personaText?: string;
    loreText?: string;
    memoryText?: string;
}

type CharacterPreset =
    NonNullable<NonNullable<typeof activeConfig.stContext>['characterPresets']>[string];

const ST_DEFAULT_HEADERS = {
    'Content-Type': 'application/json'
};

function normalizeBaseUrl(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
}

function ensureArray<T>(value: any): T[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as T[];
    if (typeof value === 'object') {
        return Object.values(value) as T[];
    }
    return [];
}

function composeCharacterProfile(data: any): { persona: string; lore: string[] } {
    if (!data) {
        return { persona: '', lore: [] };
    }

    const card = data.data || {};
    const sections: string[] = [];

    if (card.name) {
        sections.push(`Имя персонажа: ${card.name}`);
    }
    if (card.description) sections.push(card.description.trim());
    if (card.personality) sections.push(`[Личность]\n${card.personality.trim()}`);
    if (card.scenario) sections.push(`[Сценарий]\n${card.scenario.trim()}`);
    if (card.first_mes) sections.push(`[Приветствие]\n${card.first_mes.trim()}`);
    if (card.system_prompt) sections.push(card.system_prompt.trim());
    if (card.post_history_instructions) sections.push(card.post_history_instructions.trim());

    const persona = sections.filter(Boolean).join('\n\n');

    const loreEntries = ensureArray<any>(card.character_book?.entries).map(entry => {
        const title =
            entry.comment ||
            (Array.isArray(entry.keys) ? entry.keys.join(', ') : entry.comment) ||
            'Lore';
        const content = entry.content || '';
        return `${title}:\n${content}`.trim();
    });

    return { persona, lore: loreEntries.filter(Boolean) };
}

function flattenWorldInfoEntries(file: any): string[] {
    if (!file?.entries) return [];
    return Object.values(file.entries).map((entry: any) => {
        const label =
            entry.comment ||
            (Array.isArray(entry.key) ? entry.key.join(', ') : Array.isArray(entry.keys) ? entry.keys.join(', ') : 'World Info');
        return `${label}:\n${entry.content || ''}`.trim();
    });
}

function formatMemory(chatEntries: any[], limit: number): string[] {
    const filtered = chatEntries.filter(entry => typeof entry?.mes === 'string');
    if (!filtered.length) return [];
    const selected = filtered.slice(-limit);
    return selected
        .map(entry => {
            const speaker = entry.is_system
                ? 'System'
                : entry.is_user
                    ? entry.name || 'User'
                    : entry.name || 'Character';
            return `${speaker}: ${entry.mes}`.trim();
        })
        .filter(Boolean);
}

async function stPost<T>(baseUrl: string, path: string, body: any): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: ST_DEFAULT_HEADERS,
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`ST ${path} failed: ${response.status} ${text}`);
    }
    return (await response.json()) as T;
}

export async function fetchSillyTavernContext(subjectId: string): Promise<STContextSnapshot | null> {
    const cfg = activeConfig.stContext;
    if (!cfg?.enabled) {
        return null;
    }
    const useCharacterCard = cfg.useCharacterCard ?? true;
    const useWorldInfo = cfg.useWorldInfo ?? true;
    const includeMemory = cfg.includeMemory ?? true;
    if (!useCharacterCard && !useWorldInfo && !includeMemory) {
        return null;
    }

    const preset: CharacterPreset | undefined =
        cfg.characterPresets?.[subjectId] || cfg.characterPresets?.default || Object.values(cfg.characterPresets || {})[0];

    if (!preset?.avatarUrl) {
        return null;
    }

    const baseUrl = normalizeBaseUrl(cfg.baseUrl || 'http://127.0.0.1:8181');
    const snapshot: STContextSnapshot = {};

    if (useCharacterCard) {
        try {
            const character = await stPost<any>(baseUrl, '/api/characters/get', {
                avatar_url: preset.avatarUrl
            });
            const profile = composeCharacterProfile(character);
            if (profile.persona) {
                snapshot.personaText = profile.persona;
            }
            if (profile.lore.length) {
                snapshot.loreText = profile.lore.join('\n\n');
            }
        } catch (error) {
            console.warn('[ST Context] Character fetch failed:', (error as Error).message);
        }
    }

    if (useWorldInfo) {
        const combinedLore: string[] = [];
        const worldInfos = preset.worldInfoFiles?.length ? preset.worldInfoFiles : cfg.defaultWorldInfoFiles;
        if (worldInfos?.length) {
            for (const worldName of worldInfos) {
                try {
                    const worldInfo = await stPost<any>(baseUrl, '/api/worldinfo/get', { name: worldName });
                    combinedLore.push(...flattenWorldInfoEntries(worldInfo));
                } catch (error) {
                    console.warn(`[ST Context] WorldInfo "${worldName}" fetch failed:`, (error as Error).message);
                }
            }
        }
        if (combinedLore.length) {
            snapshot.loreText = [snapshot.loreText, combinedLore.join('\n\n')].filter(Boolean).join('\n\n');
        }
    }

    if (includeMemory) {
        const chatFile = preset.chatFile;
        if (chatFile) {
            try {
                const chat = await stPost<any[]>(baseUrl, '/api/chats/get', {
                    avatar_url: preset.avatarUrl,
                    file_name: chatFile
                });
                const limit = preset.memoryMessageLimit ?? cfg.memoryMessageLimit ?? 6;
                const memory = formatMemory(chat || [], limit);
                if (memory.length) {
                    snapshot.memoryText = memory.join('\n');
                }
            } catch (error) {
                console.warn('[ST Context] Memory fetch failed:', (error as Error).message);
            }
        }
    }

    if (!snapshot.personaText && !snapshot.loreText && !snapshot.memoryText) {
        return null;
    }

    return snapshot;
}
