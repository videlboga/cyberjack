#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Функция для инициализации скрытых характеристик (адаптирована под структуру файла)
function initializeHiddenCharacteristics(characteristics) {
  const createUnknownKnowledge = () => ({
    level: 'unknown'
  })

  const result = {}

  // Инициализируем знания для всех категорий, которые есть в characteristics
  Object.keys(characteristics).forEach(category => {
    result[category] = {}
    Object.keys(characteristics[category]).forEach(charName => {
      result[category][charName] = createUnknownKnowledge()
    })
  })

  return result
}

// Путь к файлу персонажей
const charactersFilePath = path.join(__dirname, '../data/characters-unified.json')

console.log('🔧 Исправление системы анализа характеристик для персонажей...\n')

try {
  // Читаем файл персонажей
  const charactersData = JSON.parse(fs.readFileSync(charactersFilePath, 'utf8'))
  let fixedCount = 0

  // Обрабатываем каждого персонажа
  charactersData.characters = charactersData.characters.map(character => {
    let wasFixed = false

    // Проверяем наличие системы знаний (используем characteristics вместо attributes)
    if (!character.knowledge && character.characteristics) {
      console.log(`🔧 Инициализирую систему знаний для: ${character.name}`)
      character.knowledge = initializeHiddenCharacteristics(character.characteristics)
      character.analysisHistory = character.analysisHistory || []
      wasFixed = true
    }

    // Проверяем структуру knowledge
    if (character.knowledge) {
      const requiredCategories = ['physical', 'psychological', 'social', 'special']

      requiredCategories.forEach(category => {
        if (!character.knowledge[category]) {
          console.log(`🔧 Создаю категорию ${category} для: ${character.name}`)
          character.knowledge[category] = {}
          wasFixed = true
        }
      })
    }

    if (wasFixed) {
      fixedCount++
    }

    return character
  })

  // Сохраняем исправленный файл
  fs.writeFileSync(charactersFilePath, JSON.stringify(charactersData, null, 2))
  console.log(`\n✅ Исправлено ${fixedCount} персонажей`)
  console.log('📁 Файл сохранен:', charactersFilePath)

} catch (error) {
  console.error('❌ Ошибка при исправлении системы анализа:', error)
  process.exit(1)
}

console.log('\n🎯 Система анализа характеристик готова к использованию!')
console.log('Теперь все персонажи имеют правильную структуру для анализа.')
