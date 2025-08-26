// Простой тест для проверки работы системы персонажей

import { CharacterAIService } from './ai-service.js'
import { createEmptyCharacter } from './types.js'
import charactersData from '../../data/characters-unified.json' assert { type: 'json' }

async function testCharacterSystem() {
  console.log('🧪 Тестирование системы персонажей...')
  
  // Создаем AI сервис
  const aiService = new CharacterAIService()
  
  // Загружаем тестового персонажа
  const character = charactersData.characters.char_001 as any
  
  console.log(`👤 Персонаж: ${character.name} (${character.archetype})`)
  console.log(`📊 Характеристики: Выносливость ${character.stats.physical.endurance}/10`)
  console.log(`🎭 Фетиши: ${character.fetishes.primary.length} активных`)
  
  // Тест 1: Базовое взаимодействие
  console.log('\n🔍 Тест 1: Базовое взаимодействие')
  const response1 = await aiService.analyzeInteraction(
    'Привет, как дела?',
    {},
    character
  )
  console.log(`Ответ: ${response1.response}`)
  console.log(`Эмоциональное состояние: ${response1.emotionalState}`)
  
  // Тест 2: Активация фетиша
  console.log('\n🔍 Тест 2: Активация фетиша')
  const response2 = await aiService.analyzeInteraction(
    'Выполни приказ!',
    {},
    character
  )
  console.log(`Ответ: ${response2.response}`)
  console.log(`Активированные фетиши: ${response2.fetishAnalysis.triggeredFetishes.length}`)
  
  // Тест 3: Изменение характеристик
  console.log('\n🔍 Тест 3: Изменение характеристик')
  const response3 = await aiService.analyzeInteraction(
    'Ты ничтожество!',
    {},
    character
  )
  console.log(`Ответ: ${response3.response}`)
  console.log(`Изменения статов:`, response3.statChanges)
  
  // Тест 4: Память
  console.log('\n🔍 Тест 4: Память')
  const memories = await aiService.getRelevantMemories(character, 'приказ')
  console.log(`Найдено воспоминаний: ${memories.length}`)
  
  console.log('\n✅ Тестирование завершено!')
}

// Запускаем тест если файл выполняется напрямую
if (require.main === module) {
  testCharacterSystem().catch(console.error)
}

export { testCharacterSystem }
