export type DialogueHistoryEntry = {
    role: 'user' | 'assistant';
    content: string;
    worldMinute?: number | null;
    contextLabel?: string | null;
};

/** Keep the recent conversation as it actually happened. */
export function buildPairedDialogueHistory(
    entries: DialogueHistoryEntry[],
    limit = 12
) {
    const usable = entries.filter(entry =>
        entry.content && !/^\[Текущий контакт\]|^\*\(Без слов\)\*|^\[Игрок \(/.test(entry.content)
    );
    return usable.slice(-limit).map(entry => ({ role: entry.role, content: entry.content }));
}
