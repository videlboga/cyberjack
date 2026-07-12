import { CompiledAction, InteractionObservation, ObservationContext, SubjectCoreState, TickOutput } from '../domain/types';
import { activeContextsRepo, presetRepo } from '../infrastructure/repositories';

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
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}

export function buildInteractionObservation(input: {
    subjectId: string;
    pointId: string;
    pointLabel?: string;
    action: CompiledAction;
    previousCore: SubjectCoreState;
    output: TickOutput;
    previousContextIds?: string[];
    notableEvent?: 'positive_discharge' | 'breakdown' | 'exhaustion';
}): InteractionObservation {
    const { subjectId, pointId, pointLabel, action, previousCore, output } = input;
    const result = output.result;
    const active = activeContextsRepo.getAllForSubject(subjectId);
    const contexts: ObservationContext[] = active.map(ctx => {
        const preset = presetRepo.getActionPreset(ctx.actionId);
        return {
            id: ctx.actionId,
            label: preset?.label || ctx.actionId,
            role: roleFor(ctx.actionId, preset?.contextConfig?.type),
            pointId: ctx.pointId,
        };
    });
    const ids = new Set(contexts.map(context => context.id));
    const behavioralState = resolveBehavioralState(ids);
    const previousBehavior = resolveBehavioralState(input.previousContextIds || []);
    const restrained = contexts.some(context => context.role === 'restraint');
    const contact = action.contact <= 0.05 ? 'none' : restrained && ['panic', 'defiance'].includes(behavioralState) ? 'forced' : action.contact < 0.55 ? 'partial' : 'full';
    const pleasure = Number(result.pleasure || 0);
    const discomfort = Number(result.discomfort || 0);
    const overload = Number(result.overload || 0);
    const engagement = Number(result.engagement || 0);
    const mixed = pleasure > 0.5 && discomfort > 0.5;

    const stateText: Record<InteractionObservation['behavioralState'], string> = {
        responsive: 'Актив остаётся в контакте и реагирует на воздействие.',
        subspace: 'Реакции замедляются; актив погружается в изменённое, податливое состояние.',
        overload: 'Актив вздрагивает и с трудом перерабатывает поток ощущений.',
        freeze: 'Актив замирает; отсутствие движения не выглядит согласием или расслаблением.',
        panic: restrained ? 'Актив пытается отстраниться, но фиксация сохраняет контакт.' : 'Актив резко отстраняется и пытается разорвать контакт.',
        defiance: restrained ? 'Актив сопротивляется; фиксация позволяет продолжить контакт, не устраняя негативную реакцию.' : 'Актив активно сопротивляется прикосновению и старается прекратить контакт.',
        unresponsive: 'Актив обмякает и почти перестаёт реагировать на внешнее воздействие.',
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
        responsive: 'Я сохраняю контакт и различаю воздействие.', subspace: 'Мысли расплываются, реакции становятся медленнее.',
        overload: 'Ощущений слишком много, мне трудно их разделить.', freeze: 'Я замираю и не могу свободно ответить движением.',
        panic: restrained ? 'Я пытаюсь отстраниться, но фиксация не даёт разорвать контакт.' : 'Я пытаюсь отстраниться и прекратить контакт.',
        defiance: restrained ? 'Я сопротивляюсь, хотя фиксация удерживает меня в контакте.' : 'Я сопротивляюсь и стараюсь не позволить продолжить.',
        unresponsive: 'Сил почти не осталось; внешнее воздействие доходит как будто издалека.',
    };

    const uiText = [stateText[behavioralState], sensation, learningText].filter(Boolean).join(' ');
    const subjectiveText = `${subjectiveState[behavioralState]} ${mixed ? 'В ощущении одновременно есть приятная и неприятная составляющие.' : discomfort > pleasure ? 'Неприятная составляющая сильнее.' : pleasure > discomfort ? 'Приятная составляющая сильнее.' : 'Я не различаю явной эмоциональной окраски.'}`;
    const technicalText = `Контакт: ${contact}. Состояние: ${behavioralState}. P ${pleasure.toFixed(1)}, D ${discomfort.toFixed(1)}, O ${overload.toFixed(1)}, E ${engagement.toFixed(1)}; tension ${signed(output.nextCore.tension - previousCore.tension)}, capacity ${signed(output.nextCore.capacity - previousCore.capacity)}, sensitivity ${signed(sensitivityDelta)}, baseline ${signed(baselineSensitivityDelta)}.`;

    const transitions: InteractionObservation['transitions'] = [];
    if (input.notableEvent === 'positive_discharge') transitions.push({ kind: 'discharge', title: 'Разрядка', text: 'Накопленное напряжение достигает пика и разрешается глубокой физиологической разрядкой.', severity: 'major' });
    if (input.notableEvent === 'breakdown') transitions.push({ kind: 'breakdown', title: 'Нервный срыв', text: 'Пиковое напряжение разрешается паническим истощением вместо положительной разрядки.', severity: 'danger' });
    if (input.notableEvent === 'exhaustion') transitions.push({ kind: 'breakdown', title: 'Истощение ресурса', text: 'Ресурс исчерпан до достижения разрядки; актив остаётся опустошённым и слабо реагирует.', severity: 'danger' });
    if (previousBehavior !== behavioralState) {
        if (behavioralState === 'unresponsive') transitions.push({ kind: 'state', title: 'Потеря контакта', text: 'Актив обмякает и перестаёт осмысленно отвечать на происходящее.', severity: 'danger' });
        else if (previousBehavior === 'unresponsive') transitions.push({ kind: 'recovery', title: 'Возвращение реакции', text: `Осмысленная реакция возвращается. Текущее состояние: ${currentStates[behavioralState].title.toLowerCase()}.`, severity: 'major' });
        else transitions.push({ kind: 'state', title: currentStates[behavioralState].title, text: currentStates[behavioralState].description, severity: behavioralState === 'panic' ? 'danger' : 'major' });
    }

    const currentState = { ...currentStates[behavioralState] };
    if (ids.has('effect_refractory')) {
        currentState.description += ' После разрядки общая реактивность временно снижена.';
    }

    return {
        action: { id: action.actionKey, label: action.label, pointId, pointLabel }, contact, behavioralState,
        reaction: { pleasure, discomfort, overload, engagement, mixed },
        learning: { effect: learningEffect, familiarityDelta, sensitivityDelta, baselineSensitivityDelta },
        changes: {
            tension: output.nextCore.tension - previousCore.tension,
            capacity: output.nextCore.capacity - previousCore.capacity,
            attitude: output.nextCore.attitude - previousCore.attitude,
            openness: output.nextCore.openness - previousCore.openness,
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
    const tension = core.tension >= 80 ? 'Напряжение близко к разрядке.' : core.tension >= 45 ? 'Напряжение заметно накоплено.' : 'Напряжение остаётся управляемым.';
    return `${stateDescriptions[state]} ${tension}`;
}
