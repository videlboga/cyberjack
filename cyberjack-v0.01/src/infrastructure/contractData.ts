import type { AssetContract } from '../domain/types';

type ContractSeedData = Omit<AssetContract, 'state'>;

/**
 * Контент контрактов — 30 штук (Veil 10, Helix 10, Continuum 10).
 * Источник: docs/plans/contract-content-v1.md
 */
export const CONTRACT_DATA: ContractSeedData[] = [
{
    id: "contract_veil_somatosensory_feet_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    title: "Протокол непрерывной соматосенсорной нагрузки нижних конечностей",
    description: "Требуется актив с фокусом на ступнях и щекотке, высокой общей и локальной чувствительностью, высокой открытостью. В течение 48–72 часов будет поддерживаться непрерывная сенсорная нагрузка с фармакологическим усилением и ограничением сна. Ожидаются тяжёлое истощение, нестабильность чувствительности и стойкие ассоциативные последствия.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_point_feet",
        operator: ">=",
        value: 2
      },
{
        type: "acquired_trait",
        key: "trait_knismolagnia",
        operator: ">=",
        value: 2
      },
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 65
      }
    ],
    rewards: {
      credits: 900,
      trust: 18,
      items: [
"drug_sensitizer"
      ]
    },
    penalties: {
      credits: -140,
      trust: -8
    },
    return_profile: {
      memory: {
        theme: "непрерывная щекотка ступней под препаратами, с откликом Аномалии",
        fragments: [
"Меня приковали к машине и зафиксировали ступни.",
"Вводили препараты, разгоняющие чувствительность, и стимуляторы, чтобы я не спала.",
"Силиконовые валики-щётки не прекращали щекотать ступни ни на минуту.",
"Когда перегрузка достигала предела, я чувствовала, как отзывается Аномалия, и проваливалась в транс.",
"В трансе не оставалось ничего, кроме усиленного во много раз ощущения щекотки."
        ],
        tags: [
"tickling",
"feet",
"restraint",
"chemical",
"anomaly",
"exhaustion",
"trance"
        ]
      },
      acute_state: {
        capacity: 5,
        tension: 85,
        sensitivity: 10,
        attitude: -15
      },
      recovery: {
        baselineCapacityLimit: 0.25,
        method: "капсула + drug_regenerative",
        durationDays: 4
      },
      traits: {
        kept: [
"trait_point_feet",
"trait_knismolagnia"
        ],
        traumatic: [
{
            id: "trauma_foot_stimulation",
            trigger: "tickling/feet",
            response: "страх, избегание, флэшбеки, повышенная перегрузка при стимуляции ступней"
          }
        ],
        temporary: [
{
            id: "anomaly_foot_echo",
            impulse: "навязчивый поиск прикосновений к ступням вопреки травме",
            decayCondition: "восстановление, время, работа с памятью"
          }
        ]
      },
      associations: {
        traumatic: [
"ступни+щекотка→негатив",
"фиксация→негатив",
"препараты→амбивалент"
        ],
        new: [
"Аномалия→притягательная/пугающая"
        ]
      },
      relations: {
        attitude: -10,
        openness: 5,
        plasticity: 5
      },
      world_effects: {
        facts: [
"Veil провёл непрерывный протокол на активе, зафиксирован аномальный отклик на щекотку ступней"
        ],
        threads: [
"повторный запрос Veil",
"изучение аномального эха"
        ]
      }
    }
  },
{
    id: "contract_veil_resonance_pain_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    title: "Резонансный болевой контур",
    description: "Veil ищет актив, у которого боль уже осмыслена как значимый сигнал, но чувствительность не перешла в сенсорный срыв. Актив будет закреплён на столе и подвергнут серии нарастающих болевых воздействий — от тупых ударов до точечных проколов и электроразрядов — до выхода на устойчивый резонансный отклик. Ожидается глубокая перегрузка и перестройка болевого порога.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_masochist",
        operator: ">=",
        value: 2
      },
{
        type: "preference",
        key: "pain",
        operator: ">=",
        value: 18
      },
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 68
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 45
      },
{
        type: "attitude",
        operator: "<=",
        value: 72
      }
    ],
    rewards: {
      credits: 820,
      trust: 16,
      items: [
"drug_painkiller"
      ]
    },
    penalties: {
      credits: -120,
      trust: -6
    },
    return_profile: {
      memory: {
        theme: "нарастающая боль до резонанса, тело как инструмент",
        fragments: [
"Меня закрепили на столе.",
"Боль нарастала от тупых ударов до точечных проколов и разрядов.",
"Тело отзывалось на каждый удар, пока не вышло на резонанс.",
"В резонансе боль стала почти музыкой, а потом я сорвалась."
        ],
        tags: [
"pain",
"impact",
"piercing",
"electronic",
"restraint",
"overload"
        ]
      },
      acute_state: {
        capacity: 4,
        tension: 90,
        sensitivity: 8,
        attitude: -12
      },
      recovery: {
        baselineCapacityLimit: 0.2,
        method: "капсула + drug_regenerative",
        durationDays: 3
      },
      traits: {
        kept: [
"trait_masochist"
        ],
        traumatic: [
{
            id: "trauma_pain_resonance",
            trigger: "pain",
            response: "флэшбеки и паника при резких болевых стимулах"
          }
        ],
        temporary: [
{
            id: "anomaly_pain_echo",
            impulse: "тяга вернуться к болевому пику",
            decayCondition: "восстановление"
          }
        ]
      },
      associations: {
        traumatic: [
"боль→амбивалент",
"стол/фиксация→негатив"
        ],
        new: [
"Аномалия→резонанс"
        ]
      },
      relations: {
        attitude: -8,
        openness: 3,
        plasticity: 6
      },
      world_effects: {
        facts: [
"Veil зафиксировал резонансный болевой профиль"
        ],
        threads: [
"серия болевых протоколов"
        ]
      }
    }
  },
{
    id: "contract_veil_exposure_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    title: "Открытая экспозиция",
    description: "Veil проверяет переходный профиль: интерес к демонстрации уже закрепился, но общая открытость ещё не растворила осторожность. Актив будет выставлен обнажённым в открытом зале наблюдения и подвергнут длительной демонстрации всех эрогенных зон перед группой наблюдателей, с фиксацией в раскрытых позах. Ожидается слом стыда и закрепление эксгибиционистского отклика.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_exhibitionist",
        operator: ">=",
        value: 1
      },
{
        type: "preference",
        key: "exposure",
        operator: ">=",
        value: 16
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 64
      },
{
        type: "attitude",
        operator: ">=",
        value: 55
      }
    ],
    rewards: {
      credits: 690,
      trust: 12
    },
    penalties: {
      credits: -90,
      trust: -4
    },
    return_profile: {
      memory: {
        theme: "обнажённая демонстрация перед наблюдателями, слом стыда",
        fragments: [
"Меня раздели и выставили в открытом зале.",
"Фиксировали в раскрытых позах перед группой наблюдателей.",
"Каждый взгляд прожигал кожу, пока стыд не сломался.",
"Я перестала различать лица — только взгляды."
        ],
        tags: [
"exposure",
"humiliation",
"vulnerable",
"sexual",
"restraint"
        ]
      },
      acute_state: {
        capacity: 20,
        tension: 60,
        sensitivity: 5,
        attitude: -8
      },
      recovery: {
        baselineCapacityLimit: 0.5,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [
"trait_exhibitionist"
        ],
        traumatic: [
{
            id: "trauma_public_exposure",
            trigger: "exposure/humiliation",
            response: "паника при публичной наготе"
          }
        ],
        temporary: [
{
            id: "anomaly_exposure_echo",
            impulse: "навязчивое желание снова быть увиденной",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [
"нагота→амбивалент",
"взгляды→негатив"
        ],
        new: [
"демонстрация→возбуждение"
        ]
      },
      relations: {
        attitude: -5,
        openness: 8,
        plasticity: 4
      },
      world_effects: {
        facts: [
"Veil провёл публичную экспозицию"
        ],
        threads: [
"повторная демонстрация"
        ]
      }
    }
  },
{
    id: "contract_veil_clinical_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    title: "Клинический допуск",
    description: "Veil открывает серию инвазивных измерений. Актив, для которого медицинская рамка уже стала приемлемой, будет подвергнут полному гинекологическому и ректальному обследованию с инструментами, забором проб и длительным удержанием в раскрытом состоянии. Важна не покорность, а сочетание доверия к процедуре, пластичности и рабочего резерва.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_clinical_fetish",
        operator: ">=",
        value: 1
      },
{
        type: "preference",
        key: "clinical",
        operator: ">=",
        value: 15
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 62
      },
{
        type: "attitude",
        operator: ">=",
        value: 60
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 52
      }
    ],
    rewards: {
      credits: 840,
      trust: 16
    },
    penalties: {
      credits: -120,
      trust: -6
    },
    return_profile: {
      memory: {
        theme: "инвазивное клиническое обследование, тело как образец",
        fragments: [
"Меня уложили на гинекологическое кресло.",
"Инструменты входили в меня, пока я была раскрыта и удержана.",
"Брали пробы, фиксировали каждую реакцию.",
"Я перестала быть человеком — стала образцом."
        ],
        tags: [
"clinical",
"penetration",
"exposure",
"restraint"
        ]
      },
      acute_state: {
        capacity: 15,
        tension: 70,
        sensitivity: 6,
        attitude: -10
      },
      recovery: {
        baselineCapacityLimit: 0.4,
        method: "капсула",
        durationDays: 2
      },
      traits: {
        kept: [
"trait_clinical_fetish"
        ],
        traumatic: [
{
            id: "trauma_clinical_invasive",
            trigger: "clinical/medical",
            response: "страх перед инструментами"
          }
        ],
        temporary: [
{
            id: "anomaly_clinical_echo",
            impulse: "навязчивое желание повторного осмотра",
            decayCondition: "восстановление"
          }
        ]
      },
      associations: {
        traumatic: [
"инструменты→негатив",
"осмотр→амбивалент"
        ],
        new: [
"медицинская рамка→подчинение"
        ]
      },
      relations: {
        attitude: -6,
        openness: 4,
        plasticity: 7
      },
      world_effects: {
        facts: [
"Veil провёл инвазивный клинический протокол"
        ],
        threads: [
"серия измерений"
        ]
      }
    }
  },
{
    id: "contract_veil_deprivation_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    title: "Сенсорная депривация",
    description: "Veil изучает отклик Аномалии на полное лишение сенсорного входа. Актив будет помещён в изолирующий кокон с заглушёнными зрением, слухом и осязанием, при этом удерживаемый на грани оргазма без разрядки. Ожидается глубокая диссоциация и аномальный отклик на пустоту.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_sensory_deprivation",
        operator: ">=",
        value: 1
      },
{
        type: "preference",
        key: "deprivation",
        operator: ">=",
        value: 15
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 60
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 60
      }
    ],
    rewards: {
      credits: 780,
      trust: 15
    },
    penalties: {
      credits: -110,
      trust: -5
    },
    return_profile: {
      memory: {
        theme: "пустота кокона, удержание на грани оргазма",
        fragments: [
"Меня поместили в изолирующий кокон.",
"Зрение, слух и осязание заглушили.",
"Держали на грани оргазма без разрядки.",
"В пустоте я провалилась в диссоциацию, и Аномалия отозвалась."
        ],
        tags: [
"deprivation",
"restraint",
"sexual",
"anomaly",
"trance"
        ]
      },
      acute_state: {
        capacity: 10,
        tension: 80,
        sensitivity: 12,
        attitude: -10
      },
      recovery: {
        baselineCapacityLimit: 0.3,
        method: "капсула + drug_neurostabilizer",
        durationDays: 3
      },
      traits: {
        kept: [
"trait_sensory_deprivation"
        ],
        traumatic: [
{
            id: "trauma_isolation",
            trigger: "deprivation",
            response: "паника в замкнутом пространстве"
          }
        ],
        temporary: [
{
            id: "anomaly_void_echo",
            impulse: "тяга к пустоте",
            decayCondition: "восстановление"
          }
        ]
      },
      associations: {
        traumatic: [
"изоляция→негатив",
"пустота→амбивалент"
        ],
        new: [
"Аномалия→пустота"
        ]
      },
      relations: {
        attitude: -8,
        openness: 2,
        plasticity: 8
      },
      world_effects: {
        facts: [
"Veil зафиксировал аномальный отклик на депривацию"
        ],
        threads: [
"изучение пустоты"
        ]
      }
    }
  },
{
    id: "contract_veil_anomaly_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    title: "Аномальный отклик",
    description: "Veil ищет актив, чей профиль уже резонирует с Аномалией. Актив будет подвергнут короткой, но предельной серии стимуляции всех зон одновременно — боль, вибрация, электростимуляция и щекотка — чтобы спровоцировать прямой аномальный отклик. Ожидается временная потеря связности сознания и стойкий аномальный след.",
    conditions: [
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 75
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 70
      },
{
        type: "acquired_trait",
        key: "trait_masochist",
        operator: ">=",
        value: 1
      }
    ],
    rewards: {
      credits: 950,
      trust: 20,
      items: [
"drug_sensitizer"
      ]
    },
    penalties: {
      credits: -150,
      trust: -8
    },
    return_profile: {
      memory: {
        theme: "предельная стимуляция всех зон, прямой отклик Аномалии",
        fragments: [
"Меня стимулировали все зоны одновременно.",
"Боль, вибрация, разряды и щекотка слились в один поток.",
"Перегрузка достигла предела, и Аномалия отозвалась напрямую.",
"Я потеряла связность сознания."
        ],
        tags: [
"pain",
"electronic",
"tickling",
"vibration",
"anomaly",
"overload",
"trance"
        ]
      },
      acute_state: {
        capacity: 3,
        tension: 95,
        sensitivity: 15,
        attitude: -15
      },
      recovery: {
        baselineCapacityLimit: 0.15,
        method: "капсула + drug_neurostabilizer",
        durationDays: 4
      },
      traits: {
        kept: [
"trait_masochist"
        ],
        traumatic: [
{
            id: "trauma_anomaly_overload",
            trigger: "overload",
            response: "флэшбеки и диссоциация при перегрузке"
          }
        ],
        temporary: [
{
            id: "anomaly_resonance_echo",
            impulse: "навязчивый поиск перегрузки",
            decayCondition: "восстановление/работа с памятью"
          }
        ]
      },
      associations: {
        traumatic: [
"перегрузка→негатив",
"Аномалия→пугающая"
        ],
        new: [
"Аномалия→притягательная"
        ]
      },
      relations: {
        attitude: -12,
        openness: 6,
        plasticity: 10
      },
      world_effects: {
        facts: [
"Veil спровоцировал прямой аномальный отклик"
        ],
        threads: [
"изучение аномального следа"
        ]
      }
    }
  },
{
    id: "contract_veil_pharma_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    title: "Фармакологический разгон",
    description: "Veil тестирует линейку стимуляторов чувствительности. Актив будет накачан препаратами, разгоняющими нервную реактивность до предела, и удерживаем в состоянии гиперчувствительности, пока препараты не выветрятся. Ожидается нестабильность чувствительности и химическая зависимость от пика.",
    conditions: [
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 60
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 60
      },
{
        type: "preference",
        key: "chemical",
        operator: ">=",
        value: 12
      }
    ],
    rewards: {
      credits: 800,
      trust: 15,
      items: [
"drug_sensitizer"
      ]
    },
    penalties: {
      credits: -120,
      trust: -6
    },
    return_profile: {
      memory: {
        theme: "химический разгон чувствительности до предела",
        fragments: [
"Мне вводили препараты, разгоняющие чувствительность.",
"Каждое прикосновение стало невыносимо ярким.",
"Я удерживалась на пике, пока препараты не выветрились.",
"Тело требовало ещё."
        ],
        tags: [
"chemical",
"sensitivity",
"overload",
"trance"
        ]
      },
      acute_state: {
        capacity: 8,
        tension: 75,
        sensitivity: 18,
        attitude: -10
      },
      recovery: {
        baselineCapacityLimit: 0.25,
        method: "капсула + drug_neurostabilizer",
        durationDays: 3
      },
      traits: {
        kept: [],
        traumatic: [
{
            id: "trauma_chemical_peak",
            trigger: "chemical",
            response: "страх перед препаратами"
          }
        ],
        temporary: [
{
            id: "anomaly_chemical_echo",
            impulse: "тяга к химическому пику",
            decayCondition: "восстановление"
          }
        ]
      },
      associations: {
        traumatic: [
"препараты→амбивалент",
"пик→негатив"
        ],
        new: [
"химический пик→зависимость"
        ]
      },
      relations: {
        attitude: -7,
        openness: 3,
        plasticity: 6
      },
      world_effects: {
        facts: [
"Veil протестировал линейку стимуляторов"
        ],
        threads: [
"повторный фармакологический протокол"
        ]
      }
    }
  },
{
    id: "contract_veil_vibration_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    title: "Непрерывная вибронагрузка",
    description: "Veil изучает отклик на непрерывную вибрационную стимуляцию гениталий. Актив будет закреплён на вибростанке с постоянной стимуляцией клитора и вагины, с периодическим доведением до оргазма и немедленным продолжением без паузы. Ожидается истощение и перестройка оргазменного порога.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_point_clitoris",
        operator: ">=",
        value: 1
      },
{
        type: "preference",
        key: "sexual",
        operator: ">=",
        value: 15
      },
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 65
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 50
      }
    ],
    rewards: {
      credits: 760,
      trust: 14
    },
    penalties: {
      credits: -100,
      trust: -5
    },
    return_profile: {
      memory: {
        theme: "непрерывная вибрация, оргазм без паузы",
        fragments: [
"Меня закрепили на вибростанке.",
"Вибрация не прекращалась ни на секунду.",
"Доводили до оргазма и сразу продолжали без паузы.",
"Я перестала различать, где заканчивается один оргазм и начинается другой."
        ],
        tags: [
"vibration",
"sexual",
"clitoris",
"penetration",
"overload",
"exhaustion"
        ]
      },
      acute_state: {
        capacity: 6,
        tension: 80,
        sensitivity: 10,
        attitude: -8
      },
      recovery: {
        baselineCapacityLimit: 0.25,
        method: "капсула",
        durationDays: 3
      },
      traits: {
        kept: [
"trait_point_clitoris"
        ],
        traumatic: [
{
            id: "trauma_vibration_overload",
            trigger: "vibration",
            response: "паника при вибрации"
          }
        ],
        temporary: [
{
            id: "anomaly_vibration_echo",
            impulse: "навязчивое желание вибрации",
            decayCondition: "восстановление"
          }
        ]
      },
      associations: {
        traumatic: [
"вибрация→амбивалент",
"оргазм→негатив"
        ],
        new: [
"вибростанок→зависимость"
        ]
      },
      relations: {
        attitude: -6,
        openness: 4,
        plasticity: 5
      },
      world_effects: {
        facts: [
"Veil зафиксировал перестройку оргазменного порога"
        ],
        threads: [
"серия вибропротоколов"
        ]
      }
    }
  },
{
    id: "contract_veil_electro_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 2160.0,
    offerDeadlineMinutes: 2160.0,
    title: "Электростимуляционный контур",
    description: "Veil калибрует электростимуляционный контур на эрогенных зонах. Актив будет подключён к электродам на клиторе, сосках и анусе, с нарастающей силой разрядов до порога срыва. Ожидается перестройка нервной проводимости и электрофетишистский след.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_electrophile",
        operator: ">=",
        value: 1
      },
{
        type: "preference",
        key: "electronic",
        operator: ">=",
        value: 16
      },
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 68
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 48
      }
    ],
    rewards: {
      credits: 790,
      trust: 15
    },
    penalties: {
      credits: -110,
      trust: -5
    },
    return_profile: {
      memory: {
        theme: "электроразряды на эрогенных зонах до порога срыва",
        fragments: [
"Меня подключили к электродам на клиторе, сосках и анусе.",
"Разряды нарастали, пока я не вышла на порог срыва.",
"Каждый разряд перестраивал нервную проводимость.",
"Я сорвалась и потеряла контроль."
        ],
        tags: [
"electronic",
"pain",
"sexual",
"clitoris",
"anus",
"overload"
        ]
      },
      acute_state: {
        capacity: 7,
        tension: 85,
        sensitivity: 12,
        attitude: -10
      },
      recovery: {
        baselineCapacityLimit: 0.25,
        method: "капсула",
        durationDays: 3
      },
      traits: {
        kept: [
"trait_electrophile"
        ],
        traumatic: [
{
            id: "trauma_electro",
            trigger: "electronic",
            response: "страх перед разрядами"
          }
        ],
        temporary: [
{
            id: "anomaly_electro_echo",
            impulse: "тяга к разрядам",
            decayCondition: "восстановление"
          }
        ]
      },
      associations: {
        traumatic: [
"разряды→амбивалент",
"электроды→негатив"
        ],
        new: [
"электростимуляция→зависимость"
        ]
      },
      relations: {
        attitude: -7,
        openness: 3,
        plasticity: 6
      },
      world_effects: {
        facts: [
"Veil откалибровал электростимуляционный контур"
        ],
        threads: [
"серия электропротоколов"
        ]
      }
    }
  },
{
    id: "contract_veil_breakdown_01",
    issuerId: "fac_veil",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    title: "Срыв и пересборка",
    description: "Veil ищет актив для полного срыва и последующей пересборки личности. Актив будет доведён до полного сенсорного и психологического срыва комбинированной стимуляцией, после чего пересобран под новый профиль. Ожидается глубокая травма и необратимая перестройка.",
    conditions: [
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 75
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 55
      },
{
        type: "attitude",
        operator: ">=",
        value: 50
      }
    ],
    rewards: {
      credits: 1000,
      trust: 22,
      items: [
"drug_plasticity_catalyst"
      ]
    },
    penalties: {
      credits: -160,
      trust: -10
    },
    return_profile: {
      memory: {
        theme: "полный срыв и пересборка личности",
        fragments: [
"Меня довели до полного срыва комбинированной стимуляцией.",
"Я рассыпалась на части.",
"В пустоте меня пересобрали под новый профиль.",
"Я вернулась другой, но помню всё."
        ],
        tags: [
"overload",
"pain",
"sexual",
"anomaly",
"trance",
"breakdown"
        ]
      },
      acute_state: {
        capacity: 2,
        tension: 95,
        sensitivity: 10,
        attitude: -20
      },
      recovery: {
        baselineCapacityLimit: 0.15,
        method: "капсула + drug_neurostabilizer + drug_plasticity_catalyst",
        durationDays: 5
      },
      traits: {
        kept: [],
        traumatic: [
{
            id: "trauma_breakdown",
            trigger: "overload/breakdown",
            response: "глубокая диссоциация и флэшбеки"
          }
        ],
        temporary: [
{
            id: "anomaly_rebuild_echo",
            impulse: "навязчивый поиск нового «я»",
            decayCondition: "работа с памятью"
          }
        ]
      },
      associations: {
        traumatic: [
"срыв→негатив",
"пересборка→амбивалент"
        ],
        new: [
"Аномалия→пересборка"
        ]
      },
      relations: {
        attitude: -15,
        openness: 8,
        plasticity: 12
      },
      world_effects: {
        facts: [
"Veil провёл полный срыв и пересборку"
        ],
        threads: [
"изучение пересобранного профиля"
        ]
      }
    }
  },
{
    id: "contract_helix_compliance_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    title: "Повторяемый отклик",
    description: "Helix валидирует стандартный поведенческий профиль для линейки процедур. Актив должен демонстрировать предсказуемый отклик на стандартную серию команд и стимуляции, превращая внешнее требование в устойчивую реакцию. Ожидается закрепление обусловленной покорности.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_conditioned_submission",
        operator: ">=",
        value: 2
      },
{
        type: "attitude",
        operator: ">=",
        value: 72
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 66
      }
    ],
    rewards: {
      credits: 820,
      trust: 15,
      items: [
"eq_handcuffs"
      ]
    },
    penalties: {
      credits: -100,
      trust: -5
    },
    return_profile: {
      memory: {
        theme: "стандартная серия команд, тело отвечает само",
        fragments: [
"Меня проинструктировали по стандартной серии команд.",
"Тело отвечало на каждую команду само, без участия воли.",
"Отклик закрепился как рефлекс."
        ],
        tags: [
"command",
"submission",
"control",
"conditioning"
        ]
      },
      acute_state: {
        capacity: 25,
        tension: 50,
        sensitivity: 3,
        attitude: 5
      },
      recovery: {
        baselineCapacityLimit: 0.6,
        method: "отдых",
        durationDays: 1
      },
      traits: {
        kept: [
"trait_conditioned_submission"
        ],
        traumatic: [],
        temporary: [
{
            id: "anomaly_command_echo",
            impulse: "навязчивое ожидание команд",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"команда→подчинение",
"инструкция→безопасность"
        ]
      },
      relations: {
        attitude: 8,
        openness: 5,
        plasticity: 5
      },
      world_effects: {
        facts: [
"Helix валидировал стандартный профиль"
        ],
        threads: [
"серия стандартных процедур"
        ]
      }
    }
  },
{
    id: "contract_helix_restraint_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2160.0,
    offerDeadlineMinutes: 2160.0,
    title: "Контур фиксации",
    description: "Инженеры Helix калибруют систему контроля позы. Актив будет закреплён в жёсткой фиксации — наручники, ошейник, ремни — и удерживаем в заданных позах длительное время, с периодической стимуляцией для проверки отклика. Ожидается закрепление фетиша фиксации.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_restraint_fetish",
        operator: ">=",
        value: 1
      },
{
        type: "preference",
        key: "restraint",
        operator: ">=",
        value: 17
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 58
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 58
      }
    ],
    rewards: {
      credits: 730,
      trust: 13
    },
    penalties: {
      credits: -90,
      trust: -4
    },
    return_profile: {
      memory: {
        theme: "жёсткая фиксация, тело в ремнях",
        fragments: [
"Меня затянули в наручники, ошейник и ремни.",
"Удерживали в заданных позах долгое время.",
"Периодически стимулировали, проверяя отклик.",
"Ремни стали привычны, почти безопасны."
        ],
        tags: [
"restraint",
"control",
"submission",
"exposure"
        ]
      },
      acute_state: {
        capacity: 18,
        tension: 60,
        sensitivity: 4,
        attitude: 3
      },
      recovery: {
        baselineCapacityLimit: 0.5,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [
"trait_restraint_fetish"
        ],
        traumatic: [
{
            id: "trauma_restraint",
            trigger: "restraint",
            response: "паника при длительной фиксации"
          }
        ],
        temporary: [
{
            id: "anomaly_restraint_echo",
            impulse: "тяга к фиксации",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"фиксация→безопасность",
"ремни→возбуждение"
        ]
      },
      relations: {
        attitude: 6,
        openness: 4,
        plasticity: 4
      },
      world_effects: {
        facts: [
"Helix откалибровал контур фиксации"
        ],
        threads: [
"серия фиксаций"
        ]
      }
    }
  },
{
    id: "contract_helix_interface_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    title: "Интерфейсный профиль",
    description: "Helix готовит тестовый пул для сенсорного интерфейса. Актив должен положительно реагировать на электронные средства стимуляции, демонстрируя высокую чувствительность и принятие оператора. Ожидается закрепление технофильного отклика.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_technophile",
        operator: ">=",
        value: 1
      },
{
        type: "preference",
        key: "electronic",
        operator: ">=",
        value: 16
      },
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 65
      },
{
        type: "attitude",
        operator: ">=",
        value: 65
      }
    ],
    rewards: {
      credits: 760,
      trust: 14
    },
    penalties: {
      credits: -100,
      trust: -5
    },
    return_profile: {
      memory: {
        theme: "электронный интерфейс, машина как оператор",
        fragments: [
"Меня подключили к сенсорному интерфейсу.",
"Машина стала моим оператором.",
"Я приняла электронную стимуляцию как норму."
        ],
        tags: [
"electronic",
"machine",
"stimulation",
"submission"
        ]
      },
      acute_state: {
        capacity: 22,
        tension: 55,
        sensitivity: 5,
        attitude: 4
      },
      recovery: {
        baselineCapacityLimit: 0.55,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [
"trait_technophile"
        ],
        traumatic: [],
        temporary: [
{
            id: "anomaly_interface_echo",
            impulse: "навязчивое желание интерфейса",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"машина→оператор",
"интерфейс→возбуждение"
        ]
      },
      relations: {
        attitude: 7,
        openness: 5,
        plasticity: 5
      },
      world_effects: {
        facts: [
"Helix включил актив в тестовый пул"
        ],
        threads: [
"серия интерфейсных тестов"
        ]
      }
    }
  },
{
    id: "contract_helix_conditioning_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    title: "Обусловленная покорность",
    description: "Helix проводит полный цикл обусловливания: актив будет приучен отвечать на команды немедленным подчинением через сочетание награды и наказания. Ожидается глубокая перестройка воли и закрепление покорности как рефлекса.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_conditioned_submission",
        operator: ">=",
        value: 1
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 70
      },
{
        type: "attitude",
        operator: ">=",
        value: 60
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 60
      }
    ],
    rewards: {
      credits: 850,
      trust: 17,
      items: [
"eq_collar"
      ]
    },
    penalties: {
      credits: -120,
      trust: -6
    },
    return_profile: {
      memory: {
        theme: "обусловливание, воля перестроена в рефлекс",
        fragments: [
"Меня приучали отвечать на команды подчинением.",
"Награда и наказание перестроили мою волю.",
"Покорность стала рефлексом."
        ],
        tags: [
"command",
"submission",
"conditioning",
"control"
        ]
      },
      acute_state: {
        capacity: 15,
        tension: 65,
        sensitivity: 3,
        attitude: 8
      },
      recovery: {
        baselineCapacityLimit: 0.45,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [
"trait_conditioned_submission"
        ],
        traumatic: [
{
            id: "trauma_conditioning",
            trigger: "command/submission",
            response: "страх перед наказанием"
          }
        ],
        temporary: [
{
            id: "anomaly_submission_echo",
            impulse: "навязчивое подчинение",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"команда→рефлекс",
"наказание→страх",
"награда→зависимость"
        ]
      },
      relations: {
        attitude: 10,
        openness: 6,
        plasticity: 8
      },
      world_effects: {
        facts: [
"Helix провёл полный цикл обусловливания"
        ],
        threads: [
"серия обусловливаний"
        ]
      }
    }
  },
{
    id: "contract_helix_pose_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    title: "Стандартизация позы",
    description: "Helix стандартизирует набор рабочих поз для активов. Актив будет обучен принимать и удерживать заданные позы — на коленях, раскрытая, согнутая — по команде, с фиксацией и проверкой точности. Ожидается закрепление позной дисциплины.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_conditioned_submission",
        operator: ">=",
        value: 1
      },
{
        type: "attitude",
        operator: ">=",
        value: 65
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 60
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 60
      }
    ],
    rewards: {
      credits: 700,
      trust: 12
    },
    penalties: {
      credits: -80,
      trust: -4
    },
    return_profile: {
      memory: {
        theme: "обучение позам, тело принимает форму по команде",
        fragments: [
"Меня учили принимать заданные позы.",
"На коленях, раскрытая, согнутая — по команде.",
"Тело принимало форму без раздумий."
        ],
        tags: [
"pose",
"submission",
"control",
"exposure"
        ]
      },
      acute_state: {
        capacity: 28,
        tension: 45,
        sensitivity: 2,
        attitude: 5
      },
      recovery: {
        baselineCapacityLimit: 0.65,
        method: "отдых",
        durationDays: 1
      },
      traits: {
        kept: [
"trait_conditioned_submission"
        ],
        traumatic: [],
        temporary: [
{
            id: "anomaly_pose_echo",
            impulse: "навязчивое принятие поз",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"поза→подчинение",
"команда→форма"
        ]
      },
      relations: {
        attitude: 6,
        openness: 4,
        plasticity: 4
      },
      world_effects: {
        facts: [
"Helix стандартизировал набор поз"
        ],
        threads: [
"серия позных тренировок"
        ]
      }
    }
  },
{
    id: "contract_helix_voice_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2160.0,
    offerDeadlineMinutes: 2160.0,
    title: "Голосовое подчинение",
    description: "Helix калибрует голосовой контур управления. Актив будет приучен реагировать на голосовые команды оператора немедленным действием, с наказанием за задержку. Ожидается закрепление голосового рефлекса подчинения.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_conditioned_submission",
        operator: ">=",
        value: 1
      },
{
        type: "attitude",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 65
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 60
      }
    ],
    rewards: {
      credits: 740,
      trust: 14
    },
    penalties: {
      credits: -100,
      trust: -5
    },
    return_profile: {
      memory: {
        theme: "голос оператора, тело подчиняется само",
        fragments: [
"Меня приучали реагировать на голос оператора.",
"Каждая команда запускала немедленное действие.",
"За задержку наказывали.",
"Голос стал моим рефлексом."
        ],
        tags: [
"command",
"voice",
"submission",
"conditioning"
        ]
      },
      acute_state: {
        capacity: 20,
        tension: 60,
        sensitivity: 3,
        attitude: 7
      },
      recovery: {
        baselineCapacityLimit: 0.5,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [
"trait_conditioned_submission"
        ],
        traumatic: [
{
            id: "trauma_voice",
            trigger: "command/voice",
            response: "страх перед голосом оператора"
          }
        ],
        temporary: [
{
            id: "anomaly_voice_echo",
            impulse: "навязчивое ожидание голоса",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"голос→подчинение",
"команда→рефлекс"
        ]
      },
      relations: {
        attitude: 9,
        openness: 5,
        plasticity: 6
      },
      world_effects: {
        facts: [
"Helix откалибровал голосовой контур"
        ],
        threads: [
"серия голосовых тренировок"
        ]
      }
    }
  },
{
    id: "contract_helix_predictable_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    title: "Предсказуемая реакция",
    description: "Helix валидирует предсказуемость реакции на стандартную стимуляцию. Актив должен демонстрировать одинаковый отклик на одинаковые стимулы, без отклонений. Ожидается закрепление стабильного поведенческого профиля.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_conditioned_submission",
        operator: ">=",
        value: 1
      },
{
        type: "attitude",
        operator: ">=",
        value: 68
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 65
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 60
      }
    ],
    rewards: {
      credits: 680,
      trust: 12
    },
    penalties: {
      credits: -80,
      trust: -4
    },
    return_profile: {
      memory: {
        theme: "одинаковый отклик на одинаковые стимулы",
        fragments: [
"Меня стимулировали одинаковыми стимулами.",
"Отклик был одинаковым, без отклонений.",
"Предсказуемость стала моей нормой."
        ],
        tags: [
"command",
"submission",
"conditioning",
"stimulation"
        ]
      },
      acute_state: {
        capacity: 30,
        tension: 40,
        sensitivity: 2,
        attitude: 4
      },
      recovery: {
        baselineCapacityLimit: 0.7,
        method: "отдых",
        durationDays: 1
      },
      traits: {
        kept: [
"trait_conditioned_submission"
        ],
        traumatic: [],
        temporary: [
{
            id: "anomaly_predictable_echo",
            impulse: "навязчивое повторение отклика",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"стимул→отклик",
"предсказуемость→безопасность"
        ]
      },
      relations: {
        attitude: 5,
        openness: 4,
        plasticity: 4
      },
      world_effects: {
        facts: [
"Helix валидировал предсказуемость"
        ],
        threads: [
"серия валидаций"
        ]
      }
    }
  },
{
    id: "contract_helix_endurance_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    title: "Серийная выносливость",
    description: "Helix тестирует выносливость актива в серийных процедурах. Актив будет подвергнут длинной серии стандартных стимуляций без перерыва, с проверкой сохранения отклика. Ожидается истощение и закрепление рабочего резерва.",
    conditions: [
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 60
      },
{
        type: "attitude",
        operator: ">=",
        value: 60
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 60
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 55
      }
    ],
    rewards: {
      credits: 720,
      trust: 13
    },
    penalties: {
      credits: -90,
      trust: -4
    },
    return_profile: {
      memory: {
        theme: "длинная серия процедур без перерыва",
        fragments: [
"Меня подвергли длинной серии стимуляций без перерыва.",
"Усталость нарастала, но отклик сохранялся.",
"Я научилась работать на истощении."
        ],
        tags: [
"stimulation",
"endurance",
"exhaustion",
"submission"
        ]
      },
      acute_state: {
        capacity: 10,
        tension: 70,
        sensitivity: 3,
        attitude: 3
      },
      recovery: {
        baselineCapacityLimit: 0.35,
        method: "капсула",
        durationDays: 3
      },
      traits: {
        kept: [],
        traumatic: [
{
            id: "trauma_endurance",
            trigger: "stimulation",
            response: "страх перед длинными сериями"
          }
        ],
        temporary: [
{
            id: "anomaly_endurance_echo",
            impulse: "навязчивое желание продолжать",
            decayCondition: "восстановление"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"серия→работа",
"усталость→норма"
        ]
      },
      relations: {
        attitude: 4,
        openness: 3,
        plasticity: 4
      },
      world_effects: {
        facts: [
"Helix протестировал серийную выносливость"
        ],
        threads: [
"серия тестов выносливости"
        ]
      }
    }
  },
{
    id: "contract_helix_threshold_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2160.0,
    offerDeadlineMinutes: 2160.0,
    title: "Нормализация порога",
    description: "Helix нормализует порог реакции актива. Актив будет подвергнут нарастающей стимуляции до определения стабильного порога, после чего порог будет зафиксирован повторными сериями. Ожидается стабилизация чувствительности.",
    conditions: [
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 60
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 60
      },
{
        type: "attitude",
        operator: ">=",
        value: 60
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 55
      }
    ],
    rewards: {
      credits: 710,
      trust: 13
    },
    penalties: {
      credits: -90,
      trust: -4
    },
    return_profile: {
      memory: {
        theme: "определение и фиксация порога реакции",
        fragments: [
"Меня стимулировали с нарастающей силой.",
"Определили мой стабильный порог.",
"Повторными сериями зафиксировали его."
        ],
        tags: [
"stimulation",
"threshold",
"conditioning",
"submission"
        ]
      },
      acute_state: {
        capacity: 16,
        tension: 60,
        sensitivity: 4,
        attitude: 4
      },
      recovery: {
        baselineCapacityLimit: 0.45,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [],
        traumatic: [
{
            id: "trauma_threshold",
            trigger: "stimulation",
            response: "страх перед нарастанием"
          }
        ],
        temporary: [
{
            id: "anomaly_threshold_echo",
            impulse: "навязчивое ожидание порога",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"порог→норма",
"нарастание→ожидание"
        ]
      },
      relations: {
        attitude: 5,
        openness: 4,
        plasticity: 5
      },
      world_effects: {
        facts: [
"Helix нормализовал порог реакции"
        ],
        threads: [
"серия нормализаций"
        ]
      }
    }
  },
{
    id: "contract_helix_loyalty_01",
    issuerId: "fac_helix",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    title: "Лояльность",
    description: "Helix формирует лояльность актива к оператору. Актив будет подвергнут сочетанию награды и наказания, привязывающему его к оператору как источнику безопасности. Ожидается закрепление зависимости от оператора.",
    conditions: [
{
        type: "attitude",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 65
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 60
      },
{
        type: "acquired_trait",
        key: "trait_conditioned_submission",
        operator: ">=",
        value: 1
      }
    ],
    rewards: {
      credits: 830,
      trust: 16,
      items: [
"eq_collar"
      ]
    },
    penalties: {
      credits: -110,
      trust: -6
    },
    return_profile: {
      memory: {
        theme: "оператор как источник безопасности, зависимость",
        fragments: [
"Меня привязали к оператору наградой и наказанием.",
"Он стал моим источником безопасности.",
"Я стала зависеть от него."
        ],
        tags: [
"command",
"submission",
"conditioning",
"dependency"
        ]
      },
      acute_state: {
        capacity: 18,
        tension: 60,
        sensitivity: 3,
        attitude: 10
      },
      recovery: {
        baselineCapacityLimit: 0.5,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [
"trait_conditioned_submission"
        ],
        traumatic: [
{
            id: "trauma_loyalty",
            trigger: "command/submission",
            response: "страх потери оператора"
          }
        ],
        temporary: [
{
            id: "anomaly_loyalty_echo",
            impulse: "навязчивая привязанность",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"оператор→безопасность",
"награда→зависимость"
        ]
      },
      relations: {
        attitude: 12,
        openness: 6,
        plasticity: 7
      },
      world_effects: {
        facts: [
"Helix сформировал лояльность актива"
        ],
        threads: [
"серия привязок"
        ]
      }
    }
  },
{
    id: "contract_continuum_drift_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 7200,
    offerDeadlineMinutes: 7200,
    title: "Карта медленного дрейфа",
    description: "Continuum собирает долгую последовательность наблюдений. Актив с подвижной базой будет помещён под длительное наблюдение с мягкой, но постоянной стимуляцией, чтобы зафиксировать медленный дрейф параметров. Ожидается пластический сдвиг без срыва.",
    conditions: [
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 76
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 72
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 50
      },
{
        type: "attitude",
        operator: ">=",
        value: 52
      }
    ],
    rewards: {
      credits: 680,
      trust: 15
    },
    penalties: {
      credits: -80,
      trust: -4
    },
    return_profile: {
      memory: {
        theme: "долгое наблюдение, медленный дрейф",
        fragments: [
"Меня поместили под длительное наблюдение.",
"Мягкая стимуляция не прекращалась.",
"Параметры медленно дрейфовали, и я это чувствовала."
        ],
        tags: [
"observation",
"stimulation",
"plasticity",
"drift"
        ]
      },
      acute_state: {
        capacity: 30,
        tension: 40,
        sensitivity: 2,
        attitude: 2
      },
      recovery: {
        baselineCapacityLimit: 0.7,
        method: "отдых",
        durationDays: 1
      },
      traits: {
        kept: [],
        traumatic: [],
        temporary: [
{
            id: "anomaly_drift_echo",
            impulse: "навязчивое самонаблюдение",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"наблюдение→норма",
"дрейф→интерес"
        ]
      },
      relations: {
        attitude: 3,
        openness: 5,
        plasticity: 6
      },
      world_effects: {
        facts: [
"Continuum зафиксировал медленный дрейф"
        ],
        threads: [
"долгое наблюдение"
        ]
      }
    }
  },
{
    id: "contract_continuum_crossindex_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    title: "Перекрёстный индекс",
    description: "Continuum сверяет биометрические записи с субъективной оценкой процедуры. Актив с двумя независимыми ассоциативными контурами (медицинский и электронный) будет подвергнут комбинированной стимуляции для разделения общего сдвига от случайной реакции.",
    conditions: [
{
        type: "preference",
        key: "clinical",
        operator: ">=",
        value: 13
      },
{
        type: "preference",
        key: "electronic",
        operator: ">=",
        value: 13
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 68
      },
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 58
      }
    ],
    rewards: {
      credits: 740,
      trust: 16
    },
    penalties: {
      credits: -100,
      trust: -5
    },
    return_profile: {
      memory: {
        theme: "комбинированная стимуляция, разделение сдвигов",
        fragments: [
"Меня стимулировали медицинскими и электронными средствами.",
"Сверяли биометрию с моими ощущениями.",
"Я научилась различать два контура."
        ],
        tags: [
"clinical",
"electronic",
"stimulation",
"observation"
        ]
      },
      acute_state: {
        capacity: 20,
        tension: 55,
        sensitivity: 4,
        attitude: 2
      },
      recovery: {
        baselineCapacityLimit: 0.55,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [
"trait_clinical_fetish",
"trait_electrophile"
        ],
        traumatic: [],
        temporary: [
{
            id: "anomaly_crossindex_echo",
            impulse: "навязчивое сравнение ощущений",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"медицинский контур→данные",
"электронный контур→данные"
        ]
      },
      relations: {
        attitude: 3,
        openness: 5,
        plasticity: 5
      },
      world_effects: {
        facts: [
"Continuum свёл перекрёстный индекс"
        ],
        threads: [
"серия сверок"
        ]
      }
    }
  },
{
    id: "contract_continuum_recovery_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    title: "Устойчивое восстановление",
    description: "Continuum наблюдает за возвращением актива к рабочему состоянию после нагрузки. Актив будет подвергнут умеренной нагрузке, после чего за ним будет вестись наблюдение в процессе восстановления. Ожидается фиксация темпа восстановления.",
    conditions: [
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 68
      },
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 50
      },
{
        type: "attitude",
        operator: ">=",
        value: 62
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 60
      }
    ],
    rewards: {
      credits: 650,
      trust: 13
    },
    penalties: {
      credits: -70,
      trust: -3
    },
    return_profile: {
      memory: {
        theme: "нагрузка и наблюдение за восстановлением",
        fragments: [
"Меня подвергли умеренной нагрузке.",
"Затем наблюдали, как я восстанавливаюсь.",
"Темп восстановления зафиксировали."
        ],
        tags: [
"observation",
"recovery",
"stimulation"
        ]
      },
      acute_state: {
        capacity: 35,
        tension: 35,
        sensitivity: 1,
        attitude: 2
      },
      recovery: {
        baselineCapacityLimit: 0.8,
        method: "отдых",
        durationDays: 1
      },
      traits: {
        kept: [],
        traumatic: [],
        temporary: []
      },
      associations: {
        traumatic: [],
        new: [
"восстановление→норма",
"наблюдение→безопасность"
        ]
      },
      relations: {
        attitude: 3,
        openness: 4,
        plasticity: 3
      },
      world_effects: {
        facts: [
"Continuum зафиксировал темп восстановления"
        ],
        threads: [
"серия наблюдений за восстановлением"
        ]
      }
    }
  },
{
    id: "contract_continuum_observation_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 10080,
    offerDeadlineMinutes: 10080,
    title: "Долгое наблюдение",
    description: "Continuum собирает долговременные данные об активе. Актив будет помещён под длительное наблюдение с минимальной стимуляцией, чтобы зафиксировать естественный дрейф параметров и ассоциаций. Ожидается накопление данных без вмешательства.",
    conditions: [
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 50
      },
{
        type: "attitude",
        operator: ">=",
        value: 50
      }
    ],
    rewards: {
      credits: 700,
      trust: 16
    },
    penalties: {
      credits: -80,
      trust: -4
    },
    return_profile: {
      memory: {
        theme: "долгое наблюдение, естественный дрейф",
        fragments: [
"Меня поместили под долгое наблюдение.",
"Стимуляция была минимальной.",
"Параметры дрейфовали естественно."
        ],
        tags: [
"observation",
"drift",
"plasticity"
        ]
      },
      acute_state: {
        capacity: 40,
        tension: 30,
        sensitivity: 1,
        attitude: 1
      },
      recovery: {
        baselineCapacityLimit: 0.85,
        method: "отдых",
        durationDays: 1
      },
      traits: {
        kept: [],
        traumatic: [],
        temporary: []
      },
      associations: {
        traumatic: [],
        new: [
"наблюдение→норма"
        ]
      },
      relations: {
        attitude: 2,
        openness: 4,
        plasticity: 5
      },
      world_effects: {
        facts: [
"Continuum накопил долговременные данные"
        ],
        threads: [
"долгое наблюдение"
        ]
      }
    }
  },
{
    id: "contract_continuum_mapping_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    title: "Ассоциативное картирование",
    description: "Continuum картирует ассоциативные связи актива. Актив будет подвергнут серии стимулов, каждый из которых привязан к определённому контексту, чтобы зафиксировать формирование и затухание ассоциаций. Ожидается полная карта ассоциативного поля.",
    conditions: [
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 72
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 68
      },
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 55
      },
{
        type: "attitude",
        operator: ">=",
        value: 50
      }
    ],
    rewards: {
      credits: 730,
      trust: 15
    },
    penalties: {
      credits: -90,
      trust: -4
    },
    return_profile: {
      memory: {
        theme: "картирование ассоциаций, стимулы и контексты",
        fragments: [
"Меня стимулировали серией стимулов.",
"Каждый был привязан к контексту.",
"Ассоциации формировались и затухали."
        ],
        tags: [
"observation",
"stimulation",
"association",
"plasticity"
        ]
      },
      acute_state: {
        capacity: 25,
        tension: 50,
        sensitivity: 3,
        attitude: 2
      },
      recovery: {
        baselineCapacityLimit: 0.6,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [],
        traumatic: [],
        temporary: [
{
            id: "anomaly_mapping_echo",
            impulse: "навязчивое связывание стимулов",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"стимул→контекст",
"ассоциация→данные"
        ]
      },
      relations: {
        attitude: 3,
        openness: 5,
        plasticity: 6
      },
      world_effects: {
        facts: [
"Continuum построил карту ассоциаций"
        ],
        threads: [
"серия картирований"
        ]
      }
    }
  },
{
    id: "contract_continuum_plasticity_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    title: "Пластический сдвиг",
    description: "Continuum изучает пластический сдвиг актива. Актив будет подвергнут серии новых стимулов, чтобы зафиксировать скорость и глубину пластической перестройки. Ожидается измерение пластичности как параметра.",
    conditions: [
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 75
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 50
      },
{
        type: "attitude",
        operator: ">=",
        value: 50
      }
    ],
    rewards: {
      credits: 750,
      trust: 16
    },
    penalties: {
      credits: -90,
      trust: -4
    },
    return_profile: {
      memory: {
        theme: "пластическая перестройка, новые стимулы",
        fragments: [
"Меня стимулировали новыми стимулами.",
"Пластичность перестраивалась быстро.",
"Скорость и глубину зафиксировали."
        ],
        tags: [
"plasticity",
"stimulation",
"observation",
"drift"
        ]
      },
      acute_state: {
        capacity: 22,
        tension: 50,
        sensitivity: 3,
        attitude: 2
      },
      recovery: {
        baselineCapacityLimit: 0.55,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [],
        traumatic: [],
        temporary: [
{
            id: "anomaly_plasticity_echo",
            impulse: "навязчивый поиск нового",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"новый стимул→интерес",
"перестройка→данные"
        ]
      },
      relations: {
        attitude: 3,
        openness: 6,
        plasticity: 7
      },
      world_effects: {
        facts: [
"Continuum измерил пластический сдвиг"
        ],
        threads: [
"серия измерений пластичности"
        ]
      }
    }
  },
{
    id: "contract_continuum_archive_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    title: "Архивная фиксация",
    description: "Continuum фиксирует текущее состояние актива в архив. Актив будет подвергнут стандартной серии измерений и стимуляции для создания полного снимка параметров и ассоциаций. Ожидается архивная запись без последствий.",
    conditions: [
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 60
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 60
      },
{
        type: "attitude",
        operator: ">=",
        value: 55
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 50
      }
    ],
    rewards: {
      credits: 620,
      trust: 12
    },
    penalties: {
      credits: -70,
      trust: -3
    },
    return_profile: {
      memory: {
        theme: "архивная фиксация, снимок состояния",
        fragments: [
"Меня измерили и стимулировали стандартной серией.",
"Создали полный снимок моего состояния.",
"Записали в архив."
        ],
        tags: [
"observation",
"measurement",
"stimulation"
        ]
      },
      acute_state: {
        capacity: 40,
        tension: 30,
        sensitivity: 1,
        attitude: 1
      },
      recovery: {
        baselineCapacityLimit: 0.85,
        method: "отдых",
        durationDays: 1
      },
      traits: {
        kept: [],
        traumatic: [],
        temporary: []
      },
      associations: {
        traumatic: [],
        new: [
"измерение→норма"
        ]
      },
      relations: {
        attitude: 2,
        openness: 3,
        plasticity: 3
      },
      world_effects: {
        facts: [
"Continuum создал архивную запись"
        ],
        threads: [
"серия фиксаций"
        ]
      }
    }
  },
{
    id: "contract_continuum_comparative_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    title: "Сравнительный дрейф",
    description: "Continuum сравнивает дрейф актива с архивными записями. Актив будет подвергнут той же серии стимулов, что и в прошлой фиксации, чтобы измерить разницу. Ожидается сравнительный анализ дрейфа.",
    conditions: [
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 65
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 50
      },
{
        type: "attitude",
        operator: ">=",
        value: 50
      }
    ],
    rewards: {
      credits: 690,
      trust: 14
    },
    penalties: {
      credits: -80,
      trust: -4
    },
    return_profile: {
      memory: {
        theme: "сравнение с прошлым, измерение дрейфа",
        fragments: [
"Меня стимулировали той же серией, что и раньше.",
"Сравнили с прошлой фиксацией.",
"Дрейф измерили."
        ],
        tags: [
"observation",
"drift",
"stimulation",
"comparison"
        ]
      },
      acute_state: {
        capacity: 28,
        tension: 45,
        sensitivity: 2,
        attitude: 2
      },
      recovery: {
        baselineCapacityLimit: 0.65,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [],
        traumatic: [],
        temporary: [
{
            id: "anomaly_comparative_echo",
            impulse: "навязчивое сравнение с прошлым",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"прошлое→сравнение",
"дрейф→данные"
        ]
      },
      relations: {
        attitude: 3,
        openness: 4,
        plasticity: 5
      },
      world_effects: {
        facts: [
"Continuum измерил сравнительный дрейф"
        ],
        threads: [
"серия сравнений"
        ]
      }
    }
  },
{
    id: "contract_continuum_biography_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    title: "Сенсорная биография",
    description: "Continuum собирает полную сенсорную биографию актива. Актив будет подвергнут последовательной стимуляции всех зон в хронологическом порядке, чтобы зафиксировать историю сенсорного опыта. Ожидается полная сенсорная карта.",
    conditions: [
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 65
      },
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 60
      },
{
        type: "attitude",
        operator: ">=",
        value: 55
      }
    ],
    rewards: {
      credits: 770,
      trust: 16
    },
    penalties: {
      credits: -100,
      trust: -5
    },
    return_profile: {
      memory: {
        theme: "полная сенсорная биография, все зоны по порядку",
        fragments: [
"Меня стимулировали все зоны по порядку.",
"Каждая зона оставила след в истории.",
"Собрали полную сенсорную карту."
        ],
        tags: [
"observation",
"stimulation",
"mapping",
"biography"
        ]
      },
      acute_state: {
        capacity: 18,
        tension: 55,
        sensitivity: 4,
        attitude: 2
      },
      recovery: {
        baselineCapacityLimit: 0.5,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [],
        traumatic: [],
        temporary: [
{
            id: "anomaly_biography_echo",
            impulse: "навязчивое переживание прошлого",
            decayCondition: "время"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"зона→история",
"стимуляция→данные"
        ]
      },
      relations: {
        attitude: 3,
        openness: 5,
        plasticity: 5
      },
      world_effects: {
        facts: [
"Continuum собрал сенсорную биографию"
        ],
        threads: [
"серия биографий"
        ]
      }
    }
  },
{
    id: "contract_continuum_anomaly_trace_01",
    issuerId: "fac_continuum",
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    title: "Аномальный след",
    description: "Continuum изучает аномальный след в профиле актива. Актив с уже зафиксированным аномальным откликом будет подвергнут мягкой стимуляции для наблюдения за проявлением следа. Ожидается картирование аномального влияния.",
    conditions: [
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 70
      },
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 65
      },
{
        type: "attitude",
        operator: ">=",
        value: 50
      }
    ],
    rewards: {
      credits: 800,
      trust: 17
    },
    penalties: {
      credits: -110,
      trust: -5
    },
    return_profile: {
      memory: {
        theme: "наблюдение за аномальным следом",
        fragments: [
"Меня стимулировали мягко, наблюдая за следом.",
"Аномалия проявлялась в моих реакциях.",
"След закартировали."
        ],
        tags: [
"anomaly",
"observation",
"stimulation",
"trace"
        ]
      },
      acute_state: {
        capacity: 20,
        tension: 60,
        sensitivity: 6,
        attitude: 2
      },
      recovery: {
        baselineCapacityLimit: 0.5,
        method: "капсула",
        durationDays: 2
      },
      traits: {
        kept: [],
        traumatic: [],
        temporary: [
{
            id: "anomaly_trace_echo",
            impulse: "навязчивое проявление следа",
            decayCondition: "восстановление"
          }
        ]
      },
      associations: {
        traumatic: [],
        new: [
"Аномалия→след",
"стимуляция→проявление"
        ]
      },
      relations: {
        attitude: 2,
        openness: 6,
        plasticity: 6
      },
      world_effects: {
        facts: [
"Continuum закартировал аномальный след"
        ],
        threads: [
"изучение аномального следа"
        ]
      }
    }
  }
];
