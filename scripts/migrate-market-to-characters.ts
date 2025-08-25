import fs from 'fs'
import path from 'path'
import { TalentToCharacterMigration, MarketMigration } from '../lib/migration/talent-to-character-migration'

/**
 * Скрипт миграции данных из старого market.json в новую структуру characters-unified.json
 */
async function migrateMarketToCharacters() {
  console.log('🔄 Начинаем миграцию данных из market.json в characters-unified.json...')
  
  try {
    // Читаем старый market.json
    const marketPath = path.join(process.cwd(), 'data', 'market.json')
    const marketData = JSON.parse(fs.readFileSync(marketPath, 'utf8'))
    
    console.log('📊 Загружены данные из market.json:', {
      talentExchange: marketData.talentExchange?.length || 0,
      voidRescues: marketData.voidRescues?.length || 0,
      corporateContracts: marketData.corporateContracts?.length || 0
    })
    
    // Мигрируем данные
    const migratedCharacters = MarketMigration.migrateMarketData(marketData)
    
    console.log('✅ Мигрировано персонажей:', migratedCharacters.characters.length)
    
    // Читаем существующий characters-unified.json
    const charactersPath = path.join(process.cwd(), 'data', 'characters-unified.json')
    let existingCharacters = { characters: [], templates: {}, config: {} }
    
    if (fs.existsSync(charactersPath)) {
      existingCharacters = JSON.parse(fs.readFileSync(charactersPath, 'utf8'))
      console.log('📋 Найдено существующих персонажей:', existingCharacters.characters.length)
    }
    
    // Объединяем мигрированные персонажи с существующими
    const existingIds = new Set(existingCharacters.characters.map((char: any) => char.id))
    const newCharacters = migratedCharacters.characters.filter((char: any) => !existingIds.has(char.id))
    
    console.log('🆕 Новых персонажей для добавления:', newCharacters.length)
    
    // Добавляем новые персонажи
    const updatedCharacters = {
      ...existingCharacters,
      characters: [...existingCharacters.characters, ...newCharacters]
    }
    
    // Сохраняем обновленный файл
    fs.writeFileSync(charactersPath, JSON.stringify(updatedCharacters, null, 2))
    
    console.log('💾 Обновлен файл characters-unified.json')
    console.log('📊 Итого персонажей:', updatedCharacters.characters.length)
    
    // Выводим статистику миграции
    console.log('\n📈 Статистика миграции:')
    console.log('- Существовало персонажей:', existingCharacters.characters.length)
    console.log('- Мигрировано из market.json:', migratedCharacters.characters.length)
    console.log('- Добавлено новых:', newCharacters.length)
    console.log('- Итого после миграции:', updatedCharacters.characters.length)
    
    // Показываем примеры мигрированных персонажей
    if (newCharacters.length > 0) {
      console.log('\n👥 Примеры мигрированных персонажей:')
      newCharacters.slice(0, 3).forEach((char: any, index: number) => {
        console.log(`${index + 1}. ${char.name} (${char.archetype})`)
        console.log(`   - Физические: выносливость ${char.stats.physical.endurance}, чувствительность ${char.stats.physical.sensitivity}`)
        console.log(`   - Психологические: стабильность ${char.stats.psychological.emotionalStability}, интеллект ${char.stats.psychological.intelligence}`)
        console.log(`   - Фетиши: основных ${char.fetishes.primary.length}, дополнительных ${char.fetishes.secondary.length}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Ошибка миграции:', error)
    process.exit(1)
  }
}

// Запускаем миграцию
migrateMarketToCharacters()
