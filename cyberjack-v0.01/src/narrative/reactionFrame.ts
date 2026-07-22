import { CharacterRelation, InteractionObservation, SubjectCoreState } from '../domain/types';
import { voiceStyleOnly } from '../orchestration/characterGenerator/profileV2';
import { deriveEdgeProfile } from '../domain/edgeState';

export type SpeechAct =
    | 'silence'
    | 'answer'
    | 'acknowledge'
    | 'conceal'
    | 'admit'
    | 'set_boundary'
    | 'bargain'
    | 'probe'
    | 'challenge'
    | 'deflect'
    | 'request'
    | 'warn';

const speechActMeaning: Record<SpeechAct, string> = {
    silence: 'ничего не произносить',
    answer: 'ответить на заданный вопрос по существу, не заменяя ответ встречным вопросом',
    acknowledge: 'кратко показать, что событие замечено',
    conceal: 'скрыть прямое признание через недосказанность или смену фокуса',
    admit: 'прямо признать факт или ощущение',
    set_boundary: 'обозначить конкретную границу',
    bargain: 'предложить явное условие или обмен в форме «если…, то…»',
    probe: 'задать вопрос ради получения информации',
    challenge: 'проверить решимость адресата или оспорить его позицию',
    deflect: 'увести разговор от уязвимой темы',
    request: 'попросить о конкретном следующем действии',
    warn: 'предупредить о конкретном последствии'
};

export interface BehavioralCore {
    values: string[];
    vulnerabilities: string[];
    defenses: string[];
    voice: string[];
    mannerisms?: string[];
    conditionalReactions?: Array<{ facts: string[]; response: string }>;
    attentionFocus?: Array<'technique' | 'person' | 'body' | 'risk' | 'rules' | 'change'>;
    speechDisposition?: 'quiet' | 'normal' | 'expressive';
}

export interface ExpressionMode {
    arousal: 'calm' | 'high' | 'edge' | 'peak' | 'aftershock';
    affect: 'neutral' | 'positive' | 'negative' | 'mixed' | 'overload';
    control: 'intact' | 'strained' | 'fragmented' | 'minimal';
    maxWords: number;
    requiresDisruption: boolean;
    instructions: string[];
}

export interface ReactionFrame {
    speaker: { id: string; name: string; gender?: 'male' | 'female' | 'other'; role: string; core: BehavioralCore };
    addressee?: { id: string; name: string; relationship: string };
    scene: { title?: string; presentCharacters: string[]; contexts: string[] };
    event: {
        action: string;
        target: string;
        experience: string;
        changes: string[];
        physiologicalState: string;
        physiologicalEvent: 'normal' | 'high' | 'edge' | 'peak' | 'discharge' | 'breakdown';
        mandatoryPhysiologicalFocus: boolean;
        requiresSpeech: boolean;
        repetition: number;
        directlyExperienced: boolean;
        playerSpeech?: string;
        /** Engine-owned facts used for reply validation; never rendered into the character prompt. */
        validationFacts?: {
            sensitivityTrend: 'up' | 'down' | 'stable';
            sensitivityDelta: number;
            baselineSensitivityDelta: number;
        };
    };
    continuity: { recentDialogue: string[]; relevantEpisodes: string[] };
    dramaticPosition: {
        primaryIntent: string;
        secondaryConflict: string;
        preferredSpeechAct: SpeechAct;
        allowedSpeechActs: SpeechAct[];
    };
    expressionMode: ExpressionMode;
}

interface CompileFrameInput {
    speakerId: string;
    speakerName: string;
    speakerGender?: 'male' | 'female' | 'other';
    targetId: string;
    targetName: string;
    initiatorId?: string;
    initiatorName?: string;
    sceneTitle?: string;
    presentCharacters: string[];
    contexts: string[];
    core: SubjectCoreState;
    relation?: CharacterRelation | null;
    observation?: InteractionObservation;
    actionLabel?: string;
    pointLabel?: string;
    repetition?: number;
    profileText?: string;
    behavioralCore?: BehavioralCore;
    recentDialogue?: string[];
    relevantEpisodes?: string[];
    recentSpeechAct?: string;
    recentSpeechActs?: string[];
}

const unique = (values: string[], limit: number) => Array.from(new Set(values.filter(Boolean))).slice(0, limit);

function profileLines(profileText = ''): string[] {
    return profileText
        .split('\n')
        .map(line => line.replace(/^\s*\d+[.)]\s*/, '').trim())
        .filter(line => line.length > 18 && !line.startsWith('[') && !line.startsWith('- Имя:'));
}

export function buildBehavioralCore(profileText = ''): BehavioralCore {
    const lines = profileLines(profileText);
    const pick = (pattern: RegExp, limit: number) => unique(lines.filter(line => pattern.test(line)), limit);
    return {
        values: pick(/субъект|личност|решени|правил|верн|достоин|контрол|информац/i, 3),
        vulnerabilities: pick(/бо(и|я)|страх|ненавид|уязв|не довер|тревог|панич|боль|унижен|потер/i, 3),
        defenses: pick(/скрыва|огрыза|упрям|ждать|провокац|угроз|дистанц|фасад|молча|сопротив/i, 3),
        voice: pick(/говор|реч|нам[её]к|канцеляр|язв|коротк|манер[аы] общ|стиль общ/i, 2)
    };
}

function relationText(relation?: CharacterRelation | null): string {
    if (!relation) return 'отношение ещё не сформировано';
    const attitude = relation.attitude >= 70 ? 'явное расположение' : relation.attitude >= 55 ? 'растущее расположение' : relation.attitude >= 40 ? 'нейтральное отношение' : relation.attitude >= 25 ? 'настороженная неприязнь' : 'сильное отторжение';
    const openness = (relation.openness ?? 0) >= 65 ? 'готовность быть откровенной' : (relation.openness ?? 0) >= 35 ? 'осторожная открытость' : 'нежелание показывать уязвимость';
    const familiarity = (relation.familiarityLevel ?? 0) >= .7 ? 'хорошо знает этого человека' : (relation.familiarityLevel ?? 0) >= .25 ? 'уже знает некоторые его привычки' : 'ещё плохо понимает его намерения';
    return `${attitude}; ${openness}; ${familiarity}`;
}

function experienceText(observation?: InteractionObservation, directlyExperienced = true): string {
    if (!observation) return 'достоверная реакция неизвестна';
    if (!directlyExperienced) return observation.uiText;
    return observation.subjectiveText;
}

function changeLines(observation?: InteractionObservation): string[] {
    if (!observation) return [];
    const lines: string[] = [];
    if (observation.reaction.mixed) lines.push('приятная и неприятная составляющие присутствуют одновременно');
    if (observation.changes.localAttitude > .2) lines.push('эта зона принимает воздействие лучше');
    if (observation.changes.localAttitude < -.2) lines.push('локальное принятие этой зоны снизилось');
    if (observation.changes.attitude > .2) lines.push('принятие контакта выросло');
    if (observation.changes.attitude < -.2) lines.push('отношение к контакту ухудшилось');
    if (observation.changes.openness > .2) lines.push('открытость выросла');
    if (observation.changes.openness < -.2) lines.push('персонаж сильнее закрылся');
    if (observation.changes.capacity < -1) lines.push('запас самоконтроля заметно снизился');
    if (observation.changes.tension > 2) lines.push('напряжение заметно выросло');
    // A character perceives only a sufficiently large qualitative change. Exact
    // deltas and baseline learning belong to engine/monitor telemetry.
    const sensitivityDelta = observation.learning.sensitivityDelta || 0;
    if (sensitivityDelta >= .5) lines.push('ощущение в этой зоне стало заметно ярче');
    if (sensitivityDelta <= -.5) lines.push('ощущение в этой зоне стало заметно приглушённее');
    if (observation.learning.familiarityDelta > .1) lines.push('воздействие становится знакомым');
    observation.transitions.slice(-2).forEach(t => lines.push(t.text));
    return unique(lines, 7);
}

function physiologicalPosition(core: SubjectCoreState, observation?: InteractionObservation) {
    const transitionKinds = new Set((observation?.transitions || []).map(transition => transition.kind));
    if (transitionKinds.has('discharge')) return {
        state: 'Разрядка происходит прямо сейчас; тело уже прошло пик, а способность к сложной речи резко снижена.',
        mandatory: true,
        requiresSpeech: true,
        kind: 'discharge' as const
    };
    if (transitionKinds.has('breakdown')) return {
        state: 'Пиковое напряжение разрешилось нервным срывом; речь фрагментарна и подчинена этому состоянию.',
        mandatory: true,
        requiresSpeech: true,
        kind: 'breakdown' as const
    };
    if (core.tension >= 95) return {
        state: `${deriveEdgeProfile(core, observation ? [observation] : []).description} Напряжение у абсолютного предела.`,
        mandatory: true,
        requiresSpeech: false,
        kind: 'peak' as const
    };
    if (core.tension >= 85) return {
        state: deriveEdgeProfile(core, observation ? [observation] : []).description,
        mandatory: true,
        requiresSpeech: false,
        kind: 'edge' as const
    };
    if (core.tension >= 60) return {
        state: 'Накоплено сильное напряжение: дыхание и речь уже не могут оставаться полностью спокойными.',
        mandatory: true,
        requiresSpeech: false,
        kind: 'high' as const
    };
    return { state: 'Физиологическое напряжение не определяет текущую реплику.', mandatory: false, requiresSpeech: false, kind: 'normal' as const };
}

function compileExpressionMode(
    core: SubjectCoreState,
    observation: InteractionObservation | undefined,
    physiology: ReturnType<typeof physiologicalPosition>
): ExpressionMode {
    const pleasure = observation?.reaction.pleasure ?? 0;
    const discomfort = observation?.reaction.discomfort ?? 0;
    const overload = observation?.reaction.overload ?? 0;
    const behavior = observation?.behavioralState ?? 'responsive';
    const mixed = observation?.reaction.mixed || (pleasure > 0.5 && discomfort > 0.5 && Math.max(pleasure, discomfort) < Math.min(pleasure, discomfort) * 1.8);

    const arousal: ExpressionMode['arousal'] =
        physiology.kind === 'discharge' || physiology.kind === 'breakdown' ? 'aftershock'
        : physiology.kind === 'peak' ? 'peak'
        : physiology.kind === 'edge' ? 'edge'
        : physiology.kind === 'high' ? 'high' : 'calm';

    const affect: ExpressionMode['affect'] =
        physiology.kind === 'breakdown' || behavior === 'panic' || behavior === 'defiance' ? 'negative'
        : behavior === 'overload' || overload > Math.max(12, pleasure, discomfort) ? 'overload'
        : mixed ? 'mixed'
        : pleasure > Math.max(discomfort * 1.25, 1) ? 'positive'
        : discomfort > Math.max(pleasure * 1.25, 1) ? 'negative' : 'neutral';

    const control: ExpressionMode['control'] =
        behavior === 'unresponsive' || physiology.kind === 'breakdown' || core.capacity <= 10 ? 'minimal'
        : physiology.kind === 'discharge' || arousal === 'peak' || arousal === 'edge' || core.capacity <= 20 || overload >= 25 ? 'fragmented'
        : arousal === 'high' || core.capacity <= 35 || overload >= 10 ? 'strained' : 'intact';

    const maxWords = control === 'minimal' ? 3 : control === 'fragmented' ? 7 : control === 'strained' ? 12 : 20;
    const requiresDisruption = ['edge', 'peak', 'aftershock'].includes(arousal) && control !== 'intact';
    const instructions: string[] = [];

    if (control === 'minimal') {
        instructions.push('Речь почти недоступна: максимум несколько слов, звук или молчание; никаких объяснений.');
    } else if (control === 'fragmented') {
        instructions.push('Фраза распадается на очень короткие фрагменты; дыхание не позволяет закончить ровное предложение.');
    } else if (control === 'strained') {
        instructions.push('Речь короткая и сбитая: используй паузу, обрыв или резкий перепад интонации.');
    } else {
        instructions.push('Речь остаётся управляемой и может быть грамматически цельной.');
    }

    if (affect === 'positive') {
        instructions.push(arousal === 'calm'
            ? 'Положительная окраска проявляется в выборе слов, без обязательных междометий.'
            : 'Положительная окраска слышна в сбитом дыхании; допустимы короткий вздох или непроизвольное междометие, но не сценическая ремарка.');
    } else if (affect === 'negative') {
        instructions.push(arousal === 'calm'
            ? 'Отрицательная окраска выражается конкретной границей, холодностью или раздражением.'
            : 'Отрицательная окраска выражается выкриком, резким приказом или оборванным предупреждением; ругательство допустимо только в голосе этого персонажа.');
    } else if (affect === 'mixed') {
        instructions.push('В голосе должно быть слышно противоречие между приятным и неприятным; не своди реакцию к одной валентности.');
    } else if (affect === 'overload') {
        instructions.push('Главное — сенсорная спутанность: слова запаздывают, повторяются или обрываются.');
    }

    if (requiresDisruption) {
        instructions.push('Реплика не может звучать как спокойное законченное высказывание: обозначь срыв голоса через «…», «—», «!» или естественное междометие.');
    }

    return { arousal, affect, control, maxWords, requiresDisruption, instructions };
}

function dramaticPosition(input: CompileFrameInput, behavioral: BehavioralCore) {
    const observation = input.observation;
    const directlyExperienced = input.speakerId === input.targetId;
    const repetition = input.repetition ?? 1;
    const discomfort = observation?.reaction.discomfort ?? 0;
    const pleasure = observation?.reaction.pleasure ?? 0;
    const overload = observation?.reaction.overload ?? 0;
    const lowResource = input.core.capacity < 30;
    const hasGuardedProfile = behavioral.defenses.length > 0 || behavioral.vulnerabilities.length > 0;
    const unresolved = (input.relevantEpisodes || []).some(e => /вопрос|обещ|границ|объясн|намерен/i.test(e));
    const physiology = physiologicalPosition(input.core, observation);

    if (!directlyExperienced) {
        return {
            primaryIntent: 'решить, достаточно ли событие затрагивает тебя, чтобы вмешаться',
            secondaryConflict: 'ты видишь только внешнюю реакцию и не знаешь внутренних ощущений другого персонажа',
            allowedSpeechActs: ['silence', 'probe', 'warn', 'challenge'] as SpeechAct[]
        };
    }
    if (observation?.behavioralState === 'unresponsive') {
        return {
            primaryIntent: 'не формулировать осмысленную реплику: сознательный контакт уже потерян',
            secondaryConflict: 'возможны только молчание или короткая непроизвольная вокализация тела',
            allowedSpeechActs: ['silence', 'acknowledge'] as SpeechAct[]
        };
    }
    if (physiology.kind === 'discharge') {
        return {
            primaryIntent: 'непроизвольно выразить происходящую разрядку, а не продолжать прежнюю спокойную линию разговора',
            secondaryConflict: 'пик почти не оставляет ресурса для связной и контролируемой формулировки',
            allowedSpeechActs: ['acknowledge', 'admit'] as SpeechAct[]
        };
    }
    if (physiology.kind === 'breakdown') {
        return {
            primaryIntent: 'дать понять, что контроль и способность выдерживать происходящее сорваны',
            secondaryConflict: 'связная речь нарушена истощением и панической реакцией',
            allowedSpeechActs: ['warn', 'request', 'set_boundary'] as SpeechAct[]
        };
    }
    if (physiology.kind === 'peak' || physiology.kind === 'edge') {
        return {
            primaryIntent: 'отреагировать на непосредственное приближение пика и попытаться повлиять на следующий момент',
            secondaryConflict: 'контроль над голосом ослаблен, поэтому скрыть телесное состояние полностью уже невозможно',
            allowedSpeechActs: ['request', 'warn', 'admit', 'set_boundary', 'silence'] as SpeechAct[]
        };
    }
    const acceptanceDown = (observation?.changes.attitude ?? 0) < -0.2 || (observation?.changes.openness ?? 0) < -0.2;
    const acceptanceUp = (observation?.changes.attitude ?? 0) > 0.2 || (observation?.changes.openness ?? 0) > 0.2;
    if (pleasure > discomfort * 1.25 && acceptanceDown) {
        return {
            primaryIntent: 'не дать адресату принять приятную телесную реакцию за согласие, доверие или просьбу повторить действие',
            secondaryConflict: 'тело отзывается положительно, но общее принятие и открытость после контакта снизились',
            allowedSpeechActs: ['set_boundary', 'conceal', 'challenge', 'admit', 'silence'] as SpeechAct[]
        };
    }
    if (discomfort > pleasure * 1.25 && acceptanceUp) {
        return {
            primaryIntent: 'признать, что неприятное ощущение не привело к большему отторжению контакта',
            secondaryConflict: 'телесная неприятность и растущее общее принятие существуют одновременно',
            allowedSpeechActs: ['admit', 'bargain', 'set_boundary', 'acknowledge', 'silence'] as SpeechAct[]
        };
    }
    if (overload > 10 || lowResource) {
        return {
            primaryIntent: 'сохранить безопасность и способность влиять на происходящее',
            secondaryConflict: 'состояние мешает строить длинные и продуманные фразы',
            allowedSpeechActs: ['silence', 'set_boundary', 'warn', 'request'] as SpeechAct[]
        };
    }
    if (repetition >= 3 || unresolved) {
        return {
            primaryIntent: pleasure > discomfort
                ? 'показать, как меняется реакция на знакомое воздействие, не повторяя прежнюю реплику'
                : 'повлиять на продолжающееся воздействие и не повторять уже обозначенную реакцию',
            secondaryConflict: pleasure > discomfort && hasGuardedProfile
                ? 'не хочется прямо признавать, насколько положительно реагирует тело'
                : 'не хочется выглядеть беспомощной или предсказуемой',
            allowedSpeechActs: pleasure > discomfort
                ? ['acknowledge', 'admit', 'conceal', 'request', 'silence'] as SpeechAct[]
                : ['set_boundary', 'warn', 'challenge', 'request', 'silence'] as SpeechAct[]
        };
    }
    if (observation?.reaction.mixed) {
        return {
            primaryIntent: 'осмыслить или обозначить неоднозначность текущей реакции',
            secondaryConflict: 'телесная реакция не совпадает с простой оценкой «приятно» или «неприятно»',
            allowedSpeechActs: ['acknowledge', 'admit', 'conceal', 'set_boundary', 'silence'] as SpeechAct[]
        };
    }
    if (discomfort > pleasure * 1.25) {
        return {
            primaryIntent: 'повлиять на характер следующего воздействия',
            secondaryConflict: hasGuardedProfile ? 'не хочется просить или показывать страх прямо' : 'нужно решить, требовать ли остановки',
            allowedSpeechActs: ['set_boundary', 'warn', 'bargain', 'challenge', 'silence'] as SpeechAct[]
        };
    }
    if (pleasure > discomfort * 1.25) {
        return {
            primaryIntent: 'решить, стоит ли озвучить замеченное ощущение или изменение',
            secondaryConflict: hasGuardedProfile ? 'прямое признание ощущается уязвимым' : 'слова могут быть избыточны',
            allowedSpeechActs: ['acknowledge', 'admit', 'conceal', 'request', 'silence'] as SpeechAct[]
        };
    }
    return {
        primaryIntent: 'сохранить осмысленный контакт и оценить следующий шаг адресата',
        secondaryConflict: 'событие пока не требует однозначной эмоциональной оценки',
        allowedSpeechActs: ['silence', 'acknowledge', 'probe', 'deflect'] as SpeechAct[]
    };
}

export function compileReactionFrame(input: CompileFrameInput): ReactionFrame {
    const behavioral = input.behavioralCore || buildBehavioralCore(input.profileText);
    const directlyExperienced = input.speakerId === input.targetId;
    const basePosition = dramaticPosition(input, behavioral);
    const lastOwnLine = [...(input.recentDialogue || [])].reverse().find(line => line.includes(`${input.speakerName}:`)) || '';
    const previousWasQuestion = lastOwnLine.includes('?');
    const recentSpeechActs = new Set([...(input.recentSpeechActs || []), input.recentSpeechAct].filter(Boolean));
    const physiology = physiologicalPosition(input.core, input.observation);
    const allowedSpeechActs = behavioral.speechDisposition === 'quiet' && !physiology.mandatory
        ? ['silence', ...basePosition.allowedSpeechActs.filter(act => act !== 'silence')] as SpeechAct[]
        : basePosition.allowedSpeechActs;
    const preferredSpeechAct = allowedSpeechActs.find(act =>
        act !== 'silence' && !recentSpeechActs.has(act) && (!previousWasQuestion || act !== 'probe')
    ) || allowedSpeechActs[0];
    const position = { ...basePosition, allowedSpeechActs, preferredSpeechAct };
    const expressionMode = compileExpressionMode(input.core, input.observation, physiology);
    const addresseeId = input.initiatorId || input.targetId;
    const addresseeName = input.initiatorName || input.targetName;
    return {
        speaker: { id: input.speakerId, name: input.speakerName, gender: input.speakerGender, role: directlyExperienced ? 'цель воздействия' : 'участник сцены', core: behavioral },
        addressee: addresseeId === input.speakerId ? undefined : { id: addresseeId, name: addresseeName, relationship: relationText(input.relation) },
        scene: { title: input.sceneTitle, presentCharacters: unique(input.presentCharacters, 8), contexts: unique(input.contexts, 8) },
        event: {
            action: input.actionLabel || input.observation?.action.label || 'событие без ясного действия',
            target: input.pointLabel || input.observation?.action.pointLabel || input.observation?.action.pointId || 'не указана',
            experience: experienceText(input.observation, directlyExperienced),
            changes: changeLines(input.observation),
            physiologicalState: physiology.state,
            physiologicalEvent: physiology.kind,
            mandatoryPhysiologicalFocus: directlyExperienced && physiology.mandatory,
            requiresSpeech: directlyExperienced && physiology.requiresSpeech && input.observation?.behavioralState !== 'unresponsive',
            repetition: input.repetition ?? 1,
            directlyExperienced,
            validationFacts: input.observation ? {
                sensitivityTrend: input.observation.learning.sensitivityDelta > .01
                    ? 'up'
                    : input.observation.learning.sensitivityDelta < -.01 ? 'down' : 'stable',
                sensitivityDelta: input.observation.learning.sensitivityDelta,
                baselineSensitivityDelta: input.observation.learning.baselineSensitivityDelta
            } : undefined
        },
        continuity: {
            recentDialogue: unique(input.recentDialogue || [], 4),
            relevantEpisodes: unique(input.relevantEpisodes || [], 3)
        },
        dramaticPosition: position,
        expressionMode
    };
}

export function applyVerbalInputToFrame(frame: ReactionFrame, playerSpeech: string): ReactionFrame {
    const text = playerSpeech.trim();
    if (!text) return frame;
    const asksDirectly = /\?|^(скажи|ответь|объясни|признай|назови)\b/i.test(text);
    return {
        ...frame,
        event: {
            ...frame.event,
            action: 'реплика адресата',
            target: 'разговор',
            experience: 'слышит содержание и тон реплики; нового физического воздействия в этот момент нет',
            changes: [],
            playerSpeech: text
        },
        dramaticPosition: asksDirectly
            ? {
                primaryIntent: 'ответить на конкретную реплику адресата по существу',
                secondaryConflict: 'ответ может раскрыть уязвимость; это влияет на формулировку, но не отменяет сам ответ',
                preferredSpeechAct: 'answer',
                allowedSpeechActs: ['answer', 'admit', 'set_boundary', 'request', 'silence']
            }
            : {
                primaryIntent: 'отреагировать на буквальное содержание реплики и продолжить уже начатый разговор',
                secondaryConflict: 'не хочется раскрывать больше необходимого, но нет причины снова выяснять намерения без новых оснований',
                preferredSpeechAct: 'acknowledge',
                allowedSpeechActs: ['acknowledge', 'admit', 'challenge', 'deflect', 'silence']
            }
    };
}

export function buildReactionSystemPrompt(frame: ReactionFrame): string {
    const core = frame.speaker.core;
    const genderText = frame.speaker.gender === 'female' ? 'женский' : frame.speaker.gender === 'male' ? 'мужской' : 'не указан';
    const attentionMeaning: Record<string, string> = {
        technique: 'как именно выполнено воздействие', person: 'намерение и реакцию собеседника',
        body: 'конкретное телесное ощущение', risk: 'риск, безопасность и возможность контроля',
        rules: 'правила, договорённости и последовательность процедуры', change: 'что изменилось по сравнению с прошлым моментом'
    };
    const behavioralLines = [
        ...core.values.slice(0, 2).map(value => `Ценность: ${value}`),
        ...core.vulnerabilities.slice(0, 2).map(value => `Уязвимость: ${value}`),
        ...core.defenses.slice(0, 2).map(value => `Защита: ${value}`),
        ...(core.mannerisms || []).slice(0, 1).map(value => `Привычка: ${value}`)
    ];
    const dischargeRule = frame.event.physiologicalEvent === 'discharge' && frame.expressionMode.control === 'minimal'
        ? '- Если разрядка совпала с потерей сознания, допустимы короткая непроизвольная вокализация или пустая speech: системное событие уже описывает случившееся.'
        : '- При событии разрядки реплика должна недвусмысленно показать, что пик уже произошёл; одной просьбы о следующем действии недостаточно.';
    return [
        `Ты формулируешь только произнесённую вслух речь персонажа ${frame.speaker.name}. Грамматический род: ${genderText}.`,
        `[Поведенческое ядро]\n${behavioralLines.length ? behavioralLines.map(v => `- ${v}`).join('\n') : '- Сохраняет субъектность и реагирует на конкретную ситуацию, а не пересказывает биографию.'}`,
        `[Голос]\n${core.voice.length ? core.voice.map(v => `- ${voiceStyleOnly(v)}`).join('\n') : '- Краткая естественная речь без литературного монолога.'}`,
        `[Фокус внимания]\n${core.attentionFocus?.length ? core.attentionFocus.map(focus => `- В первую очередь замечает ${attentionMeaning[focus] || focus}.`).join('\n') : '- Замечает конкретное текущее событие без обязательной профессиональной метафоры.'}\nРечевая склонность: ${core.speechDisposition === 'quiet' ? 'часто оставляет малозначимые события без реплики' : core.speechDisposition === 'expressive' ? 'охотно реагирует вслух' : 'говорит только когда есть что добавить'}.`,
        `[Правила]\n- Не придумывай действий, ощущений, предметов, знаний или чужих мыслей. Фактом текущей сцены считается только явно указанное в событии и контекстах.\n- Факты текущего события и строка «Что изменилось» всегда важнее старых реплик и связанных эпизодов.\n- Не называй внутренние параметры симулятора, baseline, численные дельты или «обучающий след». Говори только о непосредственно различимом ощущении, если оно явно дано текущим событием.\n- Локальный контекст действует только на подписанную зону; не переноси гиперестезию или иной эффект на текущую цель, если зоны различаются.\n- Не заменяй указанное текущее действие похожим: поглаживание не является массажем, ударом, царапаньем или иным воздействием.\n- Биография и характер определяют, что персонаж замечает и как об этом говорит, но не пересказываются без причины. Профессия не обязана упоминаться в реплике.\n- Выбери одну естественную реакцию на текущий момент; не пытайся перечислить все доступные мотивы.\n- Постоянный голос определяет лексику персонажа, а текущая манера — форму именно этой реплики. При конфликте формы текущее физиологическое состояние важнее обычной гладкости речи.\n- Различай приятную телесную реакцию, принятие конкретной зоны и общее принятие/открытость. Телесное удовольствие само по себе не означает согласия, доверия или желания повторить действие.\n- Если общее принятие или открытость снизились, не проси повторять или усиливать действие.\n- При реакции на воздействие можно назвать ощущение, заметить технику или изменение, поставить границу, обратиться к собеседнику либо промолчать — в зависимости от характера.\n- Не используй многоточие как универсальный признак эмоции: при спокойной связной речи предпочитай обычную пунктуацию.\n- Если физиологический фокус обозначен как обязательный, реплика должна явно исходить из него; нельзя отвечать так, будто персонаж спокоен.\n${dischargeRule}\n- Если текущий кадр требует речи, speech не может быть пустой.\n- Не используй имена, термины, лозунги и цитаты из лора, если адресат не поднял эту тему в текущей реплике и она не является текущим событием.\n- Если адресат задал прямой вопрос, ответь, явно откажись отвечать либо осознанно промолчи в соответствии с характером.\n- Сохраняй установленную форму обращения и грамматический род персонажа.\n- Не повторяй дословно текущую реплику адресата.\n- Не превышай лимит слов из текущей манеры.\n- Если слова не нужны и кадр не требует речи, верни пустую speech.\n- Не повторяй недавнюю реплику и не своди любую реакцию к «сильнее» или «не надо».`,
        `[Формат]\nВерни только JSON: {"addressedTo":"ID или пустая строка","speechAct":"один из разрешённых","speech":"только прямая речь без ремарок"}`
    ].join('\n\n');
}

export function buildReactionTurnMessage(frame: ReactionFrame, playerSpeech?: string | null): string {
    const currentSpeech = playerSpeech?.trim() || frame.event.playerSpeech;
    const directQuestion = Boolean(currentSpeech && (/\?|^(скажи|ответь|объясни|признай|назови)\b/i.test(currentSpeech)));
    const requiresDirectedAct = directQuestion || frame.event.requiresSpeech || frame.event.physiologicalEvent !== 'normal';
    const moveGuidance = requiresDirectedAct
        ? `Требуемый для этого критического момента ход: ${frame.dramaticPosition.preferredSpeechAct} — ${speechActMeaning[frame.dramaticPosition.preferredSpeechAct]}.`
        : 'Заранее выбранного речевого хода нет: форма реакции должна исходить из характера, фокуса внимания и значимости события.';
    return [
        `[Текущая перспектива ${frame.speaker.name}]`,
        frame.addressee ? `Адресат: ${frame.addressee.name} (${frame.addressee.id}). Отношения: ${frame.addressee.relationship}.` : 'Явного адресата нет.',
        currentSpeech ? `[Реплика адресата]\n${currentSpeech}` : '',
        `Сцена: ${frame.scene.title || 'текущая сцена'}. Присутствуют: ${frame.scene.presentCharacters.join(', ') || 'не указано'}.`,
        frame.scene.contexts.length ? `Значимые контексты: ${frame.scene.contexts.join(', ')}.` : '',
        `Событие: ${frame.event.action}; зона: ${frame.event.target}; повтор подряд: ${frame.event.repetition}.`,
        `Доступное восприятие: ${frame.event.experience}`,
        `[Физиологическое состояние]\n${frame.event.physiologicalState}${frame.event.mandatoryPhysiologicalFocus ? '\nЭто обязательный фокус реплики.' : ''}${frame.event.requiresSpeech ? '\nСобытие требует непустой голосовой реакции.' : ''}`,
        `[Манера текущей реплики]\nВозбуждение: ${frame.expressionMode.arousal}. Окраска: ${frame.expressionMode.affect}. Контроль речи: ${frame.expressionMode.control}. Лимит: ${frame.expressionMode.maxWords} слов.\n${frame.expressionMode.instructions.map(v => `- ${v}`).join('\n')}`,
        frame.event.changes.length ? `Что изменилось: ${frame.event.changes.join('; ')}.` : '',
        frame.continuity.relevantEpisodes.length ? `[Связанные эпизоды]\n${frame.continuity.relevantEpisodes.map(v => `- ${v}`).join('\n')}` : '',
        `[Импульсы текущего момента]\nВозможное намерение: ${frame.dramaticPosition.primaryIntent}.\nВнутреннее препятствие: ${frame.dramaticPosition.secondaryConflict}.\n${moveGuidance}\nДоступные ходы:\n${frame.dramaticPosition.allowedSpeechActs.map(act => `- ${act}: ${speechActMeaning[act]}`).join('\n')}.`
    ].filter(Boolean).join('\n\n');
}
