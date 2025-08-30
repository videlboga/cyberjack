#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Функция для конвертации старого формата attributes в новый формат characteristics
function convertAttributesToCharacteristics(attributes) {
  return {
    physical: {
      'Выносливость': attributes.endurance || 0,
      'Чувствительность': attributes.sensitivity || 0,
      'Гибкость': attributes.flexibility || 0
    },
    psychological: {
      'Эмоциональная стабильность': attributes.emotional_stability || 0,
      'Адаптивность': attributes.adaptability || 0,
      'Интеллект': attributes.intelligence || 0
    },
    social: {
      'Общительность': attributes.sociability || 0,
      'Эмпатия': attributes.empathy || 0,
      'Доминантность': attributes.dominance || 0
    },
    personality: {
      'Самооценка': attributes.self_esteem || 0,
      'Оптимизм': attributes.optimism || 0,
      'Любопытство': attributes.curiosity || 0
    },
    special: {
      'Сексуальная опытность': attributes.sexual_experience || 0,
      'Сопротивляемость': attributes.resistance || 0,
      'Зависимость': attributes.dependency || 0
    }
  }
}

// Функция для инициализации скрытых характеристик
function initializeHiddenCharacteristics(characteristics) {
  const createUnknownKnowledge = () => ({
    level: 'unknown'
  })

  const result = {}

  // Инициализируем знания для всех категорий характеристик
  Object.keys(characteristics).forEach(category => {
    result[category] = {}
    Object.keys(characteristics[category]).forEach(charName => {
      result[category][charName] = createUnknownKnowledge()
    })
  })

  return result
}

// Пути к файлам
const assetsFilePath = path.join(__dirname, '../data/assets-from-characters.json')
const usersFilePath = path.join(__dirname, '../data/users-unified.json')

console.log('🔄 Начинаем миграцию системы assets...\n')

try {
  // Читаем файлы
  const assetsData = JSON.parse(fs.readFileSync(assetsFilePath, 'utf8'))
  const usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'))

  console.log(`📊 Найдено ${assetsData.assets.length} assets`)
  console.log(`👥 Найдено ${usersData.users.length} пользователей\n`)

  // Создаем карту персонажей для быстрого доступа
  const assetsMap = {}
  assetsData.assets.forEach(asset => {
    assetsMap[asset.id] = asset
  })

  // Обрабатываем каждого пользователя
  usersData.users.forEach(user => {
    console.log(`🔧 Обрабатываем пользователя: ${user.username}`)

    // Инициализируем систему знаний пользователя
    if (!user.characterKnowledge) {
      user.characterKnowledge = {}
    }

    // Получаем список персонажей пользователя
    const userAssetIds = []

    // Из assets пользователя
    if (user.assets) {
      user.assets.forEach(asset => {
        if (asset.assetId && assetsMap[asset.assetId]) {
          userAssetIds.push(asset.assetId)
        }
      })
    }

    console.log(`   📋 Assets пользователя: ${userAssetIds.join(', ')}`)

    // Переносим знания для каждого персонажа
    userAssetIds.forEach(assetId => {
      const asset = assetsMap[assetId]

      if (!asset) {
        console.log(`   ⚠️  Asset ${assetId} не найден`)
        return
      }

      // Проверяем, есть ли уже знания об этом персонаже
      if (user.characterKnowledge[assetId]) {
        console.log(`   ✅ Знания о персонаже ${asset.name} уже существуют`)
        return
      }

      // Конвертируем характеристики и создаем знания
      const characteristics = convertAttributesToCharacteristics(asset.attributes)
      const characterKnowledge = initializeHiddenCharacteristics(characteristics)

      // Сохраняем знания в профиле пользователя
      user.characterKnowledge[assetId] = {
        characterId: assetId,
        knowledge: characterKnowledge,
        analysisHistory: [],
        lastAnalyzed: null,
        analysisCount: 0
      }

      console.log(`   🆕 Созданы знания для ${asset.name}`)
    })

    console.log(`   🎯 Всего знаний о персонажах: ${Object.keys(user.characterKnowledge).length}\n`)
  })

  // Обновляем assets с новой системой характеристик
  console.log('🔄 Обновляем assets с новой системой характеристик...')

  assetsData.assets.forEach(asset => {
    if (asset.attributes) {
      // Конвертируем старый формат в новый
      asset.characteristics = convertAttributesToCharacteristics(asset.attributes)
      // Удаляем старые атрибуты
      delete asset.attributes
      console.log(`   ✅ Обновлен asset: ${asset.name}`)
    }
  })

  // Сохраняем обновленные файлы
  fs.writeFileSync(assetsFilePath, JSON.stringify(assetsData, null, 2))
  fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2))

  console.log('💾 Файлы сохранены:')
  console.log(`   📁 ${assetsFilePath}`)
  console.log(`   📁 ${usersFilePath}`)

  // Статистика
  const totalKnowledgeRecords = usersData.users.reduce((sum, user) => {
    return sum + Object.keys(user.characterKnowledge || {}).length
  }, 0)

  console.log(`\n📊 Статистика миграции:`)
  console.log(`   👥 Пользователей с знаниями: ${usersData.users.filter(u => u.characterKnowledge && Object.keys(u.characterKnowledge).length > 0).length}`)
  console.log(`   🧠 Всего записей знаний: ${totalKnowledgeRecords}`)
  console.log(`   🔄 Обновлено assets: ${assetsData.assets.filter(a => a.characteristics).length}`)

} catch (error) {
  console.error('❌ Ошибка при миграции assets:', error)
  process.exit(1)
}

console.log('\n🎉 Миграция assets завершена успешно!')
console.log('Теперь assets поддерживают новую систему характеристик! 🚀')





