import { EventRecord } from './buildRecentEventsSummary';

interface ParsedEvent {
    narrative: string;
    actorName: string;
    pointLabel: string;
    actionLabel: string;
    timestamp: string;
    isContext: boolean;
    result?: {
        overload?: number;
        discomfort?: number;
        pleasure?: number;
    };
    rawContextLabel?: string;
}

interface PointStat {
    point: string;
    count: number;
    actors: Set<string>;
    actions: Set<string>;
}

interface ContextStat {
    label: string;
    count: number;
}

function safeParse(json?: string) {
    if (!json) return undefined;
    try {
        return JSON.parse(json);
    } catch {
        return undefined;
    }
}

function parseEvents(events: EventRecord[]): ParsedEvent[] {
    return events
        .map(event => {
            const payload = safeParse(event.action_payload);
            if (!payload) return null;
            const result = safeParse(event.result_payload);
            return {
                narrative:
                    payload.narrative ||
                    payload.actionLabel ||
                    payload.presetId ||
                    'воздействие',
                actorName: payload.actorName || 'Калибратор',
                pointLabel: payload.pointLabel || payload.pointId || 'тело',
                actionLabel: payload.actionLabel || payload.presetId || 'воздействие',
                timestamp: event.timestamp,
                isContext:
                    event.action_type === 'context_change' ||
                    (typeof payload.presetId === 'string' &&
                        payload.presetId.toLowerCase().includes('context')),
                rawContextLabel: payload.actionLabel || payload.narrative,
                result: {
                    overload:
                        typeof result?.overload === 'number'
                            ? result.overload
                            : typeof result?.result?.overload === 'number'
                            ? result.result.overload
                            : undefined,
                    discomfort:
                        typeof result?.discomfort === 'number'
                            ? result.discomfort
                            : typeof result?.result?.discomfort === 'number'
                            ? result.result.discomfort
                            : undefined,
                    pleasure:
                        typeof result?.pleasure === 'number'
                            ? result.pleasure
                            : typeof result?.result?.pleasure === 'number'
                            ? result.result.pleasure
                            : undefined
                }
            } as ParsedEvent;
        })
        .filter(Boolean) as ParsedEvent[];
}

function formatList(items: string[]): string {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    const tail = items.pop();
    return `${items.join(', ')} и ${tail}`;
}

function describeFrequency(count: number): string {
    if (count >= 5) return 'почти постоянно';
    if (count >= 3) return 'часто';
    return 'пару раз';
}

export function buildMemoryInsights(events: EventRecord[]): string[] {
    if (!events.length) return [];

    const parsed = parseEvents(events);
    const pointStats = new Map<string, PointStat>();
    const contextStats = new Map<string, ContextStat>();
    const overloadInsights: string[] = [];

    for (const event of parsed) {
        if (event.isContext) {
            const ctxLabel = event.rawContextLabel || event.narrative;
            if (!ctxLabel) continue;
            const stat = contextStats.get(ctxLabel) || {
                label: ctxLabel,
                count: 0
            };
            stat.count += 1;
            contextStats.set(ctxLabel, stat);
            continue;
        }

        const point = event.pointLabel.toLowerCase();
        const stat =
            pointStats.get(point) ||
            ({
                point,
                count: 0,
                actors: new Set<string>(),
                actions: new Set<string>()
            } as PointStat);
        stat.count += 1;
        stat.actors.add(event.actorName);
        stat.actions.add(event.actionLabel.toLowerCase());
        pointStats.set(point, stat);

        const overload = event.result?.overload ?? 0;
        const discomfort = event.result?.discomfort ?? 0;
        const pleasure = event.result?.pleasure ?? 0;

        if (overload >= 0.45) {
            overloadInsights.push(
                `${event.narrative}. Это доводило до перегрузки (уровень ${Math.round(overload * 100)}%).`
            );
        } else if (discomfort >= 0.4) {
            overloadInsights.push(
                `${event.narrative}. От этого тело реагирует болью (около ${Math.round(
                    discomfort * 100
                )}%).`
            );
        } else if (pleasure >= 0.5) {
            overloadInsights.push(
                `${event.narrative}. Нервная система фиксирует удовольствие (примерно ${Math.round(
                    pleasure * 100
                )}%).`
            );
        }
    }

    const insights: string[] = [];

    [...pointStats.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .forEach(stat => {
            if (stat.count < 2) return;
            const actors = formatList([...stat.actors]);
            const actions = formatList([...stat.actions]);
            const freq = describeFrequency(stat.count);
            insights.push(
                `${actors} ${freq} возвращается к моим ${stat.point}: в ход идут ${actions}.`
            );
        });

    [...contextStats.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 2)
        .forEach(stat => {
            insights.push(`Меня несколько раз переводили в состояние "${stat.label}".`);
        });

    overloadInsights.slice(0, 2).forEach(text => insights.push(text));

    return insights;
}
