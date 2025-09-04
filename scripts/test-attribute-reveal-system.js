#!/usr/bin/env node

// ===== ТЕСТИРОВАНИЕ СИСТЕМЫ АВТОМАТИЧЕСКОГО РАСКРЫТИЯ =====

// Простой тест без импортов - проверка основных функций

function testRevealProbability() {
  console.log('🧪 Тестирование вероятностей раскрытия...\n')

  // Константы из системы
  const REVEAL_PROBABILITIES = {
    20: 0.15, 25: 0.25, 30: 0.35, 40: 0.50,
    50: 0.70, 60: 0.85, 70: 0.95, 80: 1.00
  }

  const CATEGORY_MODIFIERS = {
    physical: 1.2, psychological: 0.8, social: 0.9,
    personality: 0.7, special: 0.6, bdsm: 0.5
  }

  const CONTEXT_MODIFIERS = {
    pleasure_increase: 1.3, trust_increase: 1.4, stress_increase: 0.7,
    arousal_increase: 1.2, fear_increase: 0.5
  }

  // Функция расчета вероятности
  function calculateRevealProbability(changePercent, category, context) {
    const thresholds = Object.keys(REVEAL_PROBABILITIES).map(Number).sort((a, b) => a - b)
    let baseProbability = 0

    for (const threshold of thresholds) {
      if (changePercent >= threshold) {
        baseProbability = REVEAL_PROBABILITIES[threshold]
      }
    }

    if (changePercent < 20) return 0

    const categoryModifier = CATEGORY_MODIFIERS[category] || 1.0
    let finalProbability = baseProbability * categoryModifier

    if (context) {
      const contextModifier = CONTEXT_MODIFIERS[context] || 1.0
      finalProbability *= contextModifier
    }

    return Math.max(0, Math.min(1, finalProbability))
  }

  const testCases = [
    { changePercent: 15, category: 'physical', context: 'pleasure_increase', expected: 0 },
    { changePercent: 25, category: 'physical', context: 'pleasure_increase', expected: ~0.3 },
    { changePercent: 50, category: 'psychological', context: 'trust_increase', expected: ~0.7 },
    { changePercent: 75, category: 'special', context: 'stress_increase', expected: ~0.5 },
  ]

  testCases.forEach((testCase, index) => {
    const probability = calculateRevealProbability(
      testCase.changePercent,
      testCase.category,
      testCase.context
    )

    console.log(`Тест ${index + 1}:`)
    console.log(`  Изменение: ${testCase.changePercent}%`)
    console.log(`  Категория: ${testCase.category}`)
    console.log(`  Контекст: ${testCase.context}`)
    console.log(`  Вероятность: ${(probability * 100).toFixed(1)}%`)
    console.log()
  })
}

function testAttributeChangeCreation() {
  console.log('🔄 Тестирование создания изменений атрибутов...\n')

  // Функция создания изменения
  function createAttributeChange(category, attributeId, oldValue, newValue, context) {
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

  const changes = [
    createAttributeChange('physical', 'endurance', 50, 75, 'pleasure_increase'),
    createAttributeChange('psychological', 'emotional_stability', 60, 45, 'stress_increase'),
    createAttributeChange('bdsm', 'submission', 20, 50, 'trust_increase')
  ]

  changes.forEach((change, index) => {
    console.log(`Изменение ${index + 1}:`)
    console.log(`  Атрибут: ${change.attributeId}`)
    console.log(`  Изменение: ${change.oldValue} → ${change.newValue}`)
    console.log(`  Процент: ${change.changePercent.toFixed(1)}%`)
    console.log(`  Контекст: ${change.context}`)
    console.log()
  })
}

function testRevealAttempts() {
  console.log('🎯 Тестирование попыток раскрытия...\n')

  // Функция создания изменения
  function createAttributeChange(category, attributeId, oldValue, newValue, context) {
    const changePercent = Math.abs(((newValue - oldValue) / Math.max(1, oldValue)) * 100)
    return { category, attributeId, oldValue, newValue, changePercent, context }
  }

  // Функция попытки раскрытия
  function attemptAttributeReveal(change) {
    // Константы для расчета вероятности
    const REVEAL_PROBABILITIES = {
      20: 0.15, 25: 0.25, 30: 0.35, 40: 0.50,
      50: 0.70, 60: 0.85, 70: 0.95, 80: 1.00
    }

    const CATEGORY_MODIFIERS = {
      physical: 1.2, psychological: 0.8, social: 0.9,
      personality: 0.7, special: 0.6, bdsm: 0.5
    }

    const CONTEXT_MODIFIERS = {
      pleasure_increase: 1.3, trust_increase: 1.4, stress_increase: 0.7,
      arousal_increase: 1.2, fear_increase: 0.5
    }

    // Расчет вероятности
    function calculateRevealProbabilityLocal(changePercent, category, context) {
      const thresholds = Object.keys(REVEAL_PROBABILITIES).map(Number).sort((a, b) => a - b)
      let baseProbability = 0

      for (const threshold of thresholds) {
        if (changePercent >= threshold) {
          baseProbability = REVEAL_PROBABILITIES[threshold]
        }
      }

      if (changePercent < 20) return 0

      const categoryModifier = CATEGORY_MODIFIERS[category] || 1.0
      let finalProbability = baseProbability * categoryModifier

      if (context) {
        const contextModifier = CONTEXT_MODIFIERS[context] || 1.0
        finalProbability *= contextModifier
      }

      return Math.max(0, Math.min(1, finalProbability))
    }

    const baseProbability = calculateRevealProbabilityLocal(change.changePercent, change.category, change.context)
    const successful = Math.random() < baseProbability

    return {
      category: change.category,
      attributeId: change.attributeId,
      changePercent: change.changePercent,
      baseProbability,
      finalProbability: baseProbability,
      successful,
      timestamp: new Date(),
      context: change.context
    }
  }

  const changes = [
    createAttributeChange('physical', 'endurance', 50, 75, 'pleasure_increase'),
    createAttributeChange('psychological', 'emotional_stability', 60, 45, 'stress_increase'),
    createAttributeChange('bdsm', 'submission', 20, 50, 'trust_increase')
  ]

  changes.forEach((change, index) => {
    console.log(`Попытка раскрытия ${index + 1}:`)
    console.log(`  Атрибут: ${change.attributeId}`)
    console.log(`  Изменение: ${change.changePercent.toFixed(1)}%`)

    // Имитация нескольких попыток
    let successCount = 0
    for (let i = 0; i < 10; i++) {
      const attempt = attemptAttributeReveal(change)
      if (attempt.successful) successCount++
    }
    console.log(`    Успешных из 10 попыток: ${successCount}`)
    console.log()
  })
}

function testModifiers() {
  console.log('⚙️ Тестирование модификаторов...\n')

  const CATEGORY_MODIFIERS = {
    physical: 1.2, psychological: 0.8, social: 0.9,
    personality: 0.7, special: 0.6, bdsm: 0.5
  }

  const CONTEXT_MODIFIERS = {
    pleasure_increase: 1.3, trust_increase: 1.4, stress_increase: 0.7,
    arousal_increase: 1.2, fear_increase: 0.5
  }

  console.log('Модификаторы категорий:')
  Object.entries(CATEGORY_MODIFIERS).forEach(([category, modifier]) => {
    console.log(`  ${category}: ${modifier}`)
  })

  console.log('\nМодификаторы контекста:')
  Object.entries(CONTEXT_MODIFIERS).forEach(([context, modifier]) => {
    console.log(`  ${context}: ${modifier}`)
  })
}

// Запуск всех тестов
function runAllTests() {
  console.log('🚀 Запуск тестирования системы автоматического раскрытия характеристик\n')
  console.log('='.repeat(70))

  testRevealProbability()
  console.log('='.repeat(70))

  testAttributeChangeCreation()
  console.log('='.repeat(70))

  testRevealAttempts()
  console.log('='.repeat(70))

  testChangeTracker()
  console.log('='.repeat(70))

  testModifiers()
  console.log('='.repeat(70))

  console.log('✅ Все тесты завершены!')
}

// Запускаем тесты
runAllTests()
