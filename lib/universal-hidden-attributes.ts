// ===== УНИВЕРСАЛЬНАЯ СИСТЕМА СКРЫТЫХ АТРИБУТОВ =====
// Расширяет систему скрытых характеристик на все атрибуты персонажа

import { CharacterAttributes, CharacterFetishes, CharacterStates } from './unified-entities'

// ===== ТИПЫ ДЛЯ УНИВЕРСАЛЬНОГО СКРЫТИЯ =====

export type UniversalKnowledgeLevel = 'unknown' | 'approximate' | 'detailed' | 'precise'

export interface UniversalAttributeKnowledge {
  level: UniversalKnowledgeLevel
  value?: number
  accuracy?: number // погрешность в пунктах
  lastAnalyzed?: Date
  analysisMethod?: string
  category?: string // для группировки
}

// Универсальные знания о всех атрибутах персонажа
export interface UniversalCharacterKnowledge {
  // Характеристики (attributes)
  attributes: {
    [category: string]: {
      [attributeId: string]: UniversalAttributeKnowledge
    }
  }

  // Фетиши (fetishes)
  fetishes: {
    [category: string]: {
      [fetishId: string]: UniversalAttributeKnowledge
    }
  }

  // Состояния (states) - опционально скрываемые
  states?: {
    [stateId: string]: UniversalAttributeKnowledge
  }

  // Дополнительные атрибуты
  additional?: {
    [attributeId: string]: UniversalAttributeKnowledge
  }
}

// ===== КОНСТАНТЫ ДЛЯ КАТЕГОРИЗАЦИИ =====

export const ATTRIBUTE_CATEGORIES = {
  physical: ['endurance', 'sensitivity', 'flexibility', 'strength', 'physical_power'],
  psychological: ['emotional_stability', 'adaptability', 'intelligence', 'creativity', 'temperament'],
  social: ['sociability', 'empathy', 'dominance', 'ego', 'social_skills'],
  personality: ['self_esteem', 'optimism', 'curiosity'],
  special: ['sexual_experience', 'resistance', 'dependency']
}

export const FETISH_CATEGORIES = {
  bdsm: ['bdsm', 'humiliation', 'masochism', 'sadism', 'domination', 'submission'],
  psychological: ['voyeurism', 'exhibitionism', 'roleplay', 'fear', 'shame', 'guilt', 'forbidden', 'dependency', 'ownership'],
  sensory: ['sensory_deprivation', 'sensory_overload', 'tickling', 'vibration', 'electricity', 'temperature', 'pressure', 'water_sports'],
  body_parts: ['feet', 'hands', 'breasts', 'anal', 'neck', 'ears', 'fingers', 'toes'],
  material: ['latex', 'leather', 'silk', 'rope', 'bondage'],
  social: ['uniform', 'age_play', 'status', 'hierarchy'],
  physiological: ['pregnancy', 'lactation', 'menstruation'],
  extreme: ['edge_play', 'breath_play', 'extreme_pain', 'transformation'],
  additional: ['scent', 'taste', 'texture', 'hair', 'eyes', 'lips', 'nails', 'obedience', 'defiance', 'teasing', 'anticipation', 'authority', 'equality', 'rivalry', 'group_sex', 'public_play', 'objectification', 'dehumanization']
}

export const STATE_CATEGORIES = {
  emotional: ['mood', 'fear', 'despair', 'trust', 'relationship'],
  motivational: ['devotion', 'pleasure', 'pain', 'arousal'],
  physical: ['stress', 'fatigue', 'health', 'energy'],
  cognitive: ['awareness', 'concentration', 'memory']
}

// ===== ФУНКЦИИ ИНИЦИАЛИЗАЦИИ =====

/**
 * Создает неизвестное знание для атрибута
 */
export function createUnknownKnowledge(): UniversalAttributeKnowledge {
  return {
    level: 'unknown'
  }
}

/**
 * Инициализирует универсальную систему скрытых атрибутов
 */
export function initializeUniversalHiddenAttributes(
  attributes: CharacterAttributes,
  fetishes: CharacterFetishes,
  states?: CharacterStates
): UniversalCharacterKnowledge {
  const result: UniversalCharacterKnowledge = {
    attributes: {},
    fetishes: {},
    states: states ? {} : undefined
  }

  // Инициализируем характеристики
  Object.entries(ATTRIBUTE_CATEGORIES).forEach(([category, attributeIds]) => {
    result.attributes[category] = {}
    attributeIds.forEach(attributeId => {
      result.attributes[category][attributeId] = createUnknownKnowledge()
    })
  })

  // Инициализируем фетиши
  Object.entries(FETISH_CATEGORIES).forEach(([category, fetishIds]) => {
    result.fetishes[category] = {}
    fetishIds.forEach(fetishId => {
      result.fetishes[category][fetishId] = createUnknownKnowledge()
    })
  })

  // Инициализируем состояния (если нужно)
  if (states && result.states) {
    Object.entries(STATE_CATEGORIES).forEach(([category, stateIds]) => {
      stateIds.forEach(stateId => {
        result.states![stateId] = createUnknownKnowledge()
      })
    })
  }

  return result
}

// ===== ФУНКЦИИ АНАЛИЗА =====

/**
 * Получает отображаемое значение атрибута с учетом уровня знания
 */
export function getUniversalAttributeDisplayValue(
  knowledge: UniversalAttributeKnowledge,
  actualValue: number,
  maxValue: number = 10
): string {
  switch (knowledge.level) {
    case 'unknown':
      return '❓'
    case 'approximate':
      if (knowledge.accuracy) {
        const min = Math.max(0, actualValue - knowledge.accuracy)
        const max = Math.min(maxValue, actualValue + knowledge.accuracy)
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
 * Проводит анализ универсального атрибута
 */
export function analyzeUniversalAttribute(
  actualValue: number,
  method: string,
  category: string,
  timeSpent: number = 0,
  maxValue: number = 10
): UniversalAttributeKnowledge {
  // Базовая точность зависит от метода и категории
  let baseAccuracy = 0.4

  // Модификаторы точности по категориям
  const categoryModifiers = {
    physical: 0.1,      // Физические атрибуты легче определить
    psychological: -0.1, // Психологические сложнее
    social: 0.0,        // Социальные средние
    personality: -0.1,   // Личностные сложные
    special: -0.2,      // Специальные самые сложные
    bdsm: -0.3,         // БДСМ фетиши очень скрытны
    psychological_fetish: -0.2, // Психологические фетиши скрытны
    sensory: 0.0,       // Сенсорные средние
    body_parts: 0.1,    // Телесные фетиши видны
    material: 0.0,      // Материальные средние
    social_fetish: 0.0, // Социальные фетиши средние
    physiological: 0.1, // Физиологические видны
    extreme: -0.3,      // Экстремальные очень скрытны
    additional: -0.1    // Дополнительные сложные
  }

  baseAccuracy += categoryModifiers[category] || 0

  // Модификатор от времени (для личной работы)
  if (method === 'personal_work' && timeSpent > 0) {
    baseAccuracy += Math.min(0.4, (timeSpent / 60) * 0.1)
  }

  const accuracy = Math.min(1.0, Math.max(0.1, baseAccuracy))
  const errorRange = Math.round((1 - accuracy) * (maxValue / 2))

  let level: UniversalKnowledgeLevel
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
  const clampedValue = Math.max(0, Math.min(maxValue, revealedValue))

  return {
    level,
    value: Math.round(clampedValue * 10) / 10,
    accuracy: finalAccuracy,
    lastAnalyzed: new Date(),
    analysisMethod: method,
    category
  }
}

// ===== УТИЛИТЫ =====

/**
 * Получает цвет для отображения уровня знания
 */
export function getUniversalKnowledgeLevelColor(level: UniversalKnowledgeLevel): string {
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
export function getUniversalKnowledgeLevelIcon(level: UniversalKnowledgeLevel): string {
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
export function calculateUniversalAnalysisProgress(knowledge: UniversalCharacterKnowledge): number {
  let totalAttributes = 0
  let analyzedAttributes = 0

  // Подсчитываем атрибуты
  Object.values(knowledge.attributes).forEach(category => {
    Object.values(category).forEach(attr => {
      totalAttributes++
      if (attr.level !== 'unknown') {
        analyzedAttributes++
      }
    })
  })

  // Подсчитываем фетиши
  Object.values(knowledge.fetishes).forEach(category => {
    Object.values(category).forEach(fetish => {
      totalAttributes++
      if (fetish.level !== 'unknown') {
        analyzedAttributes++
      }
    })
  })

  // Подсчитываем состояния (если есть)
  if (knowledge.states) {
    Object.values(knowledge.states).forEach(state => {
      totalAttributes++
      if (state.level !== 'unknown') {
        analyzedAttributes++
      }
    })
  }

  return totalAttributes > 0 ? analyzedAttributes / totalAttributes : 0
}

/**
 * Получает статистику по категориям
 */
export function getUniversalKnowledgeStats(knowledge: UniversalCharacterKnowledge) {
  const stats = {
    attributes: { total: 0, analyzed: 0, categories: {} as Record<string, { total: number, analyzed: number }> },
    fetishes: { total: 0, analyzed: 0, categories: {} as Record<string, { total: number, analyzed: number }> },
    states: { total: 0, analyzed: 0, categories: {} as Record<string, { total: number, analyzed: number }> }
  }

  // Статистика атрибутов
  Object.entries(knowledge.attributes).forEach(([category, attrs]) => {
    const categoryStats = { total: 0, analyzed: 0 }
    Object.values(attrs).forEach(attr => {
      categoryStats.total++
      stats.attributes.total++
      if (attr.level !== 'unknown') {
        categoryStats.analyzed++
        stats.attributes.analyzed++
      }
    })
    stats.attributes.categories[category] = categoryStats
  })

  // Статистика фетишей
  Object.entries(knowledge.fetishes).forEach(([category, fetishes]) => {
    const categoryStats = { total: 0, analyzed: 0 }
    Object.values(fetishes).forEach(fetish => {
      categoryStats.total++
      stats.fetishes.total++
      if (fetish.level !== 'unknown') {
        categoryStats.analyzed++
        stats.fetishes.analyzed++
      }
    })
    stats.fetishes.categories[category] = categoryStats
  })

  // Статистика состояний
  if (knowledge.states) {
    Object.entries(knowledge.states).forEach(([stateId, state]) => {
      stats.states.total++
      if (state.level !== 'unknown') {
        stats.states.analyzed++
      }
    })
  }

  return stats
}
