const actionTemplates: Record<
    string,
    (actor: string, point: string) => string
> = {
    gentle_stroke: (actor, point) => `${actor} мягко проводит ладонью по ${point}`,
    feather_stroke: (actor, point) => `${actor} ведёт перышком по ${point}, словно проверяя реакцию`,
    tickle: (actor, point) => `${actor} игриво щекочет ${point} кончиками пальцев`,
    light_kiss: (actor, point) => `${actor} касается ${point} лёгким поцелуем`,
    deep_kiss: (actor, point) => `${actor} впивается губами в ${point} без лишних слов`,
    deep_massage: (actor, point) => `${actor} надавливает и проминает ${point} сильными пальцами`,
    firm_grip: (actor, point) => `${actor} сжимает ${point} жёстким хватом`,
    light_bite: (actor, point) => `${actor} слегка прикусывает ${point}, не стараясь причинить боль`,
    hard_bite: (actor, point) => `${actor} больно кусает ${point}`,
    slap: (actor, point) => `${actor} шлёпает по ${point}, от чего кожа вспыхивает`,
    hard_slap: (actor, point) => `${actor} врезает по ${point} так, что в теле отзывается гул`,
    belt_strike: (actor, point) => `${actor} оставляет на ${point} полосу ремня`,
    whip_strike: (actor, point) => `${actor} рассекает воздух и хлещет по ${point}`,
    pinch: (actor, point) => `${actor} больно щиплет ${point}`,
    scratching: (actor, point) => `${actor} проводит ногтями по ${point}, оставляя царапины`,
    hair_pull: (actor, point) => `${actor} тянет за ${point}, контролируя каждое движение`,
    spit: (actor, point) => `${actor} брезгливо плюёт в ${point}`,
    breath_blow: (actor, point) => `${actor} дышит на ${point}, заставляя замереть`,
    verbal_pressure: (actor) => `${actor} обращается словами`,
    stare: (actor) => `${actor} упирается взглядом, будто взвешивает реакцию`
};

const defaultActionTemplate = (actor: string, label: string, point: string) => {
    if (point) {
        return `${actor} ${label.toLowerCase()} по ${point}`;
    }
    return `${actor} ${label.toLowerCase()}`;
};

const pointShortNames: Record<string, string> = {
    head: 'голове',
    face: 'лицу',
    lips: 'губам',
    neck: 'шее',
    shoulders: 'плечам',
    back: 'спине',
    chest: 'груди',
    nipples: 'соскам',
    belly: 'животу',
    arms: 'рукам',
    wrists: 'запястьям',
    hands: 'ладоням',
    waist: 'талии',
    hips: 'бёдрам',
    groin: 'паху',
    buttocks: 'ягодицам',
    inner_thighs: 'внутренним бёдрам',
    knees: 'коленям',
    calves: 'икрам',
    feet: 'ступням',
    general: 'телу'
};

function formatPointLabel(label?: string, pointId?: string): string {
    if (!label && pointId && pointShortNames[pointId]) {
        return pointShortNames[pointId];
    }
    if (!label) return 'телу';
    const clean = label.trim();
    if (!clean) return 'телу';
    return clean.toLowerCase();
}

export function describeActionNarrative(
    actionId: string,
    actionLabel: string,
    actorName: string,
    pointLabel?: string,
    pointId?: string
): string {
    const formattedPoint = formatPointLabel(pointLabel, pointId);
    const template = actionTemplates[actionId];
    const actor = actorName || 'Калибратор';
    if (template) {
        return template(actor, formattedPoint);
    }
    return defaultActionTemplate(actor, actionLabel, formattedPoint);
}

export type ContextNarrativeMode = 'self' | 'forced' | 'removed';

export function describeContextNarrative(
    preset: {
        label: string;
        selfApplicable?: boolean;
        selfText?: string | null;
        forcedText?: string | null;
        removalText?: string | null;
    },
    mode: ContextNarrativeMode,
    actorName?: string
): string {
    const baseLabel = preset.label || 'состояние';
    const actor = actorName || 'Калибратор';
    const applyActor = (text?: string | null) => {
        if (!text) return text;
        return text.replace(/\{\{actor\}\}/gi, actor);
    };
    if (mode === 'removed') {
        return (
            applyActor(preset.removalText) ||
            `${actor} снимает ограничение: ${baseLabel}.`
        );
    }
    if (mode === 'self') {
        return (
            preset.selfText ||
            `Ты самостоятельно принимаешь позу: ${baseLabel}.`
        );
    }
    return (
        applyActor(preset.forcedText) ||
        `${actor} заставляет тебя принять состояние: ${baseLabel}.`
    );
}
