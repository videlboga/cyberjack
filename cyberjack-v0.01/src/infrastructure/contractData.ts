import type { AssetContract } from '../domain/types';

type ContractSeedData = Omit<AssetContract, 'state'>;

/**
 * Контент контрактов — 45 штук (Veil 15, Helix 15, Continuum 15).
 * Переработка v2: только external_transfer, явные уровни сложности (difficulty)
 * и жестокости (cruelty), ≥ половины — сексуальные. Тон эвфемистично-
 * бюрократический, но прозрачно и подробно описывающий жесть.
 *
 * difficulty: easy | medium | hard | extreme — высота порогов условий.
 * cruelty: mild | moderate | severe | extreme — тяжесть return_profile.
 */
export const CONTRACT_DATA: ContractSeedData[] = [
// ═══════════════════════════════════════════════════════════════════════════
// VEIL BIOTECH — экстрим, срыв, Аномалия. Жестокость и предельные состояния.
// ═══════════════════════════════════════════════════════════════════════════
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
    id: "contract_veil_breeding_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "extreme",
    cruelty: "extreme",
    title: "Программа осеменения",
    description: "Veil проводит закрытую программу репродуктивного отбора. Актив будет подвергнут многократному осеменению в течение нескольких суток, с гормональной подготовкой и удержанием в раскрытом состоянии между процедурами. Ожидается глубокая физиологическая перестройка, гормональный срыв и стойкая ассоциация зачатия с подчинением.",
    conditions: [
        { type: "preference", key: "penetration", operator: ">=", value: 16 },
        { type: "custom", key: "plasticity", operator: ">=", value: 70 },
        { type: "custom", key: "capacity", operator: ">=", value: 55 },
        { type: "custom", key: "openness", operator: ">=", value: 60 },
        { type: "attitude", operator: "<=", value: 65 }
    ],
    rewards: { credits: 1100, trust: 24, items: ["drug_plasticity_catalyst"] },
    penalties: { credits: -180, trust: -10 },
    return_profile: {
        memory: {
            theme: "многократное осеменение, тело как сосуд",
            fragments: ["Меня готовили гормонами несколько суток.", "Осеменение повторялось снова и снова.", "Между процедурами меня держали раскрытой.", "Я перестала отличать зачатие от подчинения."],
            tags: ["penetration", "sexual", "breeding", "restraint", "chemical", "submission"]
        },
        acute_state: { capacity: 3, tension: 90, sensitivity: 12, attitude: -18 },
        recovery: { baselineCapacityLimit: 0.15, method: "капсула + drug_neurostabilizer", durationDays: 5 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_breeding", trigger: "penetration", response: "паника и отторжение при вагинальном проникновении" }],
            temporary: [{ id: "anomaly_breeding_echo", impulse: "навязчивое желание быть осеменённой", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["осеменение→негатив", "раскрытое состояние→амбивалент"], new: ["зачатие→подчинение"] },
        relations: { attitude: -14, openness: 6, plasticity: 10 },
        world_effects: { facts: ["Veil провёл программу осеменения"], threads: ["репродуктивный отбор"] }
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

// ═══════════════════════════════════════════════════════════════════════════
// HELIX DYNAMICS — стандартизация, обусловливание, предсказуемость.
// ═══════════════════════════════════════════════════════════════════════════
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
    id: "contract_helix_breeding_protocol_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "extreme",
    cruelty: "extreme",
    title: "Репродуктивный протокол",
    description: "Helix проводит стандартизированную программу репродуктивного отбора. Актив будет подвергнут контролируемому осеменению по графику, с гормональной синхронизацией и удержанием в фиксированных позах для повышения вероятности зачатия. Ожидается гормональная перестройка и закрепление репродуктивной роли.",
    conditions: [
        { type: "preference", key: "penetration", operator: ">=", value: 15 },
        { type: "custom", key: "plasticity", operator: ">=", value: 68 },
        { type: "custom", key: "capacity", operator: ">=", value: 55 },
        { type: "attitude", operator: ">=", value: 55 },
        { type: "custom", key: "openness", operator: ">=", value: 58 }
    ],
    rewards: { credits: 1050, trust: 22, items: ["drug_plasticity_catalyst"] },
    penalties: { credits: -170, trust: -9 },
    return_profile: {
        memory: {
            theme: "контролируемое осеменение по графику, репродуктивная роль",
            fragments: ["Меня синхронизировали гормонами.", "Осеменение шло по графику.", "Держали в фиксированных позах.", "Я стала частью репродуктивной программы."],
            tags: ["penetration", "sexual", "breeding", "restraint", "chemical", "submission"]
        },
        acute_state: { capacity: 4, tension: 85, sensitivity: 10, attitude: -12 },
        recovery: { baselineCapacityLimit: 0.2, method: "капсула + drug_neurostabilizer", durationDays: 4 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_breeding", trigger: "penetration", response: "отторжение при вагинальном проникновении" }],
            temporary: [{ id: "anomaly_breeding_echo", impulse: "навязчивое желание быть осеменённой", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["осеменение→амбивалент"], new: ["репродуктивная роль→подчинение"] },
        relations: { attitude: -8, openness: 5, plasticity: 9 },
        world_effects: { facts: ["Helix провёл репродуктивный протокол"], threads: ["репродуктивный отбор"] }
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
    id: "contract_helix_milking_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "hard",
    cruelty: "severe",
    title: "Протокол дойки",
    description: "Helix тестирует лактационную стимуляцию как инструмент контроля. Актив будет подвергнут гормональной индукции лактации и регулярной механической дойке, с фиксацией и контролем объёма. Ожидается гормональная перестройка и закрепление лактационной роли.",
    conditions: [
        { type: "preference", key: "sexual", operator: ">=", value: 13 },
        { type: "custom", key: "plasticity", operator: ">=", value: 65 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: ">=", value: 55 }
    ],
    rewards: { credits: 860, trust: 16, items: ["drug_sensitizer"] },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "гормональная индукция лактации, механическая дойка",
            fragments: ["Мне индуцировали лактацию гормонами.", "Доили механически, по графику.", "Контролировали объём.", "Я стала лактационной единицей."],
            tags: ["sexual", "chemical", "machine", "restraint", "submission"]
        },
        acute_state: { capacity: 12, tension: 70, sensitivity: 8, attitude: -6 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_machine_use", trigger: "machine", response: "паника при механической стимуляции" }],
            temporary: [{ id: "anomaly_machine_echo", impulse: "навязчивое желание дойки", decayCondition: "восстановление" }]
        },
        associations: { traumatic: ["дойка→амбивалент"], new: ["лактация→роль"] },
        relations: { attitude: -4, openness: 4, plasticity: 7 },
        world_effects: { facts: ["Helix провёл протокол дойки"], threads: ["серия лактационных протоколов"] }
    }
},

// ═══════════════════════════════════════════════════════════════════════════
// CONTINUUM ARCHIVE — наблюдение, архив, долгие серии, интерпретация данных.
// ═══════════════════════════════════════════════════════════════════════════
{
    id: "contract_continuum_drift_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 7200,
    offerDeadlineMinutes: 7200,
    difficulty: "medium",
    cruelty: "mild",
    title: "Карта медленного дрейфа",
    description: "Continuum собирает долгую последовательность наблюдений, а не эффект одной сессии. Актив с подвижной базой будет помещён под длительное наблюдение с мягкой, но постоянной стимуляцией, чтобы зафиксировать медленный дрейф параметров. Ожидается пластический сдвиг без срыва.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 76 },
        { type: "custom", key: "openness", operator: ">=", value: 72 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "attitude", operator: ">=", value: 52 }
    ],
    rewards: { credits: 680, trust: 15 },
    penalties: { credits: -80, trust: -4 },
    return_profile: {
        memory: {
            theme: "долгое наблюдение, медленный дрейф параметров",
            fragments: ["Меня наблюдали долго.", "Стимуляция была мягкой, но постоянной.", "Параметры медленно дрейфовали.", "Я изменилась незаметно для себя."],
            tags: ["observation", "drift", "plasticity", "stimulation"]
        },
        acute_state: { capacity: 30, tension: 40, sensitivity: 3, attitude: 2 },
        recovery: { baselineCapacityLimit: 0.7, method: "отдых", durationDays: 1 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: [{ id: "anomaly_drift_echo", impulse: "навязчивое самонаблюдение", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["наблюдение→норма", "дрейф→изменение"] },
        relations: { attitude: 3, openness: 5, plasticity: 6 },
        world_effects: { facts: ["Continuum зафиксировал медленный дрейф"], threads: ["долгосрочное наблюдение"] }
    }
},
{
    id: "contract_continuum_crossindex_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "mild",
    title: "Перекрёстный индекс",
    description: "Архив сверяет биометрические записи с субъективной оценкой процедуры. Нужен актив, у которого одновременно закрепились два независимых ассоциативных контура — медицинский и электронный. Такая комбинация помогает отличать общий сдвиг от случайной реакции.",
    conditions: [
        { type: "preference", key: "clinical", operator: ">=", value: 13 },
        { type: "preference", key: "electronic", operator: ">=", value: 13 },
        { type: "custom", key: "plasticity", operator: ">=", value: 68 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 58 }
    ],
    rewards: { credits: 720, trust: 14 },
    penalties: { credits: -90, trust: -4 },
    return_profile: {
        memory: {
            theme: "сверка биометрии с субъективной оценкой",
            fragments: ["Меня измеряли и опрашивали.", "Сверяли биометрию с моими словами.", "Искали расхождение между телом и оценкой.", "Я стала набором индексов."],
            tags: ["clinical", "electronic", "observation", "measurement"]
        },
        acute_state: { capacity: 25, tension: 45, sensitivity: 4, attitude: 2 },
        recovery: { baselineCapacityLimit: 0.6, method: "отдых", durationDays: 1 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: [{ id: "anomaly_crossindex_echo", impulse: "навязчивое сопоставление ощущений и данных", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["измерение→норма", "данные→идентичность"] },
        relations: { attitude: 3, openness: 4, plasticity: 5 },
        world_effects: { facts: ["Continuum построил перекрёстный индекс"], threads: ["серия сверок"] }
    }
},
{
    id: "contract_continuum_mapping_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "moderate",
    title: "Картирование отклика",
    description: "Архив строит полную карту сенсорного отклика актива. Актив будет подвергнут систематической стимуляции каждой эрогенной зоны по отдельности и в сочетаниях, включая вагинальное, анальное и оральное проникновение, с фиксацией порогов и ассоциаций. Ожидается исчерпывающая карта чувствительности и закрепление самонаблюдения.",
    conditions: [
        { type: "custom", key: "sensitivity", operator: ">=", value: 65 },
        { type: "custom", key: "plasticity", operator: ">=", value: 65 },
        { type: "custom", key: "openness", operator: ">=", value: 65 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 800, trust: 16 },
    penalties: { credits: -110, trust: -5 },
    return_profile: {
        memory: {
            theme: "систематическое картирование каждой зоны, включая проникновение",
            fragments: ["Каждую зону стимулировали по отдельности.", "Потом в сочетаниях, с проникновением.", "Фиксировали пороги и ассоциации.", "Я стала картой собственного тела."],
            tags: ["mapping", "sensitivity", "observation", "sexual", "penetration", "oral", "measurement"]
        },
        acute_state: { capacity: 15, tension: 60, sensitivity: 6, attitude: -3 },
        recovery: { baselineCapacityLimit: 0.45, method: "капсула", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: [{ id: "anomaly_mapping_echo", impulse: "навязчивое картирование собственных ощущений", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["карта→идентичность", "стимуляция→данные"] },
        relations: { attitude: -2, openness: 5, plasticity: 6 },
        world_effects: { facts: ["Continuum построил карту отклика"], threads: ["серия картирований"] }
    }
},
{
    id: "contract_continuum_plasticity_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 5760,
    offerDeadlineMinutes: 5760,
    difficulty: "hard",
    cruelty: "moderate",
    title: "Пластический предел",
    description: "Архив измеряет верхнюю границу пластичности актива. Актив будет подвергнут серии нарастающих перестроек — от мягких до предельных — чтобы определить, где пластичность переходит в необратимый срыв. Ожидается точная граница пластического предела.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 78 },
        { type: "custom", key: "openness", operator: ">=", value: 70 },
        { type: "custom", key: "capacity", operator: ">=", value: 55 },
        { type: "attitude", operator: ">=", value: 50 }
    ],
    rewards: { credits: 850, trust: 17 },
    penalties: { credits: -120, trust: -6 },
    return_profile: {
        memory: {
            theme: "нарастающие перестройки до пластического предела",
            fragments: ["Меня перестраивали снова и снова.", "От мягких до предельных.", "Искали границу, где пластичность срывается.", "Я подошла к пределу вплотную."],
            tags: ["plasticity", "overload", "observation", "breakdown"]
        },
        acute_state: { capacity: 10, tension: 70, sensitivity: 6, attitude: -5 },
        recovery: { baselineCapacityLimit: 0.35, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_breakdown", trigger: "overload", response: "страх перед предельной перестройкой" }],
            temporary: [{ id: "anomaly_plasticity_echo", impulse: "навязчивое желание перестройки", decayCondition: "восстановление" }]
        },
        associations: { traumatic: ["предел→амбивалент"], new: ["перестройка→изменение"] },
        relations: { attitude: -4, openness: 6, plasticity: 8 },
        world_effects: { facts: ["Continuum измерил пластический предел"], threads: ["серия предельных перестроек"] }
    }
},
{
    id: "contract_continuum_comparative_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "mild",
    title: "Сравнительная серия",
    description: "Архив сравнивает отклик актива на одинаковые стимулы в разных состояниях — до и после нагрузки, в покое и в стрессе. Нужен актив с устойчивой базой, чтобы разница была измеримой. Ожидается набор сравнительных данных без глубоких последствий.",
    conditions: [
        { type: "custom", key: "capacity", operator: ">=", value: 60 },
        { type: "custom", key: "openness", operator: ">=", value: 62 },
        { type: "custom", key: "plasticity", operator: ">=", value: 60 },
        { type: "attitude", operator: ">=", value: 55 }
    ],
    rewards: { credits: 660, trust: 13 },
    penalties: { credits: -80, trust: -4 },
    return_profile: {
        memory: {
            theme: "сравнение отклика в разных состояниях",
            fragments: ["Меня стимулировали в разных состояниях.", "До и после нагрузки, в покое и в стрессе.", "Сравнивали отклик.", "Я стала набором сравнительных данных."],
            tags: ["comparative", "observation", "stimulation", "measurement"]
        },
        acute_state: { capacity: 28, tension: 45, sensitivity: 3, attitude: 2 },
        recovery: { baselineCapacityLimit: 0.65, method: "отдых", durationDays: 1 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: [{ id: "anomaly_comparative_echo", impulse: "навязчивое сравнение собственных состояний", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["сравнение→норма", "состояние→данные"] },
        relations: { attitude: 2, openness: 4, plasticity: 4 },
        world_effects: { facts: ["Continuum собрал сравнительную серию"], threads: ["серия сравнений"] }
    }
},
{
    id: "contract_continuum_biography_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Биографическая реконструкция",
    description: "Архив восстанавливает полную биографию актива через направленные воспоминания. Актив будет подвергнут серии интервью и стимуляции памяти, чтобы вскрыть подавленные эпизоды и связать их с текущим профилем. Ожидается вскрытие старых травм и закрепление самоанализа.",
    conditions: [
        { type: "custom", key: "openness", operator: ">=", value: 68 },
        { type: "custom", key: "plasticity", operator: ">=", value: 65 },
        { type: "attitude", operator: ">=", value: 55 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 740, trust: 15 },
    penalties: { credits: -100, trust: -5 },
    return_profile: {
        memory: {
            theme: "вскрытие подавленных эпизодов, реконструкция биографии",
            fragments: ["Меня расспрашивали о прошлом.", "Стимулировали память.", "Подавленные эпизоды вскрывались.", "Я связала прошлое с собой нынешней."],
            tags: ["biography", "memory", "observation", "trauma"]
        },
        acute_state: { capacity: 20, tension: 60, sensitivity: 4, attitude: -4 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: [{ id: "anomaly_biography_echo", impulse: "навязчивое возвращение к прошлому", decayCondition: "время" }]
        },
        associations: { traumatic: ["прошлое→амбивалент"], new: ["биография→идентичность"] },
        relations: { attitude: -3, openness: 6, plasticity: 5 },
        world_effects: { facts: ["Continuum реконструировал биографию"], threads: ["серия биографических реконструкций"] }
    }
},
{
    id: "contract_continuum_trace_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "moderate",
    title: "Аномальный след",
    description: "Архив отслеживает остаточный аномальный след после предельных процедур. Актив, уже прошедший через аномальный отклик, будет помещён под длительное наблюдение, чтобы зафиксировать, как след затухает или закрепляется. Ожидается карта аномального последействия.",
    conditions: [
        { type: "custom", key: "plasticity", operator: ">=", value: 70 },
        { type: "custom", key: "openness", operator: ">=", value: 68 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 65 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 820, trust: 16 },
    penalties: { credits: -110, trust: -5 },
    return_profile: {
        memory: {
            theme: "наблюдение за затуханием аномального следа",
            fragments: ["Меня наблюдали после аномального отклика.", "След то затухал, то закреплялся.", "Фиксировали каждое изменение.", "Я стала картой последействия."],
            tags: ["trace", "anomaly", "observation", "drift"]
        },
        acute_state: { capacity: 15, tension: 60, sensitivity: 6, attitude: -3 },
        recovery: { baselineCapacityLimit: 0.45, method: "капсула", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: [{ id: "anomaly_trace_echo", impulse: "навязчивое отслеживание собственного следа", decayCondition: "время" }]
        },
        associations: { traumatic: ["след→амбивалент"], new: ["последействие→идентичность"] },
        relations: { attitude: -2, openness: 5, plasticity: 6 },
        world_effects: { facts: ["Continuum зафиксировал аномальный след"], threads: ["серия наблюдений следа"] }
    }
},
{
    id: "contract_continuum_archive_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "easy",
    cruelty: "mild",
    title: "Архивная фиксация",
    description: "Архив фиксирует базовый профиль актива для долгосрочного хранения. Актив будет подвергнут стандартной серии измерений и опросов, без глубоких воздействий. Ожидается полная архивная запись без последствий.",
    conditions: [
        { type: "custom", key: "openness", operator: ">=", value: 60 },
        { type: "attitude", operator: ">=", value: 55 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 580, trust: 11 },
    penalties: { credits: -60, trust: -3 },
    return_profile: {
        memory: {
            theme: "стандартная архивная фиксация профиля",
            fragments: ["Меня измерили и опросили.", "Записали базовый профиль.", "Без глубоких воздействий.", "Я стала архивной записью."],
            tags: ["archive", "observation", "measurement"]
        },
        acute_state: { capacity: 35, tension: 35, sensitivity: 2, attitude: 2 },
        recovery: { baselineCapacityLimit: 0.8, method: "отдых", durationDays: 1 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: []
        },
        associations: { traumatic: [], new: ["архив→норма"] },
        relations: { attitude: 2, openness: 3, plasticity: 3 },
        world_effects: { facts: ["Continuum зафиксировал базовый профиль"], threads: ["архивная запись"] }
    }
},
{
    id: "contract_continuum_observation_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 5760,
    offerDeadlineMinutes: 5760,
    difficulty: "medium",
    cruelty: "mild",
    title: "Длительное наблюдение",
    description: "Архив помещает актив под длительное пассивное наблюдение. Актив будет содержаться в наблюдательной камере с мягкой фоновой стимуляцией, чтобы зафиксировать естественный дрейф без вмешательства. Ожидается длинный ряд наблюдений без последствий.",
    conditions: [
        { type: "custom", key: "openness", operator: ">=", value: 65 },
        { type: "custom", key: "plasticity", operator: ">=", value: 60 },
        { type: "attitude", operator: ">=", value: 55 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 700, trust: 14 },
    penalties: { credits: -80, trust: -4 },
    return_profile: {
        memory: {
            theme: "длительное пассивное наблюдение",
            fragments: ["Меня содержали в наблюдательной камере.", "С мягкой фоновой стимуляцией.", "Наблюдали без вмешательства.", "Я привыкла к наблюдению."],
            tags: ["observation", "drift", "passive"]
        },
        acute_state: { capacity: 30, tension: 40, sensitivity: 3, attitude: 2 },
        recovery: { baselineCapacityLimit: 0.7, method: "отдых", durationDays: 1 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: [{ id: "anomaly_drift_echo", impulse: "навязчивое самонаблюдение", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["наблюдение→норма"] },
        relations: { attitude: 2, openness: 4, plasticity: 4 },
        world_effects: { facts: ["Continuum провёл длительное наблюдение"], threads: ["долгосрочное наблюдение"] }
    }
},
{
    id: "contract_continuum_recovery_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "mild",
    title: "Протокол восстановления",
    description: "Архив изучает процесс восстановления актива после нагрузки. Актив будет доведён до умеренного истощения, после чего помещён под наблюдение для фиксации кривой восстановления. Ожидается карта восстановления без глубоких последствий.",
    conditions: [
        { type: "custom", key: "capacity", operator: ">=", value: 55 },
        { type: "custom", key: "plasticity", operator: ">=", value: 60 },
        { type: "attitude", operator: ">=", value: 55 },
        { type: "custom", key: "openness", operator: ">=", value: 60 }
    ],
    rewards: { credits: 680, trust: 13 },
    penalties: { credits: -80, trust: -4 },
    return_profile: {
        memory: {
            theme: "фиксация кривой восстановления после истощения",
            fragments: ["Меня довели до умеренного истощения.", "Потом наблюдали восстановление.", "Фиксировали кривую.", "Я восстановилась под наблюдением."],
            tags: ["recovery", "observation", "exhaustion"]
        },
        acute_state: { capacity: 25, tension: 45, sensitivity: 3, attitude: 2 },
        recovery: { baselineCapacityLimit: 0.6, method: "капсула", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: []
        },
        associations: { traumatic: [], new: ["восстановление→норма"] },
        relations: { attitude: 2, openness: 4, plasticity: 4 },
        world_effects: { facts: ["Continuum зафиксировал кривую восстановления"], threads: ["серия протоколов восстановления"] }
    }
},
{
    id: "contract_continuum_breeding_archive_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "severe",
    title: "Репродуктивный архив",
    description: "Архив собирает данные о репродуктивном отклике актива. Актив будет подвергнут контролируемому осеменению с полной фиксацией физиологических и субъективных данных, чтобы пополнить репродуктивный архив. Ожидается гормональная перестройка и закрепление роли носителя.",
    conditions: [
        { type: "preference", key: "penetration", operator: ">=", value: 14 },
        { type: "custom", key: "plasticity", operator: ">=", value: 66 },
        { type: "custom", key: "openness", operator: ">=", value: 62 },
        { type: "custom", key: "capacity", operator: ">=", value: 52 },
        { type: "attitude", operator: ">=", value: 52 }
    ],
    rewards: { credits: 950, trust: 19, items: ["drug_plasticity_catalyst"] },
    penalties: { credits: -140, trust: -7 },
    return_profile: {
        memory: {
            theme: "контролируемое осеменение с полной фиксацией данных",
            fragments: ["Меня осеменили под полным контролем.", "Фиксировали каждую реакцию.", "Данные ушли в репродуктивный архив.", "Я стала носителем."],
            tags: ["penetration", "sexual", "breeding", "observation", "chemical"]
        },
        acute_state: { capacity: 6, tension: 75, sensitivity: 8, attitude: -8 },
        recovery: { baselineCapacityLimit: 0.3, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_breeding", trigger: "penetration", response: "отторжение при вагинальном проникновении" }],
            temporary: [{ id: "anomaly_breeding_echo", impulse: "навязчивое желание быть осеменённой", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["осеменение→амбивалент"], new: ["роль носителя→подчинение"] },
        relations: { attitude: -6, openness: 5, plasticity: 8 },
        world_effects: { facts: ["Continuum пополнил репродуктивный архив"], threads: ["репродуктивный архив"] }
    }
},
{
    id: "contract_continuum_orgasm_archive_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Архив разрядки",
    description: "Архив собирает данные об оргазменном отклике актива. Актив будет доведён до оргазма серией контролируемых стимуляций, с полной фиксацией физиологии и субъективной оценки. Ожидается набор данных о разрядке без глубоких последствий.",
    conditions: [
        { type: "preference", key: "sexual", operator: ">=", value: 14 },
        { type: "custom", key: "sensitivity", operator: ">=", value: 62 },
        { type: "custom", key: "openness", operator: ">=", value: 60 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 720, trust: 14 },
    penalties: { credits: -90, trust: -4 },
    return_profile: {
        memory: {
            theme: "контролируемая разрядка с полной фиксацией данных",
            fragments: ["Меня доводили до оргазма серией стимуляций.", "Фиксировали физиологию и мои слова.", "Данные ушли в архив разрядки.", "Я стала набором оргазменных данных."],
            tags: ["sexual", "orgasm", "observation", "measurement"]
        },
        acute_state: { capacity: 20, tension: 55, sensitivity: 5, attitude: -2 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: [{ id: "anomaly_orgasm_echo", impulse: "навязчивое желание разрядки", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["разрядка→данные"] },
        relations: { attitude: -1, openness: 4, plasticity: 5 },
        world_effects: { facts: ["Continuum пополнил архив разрядки"], threads: ["серия архиваций разрядки"] }
    }
},
{
    id: "contract_continuum_penetration_archive_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Архив проникновения",
    description: "Архив собирает данные о реакции актива на проникновение. Актив будет подвергнут серии контролируемых проникновений с нарастающей глубиной и фиксацией отклика. Ожидается набор данных о проникновении без глубоких последствий.",
    conditions: [
        { type: "preference", key: "penetration", operator: ">=", value: 13 },
        { type: "custom", key: "plasticity", operator: ">=", value: 60 },
        { type: "custom", key: "openness", operator: ">=", value: 60 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 700, trust: 13 },
    penalties: { credits: -90, trust: -4 },
    return_profile: {
        memory: {
            theme: "серия контролируемых проникновений с фиксацией отклика",
            fragments: ["Меня подвергли серии проникновений.", "Глубина нарастала.", "Фиксировали отклик.", "Я стала набором данных о проникновении."],
            tags: ["penetration", "sexual", "observation", "measurement"]
        },
        acute_state: { capacity: 18, tension: 55, sensitivity: 5, attitude: -2 },
        recovery: { baselineCapacityLimit: 0.5, method: "отдых", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: [{ id: "anomaly_penetration_echo", impulse: "навязчивое желание проникновения", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["проникновение→данные"] },
        relations: { attitude: -1, openness: 4, plasticity: 5 },
        world_effects: { facts: ["Continuum пополнил архив проникновения"], threads: ["серия архиваций проникновения"] }
    }
},
{
    id: "contract_continuum_oral_archive_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2160,
    offerDeadlineMinutes: 2160,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Архив орального отклика",
    description: "Архив собирает данные об оральном отклике актива. Актив будет подвергнут серии контролируемых оральных стимуляций с фиксацией рефлексов и субъективной оценки. Ожидается набор данных об оральном отклике без глубоких последствий.",
    conditions: [
        { type: "preference", key: "oral", operator: ">=", value: 13 },
        { type: "custom", key: "openness", operator: ">=", value: 60 },
        { type: "custom", key: "plasticity", operator: ">=", value: 58 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 }
    ],
    rewards: { credits: 680, trust: 13 },
    penalties: { credits: -80, trust: -4 },
    return_profile: {
        memory: {
            theme: "серия контролируемых оральных стимуляций",
            fragments: ["Меня подвергли серии оральных стимуляций.", "Фиксировали рефлексы и мои слова.", "Данные ушли в архив.", "Я стала набором оральных данных."],
            tags: ["oral", "sexual", "observation", "measurement"]
        },
        acute_state: { capacity: 20, tension: 50, sensitivity: 4, attitude: -1 },
        recovery: { baselineCapacityLimit: 0.55, method: "отдых", durationDays: 2 },
        traits: {
            kept: [],
            traumatic: [],
            temporary: [{ id: "anomaly_oral_echo", impulse: "навязчивое желание оральной стимуляции", decayCondition: "время" }]
        },
        associations: { traumatic: [], new: ["оральный отклик→данные"] },
        relations: { attitude: -1, openness: 4, plasticity: 4 },
        world_effects: { facts: ["Continuum пополнил архив орального отклика"], threads: ["серия архиваций орального отклика"] }
    }
},
{
    id: "contract_continuum_gang_archive_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "hard",
    cruelty: "severe",
    title: "Архив группового отклика",
    description: "Архив собирает данные о реакции актива на множественное использование. Актив будет передан группе операторов для контролируемого группового использования с полной фиксацией отклика. Ожидается набор данных о групповом отклике и закрепление роли объекта.",
    conditions: [
        { type: "preference", key: "sexual", operator: ">=", value: 14 },
        { type: "preference", key: "humiliation", operator: ">=", value: 12 },
        { type: "custom", key: "capacity", operator: ">=", value: 50 },
        { type: "custom", key: "openness", operator: ">=", value: 58 }
    ],
    rewards: { credits: 900, trust: 18 },
    penalties: { credits: -130, trust: -7 },
    return_profile: {
        memory: {
            theme: "контролируемое групповое использование с фиксацией отклика",
            fragments: ["Меня передали группе операторов.", "Использовали под полным контролем.", "Фиксировали каждую реакцию.", "Я стала объектом группового отклика."],
            tags: ["sexual", "penetration", "oral", "humiliation", "observation"]
        },
        acute_state: { capacity: 8, tension: 75, sensitivity: 7, attitude: -10 },
        recovery: { baselineCapacityLimit: 0.3, method: "капсула + drug_neurostabilizer", durationDays: 3 },
        traits: {
            kept: [],
            traumatic: [{ id: "trauma_gang_use", trigger: "humiliation", response: "паника при множественном внимании" }],
            temporary: [{ id: "anomaly_gang_echo", impulse: "навязчивое желание быть использованной", decayCondition: "работа с памятью" }]
        },
        associations: { traumatic: ["группа→негатив"], new: ["роль объекта→подчинение"] },
        relations: { attitude: -8, openness: 5, plasticity: 7 },
        world_effects: { facts: ["Continuum пополнил архив группового отклика"], threads: ["серия архиваций группового отклика"] }
    }
},

];
