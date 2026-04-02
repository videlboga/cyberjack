import { GeneratedTag, NarrativeSummary } from './types';

function dedupe(lines: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        result.push(trimmed);
    }
    return result;
}

export function buildNarrativeSummary(tags: GeneratedTag[]): NarrativeSummary {
    const identity: string[] = [];
    const history: string[] = [];
    const activation: string[] = [];

    for (const tag of tags) {
        if (tag.level === 'world' || tag.level === 'faction') {
            // Глобальный лор служит только справочным блоком, не частью биографии
            continue;
        }
        const fragments = tag.narrative;
        if (!fragments) continue;
        if (fragments.identity?.length) identity.push(...fragments.identity);
        if (fragments.history?.length) history.push(...fragments.history);
        if (fragments.activation?.length) activation.push(...fragments.activation);
    }

    return {
        identityParagraphs: dedupe(identity),
        historyParagraphs: dedupe(history),
        activationParagraphs: dedupe(activation)
    };
}
