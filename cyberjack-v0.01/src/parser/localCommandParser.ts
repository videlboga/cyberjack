export interface LocalCommandCharacter {
    id: string;
    name: string;
}

export interface LocalCommandMatch {
    actionId: string;
    actorId: string;
    targetId: string;
    pointId: string;
    confidence: number;
    source: 'local-command-parser';
}

const ACTIONS: Array<{ actionId: string; pattern: RegExp; pointId?: string }> = [
    { actionId: 'pose_all_fours', pattern: /(?:встань|вставай|поставь|поставить|встать)[^.!?]{0,40}на четвереньки/iu },
    { actionId: 'pose_kneeling', pattern: /(?:встань|опустись|становись|поставь|поставить)[^.!?]{0,40}на колени/iu },
    { actionId: 'pose_sitting', pattern: /(?:^|\s)(?:сядь|садись|сесть|посади|посадить)(?:$|\s)/iu },
    { actionId: 'pose_lying_down', pattern: /(?:^|\s)(?:ляг|ложись|лечь|уложи|уложить)(?:$|\s)/iu },
    { actionId: 'pose_standing', pattern: /(?:^|\s)(?:встань|вставай|встать|поставь|поставить)(?:$|\s)/iu },
    { actionId: 'act_examine', pattern: /(?:^|\s)(?:осмотри|осмотреть|обследуй|обследовать)(?:$|\s)/iu },
    { actionId: 'act_caress', pattern: /(?:^|\s)(?:погладь|погладить|гладь|приласкай|приласкать)(?:$|\s)/iu },
    { actionId: 'act_kiss', pattern: /(?:^|\s)(?:поцелуй|поцеловать|целуй)(?:$|\s)/iu, pointId: 'lips' },
];

const POINTS: Array<[RegExp, string]> = [
    [/(?:^|\s)(?:лицо|лицу|лица)(?:$|\s)/iu, 'face'], [/(?:^|\s)(?:губы|губам|губах)(?:$|\s)/iu, 'lips'],
    [/(?:^|\s)(?:голову|голова|голове)(?:$|\s)/iu, 'head'], [/(?:^|\s)(?:шею|шея|шее)(?:$|\s)/iu, 'neck'],
    [/(?:^|\s)(?:грудь|груди)(?:$|\s)/iu, 'chest'], [/(?:^|\s)(?:живот|животе|животу)(?:$|\s)/iu, 'belly'],
    [/(?:^|\s)(?:спину|спина|спине)(?:$|\s)/iu, 'back'], [/(?:^|\s)(?:бедра|бедро|бедрам)(?:$|\s)/iu, 'hips'],
    [/(?:^|\s)(?:ягодицы|ягодицам)(?:$|\s)/iu, 'buttocks'], [/(?:^|\s)(?:руки|руку|рукам)(?:$|\s)/iu, 'hands'],
    [/(?:^|\s)(?:ноги|ногу|ногам)(?:$|\s)/iu, 'legs'], [/(?:^|\s)(?:ступни|ступню|стопы|стопу)(?:$|\s)/iu, 'feet'],
];

function normalized(value: string): string {
    return value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^\p{L}\p{N}-]+/gu, ' ').trim();
}

function nameStem(name: string): string {
    const word = normalized(name).split(' ')[0] || '';
    return word.length > 3 ? word.replace(/[аяуюеиы]$/u, '') : word;
}

function mentionedCharacters(text: string, characters: LocalCommandCharacter[]): LocalCommandCharacter[] {
    const clean = normalized(text);
    return characters.filter(character => {
        const full = normalized(character.name);
        const stem = nameStem(character.name);
        return (full && clean.includes(full)) || (stem.length >= 3 && new RegExp(`(?:^|\\s)${stem}[а-я]*?(?:$|\\s)`, 'u').test(clean));
    });
}

/**
 * Fast, deliberately conservative parser for unambiguous Russian imperatives.
 * Actor is the addressee ("Иона, ..."), while target is the character the
 * physical action is applied to ("... осмотри Нику").
 */
export function parseLocalCommand(input: {
    text: string;
    characters: LocalCommandCharacter[];
    defaultActorId: string;
    defaultTargetId: string;
}): LocalCommandMatch | null {
    const raw = input.text.trim();
    const clean = normalized(raw);
    if (!clean || raw.includes('?') || /[«»"“”]/u.test(raw)) return null;
    if (/^(?:почему|зачем|как|когда|где|что|кто|можешь\s+ли)(?:$|\s)/iu.test(clean)) return null;
    if (/(?:^|\s)не\s+(?:садись|сядь|вставай|встань|опускайся|опустись|ложись|ляг|осматривай|осмотри|гладь|погладь|целуй|поцелуй)(?:$|\s)/iu.test(clean)) return null;
    if (/(?:^|\s)(?:сказал[аи]?|просил[аи]?|приказал[аи]?)(?:$|\s)/iu.test(clean)) return null;

    const action = ACTIONS.find(candidate => candidate.pattern.test(clean));
    if (!action) return null;

    const mentioned = mentionedCharacters(clean, input.characters);
    const commaPrefix = raw.match(/^\s*([\p{L}\p{N}-]+)\s*,/u)?.[1];
    const addressed = commaPrefix
        ? input.characters.find(character => nameStem(character.name) === nameStem(commaPrefix))
        : undefined;
    const actorId = addressed?.id || input.defaultActorId;
    const explicitTarget = mentioned.find(character => character.id !== actorId);
    const targetId = explicitTarget?.id || (addressed ? actorId : input.defaultTargetId);
    const pointId = POINTS.find(([pattern]) => pattern.test(clean))?.[1] || action.pointId || 'systemic';

    return { actionId: action.actionId, actorId, targetId, pointId, confidence: explicitTarget ? 0.99 : 0.96, source: 'local-command-parser' };
}
