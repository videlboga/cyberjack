/**
 * Short factual visual descriptions for persistent scene contexts.  These are
 * prompt facts, not narration requests: a character must not contradict them
 * or repeat them aloud unless the conversation makes them relevant.
 */
export const contextPromptEffects: Record<string, string> = {
    pose_standing: 'Ты стоишь прямо, опираясь на обе ноги.',
    pose_sitting: 'Ты сидишь; вес тела приходится на опору, а не на ноги.',
    pose_kneeling: 'Ты стоишь на коленях, удерживая равновесие корпусом.',
    pose_lying_down: 'Ты лежишь на спине и не стоишь на полу.',
    pose_all_fours: 'Ты опираешься на ладони и колени; корпус удерживается на четырёх точках.',
    pose_spread_eagle: 'Ты лежишь на спине, раскинув руки и ноги.',
    act_present_feet: 'Ты сидишь с вытянутыми вперёд ногами и демонстрируешь ступни.',
    act_hold_exposure: 'Твоё положение намеренно оставляет тело открытым для осмотра; не описывай его как свободную обычную стойку.',
    act_suspend_wrists: 'Твои запястья удерживаются над головой, поэтому руки не свободны.',
    act_apply_collar: 'На шее закреплён ошейник.',
    act_apply_cuffs: 'На запястьях закреплены фиксаторы; движения рук ограничены.',
    act_apply_ankle_cuffs: 'На щиколотках закреплены фиксаторы; шаг и положение ног ограничены.',
    act_apply_blindfold: 'Глаза закрыты повязкой; ты не можешь описывать увиденное.',
    finger_insertion: 'Пальцы остаются внутри тебя и продолжают двигаться в выбранном ритме.',
    act_start_penetration: 'Пенис остаётся внутри тебя; продолжается вагинальный или анальный секс.',
    act_increase_friction: 'Партнёр продолжает быстрые толчки; телу не хватает обычной паузы между ними.',
    act_decrease_friction: 'Партнёр продолжает более медленные толчки, оставляя телу паузу между движениями.',
    act_start_oral_giving: 'Пенис остаётся у тебя во рту; продолжается минет, и дыхание подстраивается под него.',
    act_deepen_oral: 'Пенис входит глубже тебе в рот; горло и дыхание остаются вовлечены в минет.',
};

export function contextPromptEffect(id: string, configured?: string): string | undefined {
    return configured || contextPromptEffects[id];
}
