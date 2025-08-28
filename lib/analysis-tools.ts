// ===== СИСТЕМА ИНСТРУМЕНТОВ АНАЛИЗА ХАРАКТЕРИСТИК =====
// На основе системы из Obsidian "Система Инструментов и Взаимодействий"

export type AnalysisToolType =
  | 'oscillator'          // Нейронный осциллятор
  | 'stimulator'          // Тактильный стимулятор
  | 'suppressor'          // Фонаторный супрессор
  | 'impulsor'           // Электромагнитный импульсор
  | 'analyzer'           // Ректо-анализатор
  | 'modulator'          // Клиторальный модулятор
  | 'thermoregulator'    // Терморегулятор
  | 'compressor'         // Компрессионный пресс
  | 'compressor_nv'      // Нейроваскулярный компрессор
  | 'dilatator'          // Пневматический дилататор
  | 'synthesizer'        // Кибернетический партнер
  | 'quantum_brothel'    // Виртуальный гарем
  | 'pleasure_labyrinth' // Сенсорный лабиринт
  | 'pleasure_matrix'    // Матрица удовольствий
  | 'neural_network'     // Нейронная сеть
  | 'reality_simulator'  // Симулятор реальности
  | 'personality_probe'  // Зонд личности
  | 'deep_scanner'       // Глубокий сканер
  | 'quantum_mirror'     // Квантовое зеркало
  | 'mind_melter'        // Растворитель разума

export interface AnalysisTool {
  id: string
  name: string
  type: AnalysisToolType
  cost: number
  level: 'basic' | 'advanced' | 'expert' | 'master'
  capacity: number // Количество одновременно анализируемых персонажей
  description: string

  // Что раскрывает инструмент
  reveals: {
    physical?: string[]      // Физические характеристики
    psychological?: string[] // Психологические характеристики
    social?: string[]        // Социальные характеристики
    special?: string[]       // Специальные характеристики
  }

  // Какие фетиши активирует
  activatesFetishes: Record<string, number> // фетиш -> процент активации

  // Последствия использования
  consequences: {
    excitement: number      // Возбуждение (+/-)
    stress: number         // Стресс (+/-)
    fatigue: number        // Усталость (+/-)
    trustChange: number    // Изменение доверия (+/-)
    healthImpact: number   // Влияние на здоровье (+/-)
  }

  // Эффективность анализа
  accuracy: number         // Базовая точность (0-1)
  speed: number           // Скорость анализа в минутах
  riskLevel: 'low' | 'medium' | 'high' // Риск использования

  // Требования для использования
  requirements?: {
    userLevel?: number     // Минимальный уровень пользователя
    characterRank?: string // Минимальный ранг персонажа
    prerequisites?: string[] // Необходимые предварительные знания
  }
}

// ===== КОНКРЕТНЫЕ ИНСТРУМЕНТЫ =====

export const ANALYSIS_TOOLS: Record<AnalysisToolType, AnalysisTool> = {
  // ===== РУЧНЫЕ ИНСТРУМЕНТЫ =====
  oscillator: {
    id: 'oscillator',
    name: 'Нейронный осциллятор',
    type: 'oscillator',
    cost: 200,
    level: 'basic',
    capacity: 1,
    description: 'Квантовый осциллятор с нейронной синхронизацией для сенсорного тестирования',
    reveals: {
      physical: ['endurance', 'sensitivity']
    },
    activatesFetishes: {
      vibration: 20,
      sensitivity: 15
    },
    consequences: {
      excitement: 10,
      stress: 0,
      fatigue: 5,
      trustChange: -5,
      healthImpact: 0
    },
    accuracy: 0.7,
    speed: 10,
    riskLevel: 'low'
  },

  stimulator: {
    id: 'stimulator',
    name: 'Тактильный стимулятор',
    type: 'stimulator',
    cost: 150,
    level: 'basic',
    capacity: 1,
    description: 'Нейротактильная перчатка с микроэлектродами для сенсорной стимуляции',
    reveals: {
      physical: ['flexibility', 'sensitivity']
    },
    activatesFetishes: {
      tickling: 25,
      masochism: 15,
      sadism: 15
    },
    consequences: {
      excitement: 15,
      stress: 8,
      fatigue: 3,
      trustChange: -8,
      healthImpact: -2
    },
    accuracy: 0.75,
    speed: 8,
    riskLevel: 'low'
  },

  suppressor: {
    id: 'suppressor',
    name: 'Фонаторный супрессор',
    type: 'suppressor',
    cost: 100,
    level: 'basic',
    capacity: 1,
    description: 'Акустический супрессор с квантовыми фильтрами для вокального подавления',
    reveals: {
      psychological: ['emotional_stability', 'self_esteem']
    },
    activatesFetishes: {
      humiliation: 30,
      submission: 20
    },
    consequences: {
      excitement: 12,
      stress: 5,
      fatigue: 2,
      trustChange: -15,
      healthImpact: 0
    },
    accuracy: 0.8,
    speed: 5,
    riskLevel: 'low'
  },

  impulsor: {
    id: 'impulsor',
    name: 'Электромагнитный импульсор',
    type: 'impulsor',
    cost: 300,
    level: 'basic',
    capacity: 1,
    description: 'Импульсный генератор с адаптивной электромагнитной модуляцией',
    reveals: {
      physical: ['sensitivity']
    },
    activatesFetishes: {
      electricity: 25,
      extreme_pain: 20
    },
    consequences: {
      excitement: 15,
      stress: 8,
      fatigue: 5,
      trustChange: -10,
      healthImpact: -5
    },
    accuracy: 0.85,
    speed: 12,
    riskLevel: 'medium'
  },

  // ===== СПЕЦИАЛИЗИРОВАННЫЕ ИНСТРУМЕНТЫ =====
  analyzer: {
    id: 'analyzer',
    name: 'Ректо-анализатор',
    type: 'analyzer',
    cost: 400,
    level: 'advanced',
    capacity: 1,
    description: 'Биометрический зонд с адаптивными сенсорами для ректо-анального исследования',
    reveals: {
      physical: ['flexibility', 'endurance']
    },
    activatesFetishes: {
      anal: 30
    },
    consequences: {
      excitement: 10,
      stress: 12,
      fatigue: 8,
      trustChange: -20,
      healthImpact: -8
    },
    accuracy: 0.9,
    speed: 20,
    riskLevel: 'medium',
    requirements: {
      userLevel: 2
    }
  },

  modulator: {
    id: 'modulator',
    name: 'Клиторальный модулятор',
    type: 'modulator',
    cost: 250,
    level: 'basic',
    capacity: 1,
    description: 'Нейромодулятор с точечным воздействием для клиторальной стимуляции',
    reveals: {
      physical: ['sensitivity']
    },
    activatesFetishes: {
      sensitivity: 25
    },
    consequences: {
      excitement: 15,
      stress: 6,
      fatigue: 4,
      trustChange: -8,
      healthImpact: -3
    },
    accuracy: 0.8,
    speed: 15,
    riskLevel: 'low'
  },

  thermoregulator: {
    id: 'thermoregulator',
    name: 'Терморегулятор',
    type: 'thermoregulator',
    cost: 350,
    level: 'advanced',
    capacity: 1,
    description: 'Квантовый терморегулятор с градиентным температурным контролем',
    reveals: {
      physical: ['endurance']
    },
    activatesFetishes: {
      temperature: 30,
      sensory_deprivation: 20
    },
    consequences: {
      excitement: 10,
      stress: 10,
      fatigue: 8,
      trustChange: -12,
      healthImpact: -5
    },
    accuracy: 0.85,
    speed: 18,
    riskLevel: 'medium',
    requirements: {
      userLevel: 2
    }
  },

  compressor: {
    id: 'compressor',
    name: 'Компрессионный пресс',
    type: 'compressor',
    cost: 500,
    level: 'expert',
    capacity: 1,
    description: 'Гидравлический компрессор с биометрической обратной связью',
    reveals: {
      physical: ['endurance', 'flexibility']
    },
    activatesFetishes: {
      pressure: 25,
      masochism: 20
    },
    consequences: {
      excitement: 18,
      stress: 15,
      fatigue: 12,
      trustChange: -25,
      healthImpact: -15
    },
    accuracy: 0.95,
    speed: 25,
    riskLevel: 'high',
    requirements: {
      userLevel: 3,
      characterRank: 'experienced'
    }
  },

  // ===== ДОПОЛНИТЕЛЬНЫЕ ИНСТРУМЕНТЫ =====
  compressor_nv: {
    id: 'compressor_nv',
    name: 'Нейроваскулярный компрессор',
    type: 'compressor_nv',
    cost: 180,
    level: 'basic',
    capacity: 1,
    description: 'Нейроваскулярный компрессор с биометрическим анализом',
    reveals: {
      physical: ['sensitivity']
    },
    activatesFetishes: {
      extreme_pain: 25,
      masochism: 20
    },
    consequences: {
      excitement: 12,
      stress: 8,
      fatigue: 6,
      trustChange: -12,
      healthImpact: -8
    },
    accuracy: 0.75,
    speed: 12,
    riskLevel: 'medium'
  },

  dilatator: {
    id: 'dilatator',
    name: 'Пневматический дилататор',
    type: 'dilatator',
    cost: 450,
    level: 'advanced',
    capacity: 1,
    description: 'Автоматизированный пневматический дилататор с градиентным расширением',
    reveals: {
      physical: ['flexibility']
    },
    activatesFetishes: {
      anal: 35
    },
    consequences: {
      excitement: 15,
      stress: 12,
      fatigue: 10,
      trustChange: -18,
      healthImpact: -10
    },
    accuracy: 0.9,
    speed: 22,
    riskLevel: 'medium',
    requirements: {
      userLevel: 2
    }
  },

  // ===== ИНТЕРАКТИВНЫЕ СЕКСУАЛЬНЫЕ ИНСТРУМЕНТЫ =====
  synthesizer: {
    id: 'synthesizer',
    name: 'Кибернетический партнер "Синтезатор"',
    type: 'synthesizer',
    cost: 1800,
    level: 'advanced',
    capacity: 1,
    description: 'Адаптивный кибернетический партнер с ИИ-анализом реакций',
    reveals: {
      special: ['sexual_experience', 'adaptability'],
      psychological: ['emotional_stability']
    },
    activatesFetishes: {
      latex: 45,
      vibration: 40,
      electricity: 35
    },
    consequences: {
      excitement: 30,
      stress: 25,
      fatigue: 20,
      trustChange: 10,
      healthImpact: -5
    },
    accuracy: 0.95,
    speed: 45,
    riskLevel: 'low',
    requirements: {
      userLevel: 4,
      prerequisites: ['basic_scan', 'psychological_test']
    }
  },

  quantum_brothel: {
    id: 'quantum_brothel',
    name: 'Виртуальный гарем "Квантовый бордель"',
    type: 'quantum_brothel',
    cost: 2500,
    level: 'expert',
    capacity: 1,
    description: 'Иммерсивная VR-система с бесконечным количеством виртуальных партнеров',
    reveals: {
      special: ['sexual_experience'],
      psychological: ['curiosity', 'emotional_stability']
    },
    activatesFetishes: {
      group_sex: 50,
      roleplay: 45,
      public_play: 40
    },
    consequences: {
      excitement: 25,
      stress: 30,
      fatigue: 15,
      trustChange: 5,
      healthImpact: 0
    },
    accuracy: 0.9,
    speed: 60,
    riskLevel: 'medium',
    requirements: {
      userLevel: 5,
      prerequisites: ['deep_immersion', 'personal_work']
    }
  },

  pleasure_labyrinth: {
    id: 'pleasure_labyrinth',
    name: 'Сенсорный лабиринт "Лабиринт удовольствий"',
    type: 'pleasure_labyrinth',
    cost: 3200,
    level: 'master',
    capacity: 1,
    description: 'Интерактивная сенсорная среда с адаптивными испытаниями',
    reveals: {
      physical: ['endurance', 'flexibility', 'sensitivity'],
      psychological: ['emotional_stability', 'adaptability'],
      special: ['sexual_experience']
    },
    activatesFetishes: {
      sensory_deprivation: 50,
      sensory_overload: 45,
      fear: 40,
      anticipation: 35
    },
    consequences: {
      excitement: 35,
      stress: 40,
      fatigue: 30,
      trustChange: -15,
      healthImpact: -10
    },
    accuracy: 0.98,
    speed: 90,
    riskLevel: 'high',
    requirements: {
      userLevel: 6,
      characterRank: 'veteran',
      prerequisites: ['deep_immersion', 'personal_work', 'sensory_research']
    }
  },

  // ===== ПРОДВИНУТЫЕ АНАЛИТИЧЕСКИЕ ИНСТРУМЕНТЫ =====
  pleasure_matrix: {
    id: 'pleasure_matrix',
    name: 'Матрица удовольствий',
    type: 'pleasure_matrix',
    cost: 2800,
    level: 'expert',
    capacity: 3,
    description: 'Многоуровневая сенсорная матрица для комплексного анализа',
    reveals: {
      physical: ['endurance', 'flexibility', 'sensitivity'],
      psychological: ['emotional_stability', 'adaptability', 'curiosity'],
      social: ['empathy', 'dominance'],
      special: ['sexual_experience', 'resistance', 'dependence']
    },
    activatesFetishes: {
      sensory_overload: 55,
      objectification: 50,
      dehumanization: 45,
      anticipation: 40
    },
    consequences: {
      excitement: 40,
      stress: 45,
      fatigue: 35,
      trustChange: -20,
      healthImpact: -15
    },
    accuracy: 0.96,
    speed: 75,
    riskLevel: 'high',
    requirements: {
      userLevel: 5,
      prerequisites: ['deep_immersion', 'sensory_research', 'psychological_test']
    }
  },

  neural_network: {
    id: 'neural_network',
    name: 'Нейронная сеть',
    type: 'neural_network',
    cost: 3500,
    level: 'master',
    capacity: 5,
    description: 'Коллективная нейронная сеть для глубокого анализа личности',
    reveals: {
      psychological: ['emotional_stability', 'adaptability', 'curiosity', 'self_esteem', 'optimism'],
      social: ['empathy', 'sociability', 'dominance'],
      special: ['sexual_experience', 'resistance', 'dependence']
    },
    activatesFetishes: {
      dependency: 60,
      obedience: 55,
      submission: 50,
      ownership: 45
    },
    consequences: {
      excitement: 30,
      stress: 50,
      fatigue: 40,
      trustChange: -30,
      healthImpact: -20
    },
    accuracy: 0.99,
    speed: 120,
    riskLevel: 'high',
    requirements: {
      userLevel: 7,
      characterRank: 'elite',
      prerequisites: ['deep_immersion', 'personal_work', 'sensory_research', 'psychological_test']
    }
  },

  reality_simulator: {
    id: 'reality_simulator',
    name: 'Симулятор реальности',
    type: 'reality_simulator',
    cost: 4200,
    level: 'master',
    capacity: 1,
    description: 'Полноценный симулятор реальности для предельного погружения',
    reveals: {
      physical: ['endurance', 'flexibility', 'sensitivity'],
      psychological: ['emotional_stability', 'adaptability', 'curiosity', 'self_esteem', 'optimism'],
      social: ['empathy', 'sociability', 'dominance'],
      special: ['sexual_experience', 'resistance', 'dependence']
    },
    activatesFetishes: {
      transformation: 65,
      objectification: 60,
      dehumanization: 55,
      public_play: 50,
      group_sex: 45
    },
    consequences: {
      excitement: 50,
      stress: 60,
      fatigue: 50,
      trustChange: -40,
      healthImpact: -25
    },
    accuracy: 1.0,
    speed: 180,
    riskLevel: 'high',
    requirements: {
      userLevel: 8,
      characterRank: 'master',
      prerequisites: ['deep_immersion', 'personal_work', 'sensory_research', 'psychological_test']
    }
  },

  personality_probe: {
    id: 'personality_probe',
    name: 'Зонд личности',
    type: 'personality_probe',
    cost: 1600,
    level: 'advanced',
    capacity: 1,
    description: 'Психологический зонд для глубокого анализа личности',
    reveals: {
      psychological: ['emotional_stability', 'curiosity', 'self_esteem', 'optimism'],
      social: ['empathy', 'sociability', 'dominance']
    },
    activatesFetishes: {
      obedience: 40,
      defiance: 35,
      teasing: 30
    },
    consequences: {
      excitement: 20,
      stress: 25,
      fatigue: 15,
      trustChange: -15,
      healthImpact: -8
    },
    accuracy: 0.9,
    speed: 35,
    riskLevel: 'medium',
    requirements: {
      userLevel: 3,
      prerequisites: ['psychological_test']
    }
  },

  deep_scanner: {
    id: 'deep_scanner',
    name: 'Глубокий сканер',
    type: 'deep_scanner',
    cost: 2200,
    level: 'expert',
    capacity: 1,
    description: 'Квантовый сканер для анализа подсознательных процессов',
    reveals: {
      psychological: ['emotional_stability', 'adaptability', 'curiosity', 'self_esteem'],
      special: ['resistance', 'dependence']
    },
    activatesFetishes: {
      fear: 45,
      forbidden: 40,
      guilt: 35,
      shame: 30
    },
    consequences: {
      excitement: 25,
      stress: 35,
      fatigue: 20,
      trustChange: -25,
      healthImpact: -12
    },
    accuracy: 0.95,
    speed: 50,
    riskLevel: 'high',
    requirements: {
      userLevel: 4,
      prerequisites: ['deep_immersion', 'psychological_test']
    }
  },

  quantum_mirror: {
    id: 'quantum_mirror',
    name: 'Квантовое зеркало',
    type: 'quantum_mirror',
    cost: 3800,
    level: 'master',
    capacity: 1,
    description: 'Квантовое устройство для зеркального анализа поведения',
    reveals: {
      psychological: ['emotional_stability', 'adaptability', 'self_esteem', 'optimism'],
      social: ['empathy', 'sociability', 'dominance'],
      special: ['resistance', 'dependence']
    },
    activatesFetishes: {
      objectification: 55,
      dehumanization: 50,
      ownership: 45,
      authority: 40
    },
    consequences: {
      excitement: 35,
      stress: 45,
      fatigue: 30,
      trustChange: -35,
      healthImpact: -18
    },
    accuracy: 0.97,
    speed: 85,
    riskLevel: 'high',
    requirements: {
      userLevel: 6,
      prerequisites: ['deep_immersion', 'personal_work', 'sensory_research']
    }
  },

  mind_melter: {
    id: 'mind_melter',
    name: 'Растворитель разума',
    type: 'mind_melter',
    cost: 5000,
    level: 'master',
    capacity: 1,
    description: 'Экстремальное устройство для полного разрушения психологических барьеров',
    reveals: {
      psychological: ['emotional_stability', 'adaptability', 'curiosity', 'self_esteem', 'optimism'],
      social: ['empathy', 'sociability', 'dominance'],
      special: ['sexual_experience', 'resistance', 'dependence']
    },
    activatesFetishes: {
      transformation: 70,
      objectification: 65,
      dehumanization: 60,
      fear: 55,
      extreme_pain: 50
    },
    consequences: {
      excitement: 60,
      stress: 70,
      fatigue: 60,
      trustChange: -50,
      healthImpact: -30
    },
    accuracy: 1.0,
    speed: 200,
    riskLevel: 'high',
    requirements: {
      userLevel: 9,
      characterRank: 'legendary',
      prerequisites: ['deep_immersion', 'personal_work', 'sensory_research', 'psychological_test']
    }
  }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

export function getToolById(id: string): AnalysisTool | undefined {
  return Object.values(ANALYSIS_TOOLS).find(tool => tool.id === id)
}

export function getToolsByLevel(level: 'basic' | 'advanced' | 'expert' | 'master'): AnalysisTool[] {
  return Object.values(ANALYSIS_TOOLS).filter(tool => tool.level === level)
}

export function getToolsByType(type: AnalysisToolType[]): AnalysisTool[] {
  return Object.values(ANALYSIS_TOOLS).filter(tool => type.includes(tool.type))
}

export function getAvailableToolsForUser(userLevel: number, characterRank?: string): AnalysisTool[] {
  return Object.values(ANALYSIS_TOOLS).filter(tool => {
    if (tool.requirements?.userLevel && tool.requirements.userLevel > userLevel) {
      return false
    }
    if (tool.requirements?.characterRank && characterRank) {
      // Проверка ранга персонажа (нужно реализовать логику сравнения рангов)
      return true // Временно всегда доступно
    }
    return true
  })
}

export function calculateToolEffectiveness(tool: AnalysisTool, characterTraits: string[] = []): number {
  let effectiveness = tool.accuracy

  // Увеличение эффективности на основе черт характера персонажа
  characterTraits.forEach(trait => {
    switch (trait) {
      case 'curious':
        effectiveness += 0.05
        break
      case 'obedient':
        effectiveness += 0.03
        break
      case 'resistant':
        effectiveness -= 0.05
        break
    }
  })

  return Math.min(1.0, effectiveness)
}

export function calculateToolRisk(tool: AnalysisTool, userSkill: number = 1): number {
  let risk = tool.riskLevel === 'low' ? 0.1 : tool.riskLevel === 'medium' ? 0.3 : 0.6

  // Снижение риска с ростом навыка пользователя
  risk *= (1 - userSkill * 0.1)

  return Math.max(0.05, risk)
}

