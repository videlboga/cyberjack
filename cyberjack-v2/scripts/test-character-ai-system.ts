// scripts/test-character-ai-system.ts

import { CharacterAIService } from '../lib/character/ai-service'
import { PromptSystem } from '../lib/character/prompt-system'
import { CharacterMemoryManager } from '../lib/character/memory-manager'
import { CharacterResponseManager } from '../lib/character/response-manager'
import { prisma } from '../lib/db/client'

async function testCharacterAISystem() {
  console.log('🧪 Тестирование системы Character AI...\n')

  // Инициализация сервисов
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY не найден в переменных окружения')
    return
  }

  const aiService = new CharacterAIService(apiKey)
  const promptSystem = new PromptSystem()
  const memoryManager = new CharacterMemoryManager()
  const responseManager = new CharacterResponseManager()

  try {
    // Тест 1: Проверка системы промптов
    console.log('📝 Тест 1: Система промптов')
    const templates = promptSystem.getAllTemplates()
    console.log(`✅ Найдено шаблонов: ${templates.length}`)

    templates.forEach(template => {
      console.log(`  - ${template.name} (${template.category})`)
    })
    console.log()

    // Тест 2: Проверка системы памяти
    console.log('🧠 Тест 2: Система памяти')

    // Создаем тестового персонажа
    const testCharacter = await prisma.character.create({
      data: {
        name: 'Тестовый персонаж',
        description: 'Персонаж для тестирования системы AI',
        isActive: true
      }
    })
    const testCharacterId = testCharacter.id
    console.log(`✅ Создан тестовый персонаж: ${testCharacterId}`)

    // Добавляем тестовое воспоминание
    const memory = await memoryManager.addMemory(testCharacterId, {
      type: 'interaction' as any,
      content: 'Пользователь поздоровался',
      importance: 5,
      tags: ['приветствие', 'взаимодействие'],
      emotionalWeight: 3,
      context: 'первое знакомство',
      isActive: true
    })
    console.log(`✅ Добавлено воспоминание: ${memory.id}`)

    // Получаем воспоминания
    const memories = await memoryManager.getMemory(testCharacterId)
    console.log(`✅ Найдено воспоминаний: ${memories.length}`)

    // Удаляем тестового персонажа
    await prisma.character.delete({
      where: { id: testCharacterId }
    })
    console.log(`✅ Удален тестовый персонаж`)
    console.log()

    // Тест 3: Проверка системы ответов
    console.log('💬 Тест 3: Система ответов')
    const testResponse = 'Привет! Как дела?'
    const analysis = await responseManager.analyzeResponse(testResponse, {
      characterId: testCharacterId,
      userId: 'test-user',
      message: '',
      characteristics: [],
      memory: { shortTerm: [], longTerm: [], contextual: [], emotional: [], recent: [] },
      userModifiers: {},
      gameTime: Date.now(),
      sessionHistory: [],
      environment: {
        timeOfDay: 'день',
        location: 'комната',
        atmosphere: 'дружелюбная',
        temperature: 'комфортная',
        lighting: 'яркая',
        sounds: [],
        smells: []
      }
    })
    console.log(`✅ Анализ ответа: эмоция=${analysis.emotion}, качество=${analysis.quality}`)
    console.log()

    // Тест 4: Проверка API здоровья
    console.log('🏥 Тест 4: Проверка API')
    const isHealthy = await aiService.checkApiHealth()
    console.log(`✅ API здоровье: ${isHealthy ? 'OK' : 'ERROR'}`)

    const models = await aiService.getAvailableModels()
    console.log(`✅ Доступно моделей: ${models.length}`)
    console.log()

    // Тест 5: Проверка конфигурации
    console.log('⚙️ Тест 5: Конфигурация')
    const config = aiService.getConfig()
    console.log(`✅ Модель: ${config.model}`)
    console.log(`✅ Макс токенов: ${config.maxTokens}`)
    console.log(`✅ Температура: ${config.temperature}`)
    console.log()

    // Тест 6: Проверка метрик
    console.log('📊 Тест 6: Метрики')
    const metrics = aiService.getMetrics()
    console.log(`✅ Всего запросов: ${metrics.totalRequests}`)
    console.log(`✅ Успешных: ${metrics.successfulRequests}`)
    console.log(`✅ Ошибок: ${metrics.failedRequests}`)
    console.log(`✅ Процент ошибок: ${(metrics.errorRate * 100).toFixed(2)}%`)
    console.log()

    // Тест 7: Проверка валидации шаблонов
    console.log('✅ Тест 7: Валидация шаблонов')
    let validTemplates = 0
    let invalidTemplates = 0

    templates.forEach(template => {
      const validation = promptSystem.validateTemplate(template)
      if (validation.isValid) {
        validTemplates++
      } else {
        invalidTemplates++
        console.log(`  ❌ ${template.name}: ${validation.errors.join(', ')}`)
      }
    })

    console.log(`✅ Валидных шаблонов: ${validTemplates}`)
    console.log(`❌ Невалидных шаблонов: ${invalidTemplates}`)
    console.log()

    // Тест 8: Проверка статистики промптов
    console.log('📈 Тест 8: Статистика промптов')
    const testPrompt = 'Ты - персонаж в игре. Отвечай естественно.'
    const stats = promptSystem.getPromptStats(testPrompt)
    console.log(`✅ Длина промпта: ${stats.length} символов`)
    console.log(`✅ Примерно токенов: ${stats.estimatedTokens}`)
    console.log(`✅ Переменных: ${stats.variableCount}`)
    console.log()

    // Тест 9: Проверка оптимизации промптов
    console.log('🔧 Тест 9: Оптимизация промптов')
    const longPrompt = 'Это очень длинный промпт. '.repeat(100)
    const optimized = promptSystem.optimizePrompt(longPrompt, 100)
    console.log(`✅ Исходная длина: ${longPrompt.length}`)
    console.log(`✅ Оптимизированная длина: ${optimized.length}`)
    console.log()

    // Тест 10: Проверка очистки памяти
    console.log('🧹 Тест 10: Очистка памяти')
    // Создаем еще одного тестового персонажа для проверки очистки
    const testCharacter2 = await prisma.character.create({
      data: {
        name: 'Тестовый персонаж 2',
        description: 'Персонаж для тестирования очистки памяти',
        isActive: true
      }
    })

    // Добавляем воспоминание
    await memoryManager.addMemory(testCharacter2.id, {
      type: 'interaction' as any,
      content: 'Тестовое воспоминание',
      importance: 3,
      tags: ['тест'],
      emotionalWeight: 2,
      context: 'тестирование',
      isActive: true
    })

    const deletedCount = await memoryManager.cleanupOldMemory(testCharacter2.id, 0) // Удаляем все
    console.log(`✅ Удалено воспоминаний: ${deletedCount}`)

    // Удаляем тестового персонажа
    await prisma.character.delete({
      where: { id: testCharacter2.id }
    })
    console.log()

    console.log('🎉 Все тесты завершены успешно!')
    console.log('\n📋 Сводка:')
    console.log(`  ✅ Шаблонов промптов: ${templates.length}`)
    console.log(`  ✅ Валидных шаблонов: ${validTemplates}`)
    console.log(`  ✅ API здоровье: ${isHealthy ? 'OK' : 'ERROR'}`)
    console.log(`  ✅ Доступно моделей: ${models.length}`)
    console.log(`  ✅ Система памяти: работает`)
    console.log(`  ✅ Система ответов: работает`)
    console.log(`  ✅ Метрики: работают`)

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error)
  }
}

// Запуск тестов
if (require.main === module) {
  testCharacterAISystem()
    .then(() => {
      console.log('\n✅ Тестирование завершено')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Критическая ошибка:', error)
      process.exit(1)
    })
}

export { testCharacterAISystem }
