import { CompiledAction, SubjectCoreState, SubjectPointState } from '../domain/types';

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function interpretAction(
    action: CompiledAction, 
    engineResult?: any, 
    core?: SubjectCoreState, 
    point?: SubjectPointState
): string {
    const i = action.intensity;
    let v = action.valence;
    const c = action.contact;
    const s = action.sharpness || 0.5;

    // Личностные и точечные параметры
    const attitude = core?.attitude ?? 50;
    const openness = core?.openness ?? 50;
    const localSensitivity = point?.localSensitivity ?? 50;
    const localAttitude = point?.localAttitude ?? attitude;

    let perceivedIntensity = i;
    if (engineResult && typeof engineResult.experiencedIntensity === 'number') {
        perceivedIntensity = Math.min(1.0, engineResult.experiencedIntensity / 100);
    }

    if (engineResult && typeof engineResult.finalValence === 'number') {
        v = engineResult.finalValence;
    }
    
    const isPleasure = v >= 0.2;
    const isPain = v <= -0.2;

    // Вспомогательные флаги для окраски текста
    const isHatedTouch = attitude < 30;
    const isLovedTouch = attitude > 70;
    const isClosedOff = openness < 30;
    const isHyper = localSensitivity > 80;

    // БЕЗ КОНТАКТА ИЛИ ВЕРБАЛЬНЫЕ ДЕЙСТВИЯ (c < 0.2)
    if (c < 0.2) {
        let coreStr = '';
        let texture = 'Воздействие';
        let reflex = '';

        if (isPain) {
             if (perceivedIntensity > 0.8) coreStr = pick(['тяжелое психологическое давление', 'сокрушительный ментальный прессинг']);
             else if (perceivedIntensity > 0.4) coreStr = pick(['ощутимая вербальная или психологическая угроза', 'явный дискомфортный посыл']);
             else coreStr = pick(['легкая неприязнь в общении', 'фоновое, слегка давящее присутствие']);
             
             texture += pick([' давит на психику тяжелым грузом', ' неприятно задевает внутренние барьеры', ' висит в воздухе как незримая угроза']);
             
             if (isClosedOff) texture += ', натыкаясь на твою внутреннюю стену';
             
             if (perceivedIntensity > 0.6) reflex = pick([', заставляя инстинктивно вжать голову в плечи.', ', от чего по спине пробегает неприятный холодок.', ', от чего внутри все сжимается в тугой комок.']);
             else reflex = pick([', вызывая желание отстраниться или прекратить контакт.', ', оставляя после себя горький осадок.', ', заставляя непроизвольно отвести взгляд.']);
        } else if (isPleasure) {
             if (perceivedIntensity > 0.8) coreStr = pick(['ошеломляюще позитивный эмоциональный всплеск', 'мощная волна словесной поддержки']);
             else if (perceivedIntensity > 0.4) coreStr = pick(['приятное, располагающее общение', 'теплое вербальное взаимодействие']);
             else coreStr = pick(['легкое, поверхностное внимание', 'ни к чему не обязывающая беседа']);
             
             texture += pick([' воспринимается как успокаивающий, мягкий сигнал', ' проникает в сознание приятным фоном', ' ощущается как проявление заботы или интереса']);
             
             if (isHatedTouch) texture += ', но вызывает внутренний диссонанс и недоверие';
             else if (isClosedOff) texture += ', с трудом пробиваясь через твою настороженность';
             else if (isLovedTouch) texture += ', находя глубокий отклик внутри';
             
             if (perceivedIntensity > 0.6) reflex = pick([', заставляя тело заметно расслабиться.', ', вызывая невольную, слабую улыбку.', ', от чего дыхание становится ровнее.']);
             else reflex = pick([', даря мимолетное чувство безопасности.', ', чуть смягчая общую напряженность.', '.']);
        } else {
             if (perceivedIntensity > 0.8) coreStr = pick(['оглушающе громкий или интенсивный информационный шум', 'крайне настойчивое обращение']);
             else if (perceivedIntensity > 0.4) coreStr = pick(['обычный, деловой контакт', 'прямолинейный обмен информацией']);
             else coreStr = pick(['рутинное, фоновое взаимодействие', 'ничем не примечательное сообщение']);
             
             texture += pick([' не несет в себе скрытых эмоций', ' воспринимается как чистая информация', ' не пересекает личных границ']);
             
             if (perceivedIntensity > 0.6) reflex = pick([', требуя немедленной концентрации внимания.', ', заставляя выпрямиться и слушать внимательнее.']);
             else reflex = pick(['.', ', не вызывая никаких особых реакций.', ', оставляя разум совершенно холодным.']);
        }
        
        return `${coreStr}. ${texture}${reflex}`;
    }

    // КОНТАКТНЫЕ ДЕЙСТВИЯ (c >= 0.2)
    let coreStr = '';
    if (isPain) {
        if (perceivedIntensity > 0.8) coreStr = pick(['слепящая, невыносимая агония', 'разрывающая тело чудовищная боль']);
        else if (perceivedIntensity > 0.6) coreStr = pick(['резкая, обжигающая вспышка боли', 'жестокое, болезненное воздействие']);
        else if (perceivedIntensity > 0.4) coreStr = pick(['пронзительная, острая боль', 'очень некомфортное, жесткое касание']);
        else if (perceivedIntensity > 0.2) coreStr = pick(['ощутимый, тянущий дискомфорт', 'неприятное, грубое обхождение']);
        else coreStr = pick(['легкое, едва заметное саднение', 'слабый дискомфорт от касания']);
    } else if (isPleasure) {
        if (perceivedIntensity > 0.8) coreStr = pick(['ошеломляющая, плавящая разум волна экстаза', 'всепоглощающее, ослепительное удовольствие']);
        else if (perceivedIntensity > 0.6) coreStr = pick(['пронзительная, яркая дрожь удовольствия', 'очень глубокое, сладкое наслаждение']);
        else if (perceivedIntensity > 0.4) coreStr = pick(['сладкая истома, разливающаяся по телу', 'очень приятный, чувственный контакт']);
        else if (perceivedIntensity > 0.2) coreStr = pick(['мягкая, согревающая волна приятного тепла', 'нежное, теплое прикосновение']);
        else coreStr = pick(['очень легкое, ласковое прикосновение', 'почти невесомая, приятная ласка']);
    } else {
        if (perceivedIntensity > 0.8) coreStr = pick(['сокрушительное, тяжелое физическое воздействие', 'очень мощное, подавляющее давление на тело']);
        else if (perceivedIntensity > 0.6) coreStr = pick(['жесткое, бесстрастное давление', 'грубый физический захват или толчок']);
        else if (perceivedIntensity > 0.4) coreStr = pick(['явный, плотный контакт', 'уверенное, сильное прикосновение']);
        else if (perceivedIntensity > 0.2) coreStr = pick(['уверенное, ровное касание', 'обычный физический контакт']);
        else coreStr = pick(['почти невесомое, нейтральное ощущение', 'мимолетное скольжение по коже']);
    }

    let texture = 'Воздействие';
    if (c < 0.6) { // Light / Surface contact
        if (s > 0.6) {
            if (perceivedIntensity < 0.3) texture += pick([' еле ощутимо покалывает кожу', ' слегка царапает поверхность']);
            else texture += pick([' раздражающе жалит самую поверхность', ' остро проходится по верхним слоям кожи']);
        } else if (s < 0.4) {
            if (perceivedIntensity < 0.3) texture += pick([' бережно и невесомо гладит кожу', ' мягко ложится на тело']);
            else texture += pick([' мягко и тепло растекается по поверхности', ' гладко скользит по тканям']);
        } else {
            if (perceivedIntensity < 0.3) texture += pick([' робко и дразняще касается кожи', ' легко проходится по телу']);
            else texture += pick([' уверенно скользит по самой поверхности', ' четко и ясно ощущается кожей']);
        }
    } else { // Firm Physical contact
        if (s > 0.6) {
            if (perceivedIntensity < 0.3) texture += pick([' неприятно колет и царапает', ' грубо задевает кожу']);
            else texture += pick([' пронзает плоть словно раскаленная игла', ' впивается глубоко в тело с пугающей остротой']);
        } else if (s < 0.4) {
            if (perceivedIntensity < 0.3) texture += pick([' глухо и мягко давит на ткани', ' осторожно сжимает плоть']);
            else texture += pick([' тупо и тяжело отдается где-то глубоко внутри', ' сминает мышцы тяжелым грузом']);
        } else {
            if (perceivedIntensity < 0.3) texture += pick([' настойчиво ощупывает тело', ' плотно прилегает к телу']);
            else texture += pick([' плотно, жестко и уверенно обхватывает тело', ' стискивает ткани в железной хватке']);
        }
    }
    
    // Вплетаем модификаторы в текстуру
    if (isHyper) {
        texture += pick([', прошивая перестимулированную зону словно током', ', обжигая гиперчувствительную кожу']);
    }
    
    if (isHatedTouch) {
        if (isPleasure && localAttitude < 50) {
            texture += pick([', вызывая унизительное чувство покорности', ', заставляя ненавидеть собственное тело за этот отклик']);
        } else {
            texture += pick([', вызывая отвращение своей грубостью', ', ощущаясь как грязное, чужеродное вторжение']);
        }
    } else if (isLovedTouch) {
        if (isPain && localAttitude > 50) {
            texture += pick([', принимаясь с пугающим, извращенным облегчением', ', ощущаясь как заслуженное, доверительное наказание']);
        } else {
            texture += pick([', находя горячий, инстинктивный отклик внутри', ', ощущаясь абсолютно правильно и желанно']);
        }
    }

    if (isClosedOff && !isLovedTouch) {
        texture += pick([', пробивая выстроенную тобой ментальную броню', ', словно взламывая твои границы']);
    }

    let reflex = '';
    if (perceivedIntensity > 0.8) {
        if (isPain) reflex = pick([', от чего перехватывает дыхание и тело бьется в судороге.', ', заставляя извиваться и слепо пытаться вырваться.']);
        else if (isPleasure) reflex = pick([', заставляя спину непроизвольно выгнуться дугой, а разум — помутнеть.', ', лишая возможности нормально дышать.']);
        else reflex = pick([', заставляя все мышцы рефлекторно напрячься до абсолютного предела.', ', выбивая из легких весь воздух.']);
    } else if (perceivedIntensity > 0.5) {
        if (isPain) {
             if (s > 0.6) reflex = pick([', заставляя инстинктивно сжаться, зажмуриться и стиснуть зубы.', ', прошивая тело нервной дрожью.']);
             else reflex = pick([', провоцируя резкий спазм по всему телу.', ', заставляя глухо застонать сквозь зубы.']);
        }
        else if (isPleasure) reflex = pick([', вырывая из груди тихий, прерывистый выдох.', ', заставляя глаза сами собой закрыться от нахлынувших чувств.']);
        else reflex = pick([', заставляя тело настороженно замереть в ожидании.', ', заставляя напрячься в готовности.']);
    } else if (perceivedIntensity > 0.2) {
        if (isPain) reflex = pick([', вызывая неприятную нервную дрожь и сильное желание отстраниться.', ', заставляя слегка дернуться от дискомфорта.']);
        else if (isPleasure) {
             if (isHyper) reflex = pick([', заставляя кожу покрыться мурашками, а тело — мелко дрожать.', ', вызывая острую, почти болезненную сладкую дрожь.']);
             else reflex = pick([', от чего по коже пробегает легкая стайка мурашек.', ', заставляя тело чуть податься навстречу касанию.', ', вызывая приятную, едва заметную истому.']);
        }
        else reflex = pick([', инстинктивно привлекая к себе внимание.', ', заставляя просто перевести взгляд на источник ощущения.']);
    } else {
        if (isPain) reflex = pick([', оставляя после себя лишь слабый неприятный осадок.', ', вызывая лишь легкое недовольство.']);
        else if (isPleasure) reflex = pick([', даря мимолетное чувство уюта.', ', оставляя на коже приятный фантомный след.']);
        else reflex = pick(['.', ', не вызывая никаких ярких ответных реакций.']);
    }

    return `${coreStr}. ${texture}${reflex}`;
}
