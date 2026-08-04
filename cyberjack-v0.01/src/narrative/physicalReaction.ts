import { CompiledAction, InteractionObservation, SubjectCoreState } from '../domain/types';

export interface PhysicalReactionFrame {
    reflex: 'none' | 'flinch' | 'jerk' | 'spasm';
    movementIntent: 'withdraw' | 'hold' | 'yield' | 'approach';
    movementRealization: 'full' | 'partial' | 'blocked';
    muscleTone: 'relaxed' | 'tense' | 'rigid' | 'trembling' | 'limp';
    breathing: 'steady' | 'held' | 'sharp_inhale' | 'deep' | 'rapid' | 'broken';
    involuntarySound: 'none' | 'breath' | 'gasp' | 'moan' | 'cry';
    persistence: 'instant' | 'lingering' | 'sustained';
    voluntary: boolean;
    subjectiveText: string;
    observerText: string;
}

const restrained = (observation: InteractionObservation) => observation.contact === 'forced'
    || observation.contexts.some(context => context.role === 'restraint' || context.role === 'equipment');

export function buildPhysicalReaction(
    observation: InteractionObservation,
    action: CompiledAction,
    core: SubjectCoreState,
): PhysicalReactionFrame | null {
    if (action.actionKey === 'wait' || action.actionKey === 'verbal_pressure' || action.tags?.includes('mental') || action.contact <= .05) return null;
    const snapshot = observation.reactionSnapshot;
    const intensity = Number(observation.reaction.experiencedIntensity || 0);
    const discomfort = Number(observation.reaction.discomfort || 0);
    const pleasure = Number(observation.reaction.pleasure || 0);
    const overload = Number(observation.reaction.overload || 0);
    const control = Number(snapshot?.affect.control ?? core.capacity ?? 50);
    const willingness = Number(snapshot?.appraisal.willingness ?? 50);
    const resistance = Number(snapshot?.behavior.resistance ?? 0);
    const appraisal = Number(snapshot?.appraisal.valence ?? observation.reaction.appraisal ?? 0);
    const desired = snapshot?.behavior.desiredResponse || 'continue';
    const state = observation.behavioralState;
    const load = intensity + discomfort * .7 + overload * .5 + Math.max(0, action.sharpness) * 12;

    const reflex: PhysicalReactionFrame['reflex'] = state === 'unresponsive' || load < 8 ? 'none'
        : load >= 55 || overload >= 65 ? 'spasm'
        : load >= 30 ? 'jerk'
        : 'flinch';

    let movementIntent: PhysicalReactionFrame['movementIntent'];
    if (state === 'unresponsive' || state === 'freeze') movementIntent = 'hold';
    else if (['stop', 'escape', 'slow_down'].includes(desired) || ['panic', 'defiance'].includes(state) || resistance >= 55 || appraisal <= -.3) movementIntent = 'withdraw';
    else if (willingness >= 68 && appraisal > .15 && pleasure > discomfort * 1.15) movementIntent = 'approach';
    else if (willingness >= 45 && appraisal >= 0 && pleasure > discomfort) movementIntent = 'yield';
    else movementIntent = 'hold';

    const isRestrained = restrained(observation);
    const movementRealization: PhysicalReactionFrame['movementRealization'] = movementIntent === 'hold' ? 'full'
        : isRestrained ? 'blocked'
        : state === 'overload' || control < 20 ? 'partial'
        : 'full';
    const muscleTone: PhysicalReactionFrame['muscleTone'] = state === 'unresponsive' ? 'limp'
        : state === 'freeze' ? 'rigid'
        : overload >= 55 || (core.tension >= 75 && control < 45) ? 'trembling'
        : movementIntent === 'approach' && discomfort < pleasure * .5 ? 'relaxed'
        : discomfort >= 3 || movementIntent === 'withdraw' ? 'tense'
        : 'relaxed';
    const breathing: PhysicalReactionFrame['breathing'] = state === 'freeze' ? 'held'
        : overload >= 65 || control < 15 ? 'broken'
        : state === 'panic' || load >= 45 ? 'rapid'
        : reflex === 'jerk' || reflex === 'spasm' ? 'sharp_inhale'
        : movementIntent === 'approach' && pleasure > 5 ? 'deep'
        : 'steady';
    const soundPressure = discomfort + overload * .35 + intensity * .2;
    let involuntarySound: PhysicalReactionFrame['involuntarySound'] = soundPressure >= 50 ? 'cry'
        : soundPressure >= 28 ? 'gasp'
        : pleasure >= 18 && appraisal > 0 ? 'moan'
        : reflex !== 'none' ? 'breath'
        : 'none';
    // Strong self-control can suppress a marginal sound, but not an extreme
    // reflex. This keeps a guarded character distinct without making control
    // physically absolute.
    if (control >= 70 && soundPressure < 55) {
        if (involuntarySound === 'gasp' || involuntarySound === 'moan') involuntarySound = 'breath';
        else if (involuntarySound === 'breath') involuntarySound = 'none';
    }
    const persistence: PhysicalReactionFrame['persistence'] = overload >= 55 || muscleTone === 'trembling' ? 'sustained'
        : discomfort >= 8 || core.tension >= 55 ? 'lingering'
        : 'instant';
    const voluntary = reflex === 'none' && involuntarySound === 'none' && ['approach', 'yield'].includes(movementIntent);

    const reflexSubject = { none: '', flinch: 'Ты едва заметно вздрагиваешь.', jerk: 'От контакта ты резко дёргаешься.', spasm: 'Тело сводит сильным непроизвольным спазмом.' }[reflex];
    const reflexObserver = { none: '', flinch: 'Персонаж едва заметно вздрагивает.', jerk: 'Персонаж резко дёргается от контакта.', spasm: 'Тело персонажа сводит сильным непроизвольным спазмом.' }[reflex];
    const movementSubject = movementIntent === 'withdraw'
        ? movementRealization === 'blocked' ? 'Ты пытаешься отстраниться, но фиксация превращает движение в короткий напряжённый рывок.' : movementRealization === 'partial' ? 'Ты пытаешься отстраниться, но движение выходит слабым и незавершённым.' : 'Ты отстраняешься и увеличиваешь дистанцию от прикосновения.'
        : movementIntent === 'approach' ? (movementRealization === 'blocked' ? 'Ты невольно подаёшься навстречу, насколько позволяет фиксация.' : 'Ты подаёшься навстречу прикосновению и сокращаешь дистанцию.')
        : movementIntent === 'yield' ? 'Ты не отстраняешься и позволяешь телу следовать за движением контакта.'
        : state === 'freeze' ? 'Ты цепенеешь; неподвижность не означает принятия.' : state === 'unresponsive' ? 'Осмысленного движения в ответ почти нет.' : 'Ты удерживаешь тело на месте, не двигаясь ни навстречу, ни прочь.';
    const movementObserver = movementIntent === 'withdraw'
        ? movementRealization === 'blocked' ? 'Персонаж пытается отстраниться, но фиксация превращает движение в короткий напряжённый рывок.' : movementRealization === 'partial' ? 'Персонаж пытается отстраниться, но движение выходит слабым и незавершённым.' : 'Персонаж отстраняется и увеличивает дистанцию от прикосновения.'
        : movementIntent === 'approach' ? (movementRealization === 'blocked' ? 'Персонаж невольно подаётся навстречу, насколько позволяет фиксация.' : 'Персонаж подаётся навстречу прикосновению и сокращает дистанцию.')
        : movementIntent === 'yield' ? 'Персонаж не отстраняется и позволяет телу следовать за движением контакта.'
        : state === 'freeze' ? 'Персонаж цепенеет; неподвижность не означает принятия.' : state === 'unresponsive' ? 'Осмысленного движения в ответ почти нет.' : 'Персонаж удерживает тело на месте, не двигаясь ни навстречу, ни прочь.';
    const toneSubject = muscleTone === 'tense' ? 'Мышцы остаются напряжёнными.' : muscleTone === 'rigid' ? 'Мышцы застывают в жёстком напряжении.' : muscleTone === 'trembling' ? 'По мышцам проходит заметная дрожь.' : muscleTone === 'limp' ? 'Тело остаётся безвольным и тяжёлым.' : 'Мышцы постепенно расслабляются.';
    const breathSubject = { steady: '', held: 'Ты на несколько секунд задерживаешь дыхание.', sharp_inhale: 'Ты резко втягиваешь воздух.', deep: 'Дыхание становится глубже.', rapid: 'Дыхание резко учащается.', broken: 'Дыхание сбивается и не сразу восстанавливается.' }[breathing];
    const soundSubject = { none: '', breath: 'Из тебя вырывается короткий слышимый выдох.', gasp: 'Из тебя вырывается сдавленный звук.', moan: 'Из тебя невольно вырывается тихий стон.', cry: 'Ты вскрикиваешь от боли и перегрузки.' }[involuntarySound];
    const afterSubject = persistence === 'sustained' ? 'Реакция не проходит сразу и продолжает удерживать всё тело.' : persistence === 'lingering' ? 'После контакта телесная реакция ещё некоторое время не отпускает.' : '';
    const subjectiveText = [reflexSubject, movementSubject, toneSubject, breathSubject, soundSubject, afterSubject].filter(Boolean).join(' ');
    const toneObserver = { tense: 'Мышцы персонажа остаются напряжёнными.', rigid: 'Мышцы персонажа застывают в жёстком напряжении.', trembling: 'По мышцам персонажа проходит заметная дрожь.', limp: 'Тело персонажа остаётся безвольным и тяжёлым.', relaxed: 'Мышцы персонажа постепенно расслабляются.' }[muscleTone];
    const breathObserver = { steady: '', held: 'Персонаж на несколько секунд задерживает дыхание.', sharp_inhale: 'Персонаж резко втягивает воздух.', deep: 'Дыхание персонажа становится глубже.', rapid: 'Дыхание персонажа резко учащается.', broken: 'Дыхание персонажа сбивается и не сразу восстанавливается.' }[breathing];
    const soundObserver = { none: '', breath: 'У персонажа вырывается короткий слышимый выдох.', gasp: 'У персонажа вырывается сдавленный звук.', moan: 'У персонажа невольно вырывается тихий стон.', cry: 'Персонаж вскрикивает от боли и перегрузки.' }[involuntarySound];
    const afterObserver = persistence === 'sustained' ? 'Реакция не проходит сразу и продолжает удерживать всё тело.' : persistence === 'lingering' ? 'После контакта телесная реакция ещё некоторое время не отпускает.' : '';
    const observerText = [reflexObserver, movementObserver, toneObserver, breathObserver, soundObserver, afterObserver].filter(Boolean).join(' ');
    return { reflex, movementIntent, movementRealization, muscleTone, breathing, involuntarySound, persistence, voluntary, subjectiveText, observerText };
}
