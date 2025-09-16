// test-interpretations-simple.js
// Простой тест новой системы интерпретации

// Имитируем тестовые данные
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

// Имитируем новую функцию интерпретации
function interpretCharacteristicChangesAsSensations(characteristics) {
  const sensations = []

  for (const char of characteristics) {
    if (char.recentChange && Math.abs(char.recentChange) >= 5) {
      const sensation = getSensationFromCharacteristicName(char.name, char.recentChange)
      if (sensation) {
        sensations.push(sensation)
      }
    }
  }

  return sensations
}

function getSensationFromCharacteristicName(characteristicName, change) {
  const sensationMap = {
    'Энергия': (change) => {
      if (change > 0) return 'Ты чувствуешь прилив энергии и бодрости.'
      if (change < 0) return 'Ты чувствуешь усталость и потерю сил.'
      return null
    },
    'Настроение': (change) => {
      if (change > 0) return 'Твое настроение улучшается, ты чувствуешь себя лучше.'
      if (change < 0) return 'Твое настроение ухудшается, ты чувствуешь грусть.'
      return null
    },
    'Стыд': (change) => {
      if (change > 0) return 'Ты чувствуешь усиливающееся чувство стыда.'
      if (change < 0) return 'Ты чувствуешь, что стыд отступает.'
      return null
    },
    'Чувствительность': (change) => {
      if (change > 0) return 'Ты чувствуешь, что стала более чувствительной к прикосновениям.'
      if (change < 0) return 'Ты чувствуешь, что стала менее чувствительной к прикосновениям.'
      return null
    },
    'Покорность': (change) => {
      if (change > 0) return 'Ты чувствуешь усиливающееся желание подчиняться.'
      if (change < 0) return 'Ты чувствуешь, что желание подчиняться ослабевает.'
      return null
    }
  }

  const sensationFunction = sensationMap[characteristicName]
  if (sensationFunction) {
    return sensationFunction(change)
  }

  return null
}

// Запускаем тест
console.log('🧪 Тестируем новую систему интерпретации характеристик...\n')

console.log('📊 Тестовые характеристики:')
testCharacteristics.forEach(char => {
  console.log(`- ${char.name}: ${char.currentValue}/100 (изменение: ${char.recentChange > 0 ? '+' : ''}${char.recentChange})`)
})

console.log('\n🎭 Интерпретации ощущений:')
const sensations = interpretCharacteristicChangesAsSensations(testCharacteristics)

if (sensations.length > 0) {
  sensations.forEach(sensation => {
    console.log(`- ${sensation}`)
  })
} else {
  console.log('- Нет значительных изменений для интерпретации')
}

console.log('\n📝 Пример промпта для персонажа:')
console.log('Ты чувствуешь изменения в своем состоянии:')
sensations.forEach(sensation => {
  console.log(`- ${sensation}`)
})

console.log('\n✅ Тест завершен!')
console.log('\n💡 Теперь вместо "Энергия повышается на 15" персонаж получает "Ты чувствуешь прилив энергии и бодрости."')
