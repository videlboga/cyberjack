// Generated from src/domain/anatomy.ts and source_rigs.json by tools/build-anatomical-targets.mjs
export const ANATOMICAL_TARGETS=[
  {
    "id": "posture",
    "label": "Поза (Текущее положение тела)",
    "gender": null,
    "status": "non-spatial",
    "pairPolicy": "same"
  },
  {
    "id": "mind_state",
    "label": "Психика/Разум",
    "gender": null,
    "status": "non-spatial",
    "pairPolicy": "same"
  },
  {
    "id": "head",
    "label": "Голова",
    "gender": null,
    "status": "anatomical-proxy",
    "pairPolicy": "same",
    "proxy": {
      "anchor": "cf_j_head",
      "offset": [
        0,
        0.045,
        0
      ]
    }
  },
  {
    "id": "hair",
    "label": "Волосы",
    "gender": null,
    "status": "anatomical-proxy",
    "pairPolicy": "same",
    "proxy": {
      "anchor": "cf_j_head",
      "offset": [
        0,
        0.075,
        0
      ]
    }
  },
  {
    "id": "face",
    "label": "Лицо",
    "gender": null,
    "status": "anatomical-proxy",
    "pairPolicy": "same",
    "proxy": {
      "anchor": "cf_j_head",
      "offset": [
        0,
        0.025,
        0.04
      ]
    }
  },
  {
    "id": "lips",
    "label": "Губы",
    "gender": null,
    "status": "anatomical-proxy",
    "pairPolicy": "same",
    "proxy": {
      "anchor": "cf_j_head",
      "offset": [
        0,
        0.005,
        0.045
      ]
    }
  },
  {
    "id": "neck",
    "label": "Шея",
    "gender": null,
    "status": "source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "a_n_neck",
        "anchor": "cf_j_neck",
        "offset": [
          0,
          0.025099600555880588,
          -0.005284126238558029
        ]
      }
    ]
  },
  {
    "id": "shoulders",
    "label": "Плечи",
    "gender": null,
    "status": "source-marker",
    "pairPolicy": "opposite",
    "markers": [
      {
        "name": "a_n_shoulder_L",
        "anchor": "cf_j_shoulder_L",
        "offset": [
          -0.06407875255113468,
          0.016512894649282166,
          -0.0033023059915304525
        ]
      },
      {
        "name": "a_n_shoulder_R",
        "anchor": "cf_j_shoulder_R",
        "offset": [
          0.06403608173506825,
          0.016512964131064088,
          -0.003285180351376915
        ]
      }
    ]
  },
  {
    "id": "chest",
    "label": "Грудь",
    "gender": null,
    "status": "source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "a_n_nip_L",
        "anchor": "cf_j_spine03",
        "offset": [
          1.429973653887088e-16,
          -0.0053501777088889105,
          0.04656636140077433
        ]
      },
      {
        "name": "a_n_nip_R",
        "anchor": "cf_j_spine03",
        "offset": [
          -7.394527158896499e-9,
          -0.005350009833782049,
          0.04656636140077436
        ]
      }
    ]
  },
  {
    "id": "nipples",
    "label": "Соски",
    "gender": null,
    "status": "source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "a_n_nip_L",
        "anchor": "cf_j_spine03",
        "offset": [
          1.429973653887088e-16,
          -0.0053501777088889105,
          0.04656636140077433
        ]
      },
      {
        "name": "a_n_nip_R",
        "anchor": "cf_j_spine03",
        "offset": [
          -7.394527158896499e-9,
          -0.005350009833782049,
          0.04656636140077436
        ]
      }
    ]
  },
  {
    "id": "belly",
    "label": "Живот",
    "gender": null,
    "status": "anatomical-proxy",
    "pairPolicy": "same",
    "proxy": {
      "anchor": "cf_j_spine01",
      "offset": [
        0,
        0.025,
        0.05
      ]
    }
  },
  {
    "id": "back",
    "label": "Спина",
    "gender": null,
    "status": "source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "a_n_back",
        "anchor": "cf_j_spine03",
        "offset": [
          -1.7084227439730333e-18,
          0.03566785303299635,
          -0.04623610304949951
        ]
      }
    ]
  },
  {
    "id": "waist",
    "label": "Талия",
    "gender": null,
    "status": "source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "a_n_waist_L",
        "anchor": "cf_j_waist01",
        "offset": [
          -0.0792619017371243,
          -1.4666397548459504e-16,
          -1.0176857047540572e-34
        ]
      },
      {
        "name": "a_n_waist_R",
        "anchor": "cf_j_waist01",
        "offset": [
          0.07926189280145615,
          -1.4666397548459504e-16,
          -1.0176857047540572e-34
        ]
      }
    ]
  },
  {
    "id": "arms",
    "label": "Руки",
    "gender": null,
    "status": "source-marker",
    "pairPolicy": "opposite",
    "markers": [
      {
        "name": "a_n_arm_L",
        "anchor": "cf_j_arm00_L",
        "offset": [
          -0.07217629337126052,
          6.34629762748354e-7,
          -0.002144718327534349
        ]
      },
      {
        "name": "a_n_arm_R",
        "anchor": "cf_j_arm00_R",
        "offset": [
          0.07264887811740406,
          5.047191750186416e-7,
          -0.0021233565382853406
        ]
      }
    ]
  },
  {
    "id": "hands",
    "label": "Кисти",
    "gender": null,
    "status": "source-marker",
    "pairPolicy": "opposite",
    "markers": [
      {
        "name": "a_n_hand_L",
        "anchor": "cf_s_hand_L",
        "offset": [
          -0.031092706965557926,
          -0.009775500729735126,
          0.0025390349379324747
        ]
      },
      {
        "name": "a_n_hand_R",
        "anchor": "cf_s_hand_R",
        "offset": [
          0.03302578929771883,
          -0.011889264659428793,
          0.0026420631192111974
        ]
      }
    ]
  },
  {
    "id": "inner_thighs",
    "label": "Внутренняя сторона бедер",
    "gender": null,
    "status": "geometric-region",
    "pairPolicy": "same"
  },
  {
    "id": "legs",
    "label": "Ноги",
    "gender": null,
    "status": "source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "a_n_leg_L",
        "anchor": "cf_j_thigh00_L",
        "offset": [
          -0.0016511156131988377,
          -0.1504494399718178,
          -0.006605201926318908
        ]
      },
      {
        "name": "a_n_leg_R",
        "anchor": "cf_j_thigh00_R",
        "offset": [
          0.0016513139525872816,
          -0.15044997813017022,
          -0.006605167521144242
        ]
      }
    ]
  },
  {
    "id": "feet",
    "label": "Ступни",
    "gender": null,
    "status": "source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "a_n_ankle_L",
        "anchor": "cf_j_leg01_L",
        "offset": [
          0.0023779798277911296,
          -0.2706130387401066,
          -0.004755657295477487
        ]
      },
      {
        "name": "a_n_ankle_R",
        "anchor": "cf_j_leg01_R",
        "offset": [
          0.0023778570176374546,
          -0.2706133660485554,
          -0.004755713120564432
        ]
      }
    ]
  },
  {
    "id": "buttocks",
    "label": "Ягодицы",
    "gender": null,
    "status": "source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "cf_hit_siri_L",
        "anchor": "cf_j_waist02",
        "offset": [
          -0.03877657739956393,
          -0.012160905049032375,
          -0.018524826438455395
        ]
      },
      {
        "name": "cf_hit_siri_R",
        "anchor": "cf_j_waist02",
        "offset": [
          0.03877655142132744,
          -0.012160935042827637,
          -0.01852494042705647
        ]
      }
    ]
  },
  {
    "id": "anus",
    "label": "Анус",
    "gender": null,
    "status": "source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "a_n_ana",
        "anchor": "cf_j_waist02",
        "offset": [
          -3.754122497947041e-9,
          -0.049960352083754676,
          -0.023703239642842718
        ]
      }
    ]
  },
  {
    "id": "penis",
    "label": "Член",
    "gender": "male",
    "status": "source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "a_n_dan",
        "anchor": "cf_j_waist02",
        "offset": [
          -0.000008705357596929057,
          -0.039380970018824436,
          0.054822812647017743
        ]
      }
    ]
  },
  {
    "id": "testicles",
    "label": "Яички",
    "gender": "male",
    "status": "source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "cm_J_dan_f_L",
        "anchor": "cf_j_waist02",
        "offset": [
          -0.011897989701928284,
          -0.0644805705747051,
          0.035007338329695166
        ]
      },
      {
        "name": "cm_J_dan_f_R",
        "anchor": "cf_j_waist02",
        "offset": [
          0.011880578986736147,
          -0.0644805705747051,
          0.035007338329695166
        ]
      }
    ]
  },
  {
    "id": "prostate",
    "label": "Простата",
    "gender": "male",
    "status": "internal-unavailable",
    "pairPolicy": "same"
  },
  {
    "id": "vulva",
    "label": "Вульва",
    "gender": "female",
    "status": "source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "a_n_kokan",
        "anchor": "cf_j_waist02",
        "offset": [
          -2.192933733346162e-8,
          -0.042273009908464235,
          0.013210347555573551
        ]
      }
    ]
  },
  {
    "id": "vagina",
    "label": "Влагалище",
    "gender": "female",
    "status": "internal-unavailable",
    "pairPolicy": "same"
  },
  {
    "id": "clitoris",
    "label": "Клитор",
    "gender": "female",
    "status": "approximate-source-marker",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "a_n_kokan",
        "anchor": "cf_j_waist02",
        "offset": [
          -2.192933733346162e-8,
          -0.042273009908464235,
          0.013210347555573551
        ]
      }
    ]
  },
  {
    "id": "slot_room",
    "label": "Слот: Окружение (Комната)",
    "gender": null,
    "status": "non-spatial",
    "pairPolicy": "same"
  },
  {
    "id": "slot_social",
    "label": "Слот: Социальное",
    "gender": null,
    "status": "non-spatial",
    "pairPolicy": "same"
  },
  {
    "id": "systemic",
    "label": "Всё тело",
    "gender": null,
    "status": "non-spatial",
    "pairPolicy": "same"
  },
  {
    "id": "groin",
    "label": "Паховая область",
    "status": "source-marker",
    "source": "spatial-extension",
    "pairPolicy": "same",
    "markers": [
      {
        "name": "a_n_kokan",
        "anchor": "cf_j_waist02",
        "offset": [
          -2.192933733346162e-8,
          -0.042273009908464235,
          0.013210347555573551
        ]
      }
    ]
  }
];
