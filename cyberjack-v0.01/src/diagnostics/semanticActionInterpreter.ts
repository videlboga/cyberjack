import { CompiledAction } from '../domain/types';

/**
 * Maps raw intensity/valence vectors and engine result into vivid human-readable sensations.
 */
export function interpretAction(action: CompiledAction, engineResult?: any): string {
    const i = action.intensity;
    let v = action.valence;
    const c = action.contact;
    const s = action.sharpness || 0.5;

    // Use engine result if available to get the true perceived intensity
    // 'experiencedIntensity' ranges roughly 0-100.
    let perceivedIntensity = i;
    if (engineResult && typeof engineResult.experiencedIntensity === 'number') {
        perceivedIntensity = Math.min(1.0, engineResult.experiencedIntensity / 100);
    }

    // Use final engine valence to account for attitude (disgust/pain if hated)
    if (engineResult && typeof engineResult.finalValence === 'number') {
        v = engineResult.finalValence;
    }
    
    const isPleasure = v >= 0.2;
    const isPain = v <= -0.2;

    // 1. Core Sensation (Noun phrase ending the "Это ощущается как:" sentence)
    let core = '';
    if (isPain) {
        if (perceivedIntensity > 0.8) core = 'слепящая, невыносимая агония';
        else if (perceivedIntensity > 0.6) core = 'резкая, обжигающая вспышка боли';
        else if (perceivedIntensity > 0.4) core = 'пронзительная, острая боль';
        else if (perceivedIntensity > 0.2) core = 'ощутимый, тянущий дискомфорт';
        else core = 'легкое, едва заметное саднение';
    } else if (isPleasure) {
        if (perceivedIntensity > 0.8) core = 'ошеломляющая, плавящая разум волна экстаза';
        else if (perceivedIntensity > 0.6) core = 'пронзительная, яркая дрожь удовольствия';
        else if (perceivedIntensity > 0.4) core = 'сладкая истома, разливающаяся глубоко по телу';
        else if (perceivedIntensity > 0.2) core = 'мягкая, согревающая волна приятного тепла';
        else core = 'очень легкое, ласковое прикосновение';
    } else {
        if (perceivedIntensity > 0.8) core = 'сокрушительное, тяжелое физическое воздействие';
        else if (perceivedIntensity > 0.6) core = 'жесткое, бесстрастное давление';
        else if (perceivedIntensity > 0.4) core = 'явный, плотный контакт';
        else if (perceivedIntensity > 0.2) core = 'уверенное, ровное касание';
        else core = 'почти невесомое, нейтральное ощущение';
    }

    // 2. Texture & Physics (Starts a new sentence)
    let texture = 'Воздействие';
    if (c < 0.2) { // Non-contact / Psychological / Words
        if (isPain) texture += ' давит на психику тяжелой угрозой';
        else if (isPleasure) texture += ' проникает в сознание легким возбуждающим фоном';
        else texture += ' висит в воздухе как неявное напряжение';
    } else if (c < 0.6) { // Light / Surface contact (Tickle, feather, caress)
        if (s > 0.6) {
            if (perceivedIntensity < 0.3) texture += ' еле ощутимо покалывает кожу';
            else texture += ' раздражающе жалит самую поверхность';
        } else if (s < 0.4) {
            if (perceivedIntensity < 0.3) texture += ' бережно и невесомо гладит кожу';
            else texture += ' мягко и тепло растекается по поверхности';
        } else {
            if (perceivedIntensity < 0.3) texture += ' робко и дразняще касается кожи';
            else texture += ' уверенно скользит по самой поверхности';
        }
    } else { // Firm Physical contact (Slap, massage, grips)
        if (s > 0.6) {
            if (perceivedIntensity < 0.3) texture += ' неприятно колет и царапает';
            else texture += ' пронзает плоть словно раскаленная игла';
        } else if (s < 0.4) {
            if (perceivedIntensity < 0.3) texture += ' глухо и мягко давит на ткани';
            else texture += ' тупо и тяжело отдается где-то глубоко внутри';
        } else {
            if (perceivedIntensity < 0.3) texture += ' настойчиво ощупывает тело';
            else texture += ' плотно, жестко и уверенно обхватывает тело';
        }
    }

    // 3. Reflex (Adverbial participle clause)
    let reflex = '';
    if (perceivedIntensity > 0.8) {
        if (isPain) reflex = ', от чего перехватывает дыхание и тело бьется в судороге.';
        else if (isPleasure) reflex = ', заставляя спину непроизвольно выгнуться дугой, а разум — помутнеть.';
        else reflex = ', заставляя все мышцы рефлекторно напрячься до абсолютного предела.';
    } else if (perceivedIntensity > 0.5) {
        if (isPain) reflex = ', заставляя инстинктивно сжаться, зажмуриться и стиснуть зубы.';
        else if (isPleasure) reflex = ', вырывая из груди тихий, прерывистый судорожный выдох.';
        else reflex = ', заставляя тело настороженно замереть в ожидании продолжения.';
    } else if (perceivedIntensity > 0.2) {
        if (isPain) reflex = ', вызывая неприятную нервную дрожь и сильное желание отстраниться.';
        else if (isPleasure) reflex = ', от чего по коже пробегает легкая стайка мурашек.';
        else reflex = ', инстинктивно привлекая к себе внимание.';
    } else {
        // Минимальное по силе воздействие
        if (isPain) reflex = ', оставляя после себя лишь слабый неприятный осадок.';
        else if (isPleasure) reflex = ', даря мимолетное чувство уюта и легкого тепла.';
        else reflex = '.'; // Neutral minor touches produce no dramatic reflex
    }

    return `${core}. ${texture}${reflex}`;
}
