// ===== СИСТЕМА АВТОМАТИЧЕСКОГО РАСКРЫТИЯ ХАРАКТЕРИСТИК =====
// Раскрытие через личное взаимодействие и изменения параметров >20%

import { UniversalCharacterKnowledge, UniversalAttributeKnowledge, createUnknownKnowledge } from './universal-hidden-attributes'

// ===== ТИПЫ ДЛЯ СИСТЕМЫ РАСКРЫТИЯ =====

export interface AttributeChange {
  category: string
  attributeId: string
  oldValue: number
  newValue: number
  changePercent: number
  timestamp: Date
  context?: string // контекст изменения (например, "stress_reduction", "pleasure_increase")
}

export interface RevealAttempt {
  category: string
  attributeId: string
  changePercent: number
  baseProbability: number
  finalProbability: number
  successful: boolean
  timestamp: Date
  context?: string
}

export interface AttributeRevealHistory {
  changes: AttributeChange[]
  revealAttempts: RevealAttempt[]
  lastUpdate: Date
}

// ===== КОНСТАНТЫ ВЕРОЯТНОСТЕЙ =====

/**
 * Базовые вероятности раскрытия в зависимости от процента изменения
 */
export const REVEAL_PROBABILITIES: Record<number, number> = {
  20: 0.15,  // 15% при изменении 20%
  25: 0.25,  // 25% при изменении 25%
  30: 0.35,  // 35% при изменении 30%
  40: 0.50,  // 50% при изменении 40%
  50: 0.70,  // 70% при изменении 50%
  60: 0.85,  // 85% при изменении 60%
  70: 0.95,  // 95% при изменении 70%
  80: 1.00   // 100% при изменении 80%+
}

/**
 * Модификаторы вероятности по категориям атрибутов
 */
export const CATEGORY_MODIFIERS = {
  physical: 1.2,      // Физические легче раскрываются через телесный контакт
  psychological: 0.8, // Психологические сложнее
  social: 0.9,        // Социальные средне
  personality: 0.7,   // Личностные очень скрытны
  special: 0.6,       // Специальные самые скрытные
  bdsm: 0.5,          // БДСМ фетиши очень скрытны
  psychological_fetish: 0.6, // Психологические фетиши скрытны
  sensory: 1.0,       // Сенсорные средне
  body_parts: 1.1,    // Телесные легче через контакт
  material: 0.9,      // Материальные средне
  social_fetish: 0.8, // Социальные фетиши скрытны
  emotional: 1.0,     // Эмоциональные состояния средне
  motivational: 0.9,  // Мотивационные средне
  physical_state: 1.2 // Физические состояния легче
}

/**
 * Модификаторы вероятности по контексту изменения
 */
export const CONTEXT_MODIFIERS = {
  // Положительные изменения (увеличивают вероятность)
  pleasure_increase: 1.3,
  arousal_increase: 1.2,
  trust_increase: 1.4,
  mood_improvement: 1.1,

  // Отрицательные изменения (уменьшают вероятность)
  stress_increase: 0.7,
  pain_increase: 0.6,
  fear_increase: 0.5,
  trust_decrease: 0.4,

  // Нейтральные изменения
  routine_change: 1.0,
  health_change: 0.9,
  energy_change: 1.1
}

// ===== ОСНОВНЫЕ ФУНКЦИИ =====

/**
 * Вычисляет вероятность раскрытия атрибута на основе изменения
 */
export function calculateRevealProbability(
  changePercent: number,
  category: string,
  context?: string
): number {
  // Находим ближайшую базовую вероятность
  const thresholds = Object.keys(REVEAL_PROBABILITIES)
    .map(Number)
    .sort((a, b) => a - b)

  let baseProbability = 0
  for (const threshold of thresholds) {
    if (changePercent >= threshold) {
      baseProbability = REVEAL_PROBABILITIES[threshold]
    }
  }

  // Если изменение меньше 20%, вероятность 0
  if (changePercent < 20) {
    return 0
  }

  // Применяем модификатор категории
  const categoryModifier = CATEGORY_MODIFIERS[category] || 1.0
  let finalProbability = baseProbability * categoryModifier

  // Применяем модификатор контекста
  if (context) {
    const contextModifier = CONTEXT_MODIFIERS[context] || 1.0
    finalProbability *= contextModifier
  }

  // Ограничиваем вероятность диапазоном 0-1
  return Math.max(0, Math.min(1, finalProbability))
}

/**
 * Создает запись об изменении атрибута
 */
export function createAttributeChange(
  category: string,
  attributeId: string,
  oldValue: number,
  newValue: number,
  context?: string
): AttributeChange {
  const changePercent = Math.abs(((newValue - oldValue) / Math.max(1, oldValue)) * 100)

  return {
    category,
    attributeId,
    oldValue,
    newValue,
    changePercent,
    timestamp: new Date(),
    context
  }
}

/**
 * Проверяет, нужно ли пытаться раскрыть атрибут
 */
export function shouldAttemptReveal(change: AttributeChange): boolean {
  return change.changePercent >= 20
}

/**
 * Выполняет попытку раскрытия атрибута
 */
export function attemptAttributeReveal(
  change: AttributeChange,
  currentKnowledge?: UniversalAttributeKnowledge
): RevealAttempt {
  const baseProbability = calculateRevealProbability(
    change.changePercent,
    change.category,
    change.context
  )

  // Если атрибут уже известен, уменьшаем вероятность повторного "раскрытия"
  let finalProbability = baseProbability
  if (currentKnowledge && currentKnowledge.level !== 'unknown') {
    finalProbability *= 0.3 // 30% от базовой вероятности для уже известных атрибутов
  }

  const successful = Math.random() < finalProbability

  return {
    category: change.category,
    attributeId: change.attributeId,
    changePercent: change.changePercent,
    baseProbability,
    finalProbability,
    successful,
    timestamp: new Date(),
    context: change.context
  }
}

/**
 * Обновляет знания о персонаже после успешного раскрытия
 */
export function updateKnowledgeAfterReveal(
  knowledge: UniversalCharacterKnowledge,
  revealAttempt: RevealAttempt,
  actualValue: number
): UniversalCharacterKnowledge {
  const newKnowledge = { ...knowledge }

  // Определяем уровень знания на основе успешного раскрытия
  let newLevel: 'approximate' | 'detailed' | 'precise' = 'approximate'

  // Для больших изменений даем более точные знания
  if (revealAttempt.changePercent >= 60) {
    newLevel = 'precise'
  } else if (revealAttempt.changePercent >= 40) {
    newLevel = 'detailed'
  }

  // Создаем новое знание
  const attributeKnowledge: UniversalAttributeKnowledge = {
    level: newLevel,
    value: newLevel === 'precise' ? actualValue : undefined,
    accuracy: newLevel === 'detailed' ? Math.max(5, Math.min(15, revealAttempt.changePercent / 4)) : undefined,
    lastAnalyzed: new Date()
  }

  // Обновляем соответствующую категорию
  if (revealAttempt.category.includes('_fetish') || ['bdsm', 'psychological', 'sensory', 'body_parts', 'material', 'social'].includes(revealAttempt.category)) {
    // Это фетиш
    if (!newKnowledge.fetishes[revealAttempt.category]) {
      newKnowledge.fetishes[revealAttempt.category] = {}
    }
    newKnowledge.fetishes[revealAttempt.category][revealAttempt.attributeId] = attributeKnowledge
  } else if (['emotional', 'motivational', 'physical'].includes(revealAttempt.category)) {
    // Это состояние
    if (!newKnowledge.states) {
      newKnowledge.states = {}
    }
    if (!newKnowledge.states[revealAttempt.category]) {
      newKnowledge.states[revealAttempt.category] = {}
    }
    newKnowledge.states[revealAttempt.category][revealAttempt.attributeId] = attributeKnowledge
  } else {
    // Это атрибут
    if (!newKnowledge.attributes[revealAttempt.category]) {
      newKnowledge.attributes[revealAttempt.category] = {}
    }
    newKnowledge.attributes[revealAttempt.category][revealAttempt.attributeId] = attributeKnowledge
  }

  return newKnowledge
}

/**
 * Обрабатывает изменения атрибутов и пытается раскрыть характеристики
 */
export function processAttributeChanges(
  characterKnowledge: UniversalCharacterKnowledge,
  changes: AttributeChange[],
  getActualValue: (category: string, attributeId: string) => number
): {
  updatedKnowledge: UniversalCharacterKnowledge
  successfulReveals: RevealAttempt[]
  history: AttributeRevealHistory
} {
  let updatedKnowledge = { ...characterKnowledge }
  const successfulReveals: RevealAttempt[] = []
  const history: AttributeRevealHistory = {
    changes: [...changes],
    revealAttempts: [],
    lastUpdate: new Date()
  }

  for (const change of changes) {
    if (!shouldAttemptReveal(change)) {
      continue
    }

    // Получаем текущее знание об атрибуте
    let currentKnowledge: UniversalAttributeKnowledge | undefined

    if (change.category.includes('_fetish') || ['bdsm', 'psychological', 'sensory', 'body_parts', 'material', 'social'].includes(change.category)) {
      currentKnowledge = updatedKnowledge.fetishes?.[change.category]?.[change.attributeId]
    } else if (['emotional', 'motivational', 'physical'].includes(change.category)) {
      currentKnowledge = updatedKnowledge.states?.[change.category]?.[change.attributeId]
    } else {
      currentKnowledge = updatedKnowledge.attributes?.[change.category]?.[change.attributeId]
    }

    // Пытаемся раскрыть атрибут
    const revealAttempt = attemptAttributeReveal(change, currentKnowledge)
    history.revealAttempts.push(revealAttempt)

    if (revealAttempt.successful) {
      successfulReveals.push(revealAttempt)

      // Обновляем знания
      const actualValue = getActualValue(change.category, change.attributeId)
      updatedKnowledge = updateKnowledgeAfterReveal(updatedKnowledge, revealAttempt, actualValue)
    }
  }

  return {
    updatedKnowledge,
    successfulReveals,
    history
  }
}

/**
 * Создает функцию для отслеживания изменений в персонаже
 */
export function createAttributeChangeTracker(
  initialKnowledge: UniversalCharacterKnowledge
) {
  let currentKnowledge = { ...initialKnowledge }
  let changeHistory: AttributeChange[] = []
  let revealHistory: RevealAttempt[] = []

  return {
    // Отслеживает изменение атрибута
    trackChange: (
      category: string,
      attributeId: string,
      oldValue: number,
      newValue: number,
      context?: string
    ) => {
      const change = createAttributeChange(category, attributeId, oldValue, newValue, context)
      changeHistory.push(change)

      // Автоматически обрабатываем изменение
      const result = processAttributeChanges(
        currentKnowledge,
        [change],
        (cat, attrId) => newValue // Используем новое значение как актуальное
      )

      currentKnowledge = result.updatedKnowledge
      revealHistory.push(...result.successfulReveals)

      return {
        change,
        successfulReveals: result.successfulReveals,
        updatedKnowledge: currentKnowledge
      }
    },

    // Получает текущее состояние знаний
    getCurrentKnowledge: () => currentKnowledge,

    // Получает историю изменений
    getChangeHistory: () => changeHistory,

    // Получает историю успешных раскрытий
    getRevealHistory: () => revealHistory,

    // Сбрасывает историю
    resetHistory: () => {
      changeHistory = []
      revealHistory = []
    }
  }
}
