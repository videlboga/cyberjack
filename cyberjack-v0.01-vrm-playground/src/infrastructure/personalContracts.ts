import type { AssetContract } from '../domain/types';

/**
 * Персональные контракты — привязаны к конкретным персонажам через их
 * организационные связи (story seeds). По 3 на персонажа: лёгкий, тяжёлый,
 * путь частичного разрыва. Источник: docs/plans/contract-content-v1.md
 */
type PersonalContractSeed = Omit<AssetContract, 'state'>;
export const PERSONAL_CONTRACT_DATA: PersonalContractSeed[] = [
{
    id: "contract_personal_mira_01",
    issuerId: "fac_continuum",
    subjectId: "S-AV-01",
    personal: true,
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Архивный след семьи",
    description: "Continuum Archive предлагает доступ к архивным записям внешнего кольца о ликвидации семьи Миры в обмен на участие в серии наблюдений. Актив будет помещён под длительное наблюдение с мягкой стимуляцией, чтобы зафиксировать эмоциональный отклик на семейные триггеры. Ожидается психологическое давление и вскрытие старой раны.",
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
        value: 70
      },
{
        type: "attitude",
        operator: ">=",
        value: 50
      }
    ],
    rewards: {
      credits: 850,
      trust: 18
    },
    penalties: {
      credits: -120,
      trust: -6
    },
    return_profile: {
      memory: {
        theme: "наблюдение за откликом на семейные триггеры, вскрытие старой раны",
        fragments: [
"Мне показывали записи о ликвидации семьи.",
"Каждый кадр вскрывал старую рану.",
"Я не могла отвести взгляд, хотя хотела.",
"Аномалия отзывалась на мою боль."
        ],
        tags: [
"observation",
"family",
"trauma",
"anomaly",
"grief"
        ]
      },
      acute_state: {
        capacity: 20,
        tension: 65,
        sensitivity: 5,
        attitude: -8
      },
      recovery: {
        baselineCapacityLimit: 0.5,
        method: "капсула",
        durationDays: 2
      },
      traits: {
        kept: [],
        traumatic: [
{
            id: "trauma_family_archive",
            trigger: "family/grief",
            response: "флэшбеки и паника при семейных триггерах"
          }
        ],
        temporary: [
{
            id: "anomaly_grief_echo",
            impulse: "навязчивое переживание утраты",
            decayCondition: "работа с памятью"
          }
        ]
      },
      associations: {
        traumatic: [
"семья→боль",
"архив→негатив"
        ],
        new: [
"Continuum→доступ к правде"
        ]
      },
      relations: {
        attitude: -6,
        openness: 6,
        plasticity: 5
      },
      world_effects: {
        facts: [
"Continuum вскрыл архивный след семьи Миры"
        ],
        threads: [
"восстановление истории семьи Миры"
        ]
      }
    }
  },
{
    id: "contract_personal_mira_02",
    issuerId: "fac_continuum",
    subjectId: "S-AV-01",
    personal: true,
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "severe",
    title: "Цена правды",
    description: "Continuum предлагает полный архив о ликвидации семьи Миры, но требует взамен участие в предельном протоколе наблюдения за аномальным откликом на утрату. Актив будет доведён до глубокого эмоционального срыва через семейные триггеры и сенсорную перегрузку. Ожидается тяжёлое истощение и стойкий аномальный след.",
    conditions: [
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 75
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 75
      },
{
        type: "custom",
        key: "capacity",
        operator: ">=",
        value: 50
      }
    ],
    rewards: {
      credits: 1100,
      trust: 22,
      items: [
"drug_neurostabilizer"
      ]
    },
    penalties: {
      credits: -160,
      trust: -8
    },
    return_profile: {
      memory: {
        theme: "предельный протокол, срыв через семейные триггеры",
        fragments: [
"Меня довели до срыва через воспоминания о семье.",
"Боль и сенсорная перегрузка слились с утратой.",
"Аномалия отозвалась на мой крик.",
"Я узнала цену правды."
        ],
        tags: [
"family",
"trauma",
"overload",
"anomaly",
"breakdown",
"grief"
        ]
      },
      acute_state: {
        capacity: 4,
        tension: 90,
        sensitivity: 10,
        attitude: -15
      },
      recovery: {
        baselineCapacityLimit: 0.2,
        method: "капсула + drug_neurostabilizer",
        durationDays: 4
      },
      traits: {
        kept: [],
        traumatic: [
{
            id: "trauma_family_breakdown",
            trigger: "family/overload",
            response: "глубокая диссоциация при семейных триггерах"
          }
        ],
        temporary: [
{
            id: "anomaly_grief_echo",
            impulse: "навязчивое переживание утраты",
            decayCondition: "работа с памятью"
          }
        ]
      },
      associations: {
        traumatic: [
"семья→невыносимая боль",
"правда→цена"
        ],
        new: [
"Аномалия→отклик на утрату"
        ]
      },
      relations: {
        attitude: -12,
        openness: 8,
        plasticity: 8
      },
      world_effects: {
        facts: [
"Continuum получил полный архив семьи Миры"
        ],
        threads: [
"эскалация связи Миры с Continuum"
        ]
      }
    }
  },
{
    id: "contract_personal_mira_03",
    issuerId: "fac_continuum",
    subjectId: "S-AV-01",
    personal: true,
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "easy",
    cruelty: "mild",
    title: "Разрыв связи",
    description: "Continuum предлагает Мире путь частичного разрыва связи: она может отказаться от дальнейших протоколов, но должна пройти финальную серию наблюдений, чтобы закрыть архивный след. Актив остаётся в лаборатории, но подвергается мягкой стимуляции для фиксации её решения. Ожидается эмоциональное освобождение.",
    conditions: [
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 65
      },
{
        type: "attitude",
        operator: ">=",
        value: 45
      }
    ],
    rewards: {
      credits: 600,
      trust: 10
    },
    penalties: {
      credits: -60,
      trust: -3
    },
    return_profile: {
      memory: {
        theme: "финальное наблюдение, закрытие архивного следа",
        fragments: [
"Я решила закрыть этот след.",
"Меня наблюдали в последний раз.",
"Я почувствовала освобождение."
        ],
        tags: [
"observation",
"closure",
"family",
"grief"
        ]
      },
      acute_state: {
        capacity: 35,
        tension: 30,
        sensitivity: 2,
        attitude: 3
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
"закрытие→освобождение",
"Continuum→прошлое"
        ]
      },
      relations: {
        attitude: 4,
        openness: 4,
        plasticity: 3
      },
      world_effects: {
        facts: [
"Мира закрыла архивный след с Continuum"
        ],
        threads: [
"частичный разрыв связи Миры"
        ]
      }
    }
  },
{
    id: "contract_personal_nika_01",
    issuerId: "fac_veil",
    subjectId: "NPC-CAND-01",
    personal: true,
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Свидетель клинического канала",
    description: "Veil Biotech знает, что Ника видела то, чего не должна была, в исследовательском секторе. Организация предлагает молчание в обмен на участие в серии клинических протоколов. Актив будет подвергнут инвазивным измерениям, чтобы проверить его пригодность как свидетеля-исполнителя. Ожидается давление и закрепление клинического отклика.",
    conditions: [
{
        type: "acquired_trait",
        key: "trait_clinical_fetish",
        operator: ">=",
        value: 1
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
      }
    ],
    rewards: {
      credits: 820,
      trust: 16
    },
    penalties: {
      credits: -120,
      trust: -6
    },
    return_profile: {
      memory: {
        theme: "клинические протоколы под давлением, проверка как свидетеля",
        fragments: [
"Veil знает, что я видела.",
"Меня подвергли инвазивным измерениям.",
"Каждая процедура проверяла мою пригодность.",
"Я стала их инструментом."
        ],
        tags: [
"clinical",
"pressure",
"submission",
"veil"
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
            id: "trauma_clinical_pressure",
            trigger: "clinical/medical",
            response: "страх перед инструментами под давлением"
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
"Veil→давление",
"инструменты→негатив"
        ],
        new: [
"клинический канал→власть"
        ]
      },
      relations: {
        attitude: -8,
        openness: 5,
        plasticity: 6
      },
      world_effects: {
        facts: [
"Veil проверил Нику как свидетеля-исполнителя"
        ],
        threads: [
"связь Ники с Veil"
        ]
      }
    }
  },
{
    id: "contract_personal_nika_02",
    issuerId: "fac_veil",
    subjectId: "NPC-CAND-01",
    personal: true,
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "severe",
    title: "Серия стимуляторов",
    description: "Veil предлагает Нике раскрыть происхождение серии стимуляторов, которую она видела, в обмен на участие в фармакологическом протоколе. Актив будет накачан препаратами из той самой серии, чтобы проверить его реакцию и получить данные. Ожидается химическая зависимость и вскрытие тайны.",
    conditions: [
{
        type: "custom",
        key: "sensitivity",
        operator: ">=",
        value: 65
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 65
      },
{
        type: "preference",
        key: "chemical",
        operator: ">=",
        value: 10
      }
    ],
    rewards: {
      credits: 950,
      trust: 18,
      items: [
"drug_sensitizer"
      ]
    },
    penalties: {
      credits: -140,
      trust: -7
    },
    return_profile: {
      memory: {
        theme: "фармакологический протокол, вскрытие тайны серии",
        fragments: [
"Мне вводили препараты из той самой серии.",
"Я узнала их действие на себе.",
"Химия разгоняла чувствительность до предела.",
"Тайна серии начала раскрываться."
        ],
        tags: [
"chemical",
"sensitivity",
"veil",
"overload",
"secrecy"
        ]
      },
      acute_state: {
        capacity: 8,
        tension: 80,
        sensitivity: 15,
        attitude: -12
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
            id: "trauma_chemical_series",
            trigger: "chemical",
            response: "страх перед препаратами серии"
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
"серия→опасность",
"препараты→амбивалент"
        ],
        new: [
"Veil→ключ к тайне"
        ]
      },
      relations: {
        attitude: -10,
        openness: 6,
        plasticity: 7
      },
      world_effects: {
        facts: [
"Veil вскрыл происхождение серии стимуляторов через Нику"
        ],
        threads: [
"эскалация связи Ники с Veil"
        ]
      }
    }
  },
{
    id: "contract_personal_nika_03",
    issuerId: "fac_veil",
    subjectId: "NPC-CAND-01",
    personal: true,
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "easy",
    cruelty: "mild",
    title: "Скрыть участие",
    description: "Veil предлагает Нике путь частичного разрыва: она может скрыть своё участие и уйти из-под давления, но должна пройти финальную проверку лояльности. Актив остаётся в лаборатории, подвергается стандартной серии команд. Ожидается закрепление покорности и закрытие вопроса.",
    conditions: [
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
      credits: 650,
      trust: 12
    },
    penalties: {
      credits: -70,
      trust: -4
    },
    return_profile: {
      memory: {
        theme: "финальная проверка лояльности, скрытие участия",
        fragments: [
"Я решила скрыть своё участие.",
"Меня проверили на лояльность.",
"Я подчинилась, чтобы закрыть вопрос."
        ],
        tags: [
"command",
"submission",
"veil",
"loyalty"
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
        kept: [],
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
"Veil→прошлое",
"подчинение→безопасность"
        ]
      },
      relations: {
        attitude: 6,
        openness: 4,
        plasticity: 4
      },
      world_effects: {
        facts: [
"Ника скрыла участие и закрыла вопрос с Veil"
        ],
        threads: [
"частичный разрыв связи Ники"
        ]
      }
    }
  },
{
    id: "contract_personal_eli_01",
    issuerId: "fac_helix",
    subjectId: "NPC-CAND-GEN-02",
    personal: true,
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Служебный канал",
    description: "Lattice знает, что Эли видела запрещённую операцию возле медицинского блока. Организация предлагает молчание в обмен на участие в серии стандартизированных протоколов. Актив будет подвергнут обусловливанию, чтобы проверить его управляемость. Ожидается закрепление покорности.",
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
      credits: 800,
      trust: 15
    },
    penalties: {
      credits: -110,
      trust: -5
    },
    return_profile: {
      memory: {
        theme: "обусловливание под давлением, проверка управляемости",
        fragments: [
"Lattice знает, что я видела.",
"Меня обусловливали на подчинение.",
"Каждая команда проверяла мою управляемость.",
"Я стала предсказуемой."
        ],
        tags: [
"command",
"submission",
"conditioning",
"lattice",
"pressure"
        ]
      },
      acute_state: {
        capacity: 18,
        tension: 60,
        sensitivity: 3,
        attitude: 6
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
            id: "trauma_conditioning_pressure",
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
        traumatic: [
"Lattice→давление",
"команда→страх"
        ],
        new: [
"подчинение→безопасность"
        ]
      },
      relations: {
        attitude: 7,
        openness: 5,
        plasticity: 6
      },
      world_effects: {
        facts: [
"Lattice проверил управляемость Эли"
        ],
        threads: [
"связь Эли с Lattice"
        ]
      }
    }
  },
{
    id: "contract_personal_eli_02",
    issuerId: "fac_helix",
    subjectId: "NPC-CAND-GEN-02",
    personal: true,
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "severe",
    title: "Судьба исчезнувшего",
    description: "Lattice предлагает Эли установить судьбу исчезнувшего человека из той операции в обмен на участие в предельном протоколе обусловливания. Актив будет доведён до глубокой перестройки воли, чтобы стать надёжным исполнителем. Ожидается тяжёлое истощение и необратимая перестройка.",
    conditions: [
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
      credits: 1000,
      trust: 20,
      items: [
"eq_collar"
      ]
    },
    penalties: {
      credits: -150,
      trust: -8
    },
    return_profile: {
      memory: {
        theme: "предельное обусловливание, перестройка воли",
        fragments: [
"Меня довели до глубокой перестройки воли.",
"Подчинение стало рефлексом.",
"Я узнала судьбу исчезнувшего.",
"Цена была моей волей."
        ],
        tags: [
"command",
"submission",
"conditioning",
"lattice",
"breakdown"
        ]
      },
      acute_state: {
        capacity: 6,
        tension: 80,
        sensitivity: 4,
        attitude: 10
      },
      recovery: {
        baselineCapacityLimit: 0.3,
        method: "капсула",
        durationDays: 3
      },
      traits: {
        kept: [
"trait_conditioned_submission"
        ],
        traumatic: [
{
            id: "trauma_will_breakdown",
            trigger: "command/submission",
            response: "глубокая перестройка воли, страх потери себя"
          }
        ],
        temporary: [
{
            id: "anomaly_submission_echo",
            impulse: "навязчивое подчинение",
            decayCondition: "работа с памятью"
          }
        ]
      },
      associations: {
        traumatic: [
"воля→потеря",
"Lattice→власть"
        ],
        new: [
"подчинение→рефлекс"
        ]
      },
      relations: {
        attitude: 10,
        openness: 6,
        plasticity: 8
      },
      world_effects: {
        facts: [
"Lattice перестроил волю Эли"
        ],
        threads: [
"эскалация связи Эли с Lattice"
        ]
      }
    }
  },
{
    id: "contract_personal_eli_03",
    issuerId: "fac_helix",
    subjectId: "NPC-CAND-GEN-02",
    personal: true,
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "easy",
    cruelty: "mild",
    title: "Подделка следа",
    description: "Lattice предлагает Эли путь частичного разрыва: она может подделать учётный след и уйти из-под давления, но должна пройти финальную проверку. Актив остаётся в лаборатории, подвергается стандартной серии. Ожидается закрытие вопроса.",
    conditions: [
{
        type: "attitude",
        operator: ">=",
        value: 55
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 55
      }
    ],
    rewards: {
      credits: 620,
      trust: 11
    },
    penalties: {
      credits: -60,
      trust: -3
    },
    return_profile: {
      memory: {
        theme: "финальная проверка, подделка следа",
        fragments: [
"Я решила подделать след.",
"Меня проверили в последний раз.",
"Я закрыла вопрос."
        ],
        tags: [
"command",
"submission",
"lattice",
"closure"
        ]
      },
      acute_state: {
        capacity: 28,
        tension: 45,
        sensitivity: 2,
        attitude: 4
      },
      recovery: {
        baselineCapacityLimit: 0.7,
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
"Lattice→прошлое",
"закрытие→освобождение"
        ]
      },
      relations: {
        attitude: 5,
        openness: 4,
        plasticity: 3
      },
      world_effects: {
        facts: [
"Эли подделала след и закрыла вопрос с Lattice"
        ],
        threads: [
"частичный разрыв связи Эли"
        ]
      }
    }
  },
{
    id: "contract_personal_sumi_01",
    issuerId: "fac_helix",
    subjectId: "NPC-CAND-SUMI",
    personal: true,
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Чистый сектор",
    description: "Lattice знает, что Суми помогла кому-то в центральных контурах, и эта помощь обернулась проблемой. Организация предлагает очистить имя Суми в обмен на участие в серии стандартизированных протоколов. Актив будет подвергнут обусловливанию, чтобы проверить его лояльность. Ожидается закрепление покорности.",
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
        value: 55
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 55
      }
    ],
    rewards: {
      credits: 780,
      trust: 14
    },
    penalties: {
      credits: -100,
      trust: -5
    },
    return_profile: {
      memory: {
        theme: "обусловливание, очистка имени",
        fragments: [
"Lattice знает о моей помощи.",
"Меня обусловливали на лояльность.",
"Каждая команда проверяла меня.",
"Я стала послушной, чтобы очистить имя."
        ],
        tags: [
"command",
"submission",
"conditioning",
"lattice",
"loyalty"
        ]
      },
      acute_state: {
        capacity: 20,
        tension: 55,
        sensitivity: 3,
        attitude: 5
      },
      recovery: {
        baselineCapacityLimit: 0.55,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [
"trait_conditioned_submission"
        ],
        traumatic: [],
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
"Lattice→очищение",
"подчинение→безопасность"
        ]
      },
      relations: {
        attitude: 6,
        openness: 5,
        plasticity: 5
      },
      world_effects: {
        facts: [
"Lattice начал очистку имени Суми"
        ],
        threads: [
"связь Суми с Lattice"
        ]
      }
    }
  },
{
    id: "contract_personal_sumi_02",
    issuerId: "fac_helix",
    subjectId: "NPC-CAND-SUMI",
    personal: true,
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "severe",
    title: "Оставленный доступ",
    description: "Lattice предлагает Суми использовать оставленный доступ, чтобы найти прежнего знакомого, в обмен на участие в предельном протоколе обусловливания. Актив будет доведён до глубокой перестройки воли, чтобы стать надёжным исполнителем. Ожидается тяжёлое истощение.",
    conditions: [
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 65
      },
{
        type: "attitude",
        operator: ">=",
        value: 55
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 55
      }
    ],
    rewards: {
      credits: 950,
      trust: 18,
      items: [
"eq_collar"
      ]
    },
    penalties: {
      credits: -140,
      trust: -7
    },
    return_profile: {
      memory: {
        theme: "предельное обусловливание, использование доступа",
        fragments: [
"Меня довели до глубокой перестройки воли.",
"Я использовала оставленный доступ.",
"Нашла след прежнего знакомого.",
"Цена была моей волей."
        ],
        tags: [
"command",
"submission",
"conditioning",
"lattice",
"breakdown"
        ]
      },
      acute_state: {
        capacity: 8,
        tension: 75,
        sensitivity: 4,
        attitude: 8
      },
      recovery: {
        baselineCapacityLimit: 0.3,
        method: "капсула",
        durationDays: 3
      },
      traits: {
        kept: [
"trait_conditioned_submission"
        ],
        traumatic: [
{
            id: "trauma_will_breakdown",
            trigger: "command/submission",
            response: "глубокая перестройка воли"
          }
        ],
        temporary: [
{
            id: "anomaly_submission_echo",
            impulse: "навязчивое подчинение",
            decayCondition: "работа с памятью"
          }
        ]
      },
      associations: {
        traumatic: [
"воля→потеря",
"Lattice→власть"
        ],
        new: [
"доступ→ключ к правде"
        ]
      },
      relations: {
        attitude: 8,
        openness: 6,
        plasticity: 7
      },
      world_effects: {
        facts: [
"Суми использовала доступ Lattice"
        ],
        threads: [
"эскалация связи Суми с Lattice"
        ]
      }
    }
  },
{
    id: "contract_personal_sumi_03",
    issuerId: "fac_helix",
    subjectId: "NPC-CAND-SUMI",
    personal: true,
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "easy",
    cruelty: "mild",
    title: "Отказ от прежнего знакомого",
    description: "Lattice предлагает Суми путь частичного разрыва: она может отказаться от прежнего знакомого и очистить имя, но должна пройти финальную проверку лояльности. Актив остаётся в лаборатории, подвергается стандартной серии. Ожидается закрытие вопроса.",
    conditions: [
{
        type: "attitude",
        operator: ">=",
        value: 50
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 50
      }
    ],
    rewards: {
      credits: 600,
      trust: 10
    },
    penalties: {
      credits: -60,
      trust: -3
    },
    return_profile: {
      memory: {
        theme: "финальная проверка, отказ от прежнего знакомого",
        fragments: [
"Я решила отказаться от прежнего знакомого.",
"Меня проверили на лояльность.",
"Я закрыла вопрос."
        ],
        tags: [
"command",
"submission",
"lattice",
"closure"
        ]
      },
      acute_state: {
        capacity: 30,
        tension: 40,
        sensitivity: 2,
        attitude: 3
      },
      recovery: {
        baselineCapacityLimit: 0.7,
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
"Lattice→прошлое",
"закрытие→освобождение"
        ]
      },
      relations: {
        attitude: 4,
        openness: 4,
        plasticity: 3
      },
      world_effects: {
        facts: [
"Суми отказалась от прежнего знакомого"
        ],
        threads: [
"частичный разрыв связи Суми"
        ]
      }
    }
  },
{
    id: "contract_personal_mai_01",
    issuerId: "fac_helix",
    subjectId: "NPC-CAND-GEN-04",
    personal: true,
    format: "external_transfer",
    durationMinutes: 2880,
    offerDeadlineMinutes: 2880,
    difficulty: "medium",
    cruelty: "moderate",
    title: "Прежний куратор",
    description: "Lattice знает, что Май однажды оставили ждать и не вернулись. Организация предлагает узнать причину исчезновения прежнего куратора в обмен на участие в серии стандартизированных протоколов. Актив будет подвергнут обусловливанию, чтобы проверить его лояльность. Ожидается закрепление покорности.",
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
        value: 55
      },
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 55
      }
    ],
    rewards: {
      credits: 790,
      trust: 14
    },
    penalties: {
      credits: -100,
      trust: -5
    },
    return_profile: {
      memory: {
        theme: "обусловливание, поиск причины исчезновения",
        fragments: [
"Lattice знает о моём прошлом.",
"Меня обусловливали на лояльность.",
"Я искала причину исчезновения куратора.",
"Я стала послушной."
        ],
        tags: [
"command",
"submission",
"conditioning",
"lattice",
"abandonment"
        ]
      },
      acute_state: {
        capacity: 20,
        tension: 55,
        sensitivity: 3,
        attitude: 5
      },
      recovery: {
        baselineCapacityLimit: 0.55,
        method: "отдых",
        durationDays: 2
      },
      traits: {
        kept: [
"trait_conditioned_submission"
        ],
        traumatic: [],
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
"Lattice→ключ к прошлому",
"подчинение→безопасность"
        ]
      },
      relations: {
        attitude: 6,
        openness: 5,
        plasticity: 5
      },
      world_effects: {
        facts: [
"Lattice начал поиск причины исчезновения куратора Май"
        ],
        threads: [
"связь Май с Lattice"
        ]
      }
    }
  },
{
    id: "contract_personal_mai_02",
    issuerId: "fac_helix",
    subjectId: "NPC-CAND-GEN-04",
    personal: true,
    format: "external_transfer",
    durationMinutes: 4320,
    offerDeadlineMinutes: 4320,
    difficulty: "hard",
    cruelty: "severe",
    title: "Сеть зависимых",
    description: "Lattice предлагает Май перехватить сеть зависимых прежнего куратора в обмен на участие в предельном протоколе обусловливания. Актив будет доведён до глубокой перестройки воли, чтобы стать надёжным исполнителем. Ожидается тяжёлое истощение.",
    conditions: [
{
        type: "custom",
        key: "plasticity",
        operator: ">=",
        value: 65
      },
{
        type: "attitude",
        operator: ">=",
        value: 55
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 55
      }
    ],
    rewards: {
      credits: 980,
      trust: 19,
      items: [
"eq_collar"
      ]
    },
    penalties: {
      credits: -150,
      trust: -7
    },
    return_profile: {
      memory: {
        theme: "предельное обусловливание, перехват сети",
        fragments: [
"Меня довели до глубокой перестройки воли.",
"Я перехватила сеть зависимых.",
"Стала надёжным исполнителем.",
"Цена была моей волей."
        ],
        tags: [
"command",
"submission",
"conditioning",
"lattice",
"breakdown"
        ]
      },
      acute_state: {
        capacity: 7,
        tension: 78,
        sensitivity: 4,
        attitude: 9
      },
      recovery: {
        baselineCapacityLimit: 0.3,
        method: "капсула",
        durationDays: 3
      },
      traits: {
        kept: [
"trait_conditioned_submission"
        ],
        traumatic: [
{
            id: "trauma_will_breakdown",
            trigger: "command/submission",
            response: "глубокая перестройка воли"
          }
        ],
        temporary: [
{
            id: "anomaly_submission_echo",
            impulse: "навязчивое подчинение",
            decayCondition: "работа с памятью"
          }
        ]
      },
      associations: {
        traumatic: [
"воля→потеря",
"Lattice→власть"
        ],
        new: [
"сеть→власть"
        ]
      },
      relations: {
        attitude: 9,
        openness: 6,
        plasticity: 7
      },
      world_effects: {
        facts: [
"Май перехватила сеть зависимых куратора"
        ],
        threads: [
"эскалация связи Май с Lattice"
        ]
      }
    }
  },
{
    id: "contract_personal_mai_03",
    issuerId: "fac_helix",
    subjectId: "NPC-CAND-GEN-04",
    personal: true,
    format: "external_transfer",
    durationMinutes: 1440,
    offerDeadlineMinutes: 1440,
    difficulty: "easy",
    cruelty: "mild",
    title: "Отказ от старого куратора",
    description: "Lattice предлагает Май путь частичного разрыва: она может отказаться от старого куратора и закрыть вопрос, но должна пройти финальную проверку лояльности. Актив остаётся в лаборатории, подвергается стандартной серии. Ожидается закрытие вопроса.",
    conditions: [
{
        type: "attitude",
        operator: ">=",
        value: 50
      },
{
        type: "custom",
        key: "openness",
        operator: ">=",
        value: 50
      }
    ],
    rewards: {
      credits: 610,
      trust: 10
    },
    penalties: {
      credits: -60,
      trust: -3
    },
    return_profile: {
      memory: {
        theme: "финальная проверка, отказ от старого куратора",
        fragments: [
"Я решила отказаться от старого куратора.",
"Меня проверили на лояльность.",
"Я закрыла вопрос."
        ],
        tags: [
"command",
"submission",
"lattice",
"closure"
        ]
      },
      acute_state: {
        capacity: 30,
        tension: 40,
        sensitivity: 2,
        attitude: 3
      },
      recovery: {
        baselineCapacityLimit: 0.7,
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
"Lattice→прошлое",
"закрытие→освобождение"
        ]
      },
      relations: {
        attitude: 4,
        openness: 4,
        plasticity: 3
      },
      world_effects: {
        facts: [
"Май отказалась от старого куратора"
        ],
        threads: [
"частичный разрыв связи Май"
        ]
      }
    }
  }
];
