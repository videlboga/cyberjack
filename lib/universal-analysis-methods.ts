// ===== УНИВЕРСАЛЬНЫЕ МЕТОДЫ АНАЛИЗА =====
// Расширяет методы анализа для работы со всеми атрибутами, включая фетиши

import { UniversalAttributeKnowledge, UniversalCharacterKnowledge } from './universal-hidden-attributes'

// ===== ТИПЫ МЕТОДОВ АНАЛИЗА =====

export type UniversalAnalysisMethod =
  | 'basic_scan'
  | 'psychological_test'
  | 'sensory_research'
  | 'deep_immersion'
  | 'personal_work'
  | 'fetish_exploration'
  | 'behavioral_analysis'
  | 'intimate_research'
  | 'psychological_profiling'

export interface UniversalAnalysisMethodInfo {
  id: UniversalAnalysisMethod
  name: string
  description: string
  cost: number
  time: number // в минутах
  risk: 'low' | 'medium' | 'high'
  baseAccuracy: number
  reveals: {
    attributes: string[] // категории атрибутов
    fetishes: string[]   // категории фетишей
    states?: string[]    // категории состояний
  }
  effects: {
    stressIncrease: number
    trustDecrease: number
    healthImpact: number
    arousalIncrease?: number // для фетиш-анализа
  }
  requirements?: {
    previousAnalysis?: string[] // требуемые предыдущие анализы
    characterLevel?: number     // минимальный уровень персонажа
    equipment?: string[]        // требуемое оборудование
  }
}

// ===== КОНСТАНТЫ МЕТОДОВ =====

export const UNIVERSAL_ANALYSIS_METHODS: Record<UniversalAnalysisMethod, UniversalAnalysisMethodInfo> = {
  basic_scan: {
    id: 'basic_scan',
    name: 'Базовое сканирование',
    description: 'Поверхностный анализ физических характеристик',
    cost: 50,
    time: 5,
    risk: 'low',
    baseAccuracy: 0.7,
    reveals: {
      attributes: ['physical'],
      fetishes: []
    },
    effects: {
      stressIncrease: 2,
      trustDecrease: 1,
      healthImpact: 0
    }
  },

  psychological_test: {
    id: 'psychological_test',
    name: 'Психологическое тестирование',
    description: 'Глубокий анализ психологических характеристик и личностных качеств',
    cost: 100,
    time: 15,
    risk: 'low',
    baseAccuracy: 0.6,
    reveals: {
      attributes: ['psychological', 'personality'],
      fetishes: ['psychological']
    },
    effects: {
      stressIncrease: 5,
      trustDecrease: 3,
      healthImpact: 0
    }
  },

  sensory_research: {
    id: 'sensory_research',
    name: 'Сенсорное исследование',
    description: 'Исследование физических реакций и сенсорных предпочтений',
    cost: 300,
    time: 30,
    risk: 'medium',
    baseAccuracy: 0.8,
    reveals: {
      attributes: ['physical', 'special'],
      fetishes: ['sensory', 'body_parts', 'physiological']
    },
    effects: {
      stressIncrease: 10,
      trustDecrease: 8,
      healthImpact: 2,
      arousalIncrease: 5
    }
  },

  fetish_exploration: {
    id: 'fetish_exploration',
    name: 'Исследование фетишей',
    description: 'Специализированный анализ сексуальных предпочтений и фетишей',
    cost: 500,
    time: 45,
    risk: 'medium',
    baseAccuracy: 0.75,
    reveals: {
      attributes: ['special'],
      fetishes: ['bdsm', 'psychological', 'material', 'social']
    },
    effects: {
      stressIncrease: 15,
      trustDecrease: 10,
      healthImpact: 1,
      arousalIncrease: 10
    },
    requirements: {
      previousAnalysis: ['sensory_research']
    }
  },

  behavioral_analysis: {
    id: 'behavioral_analysis',
    name: 'Поведенческий анализ',
    description: 'Наблюдение за поведением в различных ситуациях',
    cost: 200,
    time: 60,
    risk: 'low',
    baseAccuracy: 0.65,
    reveals: {
      attributes: ['social', 'personality'],
      fetishes: ['social', 'additional']
    },
    effects: {
      stressIncrease: 3,
      trustDecrease: 2,
      healthImpact: 0
    }
  },

  intimate_research: {
    id: 'intimate_research',
    name: 'Интимное исследование',
    description: 'Глубокий анализ интимных предпочтений и сексуальных характеристик',
    cost: 800,
    time: 90,
    risk: 'high',
    baseAccuracy: 0.85,
    reveals: {
      attributes: ['special'],
      fetishes: ['bdsm', 'extreme', 'physiological', 'additional']
    },
    effects: {
      stressIncrease: 20,
      trustDecrease: 15,
      healthImpact: 3,
      arousalIncrease: 15
    },
    requirements: {
      previousAnalysis: ['fetish_exploration', 'sensory_research']
    }
  },

  psychological_profiling: {
    id: 'psychological_profiling',
    name: 'Психологическое профилирование',
    description: 'Создание полного психологического профиля персонажа',
    cost: 400,
    time: 120,
    risk: 'medium',
    baseAccuracy: 0.7,
    reveals: {
      attributes: ['psychological', 'personality', 'social'],
      fetishes: ['psychological', 'social']
    },
    effects: {
      stressIncrease: 12,
      trustDecrease: 8,
      healthImpact: 1
    },
    requirements: {
      previousAnalysis: ['psychological_test', 'behavioral_analysis']
    }
  },

  deep_immersion: {
    id: 'deep_immersion',
    name: 'Глубокая иммерсия',
    description: 'Полное погружение и исследование всех аспектов личности',
    cost: 1500,
    time: 480, // 8 часов
    risk: 'high',
    baseAccuracy: 0.95,
    reveals: {
      attributes: ['physical', 'psychological', 'social', 'personality', 'special'],
      fetishes: ['bdsm', 'psychological', 'sensory', 'body_parts', 'material', 'social', 'physiological', 'extreme', 'additional'],
      states: ['emotional', 'motivational', 'physical', 'cognitive']
    },
    effects: {
      stressIncrease: 25,
      trustDecrease: 20,
      healthImpact: 5,
      arousalIncrease: 20
    },
    requirements: {
      previousAnalysis: ['intimate_research', 'psychological_profiling']
    }
  },

  personal_work: {
    id: 'personal_work',
    name: 'Личная работа',
    description: 'Естественное изучение через взаимодействие и общение',
    cost: 0,
    time: 0, // переменное время
    risk: 'medium',
    baseAccuracy: 0.4, // базовая, растет со временем
    reveals: {
      attributes: ['physical', 'psychological', 'social', 'personality', 'special'],
      fetishes: ['bdsm', 'psychological', 'sensory', 'body_parts', 'material', 'social', 'physiological', 'extreme', 'additional'],
      states: ['emotional', 'motivational', 'physical', 'cognitive']
    },
    effects: {
      stressIncrease: 0,
      trustDecrease: 0,
      healthImpact: 0
    }
  }
}

// ===== ФУНКЦИИ АНАЛИЗА =====

/**
 * Определяет доступные методы анализа на основе текущих знаний
 */
export function getAvailableUniversalAnalysisMethods(
  knowledge: UniversalCharacterKnowledge
): UniversalAnalysisMethod[] {
  const methods: UniversalAnalysisMethod[] = ['basic_scan', 'personal_work']

  // Проверяем наличие данных для разблокировки методов
  const hasPhysicalData = Object.values(knowledge.attributes.physical || {})
    .some(k => k.level !== 'unknown')
  const hasPsychologicalData = Object.values(knowledge.attributes.psychological || {})
    .some(k => k.level !== 'unknown')
  const hasSensoryData = Object.values(knowledge.fetishes.sensory || {})
    .some(k => k.level !== 'unknown')
  const hasFetishData = Object.values(knowledge.fetishes).flatMap(cat => Object.values(cat))
    .some(k => k.level !== 'unknown')
  const hasDeepAnalysis = Object.values(knowledge.attributes).flatMap(cat => Object.values(cat))
    .concat(Object.values(knowledge.fetishes).flatMap(cat => Object.values(cat)))
    .some(k => k.level === 'detailed' || k.level === 'precise')

  // Разблокируем методы по мере получения данных
  if (hasPhysicalData) {
    methods.push('sensory_research')
  }

  if (hasPsychologicalData) {
    methods.push('psychological_test', 'behavioral_analysis')
  }

  if (hasSensoryData) {
    methods.push('fetish_exploration')
  }

  if (hasFetishData) {
    methods.push('intimate_research')
  }

  if (hasDeepAnalysis) {
    methods.push('psychological_profiling', 'deep_immersion')
  }

  return methods
}

/**
 * Проверяет требования для метода анализа
 */
export function checkAnalysisMethodRequirements(
  method: UniversalAnalysisMethod,
  knowledge: UniversalCharacterKnowledge,
  characterLevel: number = 1
): { canUse: boolean, missingRequirements: string[] } {
  const methodInfo = UNIVERSAL_ANALYSIS_METHODS[method]
  const missingRequirements: string[] = []

  if (!methodInfo.requirements) {
    return { canUse: true, missingRequirements: [] }
  }

  const { previousAnalysis, characterLevel: requiredLevel, equipment } = methodInfo.requirements

  // Проверяем предыдущие анализы
  if (previousAnalysis) {
    const hasRequiredAnalysis = previousAnalysis.some(requiredMethod => {
      // Проверяем, есть ли результаты от требуемого метода
      return Object.values(knowledge.attributes).flatMap(cat => Object.values(cat))
        .concat(Object.values(knowledge.fetishes).flatMap(cat => Object.values(cat)))
        .some(attr => attr.analysisMethod === requiredMethod)
    })

    if (!hasRequiredAnalysis) {
      missingRequirements.push(`Требуется предыдущий анализ: ${previousAnalysis.join(', ')}`)
    }
  }

  // Проверяем уровень персонажа
  if (requiredLevel && characterLevel < requiredLevel) {
    missingRequirements.push(`Требуется уровень персонажа: ${requiredLevel}`)
  }

  // Проверяем оборудование (заглушка)
  if (equipment) {
    // Здесь можно добавить проверку наличия оборудования
  }

  return {
    canUse: missingRequirements.length === 0,
    missingRequirements
  }
}

/**
 * Вычисляет стоимость анализа с учетом модификаторов
 */
export function calculateUniversalAnalysisCost(
  method: UniversalAnalysisMethod,
  characterRank: string,
  urgency: 'normal' | 'urgent' | 'immediate' = 'normal'
): number {
  const baseCost = UNIVERSAL_ANALYSIS_METHODS[method].cost

  let multiplier = 1

  // Модификатор по рангу персонажа
  switch (characterRank) {
    case 'S+':
    case 'S':
    case 'S-':
      multiplier *= 2
      break
    case 'A+':
    case 'A':
    case 'A-':
      multiplier *= 1.5
      break
    case 'B+':
    case 'B':
    case 'B-':
      multiplier *= 1.2
      break
  }

  // Модификатор по срочности
  switch (urgency) {
    case 'urgent':
      multiplier *= 1.5
      break
    case 'immediate':
      multiplier *= 2
      break
  }

  return Math.round(baseCost * multiplier)
}

/**
 * Генерирует отчет об универсальном анализе
 */
export function generateUniversalAnalysisReport(
  method: UniversalAnalysisMethod,
  results: {
    attributes: Record<string, UniversalAttributeKnowledge>
    fetishes: Record<string, UniversalAttributeKnowledge>
    states?: Record<string, UniversalAttributeKnowledge>
  },
  characterName: string,
  duration: number
): string {
  const methodInfo = UNIVERSAL_ANALYSIS_METHODS[method]

  const revealedAttributes = Object.keys(results.attributes).length
  const revealedFetishes = Object.keys(results.fetishes).length
  const revealedStates = results.states ? Object.keys(results.states).length : 0

  return `
📊 ОТЧЕТ ОБ УНИВЕРСАЛЬНОМ АНАЛИЗЕ
═══════════════════════════════════════════════

👤 Персонаж: ${characterName}
🔬 Метод: ${methodInfo.name}
⏱️ Длительность: ${duration} мин
💰 Стоимость: ${methodInfo.cost} кредитов
🎯 Точность: ${(methodInfo.baseAccuracy * 100).toFixed(0)}%

📈 РЕЗУЛЬТАТЫ:
✅ Характеристики: ${revealedAttributes} раскрыто
✅ Фетиши: ${revealedFetishes} раскрыто
${revealedStates > 0 ? `✅ Состояния: ${revealedStates} раскрыто` : ''}

⚠️ ПОСЛЕДСТВИЯ:
• Увеличение стресса: +${methodInfo.effects.stressIncrease}
• Снижение доверия: -${methodInfo.effects.trustDecrease}
${methodInfo.effects.healthImpact > 0 ? `• Влияние на здоровье: -${methodInfo.effects.healthImpact}` : ''}
${methodInfo.effects.arousalIncrease ? `• Увеличение возбуждения: +${methodInfo.effects.arousalIncrease}` : ''}

═══════════════════════════════════════════════
  `.trim()
}
