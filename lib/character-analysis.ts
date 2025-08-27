// ===== СИСТЕМА АНАЛИЗА ХАРАКТЕРИСТИК =====
// Управление скрытыми характеристиками, анализом и прогрессивным раскрытием

import {
  CharacterAttributes,
  CharacterAttributeKnowledge,
  CharacteristicKnowledge,
  KnowledgeLevel,
  AnalysisMethod,
  AnalysisMethodInfo,
  AnalysisSession
} from './unified-entities'

// ===== КОНСТАНТЫ АНАЛИЗА =====

export const ANALYSIS_METHODS: Record<AnalysisMethod, AnalysisMethodInfo> = {
  basic_scan: {
    id: 'basic_scan',
    name: 'Базовое сканирование',
    cost: 50,
    time: 5,
    risk: 'low',
    accuracy: 0.7,
    reveals: ['physical'],
    effects: {
      stressIncrease: 2,
      trustDecrease: 1,
      healthImpact: 0
    }
  },
  psychological_test: {
    id: 'psychological_test',
    name: 'Психологическое тестирование',
    cost: 100,
    time: 15,
    risk: 'low',
    accuracy: 0.6,
    reveals: ['psychological', 'social'],
    effects: {
      stressIncrease: 5,
      trustDecrease: 3,
      healthImpact: 0
    }
  },
  sensory_research: {
    id: 'sensory_research',
    name: 'Сенсорное исследование',
    cost: 300,
    time: 30,
    risk: 'medium',
    accuracy: 0.8,
    reveals: ['physical', 'special'],
    effects: {
      stressIncrease: 10,
      trustDecrease: 8,
      healthImpact: 2
    }
  },
  deep_immersion: {
    id: 'deep_immersion',
    name: 'Глубокая иммерсия',
    cost: 1000,
    time: 480, // 8 часов
    risk: 'high',
    accuracy: 0.95,
    reveals: ['all'],
    effects: {
      stressIncrease: 20,
      trustDecrease: 15,
      healthImpact: 5
    }
  },
  personal_work: {
    id: 'personal_work',
    name: 'Личная работа',
    cost: 0,
    time: 0, // переменное время
    risk: 'medium',
    accuracy: 0.4, // базовая, растет со временем
    reveals: ['all'],
    effects: {
      stressIncrease: 0,
      trustDecrease: 0,
      healthImpact: 0
    }
  }
}

// ===== ФУНКЦИИ РАБОТЫ С ХАРАКТЕРИСТИКАМИ =====

/**
 * Инициализирует систему скрытых характеристик для персонажа
 * По умолчанию все характеристики скрыты (unknown)
 */
export function initializeHiddenCharacteristics(attributes: CharacterAttributes): CharacterAttributeKnowledge {
  const createUnknownKnowledge = (): CharacteristicKnowledge => ({
    level: 'unknown'
  })

  return {
    physical: {
      Выносливость: createUnknownKnowledge(),
      Чувствительность: createUnknownKnowledge(),
      Гибкость: createUnknownKnowledge()
    },
    psychological: {
      "Эмоциональная стабильность": createUnknownKnowledge(),
      Адаптивность: createUnknownKnowledge(),
      Интеллект: createUnknownKnowledge()
    },
    social: {
      Общительность: createUnknownKnowledge(),
      Эмпатия: createUnknownKnowledge(),
      Доминантность: createUnknownKnowledge()
    },
    personality: {
      Самооценка: createUnknownKnowledge(),
      Оптимизм: createUnknownKnowledge(),
      Любопытство: createUnknownKnowledge()
    },
    special: {
      "Сексуальная опытность": createUnknownKnowledge(),
      Сопротивляемость: createUnknownKnowledge(),
      Зависимость: createUnknownKnowledge()
    }
  }
}

/**
 * Получает отображаемое значение характеристики с учетом уровня знания
 */
export function getCharacteristicDisplayValue(
  knowledge: CharacteristicKnowledge,
  actualValue: number
): string {
  switch (knowledge.level) {
    case 'unknown':
      return '❓'
    case 'approximate':
      if (knowledge.accuracy) {
        const min = Math.max(0, actualValue - knowledge.accuracy)
        const max = Math.min(10, actualValue + knowledge.accuracy)
        return `~${Math.round((min + max) / 2)} (±${knowledge.accuracy})`
      }
      return '~?'
    case 'detailed':
      return `${actualValue} (±${knowledge.accuracy || 1})`
    case 'precise':
      return actualValue.toString()
    default:
      return '❓'
  }
}

/**
 * Вычисляет точность анализа на основе метода и модификаторов
 */
export function calculateAnalysisAccuracy(
  method: AnalysisMethod,
  characterTraits: string[] = [],
  timeSpent: number = 0
): number {
  const baseAccuracy = ANALYSIS_METHODS[method].accuracy

  let modifier = 0

  // Модификаторы от черт характера
  if (characterTraits.includes('loyal')) modifier += 0.1
  if (characterTraits.includes('quick_learner')) modifier += 0.1
  if (characterTraits.includes('stubborn')) modifier -= 0.1

  // Модификатор от времени (для личной работы)
  if (method === 'personal_work' && timeSpent > 0) {
    modifier += Math.min(0.4, (timeSpent / 60) * 0.1) // макс +0.4 за час
  }

  return Math.min(1.0, baseAccuracy + modifier)
}

/**
 * Проводит анализ характеристики
 */
export function analyzeCharacteristic(
  actualValue: number,
  method: AnalysisMethod,
  characterTraits: string[] = [],
  timeSpent: number = 0
): CharacteristicKnowledge {
  const accuracy = calculateAnalysisAccuracy(method, characterTraits, timeSpent)
  const errorRange = Math.round((1 - accuracy) * 5) // погрешность в пунктах

  let level: KnowledgeLevel
  let finalAccuracy: number

  if (method === 'deep_immersion' || (method === 'personal_work' && timeSpent > 120)) {
    level = 'precise'
    finalAccuracy = 0.1
  } else if (method === 'sensory_research' || accuracy > 0.8) {
    level = 'detailed'
    finalAccuracy = Math.max(0.5, errorRange * 0.2)
  } else {
    level = 'approximate'
    finalAccuracy = errorRange
  }

  const revealedValue = actualValue + (Math.random() - 0.5) * errorRange * 2
  const clampedValue = Math.max(0, Math.min(10, revealedValue))

  return {
    level,
    value: Math.round(clampedValue * 10) / 10, // округление до 0.1
    accuracy: finalAccuracy,
    lastAnalyzed: new Date(),
    analysisMethod: method
  }
}

/**
 * Создает сессию анализа
 */
export function createAnalysisSession(
  characterId: string,
  method: AnalysisMethod
): AnalysisSession {
  const methodInfo = ANALYSIS_METHODS[method]

  return {
    id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    characterId,
    method,
    startTime: new Date(),
    cost: methodInfo.cost,
    results: {
      characteristics: {},
      knowledge: {}
    },
    consequences: methodInfo.effects
  }
}

/**
 * Завершает сессию анализа
 */
export function completeAnalysisSession(
  session: AnalysisSession,
  results: {
    characteristics: Partial<CharacterAttributes>
    knowledge: Partial<CharacterAttributeKnowledge>
  }
): AnalysisSession {
  return {
    ...session,
    endTime: new Date(),
    results
  }
}

/**
 * Вычисляет стоимость анализа с учетом модификаторов
 */
export function calculateAnalysisCost(
  method: AnalysisMethod,
  characterRank: string,
  urgency: 'normal' | 'urgent' | 'immediate' = 'normal'
): number {
  const baseCost = ANALYSIS_METHODS[method].cost

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
 * Определяет доступные методы анализа для персонажа
 */
export function getAvailableAnalysisMethods(
  characterKnowledge: CharacterAttributeKnowledge
): AnalysisMethod[] {
  const methods: AnalysisMethod[] = ['basic_scan']

  // Разблокируем методы по мере прогресса анализа
  const hasPsychologicalData = Object.values(characterKnowledge.psychological)
    .some(k => k.level !== 'unknown')
  const hasSensoryData = Object.values(characterKnowledge.physical)
    .some(k => k.level !== 'unknown')
  const hasDeepAnalysis = Object.values(characterKnowledge)
    .flatMap(group => Object.values(group))
    .some(k => k.level === 'detailed' || k.level === 'precise')

  if (hasPsychologicalData) {
    methods.push('psychological_test')
  }

  if (hasSensoryData) {
    methods.push('sensory_research')
  }

  if (hasDeepAnalysis) {
    methods.push('deep_immersion')
  }

  methods.push('personal_work') // всегда доступна

  return methods
}

/**
 * Генерирует отчет об анализе
 */
export function generateAnalysisReport(
  session: AnalysisSession,
  characterName: string
): string {
  const methodInfo = ANALYSIS_METHODS[session.method]
  const duration = session.endTime
    ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60))
    : 0

  return `
📊 ОТЧЕТ ОБ АНАЛИЗЕ
═══════════════════════════════════════════════

👤 Персонаж: ${characterName}
🔬 Метод: ${methodInfo.name}
⏱️ Длительность: ${duration} мин
💰 Стоимость: ${session.cost} кредитов
🎯 Точность: ${(methodInfo.accuracy * 100).toFixed(0)}%

📈 РЕЗУЛЬТАТЫ:
${Object.keys(session.results.characteristics).length > 0
    ? '✅ Характеристики успешно проанализированы'
    : '❌ Анализ не дал результатов'}

⚠️ ПОСЛЕДСТВИЯ:
• Увеличение стресса: +${session.consequences.stressIncrease}
• Снижение доверия: -${session.consequences.trustDecrease}
${session.consequences.healthImpact > 0
    ? `• Влияние на здоровье: -${session.consequences.healthImpact}`
    : ''}

═══════════════════════════════════════════════
  `.trim()
}

// ===== УТИЛИТЫ ДЛЯ РАБОТЫ С ХАРАКТЕРИСТИКАМИ =====

/**
 * Получает цвет для отображения уровня знания
 */
export function getKnowledgeLevelColor(level: KnowledgeLevel): string {
  switch (level) {
    case 'unknown': return 'text-gray-500'
    case 'approximate': return 'text-yellow-500'
    case 'detailed': return 'text-blue-500'
    case 'precise': return 'text-green-500'
    default: return 'text-gray-500'
  }
}

/**
 * Получает иконку для уровня знания
 */
export function getKnowledgeLevelIcon(level: KnowledgeLevel): string {
  switch (level) {
    case 'unknown': return '❓'
    case 'approximate': return '~'
    case 'detailed': return '✓'
    case 'precise': return '🎯'
    default: return '❓'
  }
}

/**
 * Вычисляет общий прогресс анализа персонажа
 */
export function calculateAnalysisProgress(knowledge: CharacterAttributeKnowledge): number {
  const allCharacteristics = Object.values(knowledge).flatMap(group => Object.values(group))
  const analyzedCharacteristics = allCharacteristics.filter(k => k.level !== 'unknown')

  return analyzedCharacteristics.length / allCharacteristics.length
}

