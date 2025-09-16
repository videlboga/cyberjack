// test-characteristic-interpretations-v2.js
// Тест новой системы интерпретации характеристик

const { CharacteristicInterpreter } = require('./lib/character/characteristic-interpreter.ts')

async function testCharacteristicInterpretations() {
  console.log('🧪 Тестируем новую систему интерпретации характеристик...\n')

  const interpreter = new CharacteristicInterpreter()

  // Тестовые характеристики с изменениями
  const testCharacteristics = [
    {
      name: 'Энергия',
      category: 'Состояние',
      currentValue: 75,
      baseValue: 50,
      recentChange: 15
    },
    {
      name: 'Настроение',
      category: 'Эмоциональные',
      currentValue: 60,
      baseValue: 40,
      recentChange: 20
    },
    {
      name: 'Стыд',
      category: 'Эмоциональные',
      currentValue: 85,
      baseValue: 70,
      recentChange: -10
    },
    {
      name: 'Чувствительность',
      category: 'Физические',
      currentValue: 90,
      baseValue: 60,
      recentChange: 25
    },
    {
      name: 'Покорность',
      category: 'Состояние',
      currentValue: 80,
      baseValue: 50,
      recentChange: 30
    }
  ]

  console.log('📊 Тестовые характеристики:')
  testCharacteristics.forEach(char => {
    console.log(`- ${char.name}: ${char.currentValue}/100 (изменение: ${char.recentChange > 0 ? '+' : ''}${char.recentChange})`)
  })

  console.log('\n🎭 Интерпретации ощущений:')
  const sensations = interpreter.interpretCharacteristicChangesAsSensations(testCharacteristics)

  if (sensations.length > 0) {
    sensations.forEach(sensation => {
      console.log(`- ${sensation}`)
    })
  } else {
    console.log('- Нет значительных изменений для интерпретации')
  }

  console.log('\n📋 Сводка характеристик:')
  const summary = interpreter.createCharacteristicSummary(testCharacteristics)

  console.log(`Эмоциональное состояние: ${summary.emotionalState}`)
  console.log(`Общее настроение: ${summary.overallMood}`)
  console.log(`Поведенческое руководство: ${summary.behaviorGuidance}`)

  console.log('\n🏆 Топ-5 характеристик:')
  summary.dominantTraits.forEach((trait, index) => {
    console.log(`${index + 1}. ${trait.name}: ${trait.interpretation}`)
  })

  console.log('\n🔄 Недавние изменения:')
  if (summary.recentChanges.length > 0) {
    summary.recentChanges.forEach(change => {
      console.log(`- ${change.name}: ${change.behaviorGuidance}`)
    })
  } else {
    console.log('- Нет значительных недавних изменений')
  }

  console.log('\n✅ Тест завершен!')
}

// Запускаем тест
testCharacteristicInterpretations().catch(console.error)
