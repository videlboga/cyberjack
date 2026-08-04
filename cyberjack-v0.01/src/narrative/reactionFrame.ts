import { CharacterRelation, InteractionObservation, SubjectCoreState } from '../domain/types';
import { deriveEdgeProfile } from '../domain/edgeState';
import { OVERLOAD_FRAGMENTED_SPEECH, OVERLOAD_NOTICEABLE } from '../domain/overloadScale';

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
    | 'warn'
    | 'report'
    | 'offer'
    | 'support'
    | 'tease'
    | 'comply';

export interface BehavioralCore {
    values: string[];
    needs?: string[];
    vulnerabilities: string[];
    defenses: string[];
    voice: string[];
    emotionalVoice?: Partial<Record<'guarded' | 'open' | 'angry' | 'afraid' | 'aroused' | 'overloaded' | 'exhausted', string>>;
    mannerisms?: string[];
    centralConflict?: { desire: string; fear: string };
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
    scene: { title?: string; presentCharacters: string[]; contexts: string[]; roleContext: string[] };
    event: {
        action: string;
        target: string;
        experience: string;
        changes: string[];
        physiologicalState: string;
        physiologicalEvent: 'normal' | 'high' | 'edge' | 'peak' | 'discharge' | 'overload' | 'breakdown';
        mandatoryPhysiologicalFocus: boolean;
        requiresSpeech: boolean;
        repetition: number;
        directlyExperienced: boolean;
        affectedCharacter: string;
        playerSpeech?: string;
        sharedPastUnsupported?: boolean;
    };
    continuity: {
        recentDialogue: string[];
        relevantEpisodes: string[];
        canonicalFacts: string[];
        relationshipBeliefs: string[];
        openThreads: string[];
    };
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
    roleContext?: string[];
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
    canonicalFacts?: string[];
    recentSpeechAct?: string;
    recentSpeechActs?: string[];
    relationshipBeliefs?: string[];
    openThreads?: string[];
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
    if (!relation) return 'У тебя ещё не сложилось о нём устойчивого мнения.';
    const attitude = relation.attitude >= 70 ? 'Ты явно расположена к нему' : relation.attitude >= 55 ? 'Ты всё больше к нему расположена' : relation.attitude >= 40 ? 'Ты относишься к нему нейтрально' : relation.attitude >= 25 ? 'Ты смотришь на него с настороженной неприязнью' : 'Ты испытываешь к нему сильное отторжение';
    const openness = (relation.openness ?? 0) >= 65 ? 'и готова говорить откровенно' : (relation.openness ?? 0) >= 35 ? 'но открываешься лишь осторожно' : 'и не хочешь показывать ему свою уязвимость';
    const familiarity = (relation.familiarityLevel ?? 0) >= .7 ? 'Ты хорошо знаешь его привычки.' : (relation.familiarityLevel ?? 0) >= .25 ? 'Ты уже узнаёшь некоторые его привычки.' : 'Ты пока плохо понимаешь его намерения.';
    return `${attitude}; ${openness}; ${familiarity}`;
}

function experienceText(observation?: InteractionObservation, directlyExperienced = true): string {
    if (!observation) return 'достоверная реакция неизвестна';
    if (!directlyExperienced) return observation.uiText || 'Ты видишь внешнюю реакцию, но не можешь достоверно знать внутреннее переживание.';
    return observation.subjectiveText;
}

function changeLines(observation?: InteractionObservation): string[] {
    if (!observation) return [];
    const lines: string[] = [];
    if (observation.reaction.mixed) lines.push('Ты одновременно различаешь в ощущении приятное и неприятное');
    if (observation.changes.localAttitude > .2) lines.push('Эта часть тела уже не так резко встречает воздействие');
    if (observation.changes.localAttitude < -.2) lines.push('Эта часть тела всё сильнее отторгает повторный контакт');
    if (observation.changes.attitude > .2) lines.push('Тебе немного легче принять сам факт контакта');
    if (observation.changes.attitude < -.2) lines.push('Тебе всё труднее принимать происходящее');
    if (observation.changes.openness > .2) lines.push('Тебе легче прямо показать свою реакцию');
    if (observation.changes.openness < -.2) lines.push('Тебе снова хочется замкнуться и ничего не выдавать');
    if (observation.changes.capacity < -1) lines.push('Удерживать мысли, голос и тело под контролем становится труднее');
    if (observation.changes.tension > 2) lines.push('Внутреннее напряжение заметно нарастает');
    // A character perceives only a sufficiently large qualitative change. Exact
    // deltas and baseline learning belong to engine/monitor telemetry.
    const sensitivityDelta = observation.learning.sensitivityDelta || 0;
    if (sensitivityDelta >= .5) lines.push('Ты чувствуешь эту зону заметно ярче');
    if (sensitivityDelta <= -.5) lines.push('Ощущение в этой зоне становится глуше');
    if (observation.learning.familiarityDelta > .1) lines.push('Ты всё быстрее узнаёшь знакомый рисунок воздействия');
    observation.transitions.slice(-2).forEach(t => lines.push(t.text));
    return unique(lines, 7);
}

function hasContext(contexts: string[], pattern: RegExp): boolean {
    return contexts.some(context => pattern.test(context));
}

function physiologicalPosition(core: SubjectCoreState, observation?: InteractionObservation, contexts: string[] = []) {
    const transitionKinds = new Set((observation?.transitions || []).map(transition => transition.kind));
    if (transitionKinds.has('discharge')) return {
        state: 'Ты прямо сейчас проходишь через оргазм: пик уже прорвался через тело, и на сложную связную речь почти не остаётся контроля.',
        mandatory: true,
        requiresSpeech: true,
        kind: 'discharge' as const
    };
    if (transitionKinds.has('breakdown')) return {
        state: 'Предельное напряжение сорвало твой контроль; мысли и речь распадаются на фрагменты.',
        mandatory: true,
        requiresSpeech: true,
        kind: 'breakdown' as const
    };
    if (transitionKinds.has('overload')) return {
        state: 'Ощущения дошли до предела и захватили всё твоё внимание, но не разрешились ни оргазмом, ни нервным срывом.',
        mandatory: true,
        requiresSpeech: true,
        kind: 'overload' as const
    };
    // Conditions live longer than the tick that created them. Looking only at
    // the latest observation made an active panic attack disappear from voice
    // and expression as soon as the next event was conversational.
    if (hasContext(contexts, /(?:effect[_\s-]*panic|паническ|паник)/i)) return {
        state: 'Паника всё ещё держит тебя: дыхание сбивается, внимание мечется, и ты не можешь заговорить спокойно и нейтрально.',
        mandatory: true,
        requiresSpeech: false,
        kind: 'high' as const
    };
    const reactionMagnitude = (observation?.reaction.pleasure ?? 0)
        + (observation?.reaction.discomfort ?? 0)
        + (observation?.reaction.overload ?? 0);
    const edgeDescription = reactionMagnitude >= 2
        ? deriveEdgeProfile(core, observation ? [observation] : []).description
        : 'Ты чувствуешь, что накопленное напряжение близко к пределу, но пока не можешь ясно назвать его приятным или защитным.';
    if (core.tension >= 95) return {
        state: `${edgeDescription} Ты почти не можешь выдержать ещё один подъём.`,
        mandatory: true,
        requiresSpeech: false,
        kind: 'peak' as const
    };
    if (core.tension >= 85) return {
        state: edgeDescription,
        mandatory: true,
        requiresSpeech: false,
        kind: 'edge' as const
    };
    if (core.tension >= 60) return {
        state: 'В тебе накопилось сильное напряжение: дыхание и голос уже не удаётся удерживать полностью спокойными.',
        mandatory: true,
        requiresSpeech: false,
        kind: 'high' as const
    };
    return { state: '', mandatory: false, requiresSpeech: false, kind: 'normal' as const };
}

function compileExpressionMode(
    core: SubjectCoreState,
    observation: InteractionObservation | undefined,
    physiology: ReturnType<typeof physiologicalPosition>,
    contexts: string[] = []
): ExpressionMode {
    const pleasure = observation?.reaction.pleasure ?? 0;
    const discomfort = observation?.reaction.discomfort ?? 0;
    const overload = observation?.reaction.overload ?? 0;
    const sensoryAmplification = observation?.reaction.sensoryAmplification ?? 1;
    const behavior = observation?.behavioralState ?? 'responsive';
    const contextPanic = hasContext(contexts, /(?:effect[_\s-]*panic|паническ|паник)/i);
    const mixed = observation?.reaction.mixed || (pleasure > 0.5 && discomfort > 0.5 && Math.max(pleasure, discomfort) < Math.min(pleasure, discomfort) * 1.8);

    const arousal: ExpressionMode['arousal'] =
        physiology.kind === 'discharge' || physiology.kind === 'overload' || physiology.kind === 'breakdown' ? 'aftershock'
        : physiology.kind === 'peak' ? 'peak'
        : physiology.kind === 'edge' ? 'edge'
        : physiology.kind === 'high' ? 'high' : 'calm';

    const snapshotValence = observation?.reactionSnapshot?.affect.valence;
    const snapshotEmotion = observation?.reactionSnapshot?.affect.emotion;
    const affect: ExpressionMode['affect'] =
        physiology.kind === 'breakdown' || contextPanic || behavior === 'panic' || behavior === 'defiance' ? 'negative'
        : snapshotValence !== undefined && snapshotValence < -.2 ? 'negative'
        : snapshotEmotion === 'mixed' || snapshotEmotion === 'mixed_overload' ? 'mixed'
        : behavior === 'overload' || overload > Math.max(OVERLOAD_NOTICEABLE, pleasure, discomfort) ? 'overload'
        : mixed ? 'mixed'
        : snapshotValence !== undefined && snapshotValence > .2 ? 'positive'
        : pleasure > Math.max(discomfort * 1.25, 1) ? 'positive'
        : discomfort > Math.max(pleasure * 1.25, 1) ? 'negative' : 'neutral';

    const control: ExpressionMode['control'] =
        behavior === 'unresponsive' || physiology.kind === 'breakdown' || core.capacity <= 10 ? 'minimal'
        : physiology.kind === 'discharge' || arousal === 'peak' || core.capacity <= 20 || overload >= OVERLOAD_FRAGMENTED_SPEECH || sensoryAmplification >= 5 ? 'fragmented'
        : arousal === 'edge' || arousal === 'high' || core.capacity <= 35 || overload >= OVERLOAD_NOTICEABLE || sensoryAmplification >= 3 ? 'strained' : 'intact';

    const maxWords = control === 'minimal' ? 3 : control === 'fragmented' ? 7 : control === 'strained' ? 12 : 20;
    const requiresDisruption = (['peak', 'aftershock'].includes(arousal) || sensoryAmplification >= 3) && control !== 'intact';
    const instructions: string[] = [];

    if (control === 'minimal') {
        instructions.push('Тебе почти недоступна речь: хватает сил лишь на несколько слов, звук или молчание, но не на объяснение.');
    } else if (control === 'fragmented') {
        instructions.push('Твоя фраза распадается на короткие фрагменты; дыхание не даёт закончить ровное предложение.');
    } else if (control === 'strained') {
        instructions.push('Ты говоришь коротко и сбито; голос сам проваливается в паузу, обрыв или резкий перепад интонации.');
    } else {
        instructions.push('Ты всё ещё управляешь речью и можешь закончить грамматически цельную мысль.');
    }

    if (affect === 'positive') {
        instructions.push(arousal === 'calm'
            ? 'Ты выдаёшь положительную окраску выбором слов, а не обязательными междометиями.'
            : 'Твоё сбитое дыхание выдаёт положительную окраску; наружу может вырваться короткий вздох или междометие.');
    } else if (affect === 'negative') {
        instructions.push(arousal === 'calm'
            ? 'Ты выражаешь отрицательную реакцию конкретной границей, холодностью или раздражением.'
            : 'Отрицательная реакция прорывается выкриком, резким приказом или оборванным предупреждением.');
    } else if (affect === 'mixed') {
        instructions.push('Ты одновременно чувствуешь приятное и неприятное, и это противоречие слышно в твоих словах.');
    } else if (affect === 'overload') {
        instructions.push('Ощущения путают тебя: слова запаздывают, повторяются или обрываются.');
    }

    if (sensoryAmplification >= 3) {
        instructions.push('Даже малейшая деталь воздействия разрастается и захватывает внимание целиком; ты не способна отреагировать буднично.');
    } else if (sensoryAmplification >= 2) {
        instructions.push('Ты ощущаешь воздействие непропорционально ярко, и это меняет твой выбор слов.');
    }

    if (contextPanic) {
        instructions.push('Паника пробивается сквозь твою обычную манеру речи темпом, дыханием, повторами, резкостью или отчаянной попыткой удержать контроль.');
    }

    if (requiresDisruption) {
        instructions.push('Ты не можешь произнести это как спокойное законченное высказывание: голос естественно срывается на паузу, обрыв или междометие.');
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
    const sensoryAmplification = observation?.reaction.sensoryAmplification ?? 1;
    const lowResource = input.core.capacity < 30;
    const hasGuardedProfile = behavioral.defenses.length > 0 || behavioral.vulnerabilities.length > 0;
    const unresolved = (input.relevantEpisodes || []).some(e => /вопрос|обещ|границ|объясн|намерен/i.test(e));
    const physiology = physiologicalPosition(input.core, observation, input.contexts);

    if (!directlyExperienced) {
        const observedRisk = overload >= OVERLOAD_NOTICEABLE ||
            observation?.behavioralState === 'overload' ||
            observation?.behavioralState === 'panic' ||
            observation?.behavioralState === 'unresponsive';
        if (observedRisk) {
            return {
                primaryIntent: 'Ты видишь тревожное изменение и хочешь назвать его вслух, чтобы повлиять на следующий шаг',
                secondaryConflict: 'Ты видишь только внешнюю реакцию и не знаешь, что другой человек чувствует внутри',
                allowedSpeechActs: ['report', 'warn', 'offer', 'silence'] as SpeechAct[]
            };
        }
        return {
            primaryIntent: 'Ты присутствуешь рядом и решаешь, хочется ли тебе лично вмешаться, помочь или отметить увиденное',
            secondaryConflict: 'Чужие внутренние ощущения тебе недоступны, и малозначимый момент можно оставить без комментария',
            allowedSpeechActs: ['acknowledge', 'report', 'offer', 'support', 'tease', 'probe', 'silence'] as SpeechAct[]
        };
    }
    if (observation?.behavioralState === 'unresponsive') {
        return {
            primaryIntent: 'Ты уже не удерживаешь осмысленный контакт и не можешь сформулировать намеренную реплику',
            secondaryConflict: 'Из тебя может вырваться лишь короткий непроизвольный звук; иначе ты молчишь',
            allowedSpeechActs: ['silence', 'acknowledge'] as SpeechAct[]
        };
    }
    if (physiology.kind === 'discharge') {
        return {
            primaryIntent: 'Оргазм прорывается в твой голос раньше, чем ты успеваешь продолжить прежний спокойный разговор',
            secondaryConflict: 'На пике у тебя почти не остаётся контроля для связной формулировки',
            allowedSpeechActs: ['acknowledge', 'admit'] as SpeechAct[]
        };
    }
    if (physiology.kind === 'breakdown') {
        return {
            primaryIntent: 'Тебе нужно дать понять, что ты больше не удерживаешь контроль и не выдерживаешь происходящее',
            secondaryConflict: 'Истощение и паника ломают связную речь',
            allowedSpeechActs: ['warn', 'request', 'set_boundary'] as SpeechAct[]
        };
    }
    if (physiology.kind === 'overload') {
        return {
            primaryIntent: 'Ты хочешь дать понять, что ощущения достигли предела, хотя не разрешились ни оргазмом, ни нервным срывом',
            secondaryConflict: 'Приятная и защитная реакции одновременно мешают тебе собрать цельную оценку',
            allowedSpeechActs: ['request', 'warn', 'admit', 'silence'] as SpeechAct[]
        };
    }
    const desiredResponse = observation?.reactionSnapshot?.behavior.desiredResponse;
    if (desiredResponse === 'silent_compliance') {
        return {
            primaryIntent: 'Ты почти перестала верить, что словами можно повлиять на происходящее, и бережёшь остатки сил',
            secondaryConflict: 'Ты отстраняешься и хуже слышишь собственное желание; это не доверие, не удовольствие и не осмысленное принятие',
            allowedSpeechActs: ['silence', 'acknowledge', 'warn'] as SpeechAct[]
        };
    }
    if (desiredResponse === 'forced_rationalization') {
        return {
            primaryIntent: 'Ты всё ещё переживаешь воздействие негативно, но уже ищешь в неизбежном переносимую сторону, смысл или пользу',
            secondaryConflict: 'Ты не испытываешь внезапного свободного согласия; протест слабеет потому, что сопротивление кажется бесполезным, а найденные оправдания начинают убеждать тебя саму',
            allowedSpeechActs: ['acknowledge', 'admit', 'bargain', 'warn', 'silence'] as SpeechAct[]
        };
    }
    if (desiredResponse === 'assimilated_acceptance') {
        return {
            primaryIntent: 'Ты уже искренне находишь в неизбежном воздействии приемлемые, полезные или желанные стороны и объясняешь происходящее через них',
            secondaryConflict: 'Дискомфорт и отсутствие свободы никуда не исчезли, но положительная интерпретация теперь ощущается твоей собственной',
            allowedSpeechActs: ['acknowledge', 'admit', 'offer', 'request', 'silence'] as SpeechAct[]
        };
    }
    if (desiredResponse === 'stop' || desiredResponse === 'slow_down') {
        const boundary = observation?.boundaryExpression;
        const formalCharacter = behavioral.attentionFocus?.includes('rules')
            || [...behavioral.values, ...behavioral.defenses].some(value => /протокол|регламент|правил|процедур/i.test(value));
        const canRemainFormal = formalCharacter && boundary
            && !['plea', 'appeasement', 'silent_withdrawal'].includes(boundary.strategy)
            && boundary.force !== 'desperate';
        const strategy = canRemainFormal ? 'formal_objection' : boundary?.strategy;
        const strategyInstruction = canRemainFormal
            ? `${boundary!.instruction} Твоя обычная защита — процедурная точность: сформулируй границу холодно и формально, но не придумывай конкретный регламент.`
            : boundary?.instruction || 'Форма зависит от твоего характера и остатка контроля.';
        const acts: SpeechAct[] = strategy === 'warning' ? ['warn', 'set_boundary', 'request', 'silence']
            : strategy === 'command' || strategy === 'formal_objection' ? ['set_boundary', 'warn', 'request', 'silence']
            : strategy === 'bargain' || strategy === 'appeasement' ? ['bargain', 'request', 'set_boundary', 'silence']
            : strategy === 'concealed' || strategy === 'silent_withdrawal' ? ['silence', 'request', 'set_boundary']
            : ['request', 'set_boundary', 'silence', 'warn'];
        return {
            primaryIntent: desiredResponse === 'stop' ? 'Ты хочешь потребовать прекращения текущего контакта' : 'Ты хочешь, чтобы воздействие ослабили или замедлили',
            secondaryConflict: strategyInstruction,
            allowedSpeechActs: acts
        };
    }
    if (physiology.kind === 'peak' || physiology.kind === 'edge') {
        return {
            primaryIntent: 'Ты чувствуешь непосредственное приближение пика и хочешь повлиять на следующий момент',
            secondaryConflict: 'Контроль над голосом ослаб, и полностью скрыть происходящее с телом уже невозможно',
            allowedSpeechActs: ['request', 'warn', 'admit', 'set_boundary', 'silence'] as SpeechAct[]
        };
    }
    if (sensoryAmplification >= 2) {
        return {
            primaryIntent: sensoryAmplification >= 3
                ? 'Непропорционально мощное ощущение захватывает тебя и требует немедленной реакции'
                : 'Ты не можешь пережить это как обычное воздействие: оно ощущается непропорционально мощно',
            secondaryConflict: pleasure > discomfort
                ? 'Даже приятная окраска не делает исключительную силу ощущения управляемой или будничной для тебя'
                : discomfort > pleasure
                    ? 'Ты защищаешься и одновременно физически не можешь игнорировать стимул'
                    : 'Ощущение захватывает твоё внимание раньше, чем ты успеваешь понять его эмоциональный знак',
            allowedSpeechActs: ['acknowledge', 'request', 'warn', 'set_boundary', 'admit', 'silence'] as SpeechAct[]
        };
    }
    const acceptanceDown = (observation?.changes.attitude ?? 0) < -0.2 || (observation?.changes.openness ?? 0) < -0.2;
    const acceptanceUp = (observation?.changes.attitude ?? 0) > 0.2 || (observation?.changes.openness ?? 0) > 0.2;
    if (pleasure > discomfort * 1.25 && acceptanceDown) {
        return {
            primaryIntent: 'Ты не хочешь, чтобы приятную реакцию твоего тела приняли за согласие, доверие или просьбу повторить действие',
            secondaryConflict: 'Телу приятно, но после контакта ты сильнее закрылась и хуже принимаешь происходящее',
            allowedSpeechActs: ['set_boundary', 'conceal', 'challenge', 'admit', 'silence'] as SpeechAct[]
        };
    }
    if (discomfort > pleasure * 1.25 && acceptanceUp) {
        return {
            primaryIntent: 'Ты замечаешь, что неприятное ощущение не заставило тебя сильнее отвергнуть сам контакт',
            secondaryConflict: 'Тебе телесно неприятно, но одновременно ты чуть меньше отстраняешься от происходящего',
            allowedSpeechActs: ['admit', 'bargain', 'set_boundary', 'acknowledge', 'silence'] as SpeechAct[]
        };
    }
    if (overload >= OVERLOAD_NOTICEABLE || lowResource) {
        return {
            primaryIntent: 'Ты хочешь сохранить безопасность и остаток способности влиять на происходящее',
            secondaryConflict: 'Твоё состояние не даёт строить длинные и продуманные фразы',
            allowedSpeechActs: ['silence', 'set_boundary', 'warn', 'request'] as SpeechAct[]
        };
    }
    if (repetition >= 3 || unresolved) {
        return {
            primaryIntent: pleasure > discomfort
                ? 'Ты замечаешь, как меняется твоя реакция на знакомое воздействие, и не хочешь повторять прежние слова'
                : 'Ты хочешь повлиять на продолжающееся воздействие, но уже сказанные слова кажутся исчерпанными',
            secondaryConflict: pleasure > discomfort && hasGuardedProfile
                ? 'Тебе уязвимо прямо признавать, насколько положительно реагирует тело'
                : 'Тебе не хочется выглядеть беспомощной или предсказуемой',
            allowedSpeechActs: pleasure > discomfort
                ? ['acknowledge', 'admit', 'conceal', 'request', 'silence'] as SpeechAct[]
                : ['set_boundary', 'warn', 'challenge', 'request', 'silence'] as SpeechAct[]
        };
    }
    if (observation?.reaction.mixed) {
        return {
            primaryIntent: 'Ты пытаешься осмыслить или обозначить неоднозначность собственной реакции',
            secondaryConflict: 'Твоё тело не даёт простой оценки «приятно» или «неприятно»',
            allowedSpeechActs: ['acknowledge', 'admit', 'conceal', 'set_boundary', 'silence'] as SpeechAct[]
        };
    }
    if (discomfort > pleasure * 1.25) {
        return {
            primaryIntent: 'Ты хочешь повлиять на характер следующего воздействия',
            secondaryConflict: hasGuardedProfile ? 'Тебе не хочется просить или показывать страх прямо' : 'Ты решаешь, требовать ли остановки',
            allowedSpeechActs: ['set_boundary', 'warn', 'bargain', 'challenge', 'silence'] as SpeechAct[]
        };
    }
    if (pleasure > discomfort * 1.25) {
        return {
            primaryIntent: 'Ты решаешь, стоит ли озвучить замеченное ощущение или изменение',
            secondaryConflict: hasGuardedProfile ? 'Прямое признание ощущается тебе уязвимым' : 'Тебе кажется, что слова могут быть избыточны',
            allowedSpeechActs: ['acknowledge', 'admit', 'conceal', 'request', 'silence'] as SpeechAct[]
        };
    }
    return {
        primaryIntent: 'Ты сохраняешь осмысленный контакт и пытаешься понять следующий шаг собеседника',
        secondaryConflict: 'Ты пока не чувствуешь необходимости давать событию однозначную эмоциональную оценку',
        allowedSpeechActs: ['silence', 'acknowledge', 'probe', 'deflect'] as SpeechAct[]
    };
}

export function boundaryVariationInstruction(
    recentDialogue: string[],
    speakerName: string,
    strategy?: string,
): string {
    const ownBoundaryLines = recentDialogue
        .filter(line => line.startsWith(`${speakerName}:`))
        .map(line => line.slice(line.indexOf('«') + 1, line.lastIndexOf('»') > 0 ? line.lastIndexOf('»') : undefined))
        .filter(line => /хватит|прекрат|останов|не надо|убери|отпусти|медлен|не могу|больше не/iu.test(line));
    const previous = ownBoundaryLines.at(-1) || '';
    if (!previous) return '';
    if (/пожалуйста|прошу/iu.test(previous)) {
        return 'Не опирайся снова на отдельное слово вежливости как на всю реплику. Передай, почему голос изменился именно сейчас, через структуру фразы, не объясняя своё состояние.';
    }
    if (/если|иначе|тогда/iu.test(previous)) {
        return 'Предыдущая граница уже была построена как условие или последствие. Сейчас не повторяй условную конструкцию; сделай смысловым центром непосредственную необходимость изменить контакт.';
    }
    if (/^(?:хватит|прекрати|остановись|убери|отпусти)(?=\s|[.!?,—-]|$)/iu.test(previous.trim())) {
        return strategy === 'warning'
            ? 'Не повторяй прежний голый императив. Теперь смысловым центром должно стать последствие того, что границу снова не услышали.'
            : 'Не повторяй прежний голый императив. Сделай смысловым центром собственный достигнутый предел или прямое обращение к собеседнику.';
    }
    return 'Не повторяй начало и синтаксический рисунок предыдущей границы; сохрани ту же необходимость, но построй фразу вокруг другого смыслового центра.';
}

export function compileReactionFrame(input: CompileFrameInput): ReactionFrame {
    const behavioral = input.behavioralCore || buildBehavioralCore(input.profileText);
    const directlyExperienced = input.speakerId === input.targetId;
    const basePosition = dramaticPosition(input, behavioral);
    const lastOwnLine = [...(input.recentDialogue || [])].reverse().find(line => line.includes(`${input.speakerName}:`)) || '';
    const previousWasQuestion = lastOwnLine.includes('?');
    const recentSpeechActs = new Set([...(input.recentSpeechActs || []), input.recentSpeechAct].filter(Boolean));
    // Observers may see another character's reaction, but must not inherit its
    // pleasure, distress or loss of speech control as their own expression.
    const ownObservation = directlyExperienced ? input.observation : undefined;
    const physiology = physiologicalPosition(input.core, ownObservation, input.contexts);
    const allowedSpeechActs = behavioral.speechDisposition === 'quiet' && !physiology.mandatory
        ? ['silence', ...basePosition.allowedSpeechActs.filter(act => act !== 'silence')] as SpeechAct[]
        : basePosition.allowedSpeechActs;
    const preferredSpeechAct = allowedSpeechActs.find(act =>
        act !== 'silence' && !recentSpeechActs.has(act) && (!previousWasQuestion || act !== 'probe')
    ) || allowedSpeechActs[0];
    const variation = input.observation?.boundaryExpression
        ? boundaryVariationInstruction(input.recentDialogue || [], input.speakerName, input.observation.boundaryExpression.strategy)
        : '';
    const position = {
        ...basePosition,
        secondaryConflict: [basePosition.secondaryConflict, variation].filter(Boolean).join(' '),
        allowedSpeechActs,
        preferredSpeechAct,
    };
    const expressionMode = compileExpressionMode(input.core, ownObservation, physiology, input.contexts);
    const addresseeId = input.initiatorId || input.targetId;
    const addresseeName = input.initiatorName || input.targetName;
    return {
        speaker: { id: input.speakerId, name: input.speakerName, gender: input.speakerGender, role: directlyExperienced ? 'цель воздействия' : 'участник сцены', core: behavioral },
        addressee: addresseeId === input.speakerId ? undefined : { id: addresseeId, name: addresseeName, relationship: relationText(input.relation) },
        scene: { title: input.sceneTitle, presentCharacters: unique(input.presentCharacters, 8), contexts: unique(input.contexts, 8), roleContext: unique(input.roleContext || [], 10) },
        event: {
            action: input.actionLabel || input.observation?.action.label || 'событие без ясного действия',
            target: input.pointLabel || input.observation?.action.pointLabel || input.observation?.action.pointId || 'не указана',
            experience: experienceText(input.observation, directlyExperienced),
            changes: directlyExperienced ? changeLines(input.observation) : [],
            physiologicalState: physiology.state,
            physiologicalEvent: physiology.kind,
            mandatoryPhysiologicalFocus: directlyExperienced && physiology.mandatory,
            requiresSpeech: directlyExperienced && physiology.requiresSpeech && input.observation?.behavioralState !== 'unresponsive',
            repetition: input.repetition ?? 1,
            directlyExperienced,
            affectedCharacter: input.targetName,
        },
        continuity: {
            recentDialogue: unique(input.recentDialogue || [], 4),
            relevantEpisodes: unique(input.relevantEpisodes || [], 3),
            canonicalFacts: unique(input.canonicalFacts || [], 5),
            relationshipBeliefs: unique(input.relationshipBeliefs || [], 4),
            openThreads: unique(input.openThreads || [], 3)
        },
        dramaticPosition: position,
        expressionMode
    };
}

export function applyVerbalInputToFrame(frame: ReactionFrame, playerSpeech: string): ReactionFrame {
    const text = playerSpeech.trim();
    if (!text) return frame;
    const isQuestion = /\?\s*$/.test(text);
    const isAcuteEvent = ['discharge', 'breakdown', 'overload'].includes(frame.event.physiologicalEvent);
    const isUnresponsive = frame.expressionMode.control === 'minimal'
        && frame.dramaticPosition.allowedSpeechActs.includes('silence');
    const questionInstruction = isQuestion
        ? /почему|что\s+(?:мешает|останавливает|застав)/iu.test(text)
            ? 'Ответь на причинный вопрос: назови конкретную причину и поясни, как она влияет на твоё решение. Одного повторения отказа или согласия недостаточно.'
            : /сравни|разниц|чем\s+отлич/iu.test(text)
                ? 'Сравни оба упомянутых переживания: назови хотя бы одно различие в ощущении или отношении к нему.'
                : /что\s+(?:именно\s+)?(?:ты\s+)?почувств|приятн|неприятн/iu.test(text)
                    ? 'Ответь о непосредственном переживании: назови конкретное ощущение и собственную оценку, не подменяй ответ общей границей.'
                    : 'Ответь на смысл вопроса законченным высказыванием. Краткость допустима, но один обрывок или одно абстрактное слово не передают ответа.'
        : '';
    const conversationalExpression = isAcuteEvent
        ? frame.expressionMode
        : {
            ...frame.expressionMode,
            maxWords: Math.max(frame.expressionMode.maxWords, isQuestion ? 32 : 20),
            requiresDisruption: false,
            instructions: unique([
                ...frame.expressionMode.instructions,
                'Твоё физиологическое состояние окрашивает форму речи, но не подменяет смысл ответа.',
                'Не добавляй паузы, обрывы и многоточия автоматически: сначала закончи необходимый смысловой ход.',
                questionInstruction,
            ], 8)
        };
    return {
        ...frame,
        event: {
            ...frame.event,
            action: 'реплика адресата',
            target: 'разговор',
            experience: 'Ты слышишь содержание и тон реплики; нового физического воздействия в этот момент нет.',
            changes: [],
            mandatoryPhysiologicalFocus: isAcuteEvent,
            // Reaching this frame means the orchestrator has already selected
            // a reactive turn for the addressed character. Silence remains an
            // orchestrator outcome, not an empty completion from the speech
            // generator. An unresponsive character is the sole exception.
            requiresSpeech: !isUnresponsive,
            playerSpeech: text,
            sharedPastUnsupported: false
        },
        dramaticPosition: {
            primaryIntent: isQuestion
                ? 'Ты хочешь ответить на смысл заданного вопроса собственными словами, а не спрятаться за технической формулой'
                : 'Ты решаешь, как отозваться на обращённые к тебе слова',
            secondaryConflict: '',
            preferredSpeechAct: isQuestion ? 'answer' : 'acknowledge',
            allowedSpeechActs: isQuestion ? ['answer', 'set_boundary', 'deflect'] : []
        },
        continuity: {
            ...frame.continuity,
            // The new player line is itself a reply to the character's latest
            // question. Keeping that question marked as unanswered makes the
            // model ask it again instead of reacting to the answer.
            openThreads: frame.continuity.openThreads.filter(thread => !thread.startsWith('Без явного ответа осталось:'))
        },
        expressionMode: conversationalExpression
    };
}

export function buildReactionSystemPrompt(frame: ReactionFrame): string {
    const core = frame.speaker.core;
    const genderText = frame.speaker.gender === 'female' ? 'женский' : frame.speaker.gender === 'male' ? 'мужской' : 'не указан';
    // This prompt produces the audible speech channel only. Physical
    // mannerisms belong to the visual reaction layer; listing them here makes
    // models imitate them as stage directions in otherwise spoken replies.
    const behavioralLines = [
        ...core.values,
        ...(core.needs || []),
        ...core.vulnerabilities,
        ...core.defenses,
    ];
    const grammaticalIdentity = frame.speaker.gender === 'female'
        ? `Ты женщина. Говоря о себе в прошедшем времени, используй только женские формы: «сказала», «поняла», «почувствовала», «сделала». Никогда не используй о себе мужские формы.`
        : frame.speaker.gender === 'male'
            ? `Ты мужчина. Говоря о себе в прошедшем времени, используй мужские формы: «сказал», «понял», «почувствовал», «сделал».`
            : `Твой грамматический род не задан; избегай родовых форм, если они не нужны.`;
    const emotionalVoiceKey = hasContext(frame.scene.contexts, /(?:effect[_\s-]*panic|паническ|паник)/i)
        ? 'afraid'
        : frame.expressionMode.control === 'minimal' || frame.expressionMode.control === 'fragmented'
            ? (frame.expressionMode.arousal === 'calm' ? 'exhausted' : 'overloaded')
            : frame.expressionMode.affect === 'overload' || frame.expressionMode.affect === 'mixed'
                ? 'overloaded'
                : frame.expressionMode.affect === 'positive' && frame.expressionMode.arousal !== 'calm'
                    ? 'aroused'
                    : frame.expressionMode.affect === 'negative'
                        ? 'angry'
                        : frame.expressionMode.affect === 'positive' ? 'open' : 'guarded';
    const currentEmotionalVoice = core.emotionalVoice?.[emotionalVoiceKey];
    const owned = (value: string, lead = 'Ты узнаёшь себя в этих словах') => /^(?:ты|тебе|тебя|твой|твоя|твоё|твои)\b/iu.test(value.trim())
        ? value.trim()
        : `${lead}: «${value.trim().replace(/[.!?]+$/u, '')}».`;
    return [
        `Ты — ${frame.speaker.name}. Грамматический род: ${genderText}. ${grammaticalIdentity}`,
        frame.scene.roleContext.length ? `[Твоё положение и понимание происходящего]\n${frame.scene.roleContext.map(value => `- ${value}`).join('\n')}` : '',
        `[Твой характер]\n${behavioralLines.length ? behavioralLines.map(v => `- ${owned(v)}`).join('\n') : '- Ты реагируешь как самостоятельный живой человек.'}${core.centralConflict ? `\n- Тебя ведёт желание: ${core.centralConflict.desire}.\n- Тебя пугает: ${core.centralConflict.fear}.` : ''}`,
        `[Твоя манера речи]\n${core.voice.length ? core.voice.map(v => `- ${owned(v, 'Ты слышишь свою привычную манеру в этих словах')}`).join('\n') : '- Ты говоришь естественно и по-человечески.'}${currentEmotionalVoice ? `\n- Именно сейчас твой голос звучит так: ${currentEmotionalVoice}` : ''}`,
        frame.event.requiresSpeech
            ? `Говори только своими словами. Твоя речевая реакция на текущий момент уже выбрана: произнеси хотя бы одно слово или естественный слышимый звук. Ты можешь уклониться, отказаться отвечать, сменить тему, ответить несовершенно или противоречиво, но не возвращай пустой ответ.`
            : `Говори только своими словами. Ты решаешь, что действительно произнесёшь сейчас; можешь промолчать, сменить тему, ответить несовершенно или противоречиво.`,
        `[Форма ответа]\nВерни одну произнесённую реплику одним абзацем обычного текста. Без JSON, служебных полей, имени говорящего, ремарок и звёздочек. Не предваряй и не завершай реплику словами «сказала», «говорю», «отвечаю» или описанием голоса. Воплоти свою манеру речи в самих словах, но не объясняй её. Неверно: «Голос срывается на шёпот: — Я согласна». Верно: «Я... согласна». Ты переживаешь состояние изнутри, а не объясняешь себя как автор отчёта. Профессиональная лексика появляется только там, где она естественна для твоей живой речи.`
    ].filter(Boolean).join('\n\n');
}

export function buildReactionTurnMessage(frame: ReactionFrame, playerSpeech?: string | null): string {
    const currentSpeech = playerSpeech?.trim() || frame.event.playerSpeech;
    // During a direct bodily event the previous spoken exchange is not an
    // input awaiting an answer. Keeping it verbatim made occasional action
    // reactions answer the preceding clothing dispute instead of the touch.
    const isConcreteBodilyEvent = !currentSpeech
        && frame.event.directlyExperienced
        && frame.event.action !== 'событие без ясного действия'
        && frame.event.action !== 'реплика адресата';
    const visibleRecentDialogue = isConcreteBodilyEvent
        ? []
        : frame.continuity.recentDialogue;
    const currentTurnPriority = currentSpeech
        ? `К тебе только что обращены новые слова. Ответь именно на них. Предыдущий разговор остаётся твоей памятью о контексте: не продолжай прежнюю тему, если новые слова её не продолжают.`
        : frame.event.directlyExperienced
            ? `Ты прямо сейчас переживаешь телесное воздействие «${frame.event.action}» в области «${frame.event.target}». Отзовись именно на непосредственное ощущение; прежний разговор лишь остаётся в памяти, и сейчас тебе не нужно отвечать на старый вопрос, обещание или спор.`
            : `Ты прямо сейчас видишь событие, описанное выше. Прежний разговор лишь остаётся в памяти и не звучит как новое обращение к тебе.`;
    const eventPerspective = frame.event.directlyExperienced
        ? `[То, что ты переживаешь сейчас]\nТы прямо сейчас переживаешь воздействие «${frame.event.action}» в области «${frame.event.target}». ${frame.event.experience}`
        : `[То, что ты видишь сейчас]\nТы видишь, что воздействие «${frame.event.action}» направлено на ${frame.event.affectedCharacter}, в область «${frame.event.target}». ${frame.event.experience}\nТы видишь только внешние признаки и не чувствуешь чужое воздействие своим телом.`;
    const changePerspective = frame.event.changes.length
        ? frame.event.directlyExperienced
            ? `Ты замечаешь в себе: ${frame.event.changes.join('; ')}.`
            : `Ты видишь изменения у ${frame.event.affectedCharacter}, но не чувствуешь их своим телом: ${frame.event.changes.join('; ')}.`
        : '';
    return [
        `[То, что окружает тебя]\nТы находишься здесь: ${frame.scene.title || 'место тебе не вполне ясно'}. Рядом ты видишь: ${frame.scene.presentCharacters.join(', ') || 'никого'}.`,
        frame.scene.contexts.length ? `[То, что ты ощущаешь или видишь в сцене]\n${frame.scene.contexts.map(value => `- ${value}`).join('\n')}` : '',
        frame.scene.roleContext.length ? `[Что ты знаешь о своём положении]\n${frame.scene.roleContext.join('\n')}` : '',
        frame.addressee ? `[Твой собеседник]\nПеред тобой ${frame.addressee.name}. ${frame.addressee.relationship}` : '',
        currentSpeech ? `[Слова, обращённые к тебе]\n${frame.addressee?.name || 'Собеседник'} говорит тебе: «${currentSpeech}»` : '',
        eventPerspective,
        `[Приоритет текущего хода]\n${currentTurnPriority}`,
        frame.event.physiologicalState ? `[То, что происходит с твоим телом]\n${frame.event.physiologicalState}` : '',
        `[Как твоё состояние прорывается в голос]\n${frame.expressionMode.instructions.join(' ')} Тебе доступно не больше ${frame.expressionMode.maxWords} слов; это предел контроля, а не обязанность заполнять его полностью.`,
        frame.dramaticPosition.primaryIntent
            ? `[Твой непосредственный внутренний импульс]\n${frame.dramaticPosition.primaryIntent}.${frame.dramaticPosition.secondaryConflict ? ` Одновременно: ${frame.dramaticPosition.secondaryConflict}.` : ''}`
            : '',
        changePerspective,
        frame.continuity.canonicalFacts.length ? `[Факты о себе]\n${frame.continuity.canonicalFacts.map(v => `- ${v}`).join('\n')}` : '',
        frame.continuity.relationshipBeliefs.length ? `[Память об отношениях]\n${frame.continuity.relationshipBeliefs.map(v => `- ${v}`).join('\n')}` : '',
        frame.continuity.openThreads.length ? `[Незавершённое]\n${frame.continuity.openThreads.map(v => `- ${v}`).join('\n')}` : '',
        visibleRecentDialogue.length || frame.continuity.relevantEpisodes.length
            ? `[Границы твоей памяти]\nТы помнишь недавние реплики только как произнесённые слова. Из них ты не узнаёшь новых фактов своей биографии или мира. Не считай случившимися прошлые события, действия третьих лиц или существование организаций, если об этом нет среди твоих собственных воспоминаний и знаний.`
            : '',
        visibleRecentDialogue.length ? `[Недавний разговор]\n${visibleRecentDialogue.join('\n')}` : '',
        frame.continuity.relevantEpisodes.length ? `[Недавний опыт]\n${frame.continuity.relevantEpisodes.map(v => `- ${v}`).join('\n')}` : '',
        `Что ты действительно произносишь сейчас? ${frame.event.requiresSpeech ? 'Пустой ответ здесь не означает твоё молчание: речевая реакция уже выбрана, поэтому дай ей слышимое содержание. ' : ''}Запиши только собственные слышимые слова. Не выдавай цитату собеседника за свои слова и не повторяй дословно собственную недавнюю реплику. Твои движения уже отображаются игрой и в ответе не описываются.`
    ].filter(Boolean).join('\n\n');
}
