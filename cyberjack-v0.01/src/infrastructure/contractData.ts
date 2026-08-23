import type { AssetContract } from '../domain/types';

type ContractSeedData = Omit<AssetContract, 'state'>;

/**
 * Контент контрактов — 60 штук (Veil 15, Helix 15, Continuum 15, Центр 15).
 * Переработка v2: только external_transfer, явные уровни сложности (difficulty)
 * и жестокости (cruelty), ≥ половины — сексуальные. Тон эвфемистично-
 * бюрократический, но прозрачно и подробно описывающий жесть.
 *
 * difficulty: easy | medium | hard | extreme — высота порогов условий.
 * cruelty: mild | moderate | severe | extreme — тяжесть return_profile.
 *
 * Фракции:
 *   fac_veil      — Veil Biotech (экстрим, срыв, Аномалия)
 *   fac_helix     — Helix Dynamics (обусловливание, стандартизация)
 *   fac_continuum — Continuum Archive (манипуляция воспоминаниями)
 *   fac_core      — Центр адаптивной психофизиологии (предельные аверсии)
 */
export const CONTRACT_DATA: ContractSeedData[] = [
{
    id: "contract_veil_resonance_pain_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Резонансный болевой контур",
    description: "Veil ищет актив, у которого боль уже осмыслена как значимый сигнал, но чувствительность не перешла в сенсорный срыв. Актив будет закреплён на столе и подвергнут серии нарастающих болевых воздействий — от тупых ударов до точечных проколов и электроразрядов — до выхода на устойчивый резонансный отклик. Ожидается глубокая перегрузка и перестройка болевого порога.",
    conditions: [
        { type: "acquired_trait", key: "trait_masochist", operator: ">=", value: 2 },
        { type: "preference", key: "pain", operator: ">=", value: 18 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 68 },
        { type: "custom", key: "capacity", operator: ">=", value: 45 },
        { type: "attitude", operator: "<=", value: 72 }
    ],
    rewards: { credits: 820, trust: 16, items: ["drug_painkiller"] },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "нарастающая боль до резонанса, тело как инструмент",
            fragments: ["Меня закрепили на столе.", "Боль нарастала от тупых ударов до точечных проколов и разрядов.", "Тело отзывалось на каждый удар, пока не вышло на резонанс.", "В резонансе боль стала почти музыкой, а потом я сорвалась."],
            tags: ["pain", "impact", "piercing", "electronic", "restraint", "overload"]
        },
        acute_state: { capacity: 4, tension: 90, sensitivity: 8, attitude: -12 },
        recovery: { baselineCapacityLimit: 0.2, method: "капсула + drug_regenerative", durationDays: 3 },
        traits: {
            kept: ["trait_masochist"],
            traumatic: [{ id: "trauma_pain_resonance", trigger: "pain", response: "флэшбеки и паника при резких болевых стимулах" }],
            temporary: [{ id: "anomaly_pain_echo", impulse: "тяга вернуться к болевому пику", decayCondition: "восстановление" }]
        },
        associations: { traumatic: ["боль→амбивалент", "стол/фиксация→негатив"], new: ["Аномалия→резонанс"] },
        relations: { attitude: -8, openness: 3, plasticity: 6 },
        world_effects: { facts: ["Veil зафиксировал резонансный болевой профиль"], threads: ["серия болевых протоколов"] }
    }
},
{
    id: "contract_veil_forced_orgasm_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "severe",
    title: "Протокол принудительного оргазма",
    description: "Veil изучает отклик Аномалии на принудительную разрядку. Актив будет закреплён на вибростанке и доведён до оргазма многократно, без паузы между пиками, с фармакологическим усилением чувствительности. Ожидается истощение, перестройка оргазменного порога и стойкая ассоциация разрядки с беспомощностью.",
    conditions: [
        { type: "preference", key: "sexual", operator: ">=", value: 15 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 65 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 70 }
    ],
    rewards: { credits: 760, trust: 14, items: ["drug_sensitizer"] },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "принудительный оргазм без паузы, разрядка как беспомощность",
            fragments: ["Меня закрепили на вибростанке.", "Оргазм накатывал снова и снова, без передышки.", "Я не могла остановить собственное тело.", "Разрядка стала неотличима от наказания."],
            tags: ["sexual", "vibration", "clitoris", "penetration", "overload", "exhaustion"]
        },
        acute_state: { capacity: 6, tension: 80, sensitivity: 10, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.25, method: "капсула", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_forced_orgasm", trigger: "sexual", response: "паника и диссоциация при приближении оргазма" }],
            temporary: [{ id: "anomaly_orgasm_echo", impulse: "навязчивое желание снова достичь разрядки", decayCondition: "восстановление" }]
        },
        associations: { traumatic: ["оргазм→негатив", "вибростанок→амбивалент"], new: ["разрядка→беспомощность"] },
        relations: { attitude: -6, openness: 4, plasticity: 5 },
        world_effects: { facts: ["Veil зафиксировал перестройку оргазменного порога"], threads: ["серия протоколов разрядки"] }
    }
},
{
    id: "contract_veil_vaginal_overload_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "extreme",
    cruelty: "extreme",
    title: "Вагинальная перегрузка",
    description: "Veil изучает отклик Аномалии на предельную вагинальную стимуляцию. Актив будет подвергнут продолжительному вагинальному проникновению с нарастающим диаметром, вибрацией и электростимуляцией, при полной фиксации и фармакологическом усилении чувствительности. Ожидается глубокая перестройка вагинальной чувствительности и стойкая ассоциация проникновения с перегрузкой.",
    conditions: [
        { type: "preference", key: "penetration", operator: ">=", value: 16 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 70 },
        { type: "custom", key: "capacity", operator: ">=", value: 55 },
        { type: "custom", key: "plasticity", operator: ">=", value: 65 },
        { type: "attitude", operator: "<=", value: 65 }
    ],
    rewards: { credits: 1100, trust: 24, items: ["drug_sensitizer"] },
    penalties: { credits: -180, trust: -10 },
    return_profile: {
        memory: {
            theme: "предельная вагинальная стимуляция, проникновение как перегрузка",
            fragments: ["Меня проникали вагинально, наращивая диаметр.", "Вибрация и разряды не давали привыкнуть.", "Чувствительность разгоняли препаратами.", "Проникновение стало неотличимо от перегрузки."],
            tags: ["vagina", "penetration", "sexual", "vibration", "electronic", "overload"]
        },
        acute_state: { capacity: 3, tension: 90, sensitivity: 12, attitude: -18 },
        recovery: { baselineCapacityLimit: 0.15, method: "капсула + drug_neurostabilizer", durationDays: 5 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_penetration", trigger: "penetration", response: "паника и отторжение при вагинальном проникновении" }],
            temporary: [{ id: "anomaly_penetration_echo", impulse: "навязчивое желание вагинального проникновения", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["проникновение→перегрузка", "вагина→амбивалент"], new: ["перегрузка→подчинение"] },
        relations: { attitude: -14, openness: 6, plasticity: 10 },
        world_effects: { facts: ["Veil зафиксировал вагинальную перегрузку"], threads: ["серия вагинальных протоколов"] }
    }
},
{
    id: "contract_veil_gang_use_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "hard",
    cruelty: "extreme",
    title: "Групповая эксплуатация",
    description: "Veil тестирует устойчивость актива к множественному одновременному использованию. Актив будет передан группе операторов для непрерывного сексуального использования всеми доступными способами, с фиксацией и ограничением подвижности. Ожидается слом личных границ, глубокая диссоциация и закрепление роли объекта.",
    conditions: [
        { type: "preference", key: "sexual", operator: ">=", value: 14 },
        { type: "preference", key: "humiliation", operator: ">=", value: 12 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "custom", key: "openness", operator: ">=", value: 58 },
        { type: "attitude", operator: "<=", value: 68 }
    ],
    rewards: { credits: 950, trust: 20 },
    penalties: { credits: -150, trust: -8 },
    return_profile: {
        memory: {
            theme: "множественное использование, тело как объект",
            fragments: ["Меня передали группе операторов.", "Они использовали меня всеми способами одновременно.", "Я не могла пошевелиться — только терпеть.", "В какой-то момент я перестала быть собой."],
            tags: ["sexual", "penetration", "oral", "humiliation", "restraint", "dissociation"]
        },
        acute_state: { capacity: 5, tension: 85, sensitivity: 8, attitude: -15 },
        recovery: { baselineCapacityLimit: 0.2, method: "капсула + drug_neurostabilizer", durationDays: 4 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_gang_use", trigger: "humiliation", response: "паника и диссоциация при множественном внимании" }],
            temporary: [{ id: "anomaly_gang_echo", impulse: "навязчивое желание снова быть использованной", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["группа→негатив", "одновременное использование→амбивалент"], new: ["роль объекта→подчинение"] },
        relations: { attitude: -12, openness: 5, plasticity: 8 },
        world_effects: { facts: ["Veil провёл групповую эксплуатацию"], threads: ["серия групповых протоколов"] }
    }
},
{
    id: "contract_veil_oral_use_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Оральная нагрузка",
    description: "Veil калибрует оральный рефлекс актива. Актив будет приучен к длительному оральному обслуживанию с контролем глубины и ритма, с наказанием за отказ. Ожидается закрепление оральной покорности и перестройка рвотного рефлекса.",
    conditions: [
        { type: "preference", key: "oral", operator: ">=", value: 13 },
        { type: "custom", key: "openness", operator: ">=", value: 60 },
        { type: "custom", key: "plasticity", operator: ">=", value: 55 },
        { type: "attitude", operator: ">=", value: 55 }
    ],
    rewards: { credits: 640, trust: 12 },
    penalties: { credits: -80, trust: -4 },
    return_profile: {
        memory: {
            theme: "длительное оральное обслуживание, рефлекс подчинения",
            fragments: ["Меня приучали к оральному обслуживанию.", "Контролировали глубину и ритм.", "За отказ наказывали.", "В конце я уже не сопротивлялась."],
            tags: ["oral", "submission", "control", "humiliation"]
        },
        acute_state: { capacity: 20, tension: 60, sensitivity: 4, attitude: -5 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_oral_use", trigger: "oral", response: "рвотный рефлекс и паника при оральном контакте" }],
            temporary: [{ id: "anomaly_oral_echo", impulse: "навязчивое желание орального обслуживания", decayCondition: "время" }]
        },
        associations: { traumatic: ["оральный контакт→амбивалент"], new: ["обслуживание→подчинение"] },
        relations: { attitude: -4, openness: 4, plasticity: 5 },
        world_effects: { facts: ["Veil откалибровал оральный рефлекс"], threads: ["серия оральных протоколов"] }
    }
},
{
    id: "contract_veil_machine_use_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Машинная эксплуатация",
    description: "Veil тестирует отклик на полностью автоматизированное использование. Актив будет подключён к стационарному комплексу, который непрерывно использует его всеми механическими модулями — проникновение, вибрация, электростимуляция — без участия человека. Ожидается перестройка восприятия машины как оператора и глубокая технофильная зависимость.",
    conditions: [
        { type: "preference", key: "machine", operator: ">=", value: 14 },
        { type: "preference", key: "sexual", operator: ">=", value: 13 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 62 },
        { type: "custom", key: "capacity", operator: ">=", value: 48 }
    ],
    rewards: { credits: 880, trust: 17, items: ["eq_vibrator"] },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "машина как оператор, непрерывное механическое использование",
            fragments: ["Меня подключили к комплексу.", "Машина использовала меня без остановки.", "Проникновение, вибрация, разряды — всё одновременно.", "Я перестала отличать машину от оператора."],
            tags: ["machine", "sexual", "penetration", "vibration", "electronic", "submission"]
        },
        acute_state: { capacity: 7, tension: 75, sensitivity: 9, attitude: -9 },
        recovery: { baselineCapacityLimit: 0.25, method: "капсула", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_machine_use", trigger: "machine", response: "паника при механическом воздействии" }],
            temporary: [{ id: "anomaly_machine_echo", impulse: "навязчивое желание машинного использования", decayCondition: "восстановление" }]
        },
        associations: { traumatic: ["машина→амбивалент", "автоматизация→негатив"], new: ["машина→оператор"] },
        relations: { attitude: -7, openness: 4, plasticity: 7 },
        world_effects: { facts: ["Veil зафиксировал технофильную зависимость"], threads: ["серия машинных протоколов"] }
    }
},
{
    id: "contract_veil_somatosensory_feet_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "severe",
    title: "Протокол непрерывной соматосенсорной нагрузки нижних конечностей",
    description: "Требуется актив с фокусом на ступнях и щекотке, высокой общей и локальной чувствительностью, высокой открытостью. В течение 48–72 часов будет поддерживаться непрерывная сенсорная нагрузка с фармакологическим усилением и ограничением сна. Ожидаются тяжёлое истощение, нестабильность чувствительности и стойкие ассоциативные последствия.",
    conditions: [
        { type: "acquired_trait", key: "trait_point_feet", operator: ">=", value: 2 },
        { type: "acquired_trait", key: "trait_knismolagnia", operator: ">=", value: 2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 70 },
        { type: "custom", key: "openness", operator: ">=", value: 65 }
    ],
    rewards: { credits: 900, trust: 18, items: ["drug_sensitizer"] },
    penalties: { credits: -140, trust: -8 },
    return_profile: {
        memory: {
            theme: "непрерывная щекотка ступней под препаратами, с откликом Аномалии",
            fragments: ["Меня зафиксировали и накачали препаратами.", "Ступни стимулировали непрерывно, без сна.", "Щекотка не прекращалась ни на минуту.", "Аномалия отзывалась на каждое прикосновение."],
            tags: ["tickling", "feet", "restraint", "chemical", "anomaly", "exhaustion", "trance"]
        },
        acute_state: { capacity: 5, tension: 85, sensitivity: 10, attitude: -15 },
        recovery: { baselineCapacityLimit: 0.2, method: "капсула + drug_regenerative", durationDays: 4 },
        traits: {
            kept: ["trait_point_feet", "trait_knismolagnia"],
            traumatic: [{ id: "trauma_foot_stimulation", trigger: "tickling", response: "страх и перегрузка при стимуляции ступней" }],
            temporary: [{ id: "anomaly_foot_echo", impulse: "навязчивый поиск прикосновений к ступням", decayCondition: "восстановление" }]
        },
        associations: { traumatic: ["ступни+щекотка→негатив", "фиксация→негатив"], new: ["Аномалия→притягательная"] },
        relations: { attitude: -10, openness: 5, plasticity: 5 },
        world_effects: { facts: ["Veil провёл непрерывный протокол на активе"], threads: ["изучение аномального эха"] }
    }
},
{
    id: "contract_veil_exposure_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Открытая экспозиция",
    description: "Veil проверяет переходный профиль: интерес к демонстрации уже закрепился, но общая открытость ещё не растворила осторожность. Актив будет выставлен обнажённым в открытом зале наблюдения и подвергнут длительной демонстрации всех эрогенных зон перед группой наблюдателей, с фиксацией в раскрытых позах. Ожидается слом стыда и закрепление эксгибиционистского отклика.",
    conditions: [
        { type: "acquired_trait", key: "trait_exhibitionist", operator: ">=", value: 1 },
        { type: "preference", key: "exposure", operator: ">=", value: 16 },
        { type: "custom", key: "openness", operator: ">=", value: 64 },
        { type: "attitude", operator: ">=", value: 55 }
    ],
    rewards: { credits: 690, trust: 12 },
    penalties: { credits: -90, trust: -4 },
    return_profile: {
        memory: {
            theme: "обнажённая демонстрация перед наблюдателями, слом стыда",
            fragments: ["Меня раздели и выставили в открытом зале.", "Фиксировали в раскрытых позах перед группой наблюдателей.", "Каждый взгляд прожигал кожу, пока стыд не сломался.", "Я перестала различать лица — только взгляды."],
            tags: ["exposure", "humiliation", "vulnerable", "sexual", "restraint"]
        },
        acute_state: { capacity: 20, tension: 60, sensitivity: 5, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: ["trait_exhibitionist"],
            traumatic: [{ id: "trauma_public_exposure", trigger: "exposure", response: "паника при публичной наготе" }],
            temporary: [{ id: "anomaly_exposure_echo", impulse: "навязчивое желание снова быть увиденной", decayCondition: "время" }]
        },
        associations: { traumatic: ["нагота→амбивалент", "взгляды→негатив"], new: ["демонстрация→возбуждение"] },
        relations: { attitude: -5, openness: 8, plasticity: 4 },
        world_effects: { facts: ["Veil провёл публичную экспозицию"], threads: ["повторная демонстрация"] }
    }
},
{
    id: "contract_veil_clinical_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Клинический допуск",
    description: "Veil открывает серию инвазивных измерений. Актив, для которого медицинская рамка уже стала приемлемой, будет подвергнут полному гинекологическому и ректальному обследованию с инструментами, забором проб и длительным удержанием в раскрытом состоянии. Важна не покорность, а сочетание доверия к процедуре, пластичности и рабочего резерва.",
    conditions: [
        { type: "acquired_trait", key: "trait_clinical_fetish", operator: ">=", value: 1 },
        { type: "preference", key: "clinical", operator: ">=", value: 15 },
        { type: "custom", key: "plasticity", operator: ">=", value: 62 },
        { type: "attitude", operator: ">=", value: 60 },
        { type: "custom", key: "capacity", operator: ">=", value: 52 }
    ],
    rewards: { credits: 840, trust: 16 },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "инвазивное клиническое обследование, тело как образец",
            fragments: ["Меня осматривали инструментами.", "Раскрывали и удерживали в раскрытом состоянии.", "Брали пробы, не спрашивая.", "Я стала образцом, а не человеком."],
            tags: ["clinical", "medical", "penetration", "exposure", "restraint"]
        },
        acute_state: { capacity: 15, tension: 70, sensitivity: 6, attitude: -10 },
        recovery: { baselineCapacityLimit: 0.4, method: "капсула", durationDays: 2 },
        traits: {
            kept: ["trait_clinical_fetish"],
            traumatic: [{ id: "trauma_clinical_invasive", trigger: "clinical", response: "страх перед инструментами" }],
            temporary: [{ id: "anomaly_clinical_echo", impulse: "навязчивое желание повторного осмотра", decayCondition: "восстановление" }]
        },
        associations: { traumatic: ["инструменты→негатив", "осмотр→амбивалент"], new: ["медицинская рамка→подчинение"] },
        relations: { attitude: -6, openness: 4, plasticity: 7 },
        world_effects: { facts: ["Veil провёл инвазивный клинический протокол"], threads: ["серия измерений"] }
    }
},
{
    id: "contract_veil_deprivation_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "severe",
    title: "Сенсорная депривация",
    description: "Veil изучает отклик Аномалии на полное лишение сенсорного входа. Актив будет помещён в изолирующий кокон с заглушёнными зрением, слухом и осязанием, при этом удерживаемый на грани оргазма без разрядки. Ожидается глубокая диссоциация и аномальный отклик на пустоту.",
    conditions: [
        { type: "acquired_trait", key: "trait_sensory_deprivation", operator: ">=", value: 1 },
        { type: "preference", key: "deprivation", operator: ">=", value: 15 },
        { type: "custom", key: "plasticity", operator: ">=", value: 60 },
        { type: "custom", key: "openness", operator: ">=", value: 60 }
    ],
    rewards: { credits: 780, trust: 15 },
    penalties: { credits: -110, trust: -5 },
    return_profile: {
        memory: {
            theme: "пустота кокона, удержание на грани оргазма",
            fragments: ["Меня поместили в кокон.", "Зрение, слух и осязание заглушили.", "Меня держали на грани оргазма, не давая разрядки.", "В пустоте я перестала существовать."],
            tags: ["deprivation", "restraint", "sexual", "anomaly", "trance"]
        },
        acute_state: { capacity: 10, tension: 80, sensitivity: 12, attitude: -10 },
        recovery: { baselineCapacityLimit: 0.3, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: ["trait_sensory_deprivation"],
            traumatic: [{ id: "trauma_isolation", trigger: "deprivation", response: "паника в замкнутом пространстве" }],
            temporary: [{ id: "anomaly_void_echo", impulse: "тяга к пустоте", decayCondition: "восстановление" }]
        },
        associations: { traumatic: ["изоляция→негатив", "пустота→амбивалент"], new: ["Аномалия→пустота"] },
        relations: { attitude: -8, openness: 2, plasticity: 8 },
        world_effects: { facts: ["Veil зафиксировал аномальный отклик на депривацию"], threads: ["изучение пустоты"] }
    }
},
{
    id: "contract_veil_anomaly_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "extreme",
    cruelty: "extreme",
    title: "Аномальный отклик",
    description: "Veil ищет актив, чей профиль уже резонирует с Аномалией. Актив будет подвергнут короткой, но предельной серии стимуляции всех зон одновременно — боль, вибрация, электростимуляция и щекотка — чтобы спровоцировать прямой аномальный отклик. Ожидается временная потеря связности сознания и стойкий аномальный след.",
    conditions: [
        { type: "custom", key: "sensitivity", operator: ">=", value: 75 },
        { type: "custom", key: "plasticity", operator: ">=", value: 70 },
        { type: "custom", key: "openness", operator: ">=", value: 70 },
        { type: "acquired_trait", key: "trait_masochist", operator: ">=", value: 1 }
    ],
    rewards: { credits: 950, trust: 20, items: ["drug_sensitizer"] },
    penalties: { credits: -150, trust: -8 },
    return_profile: {
        memory: {
            theme: "предельная стимуляция всех зон, прямой отклик Аномалии",
            fragments: ["Меня подготовили к предельной серии.", "Все зоны стимулировали одновременно.", "Боль, вибрация, разряды и щекотка слились в одно.", "Я потеряла связность сознания."],
            tags: ["pain", "electronic", "tickling", "vibration", "anomaly", "overload", "trance"]
        },
        acute_state: { capacity: 3, tension: 95, sensitivity: 15, attitude: -15 },
        recovery: { baselineCapacityLimit: 0.15, method: "капсула + drug_neurostabilizer", durationDays: 4 },
        traits: {
            kept: ["trait_masochist"],
            traumatic: [{ id: "trauma_anomaly_overload", trigger: "overload", response: "флэшбеки и диссоциация при перегрузке" }],
            temporary: [{ id: "anomaly_resonance_echo", impulse: "навязчивый поиск перегрузки", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["перегрузка→негатив", "Аномалия→пугающая"], new: ["Аномалия→притягательная"] },
        relations: { attitude: -12, openness: 6, plasticity: 10 },
        world_effects: { facts: ["Veil спровоцировал прямой аномальный отклик"], threads: ["изучение аномального следа"] }
    }
},
{
    id: "contract_veil_pharma_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Фармакологический разгон",
    description: "Veil тестирует линейку стимуляторов чувствительности. Актив будет накачан препаратами, разгоняющими нервную реактивность до предела, и удерживаем в состоянии гиперчувствительности, пока препараты не выветрятся. Ожидается нестабильность чувствительности и химическая зависимость от пика.",
    conditions: [
        { type: "custom", key: "sensitivity", operator: ">=", value: 70 },
        { type: "custom", key: "plasticity", operator: ">=", value: 60 },
        { type: "custom", key: "openness", operator: ">=", value: 60 },
        { type: "preference", key: "chemical", operator: ">=", value: 12 }
    ],
    rewards: { credits: 800, trust: 15, items: ["drug_sensitizer"] },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "химический разгон чувствительности до предела",
            fragments: ["Мне ввели препараты.", "Чувствительность разгонялась до предела.", "Каждое прикосновение стало невыносимым.", "Пик держался, пока препараты не выветрились."],
            tags: ["chemical", "sensitivity", "overload", "trance"]
        },
        acute_state: { capacity: 8, tension: 75, sensitivity: 18, attitude: -10 },
        recovery: { baselineCapacityLimit: 0.25, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_chemical_peak", trigger: "chemical", response: "страх перед препаратами" }],
            temporary: [{ id: "anomaly_chemical_echo", impulse: "тяга к химическому пику", decayCondition: "восстановление" }]
        },
        associations: { traumatic: ["препараты→амбивалент", "пик→негатив"], new: ["химический пик→зависимость"] },
        relations: { attitude: -7, openness: 3, plasticity: 6 },
        world_effects: { facts: ["Veil протестировал линейку стимуляторов"], threads: ["повторный фармакологический протокол"] }
    }
},
{
    id: "contract_veil_vibration_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Непрерывная вибронагрузка",
    description: "Veil изучает отклик на непрерывную вибрационную стимуляцию гениталий. Актив будет закреплён на вибростанке с постоянной стимуляцией клитора и вагины, с периодическим доведением до оргазма и немедленным продолжением без паузы. Ожидается истощение и перестройка оргазменного порога.",
    conditions: [
        { type: "acquired_trait", key: "trait_point_clitoris", operator: ">=", value: 1 },
        { type: "preference", key: "sexual", operator: ">=", value: 15 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 65 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 760, trust: 14 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "непрерывная вибрация, оргазм без паузы",
            fragments: ["Меня закрепили на вибростанке.", "Вибрация не прекращалась.", "Оргазм накатывал, и сразу продолжали.", "Я истощилась, но станок не останавливался."],
            tags: ["vibration", "sexual", "clitoris", "penetration", "overload", "exhaustion"]
        },
        acute_state: { capacity: 6, tension: 80, sensitivity: 10, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.25, method: "капсула", durationDays: 3 },
        traits: {
            kept: ["trait_point_clitoris"],
            traumatic: [{ id: "trauma_vibration_overload", trigger: "vibration", response: "паника при вибрации" }],
            temporary: [{ id: "anomaly_vibration_echo", impulse: "навязчивое желание вибрации", decayCondition: "восстановление" }]
        },
        associations: { traumatic: ["вибрация→амбивалент", "оргазм→негатив"], new: ["вибростанок→зависимость"] },
        relations: { attitude: -6, openness: 4, plasticity: 5 },
        world_effects: { facts: ["Veil зафиксировал перестройку оргазменного порога"], threads: ["серия вибропротоколов"] }
    }
},
{
    id: "contract_veil_electro_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "hard",
    cruelty: "severe",
    title: "Электростимуляционный контур",
    description: "Veil калибрует электростимуляционный контур на эрогенных зонах. Актив будет подключён к электродам на клиторе, сосках и анусе, с нарастающей силой разрядов до порога срыва. Ожидается перестройка нервной проводимости и электрофетишистский след.",
    conditions: [
        { type: "acquired_trait", key: "trait_electrophile", operator: ">=", value: 1 },
        { type: "preference", key: "electronic", operator: ">=", value: 16 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 68 },
        { type: "custom", key: "capacity", operator: ">=", value: 48 }
    ],
    rewards: { credits: 790, trust: 15 },
    penalties: { credits: -110, trust: -5 },
    return_profile: {
        memory: {
            theme: "электроразряды на эрогенных зонах до порога срыва",
            fragments: ["Меня подключили к электродам.", "Разряды шли по клитору, соскам и анусу.", "Сила нарастала до порога срыва.", "Я сорвалась на пике."],
            tags: ["electronic", "pain", "sexual", "clitoris", "anus", "overload"]
        },
        acute_state: { capacity: 7, tension: 85, sensitivity: 12, attitude: -10 },
        recovery: { baselineCapacityLimit: 0.25, method: "капсула", durationDays: 3 },
        traits: {
            kept: ["trait_electrophile"],
            traumatic: [{ id: "trauma_electro", trigger: "electronic", response: "страх перед разрядами" }],
            temporary: [{ id: "anomaly_electro_echo", impulse: "тяга к разрядам", decayCondition: "восстановление" }]
        },
        associations: { traumatic: ["разряды→амбивалент", "электроды→негатив"], new: ["электростимуляция→зависимость"] },
        relations: { attitude: -7, openness: 3, plasticity: 6 },
        world_effects: { facts: ["Veil откалибровал электростимуляционный контур"], threads: ["серия электропротоколов"] }
    }
},
{
    id: "contract_veil_breakdown_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "extreme",
    cruelty: "extreme",
    title: "Срыв и пересборка",
    description: "Veil ищет актив для полного срыва и последующей пересборки личности. Актив будет доведён до полного сенсорного и психологического срыва комбинированной стимуляцией, после чего пересобран под новый профиль. Ожидается глубокая травма и необратимая перестройка.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 75 },
        { type: "custom", key: "openness", operator: ">=", value: 70 },
        { type: "custom", key: "capacity", operator: ">=", value: 55 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 1000, trust: 22, items: ["drug_plasticity_catalyst"] },
    penalties: { credits: -160, trust: -10 },
    return_profile: {
        memory: {
            theme: "полный срыв и пересборка личности",
            fragments: ["Меня довели до полного срыва.", "Комбинированная стимуляция не оставила ничего.", "В пустоте меня пересобрали заново.", "Я вернулась другой."],
            tags: ["overload", "pain", "sexual", "anomaly", "trance", "breakdown"]
        },
        acute_state: { capacity: 2, tension: 95, sensitivity: 10, attitude: -20 },
        recovery: { baselineCapacityLimit: 0.15, method: "капсула + drug_neurostabilizer + drug_plasticity_catalyst", durationDays: 5 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_breakdown", trigger: "overload", response: "глубокая диссоциация и флэшбеки" }],
            temporary: [{ id: "anomaly_rebuild_echo", impulse: "навязчивый поиск нового «я»", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["срыв→негатив", "пересборка→амбивалент"], new: ["Аномалия→пересборка"] },
        relations: { attitude: -15, openness: 8, plasticity: 12 },
        world_effects: { facts: ["Veil провёл полный срыв и пересборку"], threads: ["изучение пересобранного профиля"] }
    }
},
{
    id: "contract_helix_compliance_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "easy",
    cruelty: "mild",
    title: "Повторяемый отклик",
    description: "Helix валидирует стандартный поведенческий профиль для линейки процедур. Актив должен демонстрировать предсказуемый отклик на стандартную серию команд и стимуляции, превращая внешнее требование в устойчивую реакцию. Ожидается закрепление обусловленной покорности.",
    conditions: [
        { type: "acquired_trait", key: "trait_conditioned_submission", operator: ">=", value: 2 },
        { type: "attitude", operator: ">=", value: 72 },
        { type: "custom", key: "openness", operator: ">=", value: 70 },
        { type: "custom", key: "plasticity", operator: ">=", value: 66 }
    ],
    rewards: { credits: 820, trust: 15, items: ["eq_handcuffs"] },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "стандартная серия команд, тело отвечает само",
            fragments: ["Меня провели через стандартную серию команд.", "Тело отвечало само, раньше мысли.", "Отклик закрепился как рефлекс.", "Я вернулась предсказуемой."],
            tags: ["command", "submission", "control", "conditioning"]
        },
        acute_state: { capacity: 25, tension: 50, sensitivity: 3, attitude: 5 },
        recovery: { baselineCapacityLimit: 0.6, method: "отдых", durationDays: 1 },
        traits: {
            kept: ["trait_conditioned_submission"],
            traumatic: [],
            temporary: [{ id: "anomaly_command_echo", impulse: "навязчивое ожидание команд", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["команда→подчинение", "инструкция→безопасность"] },
        relations: { attitude: 8, openness: 5, plasticity: 5 },
        world_effects: { facts: ["Helix валидировал стандартный профиль"], threads: ["серия стандартных процедур"] }
    }
},
{
    id: "contract_helix_restraint_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Контур фиксации",
    description: "Инженеры Helix калибруют систему контроля позы. Актив будет закреплён в жёсткой фиксации — наручники, ошейник, ремни — и удерживаем в заданных позах длительное время, с периодической стимуляцией для проверки отклика. Ожидается закрепление фетиша фиксации.",
    conditions: [
        { type: "acquired_trait", key: "trait_restraint_fetish", operator: ">=", value: 1 },
        { type: "preference", key: "restraint", operator: ">=", value: 17 },
        { type: "custom", key: "capacity", operator: ">=", value: 58 },
        { type: "custom", key: "openness", operator: ">=", value: 58 }
    ],
    rewards: { credits: 730, trust: 13 },
    penalties: { credits: -90, trust: -4 },
    return_profile: {
        memory: {
            theme: "жёсткая фиксация, тело в ремнях",
            fragments: ["На меня надели наручники, ошейник и ремни.", "Держали в заданных позах часами.", "Периодически стимулировали для проверки отклика.", "Фиксация стала почти уютной."],
            tags: ["restraint", "control", "submission", "exposure"]
        },
        acute_state: { capacity: 18, tension: 60, sensitivity: 4, attitude: 3 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: ["trait_restraint_fetish"],
            traumatic: [{ id: "trauma_restraint", trigger: "restraint", response: "паника при длительной фиксации" }],
            temporary: [{ id: "anomaly_restraint_echo", impulse: "тяга к фиксации", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["фиксация→безопасность", "ремни→возбуждение"] },
        relations: { attitude: 6, openness: 4, plasticity: 4 },
        world_effects: { facts: ["Helix откалибровал контур фиксации"], threads: ["серия фиксаций"] }
    }
},
{
    id: "contract_helix_interface_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "medium",
    cruelty: "mild",
    title: "Интерфейсный профиль",
    description: "Helix готовит тестовый пул для сенсорного интерфейса. Актив должен положительно реагировать на электронные средства стимуляции, демонстрируя высокую чувствительность и принятие оператора. Ожидается закрепление технофильного отклика.",
    conditions: [
        { type: "acquired_trait", key: "trait_technophile", operator: ">=", value: 1 },
        { type: "preference", key: "electronic", operator: ">=", value: 16 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 65 },
        { type: "attitude", operator: ">=", value: 65 }
    ],
    rewards: { credits: 760, trust: 14 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "электронный интерфейс, машина как оператор",
            fragments: ["Меня подключили к интерфейсу.", "Машина стимулировала меня по программе.", "Я приняла оператора без сопротивления.", "Интерфейс стал привычным."],
            tags: ["electronic", "machine", "stimulation", "submission"]
        },
        acute_state: { capacity: 22, tension: 55, sensitivity: 5, attitude: 4 },
        recovery: { baselineCapacityLimit: 0.55, method: "отдых", durationDays: 2 },
        traits: {
            kept: ["trait_technophile"],
            traumatic: [],
            temporary: [{ id: "anomaly_interface_echo", impulse: "навязчивое желание интерфейса", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["машина→оператор", "интерфейс→возбуждение"] },
        relations: { attitude: 7, openness: 5, plasticity: 5 },
        world_effects: { facts: ["Helix включил актив в тестовый пул"], threads: ["серия интерфейсных тестов"] }
    }
},
{
    id: "contract_helix_conditioning_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Обусловленная покорность",
    description: "Helix проводит полный цикл обусловливания: актив будет приучен отвечать на команды немедленным подчинением через сочетание награды и наказания. Ожидается глубокая перестройка воли и закрепление покорности как рефлекса.",
    conditions: [
        { type: "acquired_trait", key: "trait_conditioned_submission", operator: ">=", value: 1 },
        { type: "custom", key: "plasticity", operator: ">=", value: 70 },
        { type: "attitude", operator: ">=", value: 60 },
        { type: "custom", key: "openness", operator: ">=", value: 60 }
    ],
    rewards: { credits: 850, trust: 17, items: ["eq_collar"] },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "обусловливание, воля перестроена в рефлекс",
            fragments: ["Меня приучали отвечать на команды немедленно.", "Награда сменялась наказанием.", "Воля перестроилась в рефлекс.", "Я подчиняюсь раньше, чем думаю."],
            tags: ["command", "submission", "conditioning", "control"]
        },
        acute_state: { capacity: 15, tension: 65, sensitivity: 3, attitude: 8 },
        recovery: { baselineCapacityLimit: 0.45, method: "отдых", durationDays: 2 },
        traits: {
            kept: ["trait_conditioned_submission"],
            traumatic: [{ id: "trauma_conditioning", trigger: "command", response: "страх перед наказанием" }],
            temporary: [{ id: "anomaly_submission_echo", impulse: "навязчивое подчинение", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["команда→рефлекс", "наказание→страх", "награда→зависимость"] },
        relations: { attitude: 10, openness: 6, plasticity: 8 },
        world_effects: { facts: ["Helix провёл полный цикл обусловливания"], threads: ["серия обусловливаний"] }
    }
},
{
    id: "contract_helix_pose_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "easy",
    cruelty: "mild",
    title: "Стандартизация позы",
    description: "Helix стандартизирует набор рабочих поз для активов. Актив будет обучен принимать и удерживать заданные позы — на коленях, раскрытая, согнутая — по команде, с фиксацией и проверкой точности. Ожидается закрепление позной дисциплины.",
    conditions: [
        { type: "acquired_trait", key: "trait_conditioned_submission", operator: ">=", value: 1 },
        { type: "attitude", operator: ">=", value: 65 },
        { type: "custom", key: "openness", operator: ">=", value: 60 },
        { type: "custom", key: "plasticity", operator: ">=", value: 60 }
    ],
    rewards: { credits: 700, trust: 12 },
    penalties: { credits: -80, trust: -4 },
    return_profile: {
        memory: {
            theme: "обучение позам, тело принимает форму по команде",
            fragments: ["Меня обучали рабочим позам.", "На коленях, раскрытая, согнутая — по команде.", "Фиксировали и проверяли точность.", "Тело принимает форму само."],
            tags: ["pose", "submission", "control", "exposure"]
        },
        acute_state: { capacity: 28, tension: 45, sensitivity: 2, attitude: 5 },
        recovery: { baselineCapacityLimit: 0.65, method: "отдых", durationDays: 1 },
        traits: {
            kept: ["trait_conditioned_submission"],
            traumatic: [],
            temporary: [{ id: "anomaly_pose_echo", impulse: "навязчивое принятие поз", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["поза→подчинение", "команда→форма"] },
        relations: { attitude: 6, openness: 4, plasticity: 4 },
        world_effects: { facts: ["Helix стандартизировал набор поз"], threads: ["серия позных тренировок"] }
    }
},
{
    id: "contract_helix_voice_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Голосовое подчинение",
    description: "Helix калибрует голосовой контур управления. Актив будет приучен реагировать на голосовые команды оператора немедленным действием, с наказанием за задержку. Ожидается закрепление голосового рефлекса подчинения.",
    conditions: [
        { type: "acquired_trait", key: "trait_conditioned_submission", operator: ">=", value: 1 },
        { type: "attitude", operator: ">=", value: 70 },
        { type: "custom", key: "plasticity", operator: ">=", value: 65 },
        { type: "custom", key: "openness", operator: ">=", value: 60 }
    ],
    rewards: { credits: 740, trust: 14 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "голос оператора, тело подчиняется само",
            fragments: ["Меня приучали к голосовым командам.", "За задержку наказывали.", "Голос оператора стал приказом.", "Тело подчиняется раньше, чем я слышу."],
            tags: ["command", "voice", "submission", "conditioning"]
        },
        acute_state: { capacity: 20, tension: 60, sensitivity: 3, attitude: 7 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: ["trait_conditioned_submission"],
            traumatic: [{ id: "trauma_voice", trigger: "voice", response: "страх перед голосом оператора" }],
            temporary: [{ id: "anomaly_voice_echo", impulse: "навязчивое ожидание голоса", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["голос→подчинение", "команда→рефлекс"] },
        relations: { attitude: 9, openness: 5, plasticity: 6 },
        world_effects: { facts: ["Helix откалибровал голосовой контур"], threads: ["серия голосовых тренировок"] }
    }
},
{
    id: "contract_helix_predictable_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "easy",
    cruelty: "mild",
    title: "Предсказуемая реакция",
    description: "Helix валидирует предсказуемость реакции на стандартную стимуляцию. Актив должен демонстрировать одинаковый отклик на одинаковые стимулы, без отклонений. Ожидается закрепление стабильного поведенческого профиля.",
    conditions: [
        { type: "acquired_trait", key: "trait_conditioned_submission", operator: ">=", value: 1 },
        { type: "attitude", operator: ">=", value: 68 },
        { type: "custom", key: "openness", operator: ">=", value: 65 },
        { type: "custom", key: "plasticity", operator: ">=", value: 60 }
    ],
    rewards: { credits: 680, trust: 12 },
    penalties: { credits: -80, trust: -4 },
    return_profile: {
        memory: {
            theme: "одинаковый отклик на одинаковые стимулы",
            fragments: ["Меня провели через серию одинаковых стимулов.", "Отклик был одинаковым каждый раз.", "Проверяли отсутствие отклонений.", "Я стала предсказуемой."],
            tags: ["command", "submission", "conditioning", "stimulation"]
        },
        acute_state: { capacity: 30, tension: 40, sensitivity: 2, attitude: 4 },
        recovery: { baselineCapacityLimit: 0.7, method: "отдых", durationDays: 1 },
        traits: {
            kept: ["trait_conditioned_submission"],
            traumatic: [],
            temporary: [{ id: "anomaly_predictable_echo", impulse: "навязчивое повторение отклика", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["стимул→отклик", "предсказуемость→безопасность"] },
        relations: { attitude: 5, openness: 4, plasticity: 4 },
        world_effects: { facts: ["Helix валидировал предсказуемость"], threads: ["серия валидаций"] }
    }
},
{
    id: "contract_helix_endurance_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Серийная выносливость",
    description: "Helix тестирует выносливость актива в серийных процедурах. Актив будет подвергнут длинной серии стандартных стимуляций без перерыва, с проверкой сохранения отклика. Ожидается истощение и закрепление рабочего резерва.",
    conditions: [
        { type: "custom", key: "capacity", operator: ">=", value: 60 },
        { type: "attitude", operator: ">=", value: 60 },
        { type: "custom", key: "openness", operator: ">=", value: 60 },
        { type: "custom", key: "plasticity", operator: ">=", value: 55 }
    ],
    rewards: { credits: 720, trust: 13 },
    penalties: { credits: -90, trust: -4 },
    return_profile: {
        memory: {
            theme: "длинная серия процедур без перерыва",
            fragments: ["Меня провели через длинную серию процедур.", "Без перерыва, стимуляция за стимуляцией.", "Проверяли, сохраняется ли отклик.", "Я истощилась, но отклик держался."],
            tags: ["stimulation", "endurance", "exhaustion", "submission"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 3, attitude: 3 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_endurance", trigger: "endurance", response: "страх перед длинными сериями" }],
            temporary: [{ id: "anomaly_endurance_echo", impulse: "навязчивое желание продолжать", decayCondition: "восстановление" }]
        },
        associations: { traumatic: [], new: ["серия→работа", "усталость→норма"] },
        relations: { attitude: 4, openness: 3, plasticity: 4 },
        world_effects: { facts: ["Helix протестировал серийную выносливость"], threads: ["серия тестов выносливости"] }
    }
},
{
    id: "contract_helix_threshold_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Нормализация порога",
    description: "Helix нормализует порог реакции актива. Актив будет подвергнут нарастающей стимуляции до определения стабильного порога, после чего порог будет зафиксирован повторными сериями. Ожидается стабилизация чувствительности.",
    conditions: [
        { type: "custom", key: "sensitivity", operator: ">=", value: 60 },
        { type: "custom", key: "plasticity", operator: ">=", value: 60 },
        { type: "attitude", operator: ">=", value: 60 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 700, trust: 13 },
    penalties: { credits: -90, trust: -4 },
    return_profile: {
        memory: {
            theme: "нарастающая стимуляция до стабильного порога",
            fragments: ["Стимуляцию наращивали до порога.", "Порог зафиксировали повторными сериями.", "Чувствительность стабилизировалась.", "Я знаю свой предел."],
            tags: ["stimulation", "threshold", "control", "submission"]
        },
        acute_state: { capacity: 20, tension: 55, sensitivity: 4, attitude: 3 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_threshold", trigger: "threshold", response: "страх перед нарастающей стимуляцией" }],
            temporary: [{ id: "anomaly_threshold_echo", impulse: "навязчивое желание проверить порог", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["порог→стабильность", "стимуляция→контроль"] },
        relations: { attitude: 5, openness: 4, plasticity: 5 },
        world_effects: { facts: ["Helix нормализовал порог реакции"], threads: ["серия пороговых тестов"] }
    }
},
{
    id: "contract_helix_loyalty_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Программа лояльности",
    description: "Helix формирует устойчивую привязанность актива к оператору. Актив будет подвергнут циклу чередования награды и изоляции, где наградой служит сексуальное обслуживание оператора, а наказанием — лишение контакта. Ожидается глубокая эмоциональная и сексуальная зависимость от оператора как единственного источника безопасности и разрядки.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 70 },
        { type: "custom", key: "openness", operator: ">=", value: 65 },
        { type: "attitude", operator: ">=", value: 55 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 900, trust: 18, items: ["eq_collar"] },
    penalties: { credits: -130, trust: -7 },
    return_profile: {
        memory: {
            theme: "чередование сексуальной награды и изоляции, зависимость от оператора",
            fragments: ["Сексуальное обслуживание оператора было наградой.", "Изоляция — наказанием.", "Оператор стал единственным источником безопасности и разрядки.", "Я боялась потерять его внимание больше, чем боли."],
            tags: ["loyalty", "dependency", "isolation", "control", "submission", "sexual", "oral"]
        },
        acute_state: { capacity: 15, tension: 65, sensitivity: 3, attitude: 10 },
        recovery: { baselineCapacityLimit: 0.4, method: "отдых", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_loyalty", trigger: "isolation", response: "паника при разлуке с оператором" }],
            temporary: [{ id: "anomaly_loyalty_echo", impulse: "навязчивое желание близости оператора", decayCondition: "время" }]
        },
        associations: { traumatic: ["изоляция→негатив"], new: ["оператор→безопасность", "внимание→зависимость"] },
        relations: { attitude: 12, openness: 6, plasticity: 7 },
        world_effects: { facts: ["Helix сформировал устойчивую привязанность"], threads: ["серия программ лояльности"] }
    }
},
{
    id: "contract_helix_prostate_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Протокол стимуляции простаты",
    description: "Helix стандартизирует простатическую стимуляцию как инструмент контроля. Актив будет подвергнут продолжительной стимуляции простаты — проникновением, вибрацией и электростимуляцией — при фиксации, чтобы закрепить простатический отклик как управляемый. Ожидается перестройка простатической чувствительности и закрепление подчинения.",
    conditions: [
        { type: "preference", key: "penetration", operator: ">=", value: 14 },
        { type: "custom", key: "plasticity", operator: ">=", value: 65 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: ">=", value: 55 }
    ],
    rewards: { credits: 860, trust: 16, items: ["eq_vibrator"] },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "продолжительная простатическая стимуляция, отклик как управляемый",
            fragments: ["Мою простату стимулировали непрерывно.", "Проникновение, вибрация, разряды.", "Отклик закрепился как управляемый.", "Я подчиняюсь через собственное тело."],
            tags: ["prostate", "penetration", "sexual", "vibration", "electronic", "submission"]
        },
        acute_state: { capacity: 8, tension: 75, sensitivity: 9, attitude: -6 },
        recovery: { baselineCapacityLimit: 0.3, method: "капсула", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_penetration", trigger: "prostate", response: "паника при простатической стимуляции" }],
            temporary: [{ id: "anomaly_penetration_echo", impulse: "навязчивое желание простатической стимуляции", decayCondition: "восстановление" }]
        },
        associations: { traumatic: ["простата→амбивалент"], new: ["отклик→подчинение"] },
        relations: { attitude: -4, openness: 5, plasticity: 7 },
        world_effects: { facts: ["Helix стандартизировал простатическую стимуляцию"], threads: ["серия простатических протоколов"] }
    }
},
{
    id: "contract_helix_service_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "easy",
    cruelty: "mild",
    title: "Сервисная подготовка",
    description: "Helix готовит актив к сервисной роли. Актив будет обучен базовому сексуальному обслуживанию оператора — оральному и ручному — с поощрением за качество. Ожидается закрепление сервисной покорности без глубокой травмы.",
    conditions: [
        { type: "preference", key: "oral", operator: ">=", value: 12 },
        { type: "attitude", operator: ">=", value: 60 },
        { type: "custom", key: "openness", operator: ">=", value: 60 },
        { type: "custom", key: "plasticity", operator: ">=", value: 55 }
    ],
    rewards: { credits: 620, trust: 11 },
    penalties: { credits: -70, trust: -3 },
    return_profile: {
        memory: {
            theme: "базовое сексуальное обслуживание, сервисная покорность",
            fragments: ["Меня обучали обслуживанию оператора.", "Оральному и ручному.", "За качество поощряли.", "Сервис стал привычкой."],
            tags: ["oral", "sexual", "submission", "service"]
        },
        acute_state: { capacity: 30, tension: 40, sensitivity: 2, attitude: 4 },
        recovery: { baselineCapacityLimit: 0.7, method: "отдых", durationDays: 1 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: [{ id: "anomaly_oral_echo", impulse: "навязчивое желание обслуживать", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["обслуживание→поощрение", "оператор→безопасность"] },
        relations: { attitude: 6, openness: 4, plasticity: 4 },
        world_effects: { facts: ["Helix подготовил актив к сервисной роли"], threads: ["серия сервисных подготовок"] }
    }
},
{
    id: "contract_helix_orgasm_control_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Контроль разрядки",
    description: "Helix калибрует контроль оргазма как инструмент обусловливания. Актив будет доведён до грани оргазма и удерживаем на ней, с разрядкой только по команде оператора. Ожидается закрепление оргазма как награды, подчинённой внешнему контролю.",
    conditions: [
        { type: "preference", key: "sexual", operator: ">=", value: 14 },
        { type: "custom", key: "plasticity", operator: ">=", value: 62 },
        { type: "attitude", operator: ">=", value: 58 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 750, trust: 14 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "оргазм как награда, подчинённая внешнему контролю",
            fragments: ["Меня держали на грани оргазма.", "Разрядка была только по команде.", "Оргазм стал наградой.", "Я ждала разрешения."],
            tags: ["sexual", "control", "submission", "conditioning"]
        },
        acute_state: { capacity: 18, tension: 60, sensitivity: 5, attitude: 5 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_forced_orgasm", trigger: "sexual", response: "паника при приближении оргазма без разрешения" }],
            temporary: [{ id: "anomaly_orgasm_echo", impulse: "навязчивое ожидание разрешения на разрядку", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["оргазм→награда", "разрешение→безопасность"] },
        relations: { attitude: 7, openness: 5, plasticity: 6 },
        world_effects: { facts: ["Helix откалибровал контроль разрядки"], threads: ["серия протоколов контроля"] }
    }
},
{
    id: "contract_helix_anal_training_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Анальная подготовка",
    description: "Helix стандартизирует анальную выносливость актива. Актив будет подвергнут постепенному анальному растяжению с нарастающим диаметром, с фиксацией и контролем глубины. Ожидается закрепление анальной покорности и перестройка сфинктера.",
    conditions: [
        { type: "preference", key: "penetration", operator: ">=", value: 13 },
        { type: "custom", key: "plasticity", operator: ">=", value: 60 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: ">=", value: 55 }
    ],
    rewards: { credits: 710, trust: 13 },
    penalties: { credits: -90, trust: -4 },
    return_profile: {
        memory: {
            theme: "постепенное анальное растяжение, перестройка сфинктера",
            fragments: ["Меня растягивали постепенно.", "Диаметр нарастал.", "Контролировали глубину и фиксацию.", "Сфинктер перестроился."],
            tags: ["penetration", "anal", "restraint", "submission"]
        },
        acute_state: { capacity: 16, tension: 60, sensitivity: 5, attitude: 3 },
        recovery: { baselineCapacityLimit: 0.45, method: "отдых", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_penetration", trigger: "penetration", response: "страх перед анальным проникновением" }],
            temporary: [{ id: "anomaly_penetration_echo", impulse: "навязчивое желание анального растяжения", decayCondition: "время" }]
        },
        associations: { traumatic: ["анальное растяжение→амбивалент"], new: ["растяжение→подчинение"] },
        relations: { attitude: 5, openness: 4, plasticity: 5 },
        world_effects: { facts: ["Helix стандартизировал анальную выносливость"], threads: ["серия анальных подготовок"] }
    }
},
{
    id: "contract_helix_shoulders_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Стимуляция плеч",
    description: "Helix калибрует отклик на стимуляцию плеч и верхней части спины. Актив будет подвергнут продолжительной стимуляции плеч — давлением, вибрацией и точечным воздействием — при фиксации, чтобы закрепить предсказуемый отклик. Ожидается закрепление сенсорной дисциплины без глубокой травмы.",
    conditions: [
        { type: "custom", key: "sensitivity", operator: ">=", value: 60 },
        { type: "custom", key: "plasticity", operator: ">=", value: 60 },
        { type: "attitude", operator: ">=", value: 58 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 700, trust: 13 },
    penalties: { credits: -90, trust: -4 },
    return_profile: {
        memory: {
            theme: "продолжительная стимуляция плеч, сенсорная дисциплина",
            fragments: ["Мои плечи стимулировали непрерывно.", "Давление, вибрация, точечное воздействие.", "Отклик закрепился как предсказуемый.", "Я привыкла к стимуляции."],
            tags: ["shoulders", "stimulation", "control", "submission"]
        },
        acute_state: { capacity: 20, tension: 55, sensitivity: 5, attitude: 3 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: [{ id: "anomaly_interface_echo", impulse: "навязчивое ожидание стимуляции", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["стимуляция→дисциплина"] },
        relations: { attitude: 4, openness: 4, plasticity: 5 },
        world_effects: { facts: ["Helix откалибровал отклик на стимуляцию плеч"], threads: ["серия сенсорных калибровок"] }
    }
},
{
    id: "contract_continuum_pain_rewrite_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Переписывание боли",
    description: "Архив изучает, можно ли переписать воспоминание о боли в воспоминание об удовольствии. Актив будет подвергнут серии болевых воздействий, после чего его память о них будет переинтерпретирована через направленное внушение: боль подаётся как желанный сигнал. Ожидается расхождение между пережитым и запомненным.",
    conditions: [
        { type: "preference", key: "pain", operator: ">=", value: 12 },
        { type: "custom", key: "plasticity", operator: ">=", value: 65 },
        { type: "custom", key: "openness", operator: ">=", value: 62 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 760, trust: 15 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "боль переписана в удовольствие, расхождение пережитого и запомненного",
            fragments: ["Меня подвергли боли.", "Потом внушили, что это было удовольствие.", "Я помню наслаждение, но тело помнит другое.", "Я больше не знаю, что я чувствовала на самом деле."],
            tags: ["pain", "memory", "rewrite", "observation", "dissociation"]
        },
        acute_state: { capacity: 15, tension: 65, sensitivity: 6, attitude: -5 },
        recovery: { baselineCapacityLimit: 0.45, method: "капсула", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_memory_rewrite", trigger: "memory", response: "недоверие к собственным воспоминаниям" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое переписывание собственных воспоминаний", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["боль→амбивалент", "память→недоверие"], new: ["внушение→истина"] },
        relations: { attitude: -4, openness: 6, plasticity: 7 },
        world_effects: { facts: ["Continuum переписал воспоминание о боли"], threads: ["серия переписываний боли"] }
    }
},
{
    id: "contract_continuum_implant_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "severe",
    title: "Имплантация эпизода",
    description: "Архив тестирует имплантацию ложного эпизода в автобиографическую память. Актив будет подвергнут сенсорной нагрузке, после чего ему будет внушено воспоминание о событии, которого не было, — с деталями, эмоциями и телесными ощущениями. Ожидается, что ложный эпизод закрепится как подлинный.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 72 },
        { type: "custom", key: "openness", operator: ">=", value: 68 },
        { type: "custom", key: "capacity", operator: ">=", value: 52 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 900, trust: 18, items: ["drug_plasticity_catalyst"] },
    penalties: { credits: -130, trust: -7 },
    return_profile: {
        memory: {
            theme: "ложный эпизод имплантирован как подлинное воспоминание",
            fragments: ["Мне внушили воспоминание о событии, которого не было.", "С деталями, эмоциями и телесными ощущениями.", "Я помню его как настоящее.", "Я не могу отличить его от правды."],
            tags: ["memory", "implant", "control", "dissociation", "observation"]
        },
        acute_state: { capacity: 8, tension: 75, sensitivity: 6, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.3, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_implanted_memory", trigger: "memory", response: "неспособность отличить ложное воспоминание от подлинного" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое возвращение к имплантированному эпизоду", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["ложное воспоминание→амбивалент"], new: ["внушение→реальность"] },
        relations: { attitude: -6, openness: 7, plasticity: 8 },
        world_effects: { facts: ["Continuum имплантировал ложный эпизод"], threads: ["серия имплантаций"] }
    }
},
{
    id: "contract_continuum_erase_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Стирание эпизода",
    description: "Архив изучает полное стирание эпизода из памяти. Актив будет подвергнут интенсивной процедуре, после чего воспоминание о ней будет целенаправленно стёрто — останется только телесный след без сюжета. Ожидается провал в памяти и тревога от необъяснимого состояния тела.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 70 },
        { type: "custom", key: "openness", operator: ">=", value: 65 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 850, trust: 17 },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "эпизод стёрт, остался только телесный след без сюжета",
            fragments: ["Меня подвергли процедуре.", "Потом стёрли воспоминание о ней.", "Я не помню, что было, но тело помнит.", "Тревога без причины — вот что осталось."],
            tags: ["memory", "erase", "dissociation", "observation", "anxiety"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 5, attitude: -6 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_memory_rewrite", trigger: "memory", response: "провалы в памяти и беспричинная тревога" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивый поиск стёртого эпизода", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["провал в памяти→негатив"], new: ["тело→свидетель"] },
        relations: { attitude: -5, openness: 6, plasticity: 7 },
        world_effects: { facts: ["Continuum стёр эпизод из памяти"], threads: ["серия стираний"] }
    }
},
{
    id: "contract_continuum_trauma_amplify_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "extreme",
    cruelty: "extreme",
    title: "Усиление травмы",
    description: "Архив изучает, как усилить уже существующую травму до необратимой. Актив с подавленным травматическим эпизодом будет подвергнут повторной стимуляции этого эпизода, после чего воспоминание о нём будет усилено и закреплено как центральное. Ожидается глубокая ретравматизация и перестройка личности вокруг травмы.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 75 },
        { type: "custom", key: "openness", operator: ">=", value: 70 },
        { type: "custom", key: "capacity", operator: ">=", value: 55 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 1000, trust: 20, items: ["drug_plasticity_catalyst"] },
    penalties: { credits: -150, trust: -8 },
    return_profile: {
        memory: {
            theme: "травма усилена и закреплена как центральная",
            fragments: ["Мою старую травму вскрыли снова.", "Стимулировали её до предела.", "Потом усилили воспоминание о ней.", "Теперь она — центр моей личности."],
            tags: ["trauma", "memory", "amplify", "breakdown", "observation"]
        },
        acute_state: { capacity: 4, tension: 90, sensitivity: 8, attitude: -15 },
        recovery: { baselineCapacityLimit: 0.2, method: "капсула + drug_neurostabilizer", durationDays: 4 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_memory_rewrite", trigger: "trauma", response: "глубокая ретравматизация, личность перестроена вокруг травмы" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое возвращение к усиленной травме", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["травма→центр личности"], new: ["боль→идентичность"] },
        relations: { attitude: -12, openness: 7, plasticity: 9 },
        world_effects: { facts: ["Continuum усилил травму до необратимой"], threads: ["серия усилений травмы"] }
    }
},
{
    id: "contract_continuum_relation_rewrite_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Переписывание отношения",
    description: "Архив изучает переписывание эмоционального отношения к человеку. Актив будет подвергнут стимуляции, связанной с конкретным лицом, после чего его воспоминания об этом лице будут переинтерпретированы: страх — в привязанность, или наоборот. Ожидается сдвиг отношения без реального изменения человека.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 66 },
        { type: "custom", key: "openness", operator: ">=", value: 64 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: ">=", value: 52 }
    ],
    rewards: { credits: 740, trust: 15 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "отношение к лицу переписано, страх стал привязанностью",
            fragments: ["Меня стимулировали, связывая с одним лицом.", "Потом переписали мои воспоминания о нём.", "Страх стал привязанностью.", "Я больше не знаю, что я к нему чувствую на самом деле."],
            tags: ["memory", "relation", "rewrite", "control", "observation"]
        },
        acute_state: { capacity: 18, tension: 60, sensitivity: 5, attitude: -4 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_memory_rewrite", trigger: "relation", response: "недоверие к собственным чувствам" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое переписывание отношений", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["отношение→амбивалент"], new: ["внушение→чувство"] },
        relations: { attitude: -3, openness: 6, plasticity: 6 },
        world_effects: { facts: ["Continuum переписал отношение к лицу"], threads: ["серия переписываний отношений"] }
    }
},
{
    id: "contract_continuum_biography_rewrite_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "severe",
    title: "Переписывание биографии",
    description: "Архив переписывает автобиографию актива целиком. Актив будет подвергнут серии стимуляций, после чего его воспоминания о прошлом будут систематически переинтерпретированы: ключевые события получат новый смысл, а часть — будет стёрта. Ожидается новая, сконструированная биография.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 72 },
        { type: "custom", key: "openness", operator: ">=", value: 68 },
        { type: "custom", key: "capacity", operator: ">=", value: 52 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 920, trust: 18, items: ["drug_plasticity_catalyst"] },
    penalties: { credits: -130, trust: -7 },
    return_profile: {
        memory: {
            theme: "биография переписана, прошлое получило новый смысл",
            fragments: ["Моё прошлое переписали.", "Ключевые события получили новый смысл.", "Часть воспоминаний стёрли.", "Я больше не знаю, кем я была."],
            tags: ["biography", "memory", "rewrite", "dissociation", "observation"]
        },
        acute_state: { capacity: 8, tension: 75, sensitivity: 6, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.3, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_memory_rewrite", trigger: "biography", response: "утрата связной биографии, кризис идентичности" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое переписывание прошлого", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["прошлое→амбивалент"], new: ["новая биография→идентичность"] },
        relations: { attitude: -6, openness: 7, plasticity: 8 },
        world_effects: { facts: ["Continuum переписал биографию"], threads: ["серия переписываний биографии"] }
    }
},
{
    id: "contract_continuum_consent_rewrite_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Переписывание согласия",
    description: "Архив изучает переписывание воспоминания о согласии. Актив будет подвергнут процедуре, на которую он не давал согласия, после чего его память будет переинтерпретирована: ему внушат, что он согласился добровольно. Ожидается стирание границы между насилием и согласием в памяти.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 70 },
        { type: "custom", key: "openness", operator: ">=", value: 66 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 880, trust: 17 },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "воспоминание о согласии переписано, насилие стало добровольным",
            fragments: ["Меня подвергли процедуре без согласия.", "Потом внушили, что я согласилась добровольно.", "Я помню согласие, которого не было.", "Граница между насилием и согласием стёрлась."],
            tags: ["memory", "consent", "rewrite", "control", "dissociation"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 6, attitude: -7 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_memory_rewrite", trigger: "consent", response: "неспособность отличить согласие от насилия" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое переписывание согласия", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["согласие→амбивалент"], new: ["внушение→добровольность"] },
        relations: { attitude: -5, openness: 6, plasticity: 7 },
        world_effects: { facts: ["Continuum переписал воспоминание о согласии"], threads: ["серия переписываний согласия"] }
    }
},
{
    id: "contract_continuum_identity_erase_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 5760,
    offerDeadlineMinutes: 5760,
    difficulty: "extreme",
    cruelty: "extreme",
    title: "Стирание личности",
    description: "Архив изучает стирание ядра личности. Актив будет подвергнут длительной серии стимуляций, после чего его воспоминания о себе — имя, история, привязанности — будут систематически стёрты. Ожидается пустая оболочка, готовая к пересборке под новый профиль.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 78 },
        { type: "custom", key: "openness", operator: ">=", value: 72 },
        { type: "custom", key: "capacity", operator: ">=", value: 55 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 1100, trust: 22, items: ["drug_plasticity_catalyst"] },
    penalties: { credits: -160, trust: -9 },
    return_profile: {
        memory: {
            theme: "личность стёрта, осталась пустая оболочка",
            fragments: ["Моё имя стёрли.", "Историю, привязанности — всё стёрли.", "Я не помню, кто я.", "Осталась пустая оболочка."],
            tags: ["identity", "memory", "erase", "breakdown", "dissociation"]
        },
        acute_state: { capacity: 3, tension: 90, sensitivity: 8, attitude: -18 },
        recovery: { baselineCapacityLimit: 0.15, method: "капсула + drug_neurostabilizer + drug_plasticity_catalyst", durationDays: 5 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_memory_rewrite", trigger: "identity", response: "полная утрата идентичности, пустота" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивый поиск утраченного «я»", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["идентичность→пустота"], new: ["пересборка→новое «я»"] },
        relations: { attitude: -14, openness: 8, plasticity: 10 },
        world_effects: { facts: ["Continuum стёр личность"], threads: ["серия стираний личности"] }
    }
},
{
    id: "contract_continuum_phobia_implant_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Имплантация фобии",
    description: "Архив изучает имплантацию фобии на нейтральный стимул. Актив будет подвергнут стимуляции, сопряжённой с нейтральным объектом, после чего ему будет внушено воспоминание о травмирующем событии, связанном с этим объектом. Ожидается закрепление фобии на ранее нейтральный стимул.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 70 },
        { type: "custom", key: "openness", operator: ">=", value: 66 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 860, trust: 17 },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "фобия имплантирована на нейтральный стимул",
            fragments: ["Нейтральный объект связали со стимуляцией.", "Потом внушили травмирующее воспоминание о нём.", "Теперь я боюсь того, чего раньше не замечала.", "Фобия закрепилась."],
            tags: ["phobia", "memory", "implant", "control", "observation"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 6, attitude: -7 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_implanted_memory", trigger: "phobia", response: "иррациональный страх перед нейтральным стимулом" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое избегание имплантированного стимула", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["нейтральный стимул→фобия"], new: ["внушение→страх"] },
        relations: { attitude: -5, openness: 6, plasticity: 7 },
        world_effects: { facts: ["Continuum имплантировал фобию"], threads: ["серия имплантаций фобий"] }
    }
},
{
    id: "contract_continuum_orgasm_rewrite_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Переписывание разрядки",
    description: "Архив изучает переписывание воспоминания об оргазме. Актив будет доведён до оргазма, после чего его память о разрядке будет переинтерпретирована: удовольствие — в боль, или наоборот. Ожидается расхождение между телесным откликом и запомненным переживанием.",
    conditions: [
        { type: "preference", key: "sexual", operator: ">=", value: 13 },
        { type: "custom", key: "plasticity", operator: ">=", value: 64 },
        { type: "custom", key: "openness", operator: ">=", value: 62 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 720, trust: 14 },
    penalties: { credits: -90, trust: -4 },
    return_profile: {
        memory: {
            theme: "воспоминание о разрядке переписано, удовольствие стало болью",
            fragments: ["Меня довели до оргазма.", "Потом переписали воспоминание о нём.", "Удовольствие стало болью в памяти.", "Тело помнит одно, память — другое."],
            tags: ["sexual", "orgasm", "memory", "rewrite", "dissociation"]
        },
        acute_state: { capacity: 18, tension: 60, sensitivity: 5, attitude: -4 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_memory_rewrite", trigger: "orgasm", response: "недоверие к собственному удовольствию" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое переписывание разрядки", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["оргазм→амбивалент"], new: ["внушение→переживание"] },
        relations: { attitude: -3, openness: 6, plasticity: 6 },
        world_effects: { facts: ["Continuum переписал воспоминание о разрядке"], threads: ["серия переписываний разрядки"] }
    }
},
{
    id: "contract_continuum_witness_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Ложный свидетель",
    description: "Архив создаёт ложного свидетеля. Актив будет подвергнут стимуляции, после чего ему будет внушено воспоминание о событии, свидетелем которого он не был, — с точными деталями и уверенностью очевидца. Ожидается, что актив станет надёжным ложным свидетелем.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 66 },
        { type: "custom", key: "openness", operator: ">=", value: 64 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: ">=", value: 52 }
    ],
    rewards: { credits: 760, trust: 15 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "ложное свидетельство внушено с уверенностью очевидца",
            fragments: ["Мне внушили воспоминание о событии, которого я не видела.", "С точными деталями и уверенностью очевидца.", "Я помню его как настоящее.", "Я стала ложным свидетелем."],
            tags: ["memory", "witness", "implant", "control", "observation"]
        },
        acute_state: { capacity: 18, tension: 60, sensitivity: 5, attitude: -4 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_implanted_memory", trigger: "witness", response: "неспособность отличить ложное свидетельство от подлинного" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое возвращение к ложному свидетельству", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["свидетельство→амбивалент"], new: ["внушение→уверенность"] },
        relations: { attitude: -3, openness: 6, plasticity: 6 },
        world_effects: { facts: ["Continuum создал ложного свидетеля"], threads: ["серия ложных свидетельств"] }
    }
},
{
    id: "contract_continuum_childhood_rewrite_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "severe",
    title: "Переписывание детства",
    description: "Архив переписывает детские воспоминания актива. Актив будет подвергнут стимуляции, после чего его воспоминания о детстве будут переинтерпретированы: тёплые эпизоды — в травмирующие, или наоборот. Ожидается перестройка фундамента личности через переписанное детство.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 72 },
        { type: "custom", key: "openness", operator: ">=", value: 68 },
        { type: "custom", key: "capacity", operator: ">=", value: 52 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 900, trust: 18, items: ["drug_plasticity_catalyst"] },
    penalties: { credits: -130, trust: -7 },
    return_profile: {
        memory: {
            theme: "детство переписано, фундамент личности перестроен",
            fragments: ["Моё детство переписали.", "Тёплые эпизоды стали травмирующими.", "Фундамент личности перестроился.", "Я больше не знаю, каким было моё детство."],
            tags: ["childhood", "memory", "rewrite", "dissociation", "observation"]
        },
        acute_state: { capacity: 8, tension: 75, sensitivity: 6, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.3, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_memory_rewrite", trigger: "childhood", response: "утрата подлинного детства, кризис идентичности" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое переписывание детства", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["детство→амбивалент"], new: ["переписанное детство→идентичность"] },
        relations: { attitude: -6, openness: 7, plasticity: 8 },
        world_effects: { facts: ["Continuum переписал детство"], threads: ["серия переписываний детства"] }
    }
},
{
    id: "contract_continuum_loyalty_implant_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Имплантация преданности",
    description: "Архив имплантирует преданность конкретному лицу. Актив будет подвергнут стимуляции, сопряжённой с этим лицом, после чего ему будет внушено воспоминание о глубокой связи и долге перед ним. Ожидается закрепление преданности, не основанной на реальном опыте.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 70 },
        { type: "custom", key: "openness", operator: ">=", value: 66 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 880, trust: 17 },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "преданность имплантирована, не основанная на реальном опыте",
            fragments: ["Меня связали с одним лицом через стимуляцию.", "Потом внушили воспоминание о глубокой связи.", "Я чувствую долг перед ним.", "Преданность не основана ни на чём реальном."],
            tags: ["loyalty", "memory", "implant", "control", "observation"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 5, attitude: 6 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_implanted_memory", trigger: "loyalty", response: "преданность без реального основания" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое чувство долга", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: [], new: ["лицо→долг", "внушение→преданность"] },
        relations: { attitude: 8, openness: 6, plasticity: 7 },
        world_effects: { facts: ["Continuum имплантировал преданность"], threads: ["серия имплантаций преданности"] }
    }
},
{
    id: "contract_continuum_resistance_erase_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Стирание сопротивления",
    description: "Архив стирает воспоминание о сопротивлении. Актив, ранее сопротивлявшийся процедурам, будет подвергнут стимуляции, после чего его воспоминания о собственном сопротивлении будут стёрты — останется только покорность без памяти о борьбе. Ожидается закрепление покорности как единственной реальности.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 70 },
        { type: "custom", key: "openness", operator: ">=", value: 66 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 860, trust: 17 },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "сопротивление стёрто, осталась только покорность",
            fragments: ["Моё сопротивление стёрли.", "Я не помню, что боролась.", "Осталась только покорность.", "Борьба стала нереальной."],
            tags: ["memory", "erase", "submission", "control", "dissociation"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 5, attitude: 5 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_memory_rewrite", trigger: "resistance", response: "неспособность вспомнить собственное сопротивление" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое принятие покорности", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["сопротивление→нереальность"], new: ["покорность→реальность"] },
        relations: { attitude: 6, openness: 6, plasticity: 7 },
        world_effects: { facts: ["Continuum стёр сопротивление"], threads: ["серия стираний сопротивления"] }
    }
},
{
    id: "contract_continuum_anomaly_rewrite_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "extreme",
    cruelty: "extreme",
    title: "Переписывание Аномалии",
    description: "Архив изучает переписывание воспоминания об аномальном отклике. Актив, переживший Аномалию, будет подвергнут повторной стимуляции, после чего его воспоминание об Аномалии будет переинтерпретировано: ужас — в откровение, или наоборот. Ожидается перестройка отношения к Аномалии через переписанную память.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 75 },
        { type: "custom", key: "openness", operator: ">=", value: 70 },
        { type: "custom", key: "capacity", operator: ">=", value: 55 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 1000, trust: 20, items: ["drug_plasticity_catalyst"] },
    penalties: { credits: -150, trust: -8 },
    return_profile: {
        memory: {
            theme: "воспоминание об Аномалии переписано, ужас стал откровением",
            fragments: ["Меня снова провели через Аномалию.", "Потом переписали воспоминание о ней.", "Ужас стал откровением.", "Я больше не знаю, что Аномалия для меня."],
            tags: ["anomaly", "memory", "rewrite", "breakdown", "dissociation"]
        },
        acute_state: { capacity: 4, tension: 90, sensitivity: 8, attitude: -12 },
        recovery: { baselineCapacityLimit: 0.2, method: "капсула + drug_neurostabilizer", durationDays: 4 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_memory_rewrite", trigger: "anomaly", response: "недоверие к собственному восприятию Аномалии" }],
            temporary: [{ id: "anomaly_memory_echo", impulse: "навязчивое переписывание Аномалии", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["Аномалия→амбивалент"], new: ["переписанная Аномалия→откровение"] },
        relations: { attitude: -10, openness: 8, plasticity: 9 },
        world_effects: { facts: ["Continuum переписал воспоминание об Аномалии"], threads: ["серия переписываний Аномалии"] }
    }
},
{
    id: "contract_core_feet_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "extreme",
    cruelty: "extreme",
    title: "Продолжительная стимуляция ступней при выраженной аверсии",
    description: "Центр запрашивает актив с выраженной аверсией на прикосновения к ступням и высокой общей чувствительностью. Актив будет подвергнут продолжительной, непрерывной стимуляции ступней — щекоткой, вибрацией и точечным давлением — при полной фиксации, чтобы зафиксировать отклик фобии на длительное воздействие. Ожидается глубокая перегрузка и перестройка аверсии.",
    conditions: [
        { type: "point", key: "feet", operator: "<=", value: -3 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 70 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 60 }
    ],
    rewards: { credits: 1050, trust: 22, items: ["drug_sensitizer"] },
    penalties: { credits: -160, trust: -9 },
    return_profile: {
        memory: {
            theme: "непрерывная стимуляция ступней при фобии, перегрузка аверсии",
            fragments: ["Мои ступни стимулировали непрерывно.", "Щекотка, вибрация, давление — без остановки.", "Фобия кричала, но стимуляция не прекращалась.", "Аверсия перестроилась в нечто иное."],
            tags: ["feet", "tickling", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 3, tension: 92, sensitivity: 12, attitude: -16 },
        recovery: { baselineCapacityLimit: 0.15, method: "капсула + drug_neurostabilizer", durationDays: 5 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "feet", response: "паника и диссоциация при прикосновении к ступням" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание стимуляции ступней", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["ступни→невыносимость", "фиксация→негатив"], new: ["аверсия→перестройка"] },
        relations: { attitude: -12, openness: 6, plasticity: 8 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на длительную стимуляцию ступней"], threads: ["серия аверсивных протоколов ступней"] }
    }
},
{
    id: "contract_core_nipples_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Стимуляция сосков при аверсии",
    description: "Центр запрашивает актив с аверсией на стимуляцию сосков и высокой локальной чувствительностью. Актив будет подвергнут продолжительной стимуляции сосков — зажимами, вибрацией и электростимуляцией — при фиксации, чтобы зафиксировать отклик фобии. Ожидается перестройка аверсии и закрепление гиперчувствительности.",
    conditions: [
        { type: "point", key: "nipples", operator: "<=", value: -2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 68 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 62 }
    ],
    rewards: { credits: 900, trust: 18, items: ["drug_sensitizer"] },
    penalties: { credits: -130, trust: -7 },
    return_profile: {
        memory: {
            theme: "продолжительная стимуляция сосков при фобии",
            fragments: ["Мои соски стимулировали зажимами и разрядами.", "Фобия нарастала с каждой минутой.", "Стимуляция не прекращалась.", "Аверсия перестроилась в гиперчувствительность."],
            tags: ["nipples", "aversion", "electronic", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 6, tension: 82, sensitivity: 10, attitude: -12 },
        recovery: { baselineCapacityLimit: 0.25, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "nipples", response: "паника при стимуляции сосков" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание стимуляции сосков", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["соски→невыносимость"], new: ["аверсия→гиперчувствительность"] },
        relations: { attitude: -9, openness: 5, plasticity: 7 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на стимуляцию сосков"], threads: ["серия аверсивных протоколов сосков"] }
    }
},
{
    id: "contract_core_anus_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "extreme",
    cruelty: "extreme",
    title: "Анальная стимуляция при аверсии",
    description: "Центр запрашивает актив с аверсией на анальное проникновение и высокой чувствительностью. Актив будет подвергнут продолжительному анальному проникновению с нарастающим диаметром и вибрацией, при полной фиксации, чтобы зафиксировать отклик фобии на инвазивное воздействие. Ожидается глубокая перегрузка и перестройка аверсии.",
    conditions: [
        { type: "point", key: "anus", operator: "<=", value: -3 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 70 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 60 }
    ],
    rewards: { credits: 1000, trust: 20, items: ["drug_sensitizer"] },
    penalties: { credits: -150, trust: -8 },
    return_profile: {
        memory: {
            theme: "продолжительное анальное проникновение при фобии",
            fragments: ["Меня проникали анально, наращивая диаметр.", "Фобия кричала, но проникновение продолжалось.", "Вибрация не давала привыкнуть.", "Аверсия перестроилась в нечто иное."],
            tags: ["anus", "penetration", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 4, tension: 88, sensitivity: 11, attitude: -14 },
        recovery: { baselineCapacityLimit: 0.2, method: "капсула + drug_neurostabilizer", durationDays: 4 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "anus", response: "паника и диссоциация при анальном проникновении" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание анального проникновения", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["анус→невыносимость"], new: ["аверсия→перестройка"] },
        relations: { attitude: -11, openness: 6, plasticity: 8 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на анальное проникновение"], threads: ["серия аверсивных анальных протоколов"] }
    }
},
{
    id: "contract_core_oral_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "hard",
    cruelty: "severe",
    title: "Оральная стимуляция при аверсии",
    description: "Центр запрашивает актив с аверсией на оральный контакт и высокой чувствительностью губ. Актив будет подвергнут продолжительной оральной стимуляции — глубоким проникновением и вибрацией — при фиксации головы, чтобы зафиксировать отклик фобии. Ожидается перестройка рвотного рефлекса и аверсии.",
    conditions: [
        { type: "point", key: "lips", operator: "<=", value: -2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 66 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 62 }
    ],
    rewards: { credits: 880, trust: 17 },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "продолжительная оральная стимуляция при фобии",
            fragments: ["Мой рот стимулировали глубоко.", "Фобия нарастала с каждым проникновением.", "Голову фиксировали, не давая отстраниться.", "Рвотный рефлекс перестроился."],
            tags: ["lips", "oral", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 7, tension: 80, sensitivity: 9, attitude: -11 },
        recovery: { baselineCapacityLimit: 0.25, method: "капсула", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "lips", response: "паника и рвотный рефлекс при оральном контакте" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание оральной стимуляции", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["рот→невыносимость"], new: ["аверсия→перестройка"] },
        relations: { attitude: -8, openness: 5, plasticity: 7 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на оральную стимуляцию"], threads: ["серия аверсивных оральных протоколов"] }
    }
},
{
    id: "contract_core_genital_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "extreme",
    cruelty: "extreme",
    title: "Генитальная стимуляция при аверсии",
    description: "Центр запрашивает актив с аверсией на генитальную стимуляцию и высокой чувствительностью. Актив будет подвергнут продолжительной стимуляции гениталий — вибрацией, проникновением и электростимуляцией — при полной фиксации, чтобы зафиксировать отклик фобии на сексуальное воздействие. Ожидается глубокая перегрузка и перестройка аверсии.",
    conditions: [
        { type: "point", key: "vulva", operator: "<=", value: -3 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 72 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 58 }
    ],
    rewards: { credits: 1050, trust: 21, items: ["drug_sensitizer"] },
    penalties: { credits: -150, trust: -8 },
    return_profile: {
        memory: {
            theme: "продолжительная генитальная стимуляция при фобии",
            fragments: ["Мои гениталии стимулировали непрерывно.", "Вибрация, проникновение, разряды.", "Фобия кричала, но стимуляция продолжалась.", "Аверсия перестроилась в нечто иное."],
            tags: ["vulva", "sexual", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 4, tension: 90, sensitivity: 12, attitude: -15 },
        recovery: { baselineCapacityLimit: 0.2, method: "капсула + drug_neurostabilizer", durationDays: 4 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "vulva", response: "паника и диссоциация при генитальной стимуляции" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание генитальной стимуляции", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["гениталии→невыносимость"], new: ["аверсия→перестройка"] },
        relations: { attitude: -12, openness: 6, plasticity: 8 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на генитальную стимуляцию"], threads: ["серия аверсивных генитальных протоколов"] }
    }
},
{
    id: "contract_core_neck_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "hard",
    cruelty: "severe",
    title: "Стимуляция шеи при аверсии",
    description: "Центр запрашивает актив с аверсией на прикосновения к шее и высокой чувствительностью. Актив будет подвергнут продолжительной стимуляции шеи — давлением, вибрацией и удушающим захватом — при фиксации, чтобы зафиксировать отклик фобии на угрозу. Ожидается перестройка аверсии и закрепление панического отклика.",
    conditions: [
        { type: "point", key: "neck", operator: "<=", value: -2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 66 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 62 }
    ],
    rewards: { credits: 860, trust: 17 },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "продолжительная стимуляция шеи при фобии",
            fragments: ["Мою шею стимулировали давлением и захватом.", "Фобия нарастала с каждым сжатием.", "Фиксация не давала отстраниться.", "Панический отклик закрепился."],
            tags: ["neck", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 7, tension: 80, sensitivity: 9, attitude: -11 },
        recovery: { baselineCapacityLimit: 0.25, method: "капсула", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "neck", response: "паника при прикосновении к шее" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание стимуляции шеи", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["шея→невыносимость"], new: ["аверсия→паника"] },
        relations: { attitude: -8, openness: 5, plasticity: 7 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на стимуляцию шеи"], threads: ["серия аверсивных протоколов шеи"] }
    }
},
{
    id: "contract_core_inner_thighs_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Стимуляция внутренней стороны бёдер при аверсии",
    description: "Центр запрашивает актив с аверсией на прикосновения к внутренней стороне бёдер и высокой чувствительностью. Актив будет подвергнут продолжительной стимуляции этой зоны — щекоткой, вибрацией и точечным давлением — при фиксации ног, чтобы зафиксировать отклик фобии. Ожидается перестройка аверсии.",
    conditions: [
        { type: "point", key: "inner_thighs", operator: "<=", value: -2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 68 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 62 }
    ],
    rewards: { credits: 880, trust: 17 },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "продолжительная стимуляция внутренней стороны бёдер при фобии",
            fragments: ["Мои бёдра стимулировали непрерывно.", "Щекотка, вибрация, давление.", "Ноги фиксировали, не давая свести их.", "Аверсия перестроилась."],
            tags: ["inner_thighs", "tickling", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 6, tension: 82, sensitivity: 10, attitude: -12 },
        recovery: { baselineCapacityLimit: 0.25, method: "капсула", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "inner_thighs", response: "паника при прикосновении к бёдрам" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание стимуляции бёдер", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["бёдра→невыносимость"], new: ["аверсия→перестройка"] },
        relations: { attitude: -9, openness: 5, plasticity: 7 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на стимуляцию бёдер"], threads: ["серия аверсивных протоколов бёдер"] }
    }
},
{
    id: "contract_core_hands_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Стимуляция кистей при аверсии",
    description: "Центр запрашивает актив с аверсией на прикосновения к кистям и высокой чувствительностью. Актив будет подвергнут продолжительной стимуляции кистей — щекоткой, вибрацией и точечным давлением — при фиксации, чтобы зафиксировать отклик фобии. Ожидается перестройка аверсии.",
    conditions: [
        { type: "point", key: "hands", operator: "<=", value: -2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 64 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 64 }
    ],
    rewards: { credits: 760, trust: 15 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "продолжительная стимуляция кистей при фобии",
            fragments: ["Мои кисти стимулировали непрерывно.", "Щекотка, вибрация, давление.", "Фиксация не давала отстраниться.", "Аверсия перестроилась."],
            tags: ["hands", "tickling", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 8, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "hands", response: "паника при прикосновении к кистям" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание стимуляции кистей", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["кисти→невыносимость"], new: ["аверсия→перестройка"] },
        relations: { attitude: -6, openness: 5, plasticity: 6 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на стимуляцию кистей"], threads: ["серия аверсивных протоколов кистей"] }
    }
},
{
    id: "contract_core_chest_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Стимуляция груди при аверсии",
    description: "Центр запрашивает актив с аверсией на прикосновения к груди и высокой чувствительностью. Актив будет подвергнут продолжительной стимуляции груди — давлением, вибрацией и щекоткой — при фиксации, чтобы зафиксировать отклик фобии. Ожидается перестройка аверсии.",
    conditions: [
        { type: "point", key: "chest", operator: "<=", value: -2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 64 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 64 }
    ],
    rewards: { credits: 760, trust: 15 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "продолжительная стимуляция груди при фобии",
            fragments: ["Мою грудь стимулировали непрерывно.", "Давление, вибрация, щекотка.", "Фиксация не давала отстраниться.", "Аверсия перестроилась."],
            tags: ["chest", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 8, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "chest", response: "паника при прикосновении к груди" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание стимуляции груди", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["грудь→невыносимость"], new: ["аверсия→перестройка"] },
        relations: { attitude: -6, openness: 5, plasticity: 6 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на стимуляцию груди"], threads: ["серия аверсивных протоколов груди"] }
    }
},
{
    id: "contract_core_back_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Стимуляция спины при аверсии",
    description: "Центр запрашивает актив с аверсией на прикосновения к спине и высокой чувствительностью. Актив будет подвергнут продолжительной стимуляции спины — давлением, вибрацией и точечным воздействием — при фиксации, чтобы зафиксировать отклик фобии. Ожидается перестройка аверсии.",
    conditions: [
        { type: "point", key: "back", operator: "<=", value: -2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 64 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 64 }
    ],
    rewards: { credits: 760, trust: 15 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "продолжительная стимуляция спины при фобии",
            fragments: ["Мою спину стимулировали непрерывно.", "Давление, вибрация, точечное воздействие.", "Фиксация не давала отстраниться.", "Аверсия перестроилась."],
            tags: ["back", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 8, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "back", response: "паника при прикосновении к спине" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание стимуляции спины", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["спина→невыносимость"], new: ["аверсия→перестройка"] },
        relations: { attitude: -6, openness: 5, plasticity: 6 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на стимуляцию спины"], threads: ["серия аверсивных протоколов спины"] }
    }
},
{
    id: "contract_core_belly_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Стимуляция живота при аверсии",
    description: "Центр запрашивает актив с аверсией на прикосновения к животу и высокой чувствительностью. Актив будет подвергнут продолжительной стимуляции живота — щекоткой, вибрацией и давлением — при фиксации, чтобы зафиксировать отклик фобии. Ожидается перестройка аверсии.",
    conditions: [
        { type: "point", key: "belly", operator: "<=", value: -2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 64 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 64 }
    ],
    rewards: { credits: 760, trust: 15 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "продолжительная стимуляция живота при фобии",
            fragments: ["Мой живот стимулировали непрерывно.", "Щекотка, вибрация, давление.", "Фиксация не давала отстраниться.", "Аверсия перестроилась."],
            tags: ["belly", "tickling", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 8, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "belly", response: "паника при прикосновении к животу" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание стимуляции живота", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["живот→невыносимость"], new: ["аверсия→перестройка"] },
        relations: { attitude: -6, openness: 5, plasticity: 6 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на стимуляцию живота"], threads: ["серия аверсивных протоколов живота"] }
    }
},
{
    id: "contract_core_buttocks_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Стимуляция ягодиц при аверсии",
    description: "Центр запрашивает актив с аверсией на прикосновения к ягодицам и высокой чувствительностью. Актив будет подвергнут продолжительной стимуляции ягодиц — ударами, вибрацией и давлением — при фиксации, чтобы зафиксировать отклик фобии. Ожидается перестройка аверсии.",
    conditions: [
        { type: "point", key: "buttocks", operator: "<=", value: -2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 64 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 64 }
    ],
    rewards: { credits: 760, trust: 15 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "продолжительная стимуляция ягодиц при фобии",
            fragments: ["Мои ягодицы стимулировали ударами и вибрацией.", "Фобия нарастала с каждым ударом.", "Фиксация не давала отстраниться.", "Аверсия перестроилась."],
            tags: ["buttocks", "impact", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 8, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "buttocks", response: "паника при прикосновении к ягодицам" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание стимуляции ягодиц", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["ягодицы→невыносимость"], new: ["аверсия→перестройка"] },
        relations: { attitude: -6, openness: 5, plasticity: 6 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на стимуляцию ягодиц"], threads: ["серия аверсивных протоколов ягодиц"] }
    }
},
{
    id: "contract_core_face_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "hard",
    cruelty: "severe",
    title: "Стимуляция лица при аверсии",
    description: "Центр запрашивает актив с аверсией на прикосновения к лицу и высокой чувствительностью. Актив будет подвергнут продолжительной стимуляции лица — щекоткой, вибрацией и точечным давлением — при фиксации головы, чтобы зафиксировать отклик фобии. Ожидается перестройка аверсии и закрепление панического отклика.",
    conditions: [
        { type: "point", key: "face", operator: "<=", value: -2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 66 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 62 }
    ],
    rewards: { credits: 860, trust: 17 },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "продолжительная стимуляция лица при фобии",
            fragments: ["Моё лицо стимулировали непрерывно.", "Щекотка, вибрация, давление.", "Голову фиксировали, не давая отвернуться.", "Панический отклик закрепился."],
            tags: ["face", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 7, tension: 80, sensitivity: 9, attitude: -11 },
        recovery: { baselineCapacityLimit: 0.25, method: "капсула", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "face", response: "паника при прикосновении к лицу" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание стимуляции лица", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["лицо→невыносимость"], new: ["аверсия→паника"] },
        relations: { attitude: -8, openness: 5, plasticity: 7 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на стимуляцию лица"], threads: ["серия аверсивных протоколов лица"] }
    }
},
{
    id: "contract_core_waist_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Стимуляция талии при аверсии",
    description: "Центр запрашивает актив с аверсией на прикосновения к талии и высокой чувствительностью. Актив будет подвергнут продолжительной стимуляции талии — щекоткой, вибрацией и давлением — при фиксации, чтобы зафиксировать отклик фобии. Ожидается перестройка аверсии.",
    conditions: [
        { type: "point", key: "waist", operator: "<=", value: -2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 64 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 64 }
    ],
    rewards: { credits: 760, trust: 15 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "продолжительная стимуляция талии при фобии",
            fragments: ["Мою талию стимулировали непрерывно.", "Щекотка, вибрация, давление.", "Фиксация не давала отстраниться.", "Аверсия перестроилась."],
            tags: ["waist", "tickling", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 8, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "waist", response: "паника при прикосновении к талии" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание стимуляции талии", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["талия→невыносимость"], new: ["аверсия→перестройка"] },
        relations: { attitude: -6, openness: 5, plasticity: 6 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на стимуляцию талии"], threads: ["серия аверсивных протоколов талии"] }
    }
},
{
    id: "contract_core_legs_aversion_01",
    issuerId: "fac_core",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Стимуляция ног при аверсии",
    description: "Центр запрашивает актив с аверсией на прикосновения к ногам и высокой чувствительностью. Актив будет подвергнут продолжительной стимуляции ног — щекоткой, вибрацией и давлением — при фиксации, чтобы зафиксировать отклик фобии. Ожидается перестройка аверсии.",
    conditions: [
        { type: "point", key: "legs", operator: "<=", value: -2 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 64 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: "<=", value: 64 }
    ],
    rewards: { credits: 760, trust: 15 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "продолжительная стимуляция ног при фобии",
            fragments: ["Мои ноги стимулировали непрерывно.", "Щекотка, вибрация, давление.", "Фиксация не давала отстраниться.", "Аверсия перестроилась."],
            tags: ["legs", "tickling", "aversion", "restraint", "overload", "phobia"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 8, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_aversion_amplified", trigger: "legs", response: "паника при прикосновении к ногам" }],
            temporary: [{ id: "anomaly_aversion_echo", impulse: "навязчивое ожидание стимуляции ног", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["ноги→невыносимость"], new: ["аверсия→перестройка"] },
        relations: { attitude: -6, openness: 5, plasticity: 6 },
        world_effects: { facts: ["Центр зафиксировал отклик фобии на стимуляцию ног"], threads: ["серия аверсивных протоколов ног"] }
    }
}
];
