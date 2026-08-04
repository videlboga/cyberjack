import { CompiledAction, InteractionObservation, ObservationContext, SubjectCoreState, TickOutput } from '../domain/types';
import { activeContextsRepo, presetRepo } from '../infrastructure/repositories';
import { getActiveContextLabel } from '../domain/contextPresentation';

const behaviorPriority: Array<[InteractionObservation['behavioralState'], string[]]> = [
    ['unresponsive', ['effect_apathy', 'effect_chronic_apathy']],
    ['panic', ['effect_panic']],
    ['defiance', ['effect_active_defiance']],
    ['freeze', ['effect_freeze']],
    ['overload', ['effect_sensory_overload']],
    ['subspace', ['effect_subspace']],
];

export function resolveBehavioralState(contextIds: Iterable<string>): InteractionObservation['behavioralState'] {
    const ids = contextIds instanceof Set ? contextIds : new Set(contextIds);
    return behaviorPriority.find(([, candidates]) => candidates.some(id => ids.has(id)))?.[0] || 'responsive';
}

const currentStates: Record<InteractionObservation['behavioralState'], { title: string; description: string }> = {
    responsive: { title: 'В контакте', description: 'Осмысленно реагирует на окружение и воздействие.' },
    subspace: { title: 'Сабспейс', description: 'Внимание погружено в ощущения; реакции замедлены и менее самостоятельны.' },
    overload: { title: 'Сенсорная перегрузка', description: 'С трудом разделяет ощущения и отвечает с задержкой.' },
    freeze: { title: 'Оцепенение', description: 'Замирает и не может свободно выразить реакцию движением.' },
    panic: { title: 'Паника', description: 'Стремится прекратить воздействие и восстановить дистанцию.' },
    defiance: { title: 'Активное сопротивление', description: 'Осмысленно отвергает воздействие и пытается сорвать контакт.' },
    unresponsive: { title: 'Отключена', description: 'Почти не отвечает на внешние стимулы; осмысленный контакт потерян.' },
};

function roleFor(id: string, type?: string): ObservationContext['role'] {
    if (behaviorPriority.some(([, ids]) => ids.includes(id))) return 'behavior';
    if (id.includes('hyperesthesia') || id.includes('numbness') || id === 'effect_suggestibility' || id === 'effect_refractory') return 'physiology';
    if (type === 'equipment') return 'equipment';
    if (type === 'restraint') return 'restraint';
    if (type === 'pose') return 'pose';
    if (type === 'environment') return 'environment';
    return 'other';
}

function signed(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function sensoryExperienceText(
    action: CompiledAction,
    experiencedIntensity: number,
    overload: number,
    pointLabel?: string
): string {
    if (action.actionKey === 'verbal_pressure' || action.tags?.includes('mental')) {
        return 'Ты слышишь содержание и тон сказанного; нового физического воздействия в этот момент нет.';
    }
    const authored = action.sensory;
    const details = [
        authored?.stimulus || action.description,
        authored?.texture,
        authored?.rhythm,
        authored?.bodilyResponse,
        authored?.aftereffect,
    ].filter(Boolean);
    const intensity = experiencedIntensity >= 12
        ? 'Ощущение подавляет остальные сигналы тела и почти не оставляет места для связной мысли.'
        : experiencedIntensity >= 7
            ? 'Ощущение яркое, настойчивое и всё время возвращает внимание к месту контакта.'
            : experiencedIntensity >= 3
                ? 'Ощущение отчётливое, но его детали ещё можно разделять.'
                : 'Ощущение слабое и локальное.';
    const texture = action.sharpness >= 0.7
        ? 'Контакт воспринимается резко, с отчётливой границей каждого импульса.'
        : action.sharpness <= -0.15
            ? 'Контакт мягкий, растянутый и без резкой границы.'
            : action.contact >= 0.75
                ? 'Контакт плотный и непрерывно ощущается телом.'
                : '';
    const overloadText = overload >= 8
        ? 'Отдельные нюансы начинают сливаться в общий сенсорный напор.'
        : '';
    const zone = pointLabel ? `Ты яснее всего чувствуешь это в области «${pointLabel.toLowerCase()}».` : '';
    const feltDetails = details.map(detail => /^ты\b/iu.test(String(detail)) ? String(detail) : `Ты ощущаешь: ${detail}`);
    return [zone, ...feltDetails, intensity, texture, overloadText].filter(Boolean).join(' ');
}

export function buildInteractionObservation(input: {
    subjectId: string;
    pointId: string;
    pointLabel?: string;
    action: CompiledAction;
    previousCore: SubjectCoreState;
    output: TickOutput;
    previousContextIds?: string[];
    notableEvent?: 'positive_discharge' | 'peak_overload' | 'breakdown' | 'exhaustion';
}): InteractionObservation {
    const { subjectId, pointId, pointLabel, action, previousCore, output } = input;
    const result = output.result;
    const active = activeContextsRepo.getAllForSubject(subjectId);
    const contexts: ObservationContext[] = active.map(ctx => {
        const preset = presetRepo.getActionPreset(ctx.actionId);
        return {
            id: ctx.actionId,
            label: getActiveContextLabel(preset, ctx.actionId),
            role: roleFor(ctx.actionId, preset?.contextConfig?.type),
            pointId: ctx.pointId,
        };
    });
    const ids = new Set(contexts.map(context => context.id));
    const behavioralState = resolveBehavioralState(ids);
    const previousBehavior = resolveBehavioralState(input.previousContextIds || []);
    const regainingReflexes = behavioralState === 'unresponsive' && output.nextCore.capacity > 10;
    const restrained = contexts.some(context => context.role === 'restraint');
    const contact = action.contact <= 0.05 ? 'none' : restrained && ['panic', 'defiance'].includes(behavioralState) ? 'forced' : action.contact < 0.55 ? 'partial' : 'full';
    const pleasure = Number(result.pleasure || 0);
    const discomfort = Number(result.discomfort || 0);
    const overload = Number(result.overload || 0);
    const engagement = Number(result.engagement || 0);
    const experiencedIntensity = Number(result.experiencedIntensity || 0);
    const sensoryAmplification = Number(result.sensoryAmplification || 1);
    const exceptionalSensoryLoad = Number(result.exceptionalSensoryLoad || 0);
    const mixed = pleasure > 0.5 && discomfort > 0.5;
    const sensoryExperience = sensoryExperienceText(action, experiencedIntensity, overload, pointLabel);

    const stateText: Record<InteractionObservation['behavioralState'], string> = {
        responsive: 'Актив остаётся в контакте и реагирует на воздействие.',
        subspace: 'Реакции замедляются; актив погружается в изменённое, податливое состояние.',
        overload: 'Актив вздрагивает и с трудом перерабатывает поток ощущений.',
        freeze: 'Актив замирает; отсутствие движения не выглядит согласием или расслаблением.',
        panic: restrained ? 'Актив пытается отстраниться, но фиксация сохраняет контакт.' : 'Актив резко отстраняется и пытается разорвать контакт.',
        defiance: restrained ? 'Актив сопротивляется; фиксация позволяет продолжить контакт, не устраняя негативную реакцию.' : 'Актив активно сопротивляется прикосновению и старается прекратить контакт.',
        unresponsive: regainingReflexes
            ? 'Дыхание становится ровнее; появляются отдельные рефлекторные движения, но осмысленного контакта ещё нет.'
            : 'Актив обмякает и почти перестаёт реагировать на внешнее воздействие.',
    };
    if (action.actionKey === 'wait') {
        stateText.responsive = 'Во время паузы актив остаётся доступен наблюдению; текущее состояние постепенно меняется без нового контакта.';
    }
    const sensation = mixed
        ? 'Одновременно заметны приятный отклик и дискомфорт.'
        : discomfort > Math.max(pleasure * 1.25, 2) ? 'Преобладает дискомфорт.'
        : pleasure > Math.max(discomfort * 1.25, 2) ? 'Преобладает положительный телесный отклик.'
        : overload > 5 ? 'Главный наблюдаемый эффект — нарастающая перегрузка.'
        : 'Реакция сдержанная, без явного преобладания удовольствия или дискомфорта.';
    const amplificationText = sensoryAmplification >= 3
        ? `Даже слабейшие детали воздействия разрастаются до исключительной силы и захватывают твоё внимание целиком.`
        : sensoryAmplification >= 2
            ? `Обычное воздействие ощущается тебе непропорционально мощным и не оставляет места для будничной реакции.`
            : sensoryAmplification >= 1.5
                ? `Ты переживаешь воздействие заметно ярче и сильнее обычного.`
                : sensoryAmplification >= 1.15
                    ? `Ты ощущаешь воздействие ярче обычного.`
                    : '';
    const learningEffect = Number(result.learningEffect || 0);
    const familiarityDelta = (output.nextPoint.familiarity || 0) - (output.tickMeta.inputs.point.familiarity || 0);
    const sensitivityDelta = output.nextPoint.localSensitivity - output.tickMeta.inputs.point.localSensitivity;
    const baselineSensitivityDelta = (output.nextPoint.baselineLocalSensitivity || 0) - (output.tickMeta.inputs.point.baselineLocalSensitivity || 0);
    const learningText = baselineSensitivityDelta > 0.01
        ? 'Изменение начинает закрепляться в baseline.'
        : familiarityDelta > 0.01 ? 'Воздействие становится привычнее; повтор будет менее новым.'
        : sensitivityDelta > 0.05 ? 'Текущая локальная чувствительность выросла, но ещё не закрепилась.'
        : sensitivityDelta < -0.05 ? 'Текущая локальная чувствительность снизилась.' : '';
    const subjectiveState: Record<InteractionObservation['behavioralState'], string> = {
        responsive: 'Ты сохраняешь осмысленный контакт и различаешь воздействие.', subspace: 'Твои мысли расплываются, а реакции становятся медленнее.',
        overload: 'Ощущений слишком много, и тебе трудно разделить их.', freeze: 'Ты замираешь и не можешь свободно ответить движением.',
        panic: restrained ? 'Ты пытаешься отстраниться, но фиксация не даёт разорвать контакт.' : 'Ты пытаешься отстраниться и прекратить контакт.',
        defiance: restrained ? 'Ты сопротивляешься, хотя фиксация удерживает тебя в контакте.' : 'Ты сопротивляешься и стараешься не позволить продолжить.',
        unresponsive: regainingReflexes
            ? 'Ощущения начинают возвращаться отдельными фрагментами, но ответить или удержать контакт ещё не получается.'
            : 'Сил почти не осталось; внешнее воздействие доходит до тебя как будто издалека.',
    };

    const tensionDelta = output.nextCore.tension - previousCore.tension;
    const attitudeDelta = output.nextCore.attitude - previousCore.attitude;
    const opennessDelta = output.nextCore.openness - previousCore.openness;
    const localAttitudeDelta = output.nextPoint.localAttitude - output.tickMeta.inputs.point.localAttitude;
    const localOpennessDelta = (output.nextPoint.localOpenness || 0) - (output.tickMeta.inputs.point.localOpenness || 0);
    const acceptingLess = attitudeDelta < -0.2 || opennessDelta < -0.2;
    const acceptingMore = attitudeDelta > 0.2 || opennessDelta > 0.2;
    const forcedArousal = previousBehavior === 'unresponsive' && behavioralState !== 'unresponsive' &&
        output.nextCore.capacity <= 10 && output.nextCore.tension >= 30;
    const restText = action.actionKey === 'wait' && tensionDelta < -1
        ? `Без нового воздействия накопленное напряжение снижается (${signed(tensionDelta)}).`
        : '';
    const acceptanceText = pleasure > discomfort && acceptingLess
        ? 'Положительный телесный отклик не превращается в принятие: актив после контакта сильнее закрывается или хуже принимает происходящее.'
        : discomfort > pleasure && acceptingMore
            ? 'Несмотря на неприятное ощущение, общее принятие контакта растёт.'
            : acceptingLess ? 'Общее принятие контакта снижается.'
            : acceptingMore ? 'Общее принятие контакта растёт.' : '';
    const subjectiveAcceptance = pleasure > discomfort && acceptingLess
        ? 'Твоему телу приятно, но это не означает согласия или доверия: после контакта ты сильнее закрываешься.'
        : discomfort > pleasure && acceptingMore
            ? 'Ощущение неприятное, хотя сам контакт ты отвергаешь чуть меньше.'
            : acceptingLess ? 'После этого ты хуже принимаешь происходящее и сильнее закрываешься.'
            : acceptingMore ? 'После этого тебе легче принимать происходящее.' : '';
    const arousalText = forcedArousal ? 'Резкий стимул возвращает осмысленную реакцию, но ресурс не восстановлен: контакт удерживается нервной активацией.' : '';
    const verbal = action.actionKey === 'verbal_pressure' || action.tags?.includes('mental');
    const valenceExperience = verbal
        ? (mixed ? 'Смысл сказанного вызывает противоречивое отношение.'
            : discomfort > pleasure ? 'Сказанное воспринимается неприятно.'
            : pleasure > discomfort ? 'Сказанное воспринимается положительно.'
            : 'Сказанное не вызывает ясной эмоциональной оценки.')
        : (mixed ? 'В ощущении одновременно есть приятная и неприятная составляющие.'
            : discomfort > pleasure ? 'Неприятная составляющая сильнее.'
            : pleasure > discomfort ? 'Приятная телесная составляющая сильнее.'
            : 'Ты не различаешь явной эмоциональной окраски.');
    const uiText = [stateText[behavioralState], arousalText, restText, amplificationText, sensation, acceptanceText, learningText].filter(Boolean).join(' ');
    const subjectiveText = `${subjectiveState[behavioralState]} ${sensoryExperience} ${forcedArousal ? 'Сил по-прежнему нет, но резкая активация не даёт тебе снова провалиться.' : ''} ${verbal ? '' : amplificationText} ${valenceExperience} ${subjectiveAcceptance}`.trim();
    const technicalText = `Контакт: ${contact}. Состояние: ${behavioralState}. P ${pleasure.toFixed(1)}, D ${discomfort.toFixed(1)}, O ${overload.toFixed(1)}, E ${engagement.toFixed(1)}; интенсивность ${experiencedIntensity.toFixed(1)}, сенсорное усиление ${sensoryAmplification.toFixed(2)}×, сверхнагрузка ${exceptionalSensoryLoad.toFixed(1)}; tension ${signed(output.nextCore.tension - previousCore.tension)}, capacity ${signed(output.nextCore.capacity - previousCore.capacity)}, sensitivity ${signed(sensitivityDelta)}, baseline ${signed(baselineSensitivityDelta)}.`;

    const transitions: InteractionObservation['transitions'] = [];
    if (input.notableEvent === 'positive_discharge') transitions.push({ kind: 'discharge', title: 'Оргазм', text: 'Накопленное напряжение достигает пика и разрешается оргазмом.', severity: 'major' });
    if (input.notableEvent === 'peak_overload') transitions.push({ kind: 'overload', title: 'Смешанная перегрузка', text: 'Активация достигает предела, но остаётся смешанной: оргазма или нервного срыва не происходит.', severity: 'major' });
    if (input.notableEvent === 'breakdown') transitions.push({ kind: 'breakdown', title: 'Нервный срыв', text: 'Устойчиво негативная активация срывает контроль, но не означает автоматической потери сознания.', severity: 'danger' });
    if (input.notableEvent === 'exhaustion') transitions.push({ kind: 'breakdown', title: 'Истощение ресурса', text: 'Ресурс исчерпан до достижения оргазма; актив остаётся опустошённым и слабо реагирует.', severity: 'danger' });
    if (action.actionKey === 'wait' && tensionDelta <= -8 && !input.notableEvent) {
        transitions.push({ kind: 'recovery', title: 'Напряжение снижается', text: `Пауза позволяет активу расслабиться: напряжение ${signed(tensionDelta)} без оргазма.`, severity: 'major' });
    }
    if (action.actionKey === 'wait' && previousBehavior === 'unresponsive' && behavioralState === 'unresponsive' && previousCore.capacity <= 10 && output.nextCore.capacity > 10) {
        transitions.push({ kind: 'recovery', title: 'Первые реакции', text: 'Дыхание выравнивается и возвращаются отдельные рефлексы, но осмысленный контакт ещё не восстановлен.', severity: 'major' });
    }
    if (previousBehavior !== behavioralState) {
        if (behavioralState === 'unresponsive') {
            const exhaustedAgain = output.nextCore.capacity <= 10 && output.nextCore.tension <= 15;
            transitions.push({ kind: 'state', title: exhaustedAgain ? 'Повторная отключка' : 'Потеря контакта', text: exhaustedAgain ? 'Нервная активация падает; без восстановившегося ресурса актив снова отключается.' : 'Актив обмякает и перестаёт осмысленно отвечать на происходящее.', severity: 'danger' });
        }
        else if (previousBehavior === 'unresponsive') transitions.push({ kind: 'recovery', title: forcedArousal ? 'Принудительное пробуждение' : 'Возвращение реакции', text: forcedArousal ? 'Резкое воздействие возвращает контакт без восстановления ресурса. Сознание удерживается только накопленной нервной активацией.' : `Осмысленная реакция возвращается. Текущее состояние: ${currentStates[behavioralState].title.toLowerCase()}.`, severity: 'major' });
        else transitions.push({ kind: 'state', title: currentStates[behavioralState].title, text: currentStates[behavioralState].description, severity: behavioralState === 'panic' ? 'danger' : 'major' });
    }

    const currentState = { ...currentStates[behavioralState] };
    if (regainingReflexes) {
        currentState.description = 'Появляются отдельные рефлекторные реакции, но осмысленный контакт ещё не восстановлен.';
    }
    if (forcedArousal) {
        currentState.description += ' Контакт удерживается нервной активацией при практически исчерпанном ресурсе.';
    }
    if (ids.has('effect_refractory')) {
        currentState.description += ' После оргазма общая реактивность временно снижена.';
    }

    return {
        action: {
            id: action.actionKey,
            label: action.label,
            pointId,
            pointLabel,
            description: action.description,
            sensory: action.sensory,
        }, contact, behavioralState,
        reaction: { pleasure, discomfort, overload, engagement, mixed, appraisal: output.result.finalValence, experiencedIntensity, sensoryAmplification, exceptionalSensoryLoad },
        learning: { effect: learningEffect, familiarityDelta, sensitivityDelta, baselineSensitivityDelta },
        changes: {
            tension: output.nextCore.tension - previousCore.tension,
            capacity: output.nextCore.capacity - previousCore.capacity,
            sensitivity: output.nextCore.sensitivity - previousCore.sensitivity,
            attitude: attitudeDelta,
            openness: opennessDelta,
            plasticity: output.nextCore.plasticity - previousCore.plasticity,
            localAttitude: localAttitudeDelta,
            localOpenness: localOpennessDelta,
        },
        contexts, currentState, transitions, uiText, subjectiveText, technicalText,
    };
}

export function buildCurrentStateObservationText(subjectId: string, core: SubjectCoreState): string {
    const contexts = activeContextsRepo.getAllForSubject(subjectId);
    const ids = new Set(contexts.map(context => context.actionId));
    const state = resolveBehavioralState(ids);
    const stateDescriptions: Record<InteractionObservation['behavioralState'], string> = {
        responsive: 'Актив сохраняет осмысленный контакт с окружением.', subspace: 'Реакции замедлены, внимание погружено в ощущения.',
        overload: 'Актив перегружен ощущениями и реагирует с задержкой.', freeze: 'Актив неподвижен и скован.', panic: 'Актив находится в панике и стремится прекратить воздействие.',
        defiance: 'Актив собран и активно отвергает воздействие.', unresponsive: 'Актив истощён и почти не отвечает на внешние стимулы.',
    };
    const tension = core.tension >= 80 ? 'Напряжение близко к оргазму.' : core.tension >= 45 ? 'Напряжение заметно накоплено.' : 'Напряжение остаётся управляемым.';
    return `${stateDescriptions[state]} ${tension}`;
}
