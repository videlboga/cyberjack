export type TemporalDialogueEntry = {
    role: 'user' | 'assistant' | string;
    content: string;
    worldMinute?: number | null;
    contextLabel?: string | null;
};

export function formatElapsedGameTime(minutes: number): string {
    const value = Math.max(0, Math.round(minutes));
    if (value < 2) return '';
    if (value < 15) return 'несколько минут';
    if (value < 90) return value < 45 ? 'около получаса' : 'около часа';
    if (value < 360) return `около ${Math.max(2, Math.round(value / 60))} часов`;
    if (value < 1440) return 'большая часть дня';
    if (value < 2880) return 'около суток';
    return `около ${Math.round(value / 1440)} дней`;
}

export function formatWorldTimeContext(currentMinute: number, knownSinceMinute?: number | null): string {
    const current = Math.max(0, Math.floor(Number(currentMinute) || 0));
    const day = Math.floor(current / 1440) + 1;
    const minuteOfDay = current % 1440;
    const hours = Math.floor(minuteOfDay / 60).toString().padStart(2, '0');
    const minutes = (minuteOfDay % 60).toString().padStart(2, '0');
    const since = Number(knownSinceMinute);
    const duration = knownSinceMinute != null && Number.isFinite(since) && current >= since
        ? formatElapsedGameTime(current - since)
        : '';
    return duration
        ? `Сейчас день ${day}, примерно ${hours}:${minutes} по игровому времени. С первого зафиксированного момента твоего пребывания здесь прошло ${duration}. Это факт хронологии: не описывай происходящее как только что начавшееся.`
        : `Сейчас день ${day}, примерно ${hours}:${minutes} по игровому времени.`;
}

export function temporalGapMarker(previous: TemporalDialogueEntry, current: TemporalDialogueEntry): string | null {
    const previousMinute = Number(previous.worldMinute);
    const currentMinute = Number(current.worldMinute);
    const hasMinutes = previous.worldMinute != null && current.worldMinute != null
        && Number.isFinite(previousMinute) && Number.isFinite(currentMinute);
    const elapsed = hasMinutes ? formatElapsedGameTime(currentMinute - previousMinute) : '';
    const previousPlace = previous.contextLabel?.trim();
    const currentPlace = current.contextLabel?.trim();
    const placeChanged = Boolean(previousPlace && currentPlace && previousPlace !== currentPlace);
    if (!elapsed && !placeChanged) return null;
    const parts = [
        elapsed ? `После предыдущей реплики прошло ${elapsed}.` : 'Это уже другой момент разговора.',
        placeChanged ? `Место изменилось: ${previousPlace} → ${currentPlace}.` : '',
    ].filter(Boolean);
    return `[Временной разрыв: ${parts.join(' ')} Не воспринимай следующую реплику как мгновенное продолжение предыдущей.]`;
}

/** Keep literal chat history inside one live exchange. Older conversations
 * remain available through episodic and social memory instead of competing
 * with the current scene as if no time had passed. */
export function selectCurrentDialogueSegment(
    entries: TemporalDialogueEntry[],
    maximumEntries = 8,
): TemporalDialogueEntry[] {
    if (!entries.length) return [];
    let segmentStart = 0;
    for (let index = 1; index < entries.length; index++) {
        const previous = entries[index - 1];
        const current = entries[index];
        const previousMinute = Number(previous.worldMinute);
        const currentMinute = Number(current.worldMinute);
        const elapsed = previous.worldMinute != null && current.worldMinute != null
            && Number.isFinite(previousMinute) && Number.isFinite(currentMinute)
            ? currentMinute - previousMinute
            : 0;
        const previousPlace = previous.contextLabel?.trim();
        const currentPlace = current.contextLabel?.trim();
        const placeChanged = Boolean(previousPlace && currentPlace && previousPlace !== currentPlace);
        if (elapsed >= 90 || placeChanged) segmentStart = index;
    }
    return entries.slice(segmentStart).slice(-maximumEntries);
}

export function renderTemporalDialogue(
    entries: TemporalDialogueEntry[],
    ownerName: string,
    initiatorName: string,
): string[] {
    const lines: string[] = [];
    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        if (index > 0) {
            const marker = temporalGapMarker(entries[index - 1], entry);
            if (marker) lines.push(marker);
        }
        lines.push(`${entry.role === 'assistant' ? ownerName : initiatorName}: «${entry.content}»`);
    }
    return lines;
}
