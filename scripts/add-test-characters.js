#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Пути к файлам
const assetsFilePath = path.join(__dirname, '../data/assets-from-characters.json')
const usersFilePath = path.join(__dirname, '../data/users-unified.json')

console.log('🔧 Добавление тестовых персонажей пользователю...\n')

try {
  // Читаем файлы
  const assetsData = JSON.parse(fs.readFileSync(assetsFilePath, 'utf8'))
  const usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'))

  console.log(`📊 Найдено ${assetsData.assets.length} доступных персонажей`)
  console.log(`👥 Найдено ${usersData.users.length} пользователей\n`)

  // Находим пользователя (берем первого)
  const user = usersData.users[0]
  if (!user) {
    throw new Error('Пользователь не найден')
  }

  console.log(`🎯 Работаем с пользователем: ${user.username}`)

  // Выбираем первые 3 персонажа для тестирования
  const testCharacters = assetsData.assets.slice(0, 3)

  console.log('📋 Выбранные персонажи для тестирования:')
  testCharacters.forEach((character, index) => {
    console.log(`   ${index + 1}. ${character.name} (ID: ${character.id})`)
  })

  // Добавляем персонажей в массив characters пользователя
  user.characters = testCharacters.map(char => char.id)

  // Добавляем assets в профиль пользователя
  user.assets = testCharacters.map(character => ({
    assetId: character.id,
    assignedDate: new Date().toISOString().split('T')[0],
    status: "active"
  }))

  // Инициализируем систему знаний для каждого персонажа
  if (!user.characterKnowledge) {
    user.characterKnowledge = {}
  }

  testCharacters.forEach(character => {
    if (!user.characterKnowledge[character.id]) {
      // Используем функцию из character-analysis для инициализации
      const characteristics = character.characteristics

      const characterKnowledge = {
        physical: {},
        psychological: {},
        social: {},
        personality: {},
        special: {}
      }

      // Инициализируем все характеристики как неизвестные
      Object.keys(characteristics).forEach(category => {
        characterKnowledge[category] = {}
        Object.keys(characteristics[category]).forEach(charName => {
          characterKnowledge[category][charName] = {
            level: 'unknown'
          }
        })
      })

      user.characterKnowledge[character.id] = {
        characterId: character.id,
        knowledge: characterKnowledge,
        analysisHistory: [],
        lastAnalyzed: null,
        analysisCount: 0
      }
    }
  })

  // Сохраняем обновленный файл пользователей
  fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2))

  console.log('✅ Персонажи успешно добавлены!')
  console.log(`   🎭 Добавлено персонажей: ${testCharacters.length}`)
  console.log(`   🧠 Созданы записи знаний: ${testCharacters.length}`)

  // Выводим итоговую информацию
  console.log('\n📊 Итоговое состояние пользователя:')
  console.log(`   🎯 Персонажи: ${user.characters.join(', ')}`)
  console.log(`   🎮 Assets: ${user.assets.map(a => a.assetId).join(', ')}`)
  console.log(`   🧠 Записи знаний: ${Object.keys(user.characterKnowledge || {}).length}`)

} catch (error) {
  console.error('❌ Ошибка при добавлении персонажей:', error)
  process.exit(1)
}

console.log('\n🎉 Тестовые персонажи успешно добавлены!')
console.log('Теперь можно тестировать систему анализа в прод режиме! 🚀')






