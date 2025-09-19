# 🤖 Система Character AI - Руководство разработчика

## 📋 Обзор

Система Character AI представляет собой комплексное решение для создания интеллектуальных персонажей в игре CyberJack v2.0. Система состоит из четырех основных модулей:

1. **PromptSystem** - Управление шаблонами промптов
2. **MemoryManager** - Управление памятью персонажей
3. **ResponseManager** - Обработка и анализ ответов ИИ
4. **CharacterAIService** - Основной сервис, объединяющий все модули

## 🏗️ Архитектура

```
CharacterAIService
├── PromptSystem (управление шаблонами)
├── MemoryManager (управление памятью)
├── ResponseManager (обработка ответов)
└── Configuration (настройки)
```

## 📁 Структура файлов

```
lib/character/
├── ai-service.ts          # Основной сервис
├── prompt-system.ts       # Система промптов
├── memory-manager.ts      # Управление памятью
└── response-manager.ts    # Обработка ответов

types/
└── character-ai.ts        # Типы и интерфейсы
```

## 🚀 Быстрый старт

### Инициализация

```typescript
import { CharacterAIService } from '@/lib/character/ai-service'

const aiService = new CharacterAIService(
  process.env.OPENROUTER_API_KEY,
  'https://openrouter.ai/api/v1',
  'z-ai/glm-4.5',
  'google/gemini-2.5-flash-lite'
)
```

### Генерация ответа

```typescript
const response = await aiService.generateResponse(
  characterId,
  userMessage,
  {
    userId: 'user123',
    // дополнительные параметры контекста
  }
)

console.log(response.message) // Ответ персонажа
console.log(response.metadata) // Метаданные ответа
```

## 📝 Система промптов

### Шаблоны промптов

Система использует модульные шаблоны для построения промптов:

```typescript
const promptSystem = new PromptSystem()

// Получить все шаблоны
const templates = promptSystem.getAllTemplates()

// Получить шаблоны по категории
const characterTemplates = promptSystem.getTemplatesByCategory(
  PromptCategory.CHARACTER_DESCRIPTION
)
```

### Категории шаблонов

- `CHARACTER_DESCRIPTION` - Описание персонажа
- `CHARACTERISTICS` - Характеристики
- `MEMORY` - Память и воспоминания
- `CONTEXT` - Контекст ситуации
- `RESPONSE_STYLE` - Стиль ответа
- `EMOTION` - Эмоциональное состояние
- `SITUATION` - Текущая ситуация
- `INTERACTION` - Взаимодействие

### Переменные в шаблонах

```typescript
// Пример шаблона с переменными
const template = {
  id: 'character-description',
  template: `Ты - {{characterName}}, {{characterDescription}}`,
  variables: [
    {
      name: 'characterName',
      type: PromptVariableType.STRING,
      required: true,
      description: 'Имя персонажа'
    }
  ]
}
```

### Условные блоки и циклы

```typescript
// Условный блок
{{#if currentPose}}
Твоя текущая поза: {{currentPose.name}}
{{/if}}

// Цикл
{{#each characteristics}}
- {{name}}: {{currentValue}}/100
{{/each}}
```

## 🧠 Система памяти

### Типы воспоминаний

- `INTERACTION` - Взаимодействия с пользователем
- `EMOTION` - Эмоциональные переживания
- `ACTION` - Выполненные действия
- `CHARACTERISTIC_CHANGE` - Изменения характеристик
- `POSE_CHANGE` - Изменения поз
- `USER_PREFERENCE` - Предпочтения пользователя
- `ENVIRONMENT` - Окружение
- `RELATIONSHIP` - Отношения

### Управление памятью

```typescript
const memoryManager = new CharacterMemoryManager()

// Добавить воспоминание
const memory = await memoryManager.addMemory(characterId, {
  type: MemoryType.INTERACTION,
  content: 'Пользователь поздоровался',
  importance: 5,
  tags: ['приветствие'],
  emotionalWeight: 3,
  context: 'первое знакомство',
  isActive: true
})

// Получить воспоминания
const memories = await memoryManager.getMemory(characterId, MemoryType.INTERACTION)

// Получить контекстуальные воспоминания
const contextualMemories = await memoryManager.getContextualMemory(
  characterId,
  'приветствие'
)
```

### Классификация памяти

- **Краткосрочная** - до 24 часов
- **Долгосрочная** - более 7 дней
- **Контекстуальная** - связанная с текущей ситуацией
- **Эмоциональная** - с высоким эмоциональным весом
- **Недавняя** - до 1 часа

## 💬 Система ответов

### Анализ ответов

```typescript
const responseManager = new CharacterResponseManager()

const analysis = await responseManager.analyzeResponse(response, context)
console.log(analysis.emotion) // Эмоция
console.log(analysis.quality) // Качество (0-1)
console.log(analysis.confidence) // Уверенность (0-1)
```

### Валидация ответов

```typescript
const validation = await responseManager.validateResponse(response, context)
if (!validation.isValid) {
  console.log('Ошибки:', validation.errors)
  console.log('Предупреждения:', validation.warnings)
}
```

### Улучшение ответов

```typescript
const enhancedResponse = await responseManager.enhanceResponse(response, context)
```

## ⚙️ Конфигурация

### Настройки AI сервиса

```typescript
const config = {
  model: 'z-ai/glm-4.5',
  model2: 'google/gemini-2.5-flash-lite',
  maxTokens: 500,
  temperature: 0.8,
  topP: 0.9,
  frequencyPenalty: 0.1,
  presencePenalty: 0.1,
  maxMemoryItems: 1000,
  memoryRetentionDays: 30,
  responseQualityThreshold: 0.6,
  enableResponseAnalysis: true,
  enableMemoryManagement: true,
  enablePromptOptimization: true
}

aiService.updateConfig(config)
```

## 📊 Метрики и мониторинг

### Получение метрик

```typescript
const metrics = aiService.getMetrics()
console.log(`Всего запросов: ${metrics.totalRequests}`)
console.log(`Успешных: ${metrics.successfulRequests}`)
console.log(`Ошибок: ${metrics.failedRequests}`)
console.log(`Среднее время ответа: ${metrics.averageResponseTime}ms`)
console.log(`Среднее качество: ${metrics.averageQuality}`)
console.log(`Процент ошибок: ${(metrics.errorRate * 100).toFixed(2)}%`)
```

### Сброс метрик

```typescript
aiService.resetMetrics()
```

## 🔧 API методы

### CharacterAIService

```typescript
// Основные методы
generateResponse(characterId, userMessage, context): Promise<AIResponse>
analyzeMessage(userMessage): Promise<MessageAnalysis>
getCharacterContext(characterId, userId): Promise<PromptContext>
getCharacterMemory(characterId, type?): Promise<MemoryItem[]>
addCharacterMemory(characterId, memory): Promise<MemoryItem>
updateCharacterPrompts(characterId, prompts): Promise<void>
getCharacterPrompts(characterId): Promise<Record<string, any>>

// Утилиты
checkApiHealth(): Promise<boolean>
getAvailableModels(): Promise<string[]>
setModel(modelId): void
getCurrentModel(): string
getRequestCost(prompt): Promise<number>
getMetrics(): CharacterAIMetrics
resetMetrics(): void
getConfig(): CharacterAIConfig
updateConfig(newConfig): void
```

### PromptSystem

```typescript
buildPrompt(context): Promise<string>
addTemplate(template): void
removeTemplate(templateId): void
updateTemplate(templateId, updates): void
getTemplate(templateId): PromptTemplate | null
getTemplatesByCategory(category): PromptTemplate[]
getAllTemplates(): PromptTemplate[]
validateTemplate(template): ValidationResult
optimizePrompt(prompt, maxTokens): string
getPromptStats(prompt): PromptStats
```

### MemoryManager

```typescript
addMemory(characterId, memory): Promise<MemoryItem>
getMemory(characterId, type?, limit?): Promise<MemoryItem[]>
updateMemory(memoryId, updates): Promise<MemoryItem>
deleteMemory(memoryId): Promise<void>
getContextualMemory(characterId, context): Promise<MemoryItem[]>
getEmotionalMemory(characterId, emotion): Promise<MemoryItem[]>
cleanupOldMemory(characterId, daysOld?): Promise<number>
getMemoryStats(characterId): Promise<MemoryStats>
getMemoryContext(characterId): Promise<MemoryContext>
createInteractionMemory(characterId, userMessage, aiResponse, context): Promise<MemoryItem>
createEmotionalMemory(characterId, emotion, trigger, intensity): Promise<MemoryItem>
createCharacteristicChangeMemory(characterId, characteristicName, oldValue, newValue, reason): Promise<MemoryItem>
```

### ResponseManager

```typescript
generateResponse(characterId, userMessage, context): Promise<AIResponse>
analyzeResponse(response, context): Promise<ResponseAnalysis>
validateResponse(response, context): Promise<ValidationResult>
enhanceResponse(response, context): Promise<string>
getResponseQuality(response, context): Promise<number>
```

## 🧪 Тестирование

### Запуск тестов

```bash
# Запуск тестов системы Character AI
npx tsx scripts/test-character-ai-system.ts
```

### Тестовые сценарии

1. **Система промптов** - проверка шаблонов и валидации
2. **Система памяти** - добавление и получение воспоминаний
3. **Система ответов** - анализ и валидация ответов
4. **API здоровье** - проверка доступности OpenRouter
5. **Конфигурация** - проверка настроек
6. **Метрики** - проверка сбора статистики

## 🚨 Обработка ошибок

### Типы ошибок

- **API ошибки** - проблемы с OpenRouter API
- **Валидация** - некорректные данные
- **Память** - проблемы с хранением воспоминаний
- **Промпты** - ошибки в шаблонах
- **Контекст** - отсутствие необходимых данных

### Fallback стратегии

```typescript
try {
  const response = await aiService.generateResponse(characterId, message, context)
  return response
} catch (error) {
  console.error('Ошибка генерации ответа:', error)

  // Fallback ответ
  return {
    message: 'Извините, произошла ошибка при генерации ответа.',
    characterId,
    timestamp: new Date(),
    metadata: {
      emotion: 'neutral',
      intent: 'error',
      quality: 0.1,
      confidence: 0.1
    }
  }
}
```

## 🔄 Интеграция с игровыми системами

### Связь с характеристиками

```typescript
// Получение характеристик для контекста
const characteristics = await prisma.characteristic.findMany({
  where: { characterId },
  include: { definition: true }
})
```

### Связь с позами

```typescript
// Получение текущей позы
const currentPose = await prisma.characterPose.findFirst({
  where: { characterId, isActive: true },
  include: { angles: { include: { activeZones: true } } }
})
```

### Связь с действиями

```typescript
// Создание воспоминания об изменении характеристики
await memoryManager.createCharacteristicChangeMemory(
  characterId,
  'чувствительность',
  50,
  60,
  'действие "ласка"'
)
```

## 📈 Производительность

### Оптимизация

- **Кэширование** - кэширование промптов и контекста
- **Ленивая загрузка** - загрузка данных по требованию
- **Батчинг** - группировка запросов к API
- **Сжатие** - оптимизация промптов

### Мониторинг

- **Время ответа** - отслеживание производительности
- **Использование токенов** - контроль расходов
- **Качество ответов** - оценка релевантности
- **Ошибки** - мониторинг сбоев

## 🔐 Безопасность

### Валидация входных данных

```typescript
// Проверка на недопустимый контент
const inappropriateWords = ['игра', 'ии', 'бот', 'программа']
const hasInappropriateContent = inappropriateWords.some(word =>
  message.toLowerCase().includes(word)
)
```

### Ограничения

- **Длина промптов** - ограничение на максимальную длину
- **Количество воспоминаний** - лимит на хранение
- **Частота запросов** - rate limiting
- **Размер ответов** - ограничение на длину ответов

## 🎯 Лучшие практики

### Разработка

1. **Модульность** - разделение ответственности между модулями
2. **Типизация** - использование TypeScript для безопасности типов
3. **Обработка ошибок** - graceful degradation
4. **Тестирование** - покрытие тестами всех компонентов
5. **Документация** - подробная документация API

### Использование

1. **Контекст** - всегда передавайте полный контекст
2. **Память** - регулярно очищайте старые воспоминания
3. **Мониторинг** - отслеживайте метрики и качество
4. **Оптимизация** - используйте оптимизацию промптов
5. **Fallback** - предусматривайте резервные варианты

## 🔮 Планы развития

### Ближайшие улучшения

- [ ] Интеграция с Redis для кэширования
- [ ] Система A/B тестирования промптов
- [ ] Автоматическая оптимизация шаблонов
- [ ] Расширенная аналитика ответов
- [ ] Поддержка множественных моделей

### Долгосрочные цели

- [ ] Машинное обучение для улучшения промптов
- [ ] Персонализация под пользователей
- [ ] Многоязычная поддержка
- [ ] Интеграция с внешними API
- [ ] Система рекомендаций

---

**Версия документации:** 1.0
**Дата обновления:** 2024
**Автор:** CyberJack Development Team
