import { GeneratedCharacterContext } from '../orchestration/characterGenerator/types';
import { activeConfig, updateConfig } from '../prompts/config';
import { WorldInfoEntry } from '../orchestration/characterGenerator/loreSource';

interface ApplyContextOptions {
    subjectId: string;
    context: GeneratedCharacterContext;
    personaText: string;
    traitBlock: string;
    scenarioText: string;
    instructions: string;
}

interface WorldInfoPayload {
    entries: WorldInfoEntry[];
}

function normalizeBaseUrl(url?: string): string {
    if (!url) return 'http://127.0.0.1:8181';
    return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function stPost<T>(path: string, body: any): Promise<T> {
    const baseUrl = normalizeBaseUrl(activeConfig.stContext?.baseUrl);
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`ST ${path} failed: ${response.status} ${text}`);
    }
    if (response.headers.get('Content-Type')?.includes('application/json')) {
        return (await response.json()) as T;
    }
    return {} as T;
}

function getPreset(subjectId: string) {
    const presets = activeConfig.stContext?.characterPresets || {};
    return presets[subjectId] || presets.default;
}

function buildWorldInfoPayload(context: GeneratedCharacterContext): WorldInfoPayload {
    const entries: WorldInfoEntry[] = [];
    context.loreEntries.forEach((note, index) => {
        if (note.entry) {
            entries.push({
                ...note.entry,
                enabled: note.entry.enabled ?? true,
                insertion_order: note.entry.insertion_order ?? 100 + index,
                position: note.entry.position || 'before_char'
            });
            return;
        }
        entries.push({
            uid: note.uid || `generated_${index}`,
            comment: `Generated lore ${index + 1}`,
            content: note.text,
            keys: [note.uid || `generated_${index}`],
            enabled: true,
            insertion_order: 200 + index,
            position: 'before_char'
        });
    });
    return { entries };
}

export async function applyGeneratedContextToSillyTavern({
    subjectId,
    context,
    personaText,
    traitBlock,
    scenarioText,
    instructions
}: ApplyContextOptions): Promise<{ worldInfoName: string }> {
    if (!activeConfig.stContext?.enabled) {
        throw new Error('stContext is disabled in config, cannot push to SillyTavern.');
    }

    const preset = getPreset(subjectId);
    if (!preset?.avatarUrl) {
        throw new Error(`No SillyTavern preset configured for subject ${subjectId}`);
    }

    const worldInfoName =
        (preset as any).generatedWorldInfoName ||
        `${subjectId}_Generated`;

    const worldInfoData = buildWorldInfoPayload(context);

    await stPost('/api/worldinfo/edit', {
        name: worldInfoName,
        data: worldInfoData
    });

    const defaults = new Set(activeConfig.stContext?.defaultWorldInfoFiles || []);
    const preserved = (preset.worldInfoFiles || []).filter(
        name => name && !defaults.has(name) && name !== worldInfoName
    );
    const mergedWorldInfoList = [worldInfoName, ...preserved];

    const currentSt = activeConfig.stContext || {
        enabled: false,
        baseUrl: 'http://127.0.0.1:8181',
        characterPresets: {}
    };

    updateConfig({
        stContext: {
            enabled: currentSt.enabled,
            baseUrl: currentSt.baseUrl,
            defaultWorldInfoFiles: currentSt.defaultWorldInfoFiles,
            memoryMessageLimit: currentSt.memoryMessageLimit,
            useCharacterCard: currentSt.useCharacterCard,
            useWorldInfo: currentSt.useWorldInfo,
            includeMemory: currentSt.includeMemory,
            characterPresets: {
                [subjectId]: {
                    ...preset,
                    worldInfoFiles: mergedWorldInfoList,
                    generatedWorldInfoName: worldInfoName
                }
            }
        }
    });

    await stPost('/api/characters/merge-attributes', {
        avatar: preset.avatarUrl,
        description: personaText,
        personality: traitBlock,
        scenario: scenarioText,
        system_prompt: activeConfig.adapters.sillyTavernSystemPrefix,
        post_history_instructions: instructions,
        data: {
            description: personaText,
            personality: traitBlock,
            scenario: scenarioText,
            system_prompt: activeConfig.adapters.sillyTavernSystemPrefix,
            post_history_instructions: instructions
        }
    });

    return { worldInfoName };
}
