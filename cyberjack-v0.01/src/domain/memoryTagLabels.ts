/** Human-facing names for every semantic tag that can enter an episode. */
export const memoryTagLabels: Record<string, string> = {
    adult: 'взрослая тема', affection: 'нежность', ankles: 'лодыжки', arousal: 'возбуждение', answer_question: 'ответ на вопрос',
    biomaterial: 'биоматериал', blunt: 'тупое воздействие', boundary_ignored: 'граница проигнорирована', calibration: 'калибровка', check_in: 'уточнение состояния',
    chemical: 'химическое воздействие', climax: 'пик', clinical: 'медицинский контекст', clothing: 'одежда', command: 'команда', comfort: 'комфорт', conditioning: 'обусловливание',
    continuous: 'продолжительный контакт', continue_topic: 'продолжение темы', control: 'контроль', costume: 'костюм', demeaning: 'унижение', deprivation: 'лишение', dress: 'платье', drug: 'препарат',
    electronic: 'электростимуляция', equipment: 'оборудование', exposure: 'воздействие', feet: 'ступни', fluid: 'жидкость', giving: 'оказание орального контакта', gown: 'халат', hands: 'руки',
    heard_speech: 'услышанные слова', hormonal: 'гормональное воздействие', humiliation: 'унижение', impact: 'ударное воздействие', infusion: 'инфузия', intense: 'усиленный контакт', intimate: 'интимное',
    isolation: 'изоляция', manual: 'ручное воздействие', medical: 'медицинское', mental: 'ментальное', metal: 'металл', neural: 'нейронное воздействие', neutral: 'нейтральное', oral: 'оральное',
    overload: 'перегрузка', pace: 'темп', pain: 'боль', panties: 'нижнее бельё', penetration: 'проникновение', personal: 'личное', piercing: 'прокол', plasticity: 'пластичность', pleasure: 'удовольствие',
    pose: 'поза', pressure: 'давление', punishment: 'наказание', recovery: 'восстановление', relief: 'облегчение', remove: 'снятие', restraint: 'фиксация', scene_observation: 'наблюдение сцены',
    sensitivity: 'чувствительность', sensory: 'ощущения', sexual: 'сексуальное', social_transaction: 'социальный обмен', sportswear: 'спортивная одежда', stabilizer: 'стабилизатор', stimulation: 'стимуляция', stockings: 'чулки', stretching: 'растяжение',
    stop: 'прекращение контакта', struggle: 'сопротивление', submission: 'подчинение', suspension: 'подвешивание', tickling: 'щекотка', underwear: 'нижнее бельё', vulnerable: 'уязвимость', waist: 'талия',
};

export function memoryTagLabel(tag: string) {
    return memoryTagLabels[tag] || `тема: ${tag.replace(/[_-]+/g, ' ')}`;
}
