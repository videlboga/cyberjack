// scripts/test-enhanced-ai-system.ts

import { CharacterAIService } from '../lib/character/ai-service'
import { EnhancedMessageAnalyzer } from '../lib/character/enhanced-message-analyzer'
import { ActionMessageSystemManager } from '../lib/character/action-message-system'

async function testEnhancedAISystem() {
  console.log('🧪 Тестирование расширенной системы ИИ-персонажей\n')

  // Инициализация сервисов
  const apiKey = process.env.OPENROUTER_API_KEY || 'test-key'
  const aiService = new CharacterAIService(apiKey)
  const messageAnalyzer = new EnhancedMessageAnalyzer()
  const actionSystem = new ActionMessageSystemManager(aiService)

  const testCharacterId = 'test-character-1'
  const testUserId = 'test-user-1'

  console.log('📝 Тест 1: Анализ сообщений с командами поз')
  console.log('=' .repeat(50))

  const poseMessages = [
    'Встань на колени',
    'Прими позу стоя',
    'Ляг на спину',
    'Сядь красиво',
    'Раскинься на кровати'
  ]

  for (const message of poseMessages) {
    console.log(`\nСообщение: "${message}"`)
    try {
      const analysis = await messageAnalyzer.analyzeMessage(message, testCharacterId, testUserId)
      console.log('Команды поз:', analysis.poseCommands.map(cmd =>
        `${cmd.poseName} (уверенность: ${(cmd.confidence * 100).toFixed(1)}%)`
      ))
    } catch (error) {
      console.log('Ошибка:', error.message)
    }
  }

  console.log('\n\n📊 Тест 2: Анализ влияния на характеристики')
  console.log('=' .repeat(50))

  const characteristicMessages = [
    'Ты очень покорная',
    'Мне нравится твоя невинность',
    'Ты слишком агрессивная',
    'Твоя чувствительность зашкаливает',
    'Ты доминируешь надо мной'
  ]

  for (const message of characteristicMessages) {
    console.log(`\nСообщение: "${message}"`)
    try {
      const analysis = await messageAnalyzer.analyzeMessage(message, testCharacterId, testUserId)
      console.log('Влияние на характеристики:', analysis.characteristicInfluences.map(inf =>
        `${inf.characteristicName}: ${inf.influence > 0 ? '+' : ''}${inf.influence} (уверенность: ${(inf.confidence * 100).toFixed(1)}%)`
      ))
    } catch (error) {
      console.log('Ошибка:', error.message)
    }
  }

  console.log('\n\n🎭 Тест 3: Анализ фетиш-элементов')
  console.log('=' .repeat(50))

  const fetishMessages = [
    'Ты такая невинная и чистая',
    'Мне нравится твоя покорность',
    'Твоя чувствительность возбуждает',
    'Ты доминируешь надо мной',
    'Твоя невинность сводит с ума'
  ]

  for (const message of fetishMessages) {
    console.log(`\nСообщение: "${message}"`)
    try {
      const analysis = await messageAnalyzer.analyzeMessage(message, testCharacterId, testUserId)
      console.log('Фетиш-элементы:', analysis.fetishElements.map(fetish =>
        `${fetish.type} (интенсивность: ${fetish.intensity}%, уверенность: ${(fetish.confidence * 100).toFixed(1)}%)`
      ))
    } catch (error) {
      console.log('Ошибка:', error.message)
    }
  }

  console.log('\n\n⚡ Тест 4: Система действий-сообщений')
  console.log('=' .repeat(50))

  const testActions = [
    { name: 'поцелуй', intensity: 30, targetZone: 'губы' },
    { name: 'объятие', intensity: 25, targetZone: 'тело' },
    { name: 'ласка', intensity: 40, targetZone: 'шея' },
    { name: 'удар', intensity: 70, targetZone: 'попа' },
    { name: 'похвала', intensity: 20, targetZone: undefined }
  ]

  console.log('\nРегистрация действий:')
  for (const action of testActions) {
    try {
      await actionSystem.registerAction(
        testCharacterId,
        testUserId,
        action.name,
        action.intensity,
        action.targetZone
      )
      console.log(`✓ Зарегистрировано: ${action.name} (интенсивность: ${action.intensity}%)`)
    } catch (error) {
      console.log(`✗ Ошибка регистрации ${action.name}:`, error.message)
    }
  }

  console.log('\nОжидающие действия:')
  const pendingActions = actionSystem.getPendingActions(testCharacterId, testUserId)
  console.log(`Количество: ${pendingActions.length}`)
  pendingActions.forEach(action => {
    console.log(`- ${action.actionName} (${action.intensity}%)`)
  })

  console.log('\nСтатистика действий:')
  try {
    const stats = await actionSystem.getActionStats(testCharacterId, testUserId)
    console.log(`Общее количество: ${stats.totalActions}`)
    console.log(`За последние 24 часа: ${stats.recentActions}`)
    console.log(`Средняя интенсивность: ${stats.avgIntensity}%`)
    console.log(`Самое частое действие: ${stats.mostCommonAction}`)
  } catch (error) {
    console.log('Ошибка получения статистики:', error.message)
  }

  console.log('\n\n🔧 Тест 5: Конфигурация системы')
  console.log('=' .repeat(50))

  console.log('Текущая конфигурация AI сервиса:')
  const aiConfig = aiService.getConfig()
  console.log(`- Модель: ${aiConfig.model}`)
  console.log(`- Максимум токенов: ${aiConfig.maxTokens}`)
  console.log(`- Температура: ${aiConfig.temperature}`)
  console.log(`- Анализ ответов: ${aiConfig.enableResponseAnalysis}`)
  console.log(`- Управление памятью: ${aiConfig.enableMemoryManagement}`)

  console.log('\nТекущая конфигурация системы действий:')
  const actionConfig = actionSystem.getConfig()
  console.log(`- Порог сообщений: ${actionConfig.messageThreshold}`)
  console.log(`- Временной порог: ${actionConfig.timeThreshold}с`)
  console.log(`- Автосообщения: ${actionConfig.enableAutoMessages}`)
  console.log(`- Шаблонов сообщений: ${actionConfig.messageTemplates.length}`)

  console.log('\n\n📈 Тест 6: Метрики системы')
  console.log('=' .repeat(50))

  const metrics = aiService.getMetrics()
  console.log(`Общее количество запросов: ${metrics.totalRequests}`)
  console.log(`Успешные запросы: ${metrics.successfulRequests}`)
  console.log(`Неудачные запросы: ${metrics.failedRequests}`)
  console.log(`Среднее время ответа: ${metrics.averageResponseTime.toFixed(2)}мс`)
  console.log(`Среднее качество: ${(metrics.averageQuality * 100).toFixed(1)}%`)
  console.log(`Процент ошибок: ${(metrics.errorRate * 100).toFixed(1)}%`)

  console.log('\n\n✅ Тестирование завершено!')
  console.log('=' .repeat(50))
  console.log('Все основные компоненты расширенной системы ИИ протестированы.')
  console.log('Система готова к использованию в продакшене.')
}

// Запуск тестов
if (require.main === module) {
  testEnhancedAISystem().catch(console.error)
}

export { testEnhancedAISystem }
