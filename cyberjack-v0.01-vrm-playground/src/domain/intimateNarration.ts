import type { SensoryProfile } from '../infrastructure/actionSensoryProfile';

type IntimateNarration = { description: string; sensory: SensoryProfile };

const internalPlaces = (pointId?: string) => pointId === 'anus'
    ? { entry: 'в твой анус', inside: 'в твоём анусе', exit: 'из твоего ануса' }
    : { entry: 'во влагалище', inside: 'во влагалище', exit: 'из влагалища' };

/**
 * Mechanical presets are shared by several anatomical targets.  This creates
 * the factual, first-person prompt language only after the actual target and
 * sustained source are known, so an oral stop can never be described as a
 * withdrawal from an internal contact.
 */
export function intimateNarrationFor(
    actionId: string,
    pointId?: string,
    sustainedSource?: string,
): IntimateNarration | undefined {
    const place = internalPlaces(pointId);
    const internal = pointId === 'anus' ? 'анальный' : 'вагинальный';
    const profiles: Record<string, IntimateNarration> = {
        finger_insertion: {
            description: `Пальцы входят ${place.entry} и начинают двигаться внутри.`,
            sensory: { stimulus: `Ты чувствуешь пальцы внутри: ${place.inside}.`, texture: 'Пальцы раздвигают мышцы и меняют нажим изнутри.', rhythm: 'Движения повторяются, не давая ощущениям полностью стихнуть.', bodilyResponse: 'Мышцы вокруг пальцев непроизвольно сжимаются или пытаются отстраниться.', aftereffect: 'Даже в короткой паузе внутри остаются тепло и ожидание следующего движения.' },
        },
        act_start_penetration: {
            description: `Пенис входит ${place.entry}; начинается ${internal} секс.`,
            sensory: { stimulus: `Ты чувствуешь, как пенис входит ${place.entry}.`, texture: 'Глубокое давление изнутри меняется вместе с движением бёдер партнёра.', rhythm: 'Каждый толчок приходит до того, как мышцы успевают полностью расслабиться.', bodilyResponse: 'Мышцы вокруг проникновения сжимаются, дыхание и положение тела подстраиваются под темп.', aftereffect: 'После каждого движения внутри остаются тепло, растяжение и ожидание следующего толчка.' },
        },
        act_increase_friction: {
            description: `Партнёр ускоряет толчки во время ${internal} секса.`,
            sensory: { stimulus: `Толчки ${place.inside} становятся быстрее.`, texture: 'Давление и скольжение сменяются чаще, не оставляя телу обычной паузы.', rhythm: 'Быстрый ритм навязан повторяющимися толчками.', bodilyResponse: 'Мышцы напрягаются в попытке угнаться за темп, дыхание сбивается.', aftereffect: 'После ускорения тело ещё держит этот ритм в мышцах.' },
        },
        act_decrease_friction: {
            description: `Партнёр замедляет толчки во время ${internal} секса.`,
            sensory: { stimulus: `Толчки ${place.inside} становятся медленнее.`, texture: 'Между движениями появляется время почувствовать глубину и постепенное ослабление давления.', rhythm: 'Каждый следующий толчок приходит после заметной паузы.', bodilyResponse: 'Дыхание получает возможность выровняться, но мышцы всё ещё удерживают след проникновения.', aftereffect: 'Внутри остаются тепло и медленно уходящее растяжение.' },
        },
        act_start_oral_giving: {
            description: 'Пенис входит тебе в рот; начинается минет.',
            sensory: { stimulus: 'Ты чувствуешь пенис во рту.', texture: 'Губы, язык и челюсть удерживают его; вкус, тепло и слюна становятся частью ощущения.', rhythm: 'Движение задаётся темпом партнёра и твоим дыханием.', bodilyResponse: 'Челюсть и горло напрягаются, дыхание приходится подстраивать под занятый рот.', aftereffect: 'На губах и языке остаются влажность, вкус и напряжение челюсти.' },
        },
        act_deepen_oral: {
            description: 'Пенис входит глубже тебе в рот; минет становится глубже.',
            sensory: { stimulus: 'Ты чувствуешь, как пенис проходит глубже во рту.', texture: 'Давление сильнее упирается в язык и горло, слюны становится больше.', rhythm: 'Глубина меняется вместе с каждым движением, а паузы на дыхание короче.', bodilyResponse: 'Горло, челюсть и дыхание напрягаются; тело реагирует на глубину раньше, чем успевает отвлечься.', aftereffect: 'После движения остаются влажность, вкус и чувствительность горла.' },
        },
        act_sexual_climax: {
            description: `Толчки ${place.inside} резко усиливаются, подводя тело к оргазму.`,
            sensory: { stimulus: `Ты чувствуешь резкое усиление толчков ${place.inside}.`, texture: 'Давление становится плотнее и настойчивее, почти не оставляя промежутков.', rhythm: 'Несколько сильных движений следуют одно за другим.', bodilyResponse: 'Мышцы таза сжимаются, дыхание срывается, тело может непроизвольно выгнуться или отпрянуть.', aftereffect: 'После всплеска внутри остаются пульсация и повышенная чувствительность.' },
        },
    };
    if (actionId === 'act_end_sexual_contact') {
        return pointId === 'lips'
            ? { description: 'Пенис выходит из твоего рта; минет прекращается.', sensory: { stimulus: 'Ты чувствуешь, как пенис выходит изо рта.', texture: 'Давление на губы, язык и горло исчезает, оставляя влажность и вкус.', bodilyResponse: 'Челюсть и горло постепенно отпускают напряжение, дыхание выравнивается.', aftereffect: 'На губах и языке остаются влага, вкус и остаточная чувствительность.' } }
            : { description: `Пенис выходит ${place.exit}; ${internal} секс прекращается.`, sensory: { stimulus: `Ты чувствуешь, как пенис выходит ${place.exit}.`, texture: 'Внутреннее давление и растяжение постепенно ослабевают.', bodilyResponse: 'Мышцы вокруг проникновения отпускают напряжение не сразу.', aftereffect: 'Внутри остаются тепло, пульсация и остаточная чувствительность.' } };
    }
    if (actionId === 'sustained_sexual_pulse') {
        return intimateNarrationFor(sustainedSource || 'act_start_penetration', pointId);
    }
    return profiles[actionId];
}
