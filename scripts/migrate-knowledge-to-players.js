#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Функция для создания пустой системы знаний для персонажа
function createEmptyCharacterKnowledge(characteristics) {
  const result = {}

  // Инициализируем знания для всех категорий характеристик
  Object.keys(characteristics).forEach(category => {
    result[category] = {}
    Object.keys(characteristics[category]).forEach(charName => {
      result[category][charName] = {
        level: 'unknown'
      }
    })
  })

  return result
}

// Пути к файлам
const charactersFilePath = path.join(__dirname, '../data/characters-unified.json')
const usersFilePath = path.join(__dirname, '../data/users-unified.json')

console.log('🔄 Начинаем миграцию системы знаний...\n')

try {
  // Читаем файлы
  const charactersData = JSON.parse(fs.readFileSync(charactersFilePath, 'utf8'))
  const usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'))

  console.log(`📊 Найдено ${charactersData.characters.length} персонажей`)
  console.log(`👥 Найдено ${usersData.users.length} пользователей\n`)

  // Создаем карту персонажей для быстрого доступа
  const charactersMap = {}
  charactersData.characters.forEach(character => {
    charactersMap[character.id] = character
  })

  // Обрабатываем каждого пользователя
  usersData.users.forEach(user => {
    console.log(`🔧 Обрабатываем пользователя: ${user.username}`)

    // Инициализируем систему знаний пользователя
    if (!user.characterKnowledge) {
      user.characterKnowledge = {}
    }

    // Получаем список персонажей пользователя
    const userCharacterIds = []

    // Из assets пользователя
    if (user.assets) {
      user.assets.forEach(asset => {
        if (asset.assetId && charactersMap[asset.assetId]) {
          userCharacterIds.push(asset.assetId)
        }
      })
    }

    // Из characters пользователя (если есть)
    if (user.characters) {
      user.characters.forEach(charId => {
        if (charactersMap[charId] && !userCharacterIds.includes(charId)) {
          userCharacterIds.push(charId)
        }
      })
    }

    console.log(`   📋 Персонажи пользователя: ${userCharacterIds.join(', ')}`)

    // Переносим знания для каждого персонажа
    userCharacterIds.forEach(characterId => {
      const character = charactersMap[characterId]

      if (!character) {
        console.log(`   ⚠️  Персонаж ${characterId} не найден`)
        return
      }

      // Проверяем, есть ли уже знания об этом персонаже
      if (user.characterKnowledge[characterId]) {
        console.log(`   ✅ Знания о персонаже ${character.name} уже существуют`)
        return
      }

      // Создаем знания для этого персонажа
      let characterKnowledge = null
      let analysisHistory = []

      // Если у персонажа есть знания, переносим их
      if (character.knowledge) {
        characterKnowledge = character.knowledge
        console.log(`   🔄 Переносим существующие знания для ${character.name}`)
      } else if (character.characteristics) {
        characterKnowledge = createEmptyCharacterKnowledge(character.characteristics)
        console.log(`   🆕 Создаем новые знания для ${character.name}`)
      }

      // Если у персонажа есть история анализа, переносим её
      if (character.analysisHistory) {
        analysisHistory = character.analysisHistory
        console.log(`   📚 Переносим историю анализа (${analysisHistory.length} записей)`)
      }

      // Сохраняем знания в профиле пользователя
      if (characterKnowledge) {
        user.characterKnowledge[characterId] = {
          characterId: characterId,
          knowledge: characterKnowledge,
          analysisHistory: analysisHistory,
          lastAnalyzed: analysisHistory.length > 0 ?
            analysisHistory[analysisHistory.length - 1].startTime : null,
          analysisCount: analysisHistory.length
        }
      }
    })

    console.log(`   🎯 Всего знаний о персонажах: ${Object.keys(user.characterKnowledge).length}\n`)
  })

  // Теперь очищаем знания из персонажей
  console.log('🧹 Очищаем знания из персонажей...')

  let cleanedCharacters = 0
  charactersData.characters.forEach(character => {
    if (character.knowledge) {
      delete character.knowledge
      cleanedCharacters++
    }
    if (character.analysisHistory) {
      delete character.analysisHistory
      cleanedCharacters++
    }
  })

  console.log(`✅ Очищено полей из ${cleanedCharacters} персонажей\n`)

  // Сохраняем обновленные файлы
  fs.writeFileSync(charactersFilePath, JSON.stringify(charactersData, null, 2))
  fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2))

  console.log('💾 Файлы сохранены:')
  console.log(`   📁 ${charactersFilePath}`)
  console.log(`   📁 ${usersFilePath}`)

  // Статистика
  const totalKnowledgeRecords = usersData.users.reduce((sum, user) => {
    return sum + Object.keys(user.characterKnowledge || {}).length
  }, 0)

  console.log(`\n📊 Статистика миграции:`)
  console.log(`   👥 Пользователей с знаниями: ${usersData.users.filter(u => u.characterKnowledge && Object.keys(u.characterKnowledge).length > 0).length}`)
  console.log(`   🧠 Всего записей знаний: ${totalKnowledgeRecords}`)

} catch (error) {
  console.error('❌ Ошибка при миграции:', error)
  process.exit(1)
}

console.log('\n🎉 Миграция завершена успешно!')
console.log('Теперь знания принадлежат игрокам, а не персонажам! 🚀')






