import { EventRecord } from './buildRecentEventsSummary';

interface ParsedEvent {
    narrative?: string;
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
    key: string;
    label: string;
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
                narrative: payload.narrative,
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

function describePoint(point: string) {
    const normalized = point.trim();
    if (!normalized || normalized.toLowerCase() === 'общее воздействие') {
        return 'ко мне';
    }
    return `к моим ${normalized}`;
}

function describeAction(actor: string, action: string, point: string) {
    const target = describePoint(point);
    return `${actor} использует «${action}» ${target}`.trim();
}

function describeContext(label: string, count: number) {
    const freq = describeFrequency(count);
    return `Меня ${freq} переводили в состояние «${label}».`;
}

function describeExtreme(event: ParsedEvent, suffix: string) {
    const actor = event.actorName;
    const action = event.actionLabel;
    const target = describePoint(event.pointLabel);
    return `${actor} применял «${action}» ${target}. ${suffix}`;
}

function describeOverloadPhrase(value: number) {
    if (value >= 0.8) return 'Это почти вышибает меня из тела.';
    if (value >= 0.6) return 'От этого тяжело удерживать внимание, словно накрывает волной.';
    return 'Чувствую, как организм начинает сдавать, хотя я пытаюсь держаться.';
}

function describeDiscomfortPhrase(value: number) {
    if (value >= 0.8) return 'Боль прожигает мгновенно, приходится сжимать зубы.';
    if (value >= 0.6) return 'Боль тянет изнутри, и хочется отодвинуться.';
    return 'Неприятно, но я лишь сильнее зажимаюсь.';
}

function describePleasurePhrase(value: number) {
    if (value >= 0.8) return 'Нервная система вспыхивает удовольствием, и сложно скрыть реакцию.';
    if (value >= 0.6) return 'Мягкая волна удовольствия накрывает и заставляет дышать глубже.';
    return 'Чувствую лёгкую отдачу, как будто тело вспоминает приятное.';
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

        const pointKey = (event.pointLabel || 'тело').toLowerCase();
        const stat =
            pointStats.get(pointKey) ||
            ({
                key: pointKey,
                label: event.pointLabel || 'тело',
                count: 0,
                actors: new Set<string>(),
                actions: new Set<string>()
            } as PointStat);
        stat.count += 1;
        stat.actors.add(event.actorName);
        stat.actions.add(event.actionLabel);
        pointStats.set(pointKey, stat);

        const overload = event.result?.overload ?? 0;
        const discomfort = event.result?.discomfort ?? 0;
        const pleasure = event.result?.pleasure ?? 0;

        if (overload >= 0.45) {
            overloadInsights.push(
                describeExtreme(event, describeOverloadPhrase(overload))
            );
        } else if (discomfort >= 0.4) {
            overloadInsights.push(
                describeExtreme(event, describeDiscomfortPhrase(discomfort))
            );
        } else if (pleasure >= 0.5) {
            overloadInsights.push(
                describeExtreme(event, describePleasurePhrase(pleasure))
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
                `${actors} ${freq} возвращается ${describePoint(stat.label)} — чаще всего ${actions}.`
            );
        });

    [...contextStats.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 2)
        .forEach(stat => insights.push(describeContext(stat.label, stat.count)));

    overloadInsights.slice(0, 2).forEach(text => insights.push(text));

    const finalInsights: string[] = [];
    const seen = new Set<string>();
    for (const text of insights) {
        const normalized = text.trim();
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        finalInsights.push(normalized);
        if (finalInsights.length >= 6) break;
    }

    return finalInsights;
}
