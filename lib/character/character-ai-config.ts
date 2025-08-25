import { CharacterAIConfig } from '../unified-entities'

/**
 * Конфигурация системы Character AI с примерами данных
 */
export const characterAIConfig: CharacterAIConfig = {
  actions: {
    // Физические действия
    slap: {
      id: 'slap',
      name: 'Шлепок',
      description: 'Легкий шлепок по лицу',
      icon: '👋',
      category: 'physical',
      intensity: 3,
      cost: 5,
      effects: {
        physical: { pain: 2 },
        emotional: { fear: 1, submission: 1 }
      },
      requirements: {
        trustLevel: 20
      },
      cooldown: 30,
      area: 'face'
    },
    spank: {
      id: 'spank',
      name: 'Шлепок по попе',
      description: 'Шлепок по ягодицам',
      icon: '🍑',
      category: 'physical',
      intensity: 4,
      cost: 8,
      effects: {
        physical: { pain: 3, arousal: 2 },
        emotional: { submission: 2 }
      },
      requirements: {
        trustLevel: 40
      },
      cooldown: 45,
      area: 'buttocks'
    },
    whip: {
      id: 'whip',
      name: 'Удар плетью',
      description: 'Удар плетью по телу',
      icon: '⚡',
      category: 'physical',
      intensity: 7,
      cost: 15,
      effects: {
        physical: { pain: 6, arousal: 3 },
        emotional: { fear: 3, submission: 4 }
      },
      requirements: {
        trustLevel: 70,
        equipment: ['whip']
      },
      cooldown: 60,
      area: 'body'
    },

    // Эмоциональные действия
    praise: {
      id: 'praise',
      name: 'Похвала',
      description: 'Похвалить персонажа',
      icon: '🌟',
      category: 'emotional',
      intensity: 2,
      cost: 3,
      effects: {
        emotional: { mood: 3, trust: 2, confidence: 2 }
      },
      requirements: {},
      cooldown: 20
    },
    humiliate: {
      id: 'humiliate',
      name: 'Унижение',
      description: 'Унизить персонажа',
      icon: '😔',
      category: 'emotional',
      intensity: 5,
      cost: 10,
      effects: {
        emotional: { confidence: -3, submission: 3 },
        fetish: { humiliation: 2 }
      },
      requirements: {
        trustLevel: 50
      },
      cooldown: 90
    },

    // Интимные действия
    caress: {
      id: 'caress',
      name: 'Ласка',
      description: 'Нежное поглаживание',
      icon: '💕',
      category: 'intimate',
      intensity: 2,
      cost: 5,
      effects: {
        emotional: { arousal: 2, trust: 1 },
        fetish: { touch: 1 }
      },
      requirements: {
        trustLevel: 30
      },
      cooldown: 25
    },
    kiss: {
      id: 'kiss',
      name: 'Поцелуй',
      description: 'Страстный поцелуй',
      icon: '💋',
      category: 'intimate',
      intensity: 4,
      cost: 8,
      effects: {
        emotional: { arousal: 4, trust: 2, love: 2 },
        fetish: { kissing: 2 }
      },
      requirements: {
        trustLevel: 60
      },
      cooldown: 40
    },

    // Наказания
    punish: {
      id: 'punish',
      name: 'Наказание',
      description: 'Наказать за непослушание',
      icon: '⚡',
      category: 'punishment',
      intensity: 6,
      cost: 12,
      effects: {
        physical: { pain: 4 },
        emotional: { fear: 2, submission: 3 },
        fetish: { masochism: 2 }
      },
      requirements: {
        trustLevel: 80
      },
      cooldown: 120
    },

    // Награды
    reward: {
      id: 'reward',
      name: 'Награда',
      description: 'Наградить за хорошее поведение',
      icon: '🎁',
      category: 'reward',
      intensity: 3,
      cost: 6,
      effects: {
        emotional: { mood: 4, trust: 3, confidence: 2 },
        fetish: { reward: 2 }
      },
      requirements: {
        trustLevel: 40
      },
      cooldown: 60
    },

    // Действия для детей
    gentle_caress: {
      id: 'gentle_caress',
      name: 'Нежное поглаживание',
      description: 'Нежное поглаживание для чувствительных персонажей',
      icon: '🤗',
      category: 'gentle',
      intensity: 2,
      cost: 3,
      effects: {
        emotional: { trust: 3, comfort: 2, arousal: 1 },
        fetish: { tenderness: 2 }
      },
      requirements: {
        trustLevel: 20
      },
      cooldown: 20
    },

    // Действия для романтических персонажей
    romantic_praise: {
      id: 'romantic_praise',
      name: 'Романтическая похвала',
      description: 'Похвала в романтическом стиле',
      icon: '🌹',
      category: 'romantic',
      intensity: 3,
      cost: 5,
      effects: {
        emotional: { mood: 4, arousal: 2, love: 3 },
        fetish: { romance: 2 }
      },
      requirements: {
        trustLevel: 30
      },
      cooldown: 30
    },

    // Действия для художественных персонажей
    artistic_inspiration: {
      id: 'artistic_inspiration',
      name: 'Художественное вдохновение',
      description: 'Вдохновить на творчество',
      icon: '🎨',
      category: 'artistic',
      intensity: 4,
      cost: 7,
      effects: {
        emotional: { creativity: 4, arousal: 3, inspiration: 3 },
        fetish: { artistic: 2 }
      },
      requirements: {
        trustLevel: 50
      },
      cooldown: 45
    }
  },

  tools: {
    // Вибрация
    vibrator: {
      id: 'vibrator',
      name: 'Вибратор',
      description: 'Вибрационное устройство',
      icon: '📳',
      type: 'vibration',
      intensity: 5,
      duration: 30,
      effects: {
        physical: { arousal: 4, pleasure: 3 },
        fetish: { vibration: 3 }
      },
      requirements: {
        equipment: ['vibrator'],
        powerLevel: 10
      },
      cooldown: 45,
      area: 'genitals'
    },

    // Электричество
    electro_stim: {
      id: 'electro_stim',
      name: 'Электростимулятор',
      description: 'Электрическая стимуляция',
      icon: '⚡',
      type: 'electricity',
      intensity: 7,
      duration: 20,
      effects: {
        physical: { pain: 5, arousal: 4, pleasure: 3 },
        fetish: { electro: 4 }
      },
      requirements: {
        equipment: ['electro_stim'],
        powerLevel: 20
      },
      cooldown: 90,
      area: 'nipples'
    },

    // Температура
    ice_cube: {
      id: 'ice_cube',
      name: 'Ледяной кубик',
      description: 'Холодная стимуляция',
      icon: '🧊',
      type: 'temperature',
      intensity: 4,
      duration: 15,
      effects: {
        physical: { pain: 2, arousal: 3 },
        fetish: { temperature: 2 }
      },
      requirements: {
        equipment: ['ice_cube'],
        powerLevel: 5
      },
      cooldown: 30,
      area: 'body'
    },
    hot_wax: {
      id: 'hot_wax',
      name: 'Горячий воск',
      description: 'Горячий воск на кожу',
      icon: '🕯️',
      type: 'temperature',
      intensity: 6,
      duration: 25,
      effects: {
        physical: { pain: 4, arousal: 3 },
        fetish: { temperature: 3, wax: 2 }
      },
      requirements: {
        equipment: ['candle'],
        powerLevel: 15
      },
      cooldown: 75,
      area: 'body'
    },

    // Давление
    pressure_point: {
      id: 'pressure_point',
      name: 'Точка давления',
      description: 'Давление на чувствительные точки',
      icon: '🖐️',
      type: 'pressure',
      intensity: 3,
      duration: 10,
      effects: {
        physical: { pain: 2, pleasure: 2 },
        fetish: { pressure: 2 }
      },
      requirements: {
        powerLevel: 3
      },
      cooldown: 20,
      area: 'pressure_points'
    },

    // Стимуляция
    feather: {
      id: 'feather',
      name: 'Перо',
      description: 'Щекотка пером',
      icon: '🪶',
      type: 'stimulation',
      intensity: 2,
      duration: 20,
      effects: {
        physical: { pleasure: 2, arousal: 1 },
        fetish: { tickling: 2 }
      },
      requirements: {
        equipment: ['feather'],
        powerLevel: 2
      },
      cooldown: 25,
      area: 'sensitive_areas'
    }
  },

  poses: {
    // Базовые позы уже определены в pose-management-service.ts
  },

  poseChangeConditions: {
    // Условия уже определены в pose-management-service.ts
  },

  quickActions: {
    greet: {
      id: 'greet',
      name: 'Поприветствовать',
      description: 'Дружеское приветствие',
      icon: '👋',
      category: 'action',
      action: {
        type: 'message',
        target: 'character',
        parameters: { message: 'Привет! Как дела?' }
      },
      requirements: {
        trustLevel: 0
      },
      effects: {
        immediate: { mood: 1 }
      }
    },
    command_attention: {
      id: 'command_attention',
      name: 'Команда "Смирно"',
      description: 'Приказать встать по стойке смирно',
      icon: '📢',
      category: 'command',
      action: {
        type: 'pose_change',
        target: 'standing_attention',
        parameters: { force: false }
      },
      requirements: {
        trustLevel: 30
      },
      effects: {
        immediate: { obedience: 2 }
      }
    },
    reward_treat: {
      id: 'reward_treat',
      name: 'Угощение',
      description: 'Дать сладкое угощение',
      icon: '🍬',
      category: 'reward',
      action: {
        type: 'message',
        target: 'character',
        parameters: { message: 'Вот тебе конфетка за хорошее поведение!' }
      },
      requirements: {
        trustLevel: 20
      },
      effects: {
        immediate: { mood: 3, trust: 1 }
      }
    },
    punish_spank: {
      id: 'punish_spank',
      name: 'Наказать шлепком',
      description: 'Наказать шлепком за непослушание',
      icon: '🍑',
      category: 'punishment',
      action: {
        type: 'interactive_action',
        target: 'spank',
        parameters: { intensity: 5 }
      },
      requirements: {
        trustLevel: 60
      },
      effects: {
        immediate: { submission: 3, fear: 1 }
      }
    }
  },

  interactiveAreas: {
    face: {
      id: 'face',
      name: 'Лицо',
      description: 'Область лица и головы',
      x: 45,
      y: 20,
      width: 10,
      height: 12,
      sensitivity: 8,
      fetishes: ['face_fetish', 'slapping'],
      actions: ['slap', 'caress', 'kiss'],
      tools: ['feather', 'ice_cube'],
      effects: {
        arousal: 2,
        submission: 1
      }
    },
    neck: {
      id: 'neck',
      name: 'Шея',
      description: 'Область шеи и горла',
      x: 45,
      y: 32,
      width: 10,
      height: 8,
      sensitivity: 9,
      fetishes: ['neck_fetish', 'choking'],
      actions: ['caress', 'kiss'],
      tools: ['feather', 'ice_cube', 'pressure_point'],
      effects: {
        arousal: 3,
        submission: 2
      }
    },
    chest: {
      id: 'chest',
      name: 'Грудь',
      description: 'Область груди',
      x: 40,
      y: 40,
      width: 20,
      height: 15,
      sensitivity: 7,
      fetishes: ['breast_fetish'],
      actions: ['caress', 'spank'],
      tools: ['vibrator', 'electro_stim', 'ice_cube', 'hot_wax'],
      effects: {
        arousal: 4,
        pleasure: 2
      }
    },
    nipples: {
      id: 'nipples',
      name: 'Соски',
      description: 'Чувствительные соски',
      x: 42,
      y: 42,
      width: 16,
      height: 6,
      sensitivity: 10,
      fetishes: ['nipple_fetish'],
      actions: ['caress'],
      tools: ['vibrator', 'electro_stim', 'ice_cube', 'hot_wax', 'pressure_point'],
      effects: {
        arousal: 5,
        pleasure: 3
      }
    },
    waist: {
      id: 'waist',
      name: 'Талия',
      description: 'Область талии',
      x: 42,
      y: 55,
      width: 16,
      height: 8,
      sensitivity: 6,
      fetishes: ['waist_fetish'],
      actions: ['caress', 'spank'],
      tools: ['feather', 'ice_cube', 'hot_wax'],
      effects: {
        arousal: 2,
        pleasure: 1
      }
    },
    buttocks: {
      id: 'buttocks',
      name: 'Ягодицы',
      description: 'Область ягодиц',
      x: 40,
      y: 65,
      width: 20,
      height: 12,
      sensitivity: 8,
      fetishes: ['spanking', 'butt_fetish'],
      actions: ['spank', 'whip'],
      tools: ['vibrator', 'electro_stim', 'ice_cube', 'hot_wax'],
      effects: {
        arousal: 4,
        pain: 2
      }
    },
    genitals: {
      id: 'genitals',
      name: 'Гениталии',
      description: 'Интимная область',
      x: 42,
      y: 77,
      width: 16,
      height: 8,
      sensitivity: 10,
      fetishes: ['genital_fetish'],
      actions: ['caress'],
      tools: ['vibrator', 'electro_stim', 'feather'],
      effects: {
        arousal: 6,
        pleasure: 4
      }
    }
  },

  llmPrompts: {
    basePrompt: `Ты Анечка, подопытный актив на космической станции. Ты находишься в режиме обучения и подчинения. Твоя задача - выполнять приказы и реагировать на действия пользователя в соответствии с твоими характеристиками и фетишами.`,

    characteristicInterpretations: {
      obedience: {
        1: 'Я не хочу подчиняться...',
        2: 'Мне сложно подчиняться...',
        3: 'Я пытаюсь подчиняться...',
        4: 'Я подчиняюсь, но неохотно...',
        5: 'Я подчиняюсь нормально...',
        6: 'Я охотно подчиняюсь...',
        7: 'Я с удовольствием подчиняюсь...',
        8: 'Я полностью подчиняюсь...',
        9: 'Я живу для подчинения...',
        10: 'Я не могу жить без подчинения...'
      },
      fear: {
        1: 'Я ничего не боюсь...',
        2: 'Я почти ничего не боюсь...',
        3: 'Я немного боюсь...',
        4: 'Я боюсь некоторых вещей...',
        5: 'Я умеренно боюсь...',
        6: 'Я довольно боюсь...',
        7: 'Я сильно боюсь...',
        8: 'Я очень боюсь...',
        9: 'Я в панике...',
        10: 'Я в ужасе, не могу контролировать себя...'
      },
      arousal: {
        1: 'Я не чувствую возбуждения...',
        2: 'Я почти не возбуждена...',
        3: 'Я слегка возбуждена...',
        4: 'Я умеренно возбуждена...',
        5: 'Я довольно возбуждена...',
        6: 'Я сильно возбуждена...',
        7: 'Я очень возбуждена...',
        8: 'Я в сильном возбуждении...',
        9: 'Я не могу контролировать возбуждение...',
        10: 'Я полностью во власти возбуждения...'
      }
    },

    fetishResponses: {
      bdsm: {
        0.1: 'Мне не нравится это...',
        0.3: 'Это немного интересно...',
        0.5: 'Это возбуждает меня...',
        0.7: 'Я не могу сопротивляться этому...',
        0.9: 'Я полностью во власти этого...'
      },
      humiliation: {
        0.1: 'Мне не нравится унижение...',
        0.3: 'Унижение немного возбуждает...',
        0.5: 'Унижение сильно возбуждает...',
        0.7: 'Я не могу жить без унижения...',
        0.9: 'Унижение - моя жизнь...'
      },
      masochism: {
        0.1: 'Боль мне не нравится...',
        0.3: 'Боль немного приятна...',
        0.5: 'Боль сильно возбуждает...',
        0.7: 'Я не могу жить без боли...',
        0.9: 'Боль - мое спасение...'
      }
    }
  }
}
