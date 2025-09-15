# 🏗️ Конструкторы промптов - Руководство разработчика

## 📋 Обзор

Конструкторы промптов - это продвинутая система для динамического создания промптов на основе текущего состояния персонажа, его характеристик, поз и активных зон. Система автоматически анализирует игровое состояние и генерирует контекстные промпты для более точных и релевантных ответов ИИ.

## 🏗️ Архитектура

```
PromptConstructors
├── buildCharacteristicBasedPrompt() - Промпты на основе характеристик
├── buildPoseBasedPrompt() - Промпты на основе поз
├── buildCombinedPrompt() - Комбинированные промпты
└── Анализ и генерация
    ├── analyzeCharacteristics() - Анализ характеристик
    ├── analyzePose() - Анализ позы и активных зон
    └── generateTemplates() - Генерация шаблонов
```

## 🚀 Быстрый старт

### Инициализация

```typescript
import { PromptSystem } from '@/lib/character/prompt-system'
import { PromptConstructors } from '@/lib/character/prompt-constructors'

const promptSystem = new PromptSystem()
const constructors = promptSystem.getConstructors()
```

### Создание промптов

```typescript
// Промпт на основе характеристик
const charPrompt = await constructors.buildCharacteristicBasedPrompt(
  characterId,
  'high' // контекст: high, low, extreme, normal
)

// Промпт на основе позы
const posePrompt = await constructors.buildPoseBasedPrompt(characterId)

// Комбинированный промпт
const combinedPrompt = await constructors.buildCombinedPrompt(
  characterId,
  'interaction' // контекст: interaction, action, emotion, general
)
```

## 📊 Конструктор промптов на основе характеристик

### Анализ характеристик

Система автоматически анализирует характеристики персонажа:

```typescript
const analysis = {
  dominant: [],      // Характеристики >= 80
  extreme: [],       // Характеристики >= 90 или <= 10
  low: [],          // Характеристики <= 30
  categories: {},   // Группировка по категориям
  overall: {        // Общая статистика
    average: 0,     // Среднее значение
    range: 0,       // Разброс значений
    volatility: 0   // Волатильность
  }
}
```

### Контексты характеристик

- **`high`** - Высокие значения (>= 80)
- **`low`** - Низкие значения (<= 30)
- **`extreme`** - Экстремальные значения (>= 90 или <= 10)
- **`normal`** - Нормальные значения (30-80)

### Примеры промптов

#### Высокие характеристики
```
Твои характеристики влияют на твое поведение:

Доминирующие черты (высокие значения):
- чувствительность: 85/100 - очень чувствителен к прикосновениям
- покорность: 80/100 - склонен к подчинению

Общее состояние: очень возбужден и активен

Твои высокие характеристики делают тебя очень отзывчивым.
Реагируй интенсивно и эмоционально.
```

#### Низкие характеристики
```
Твои характеристики влияют на твое поведение:

Слабые стороны:
- невинность: 20/100 - опытен и знающ

Общее состояние: очень спокоен или подавлен

Твои низкие характеристики делают тебя более сдержанным.
Реагируй спокойно и размеренно.
```

## 🕺 Конструктор промптов на основе поз

### Анализ позы

Система анализирует позу и активные зоны:

```typescript
const analysis = {
  pose: pose,                    // Данные позы
  activeZones: [],              // Активные зоны
  sensitiveAreas: [],           // Чувствительные области
  exposedAreas: [],             // Открытые области
  dominantAnatomy: [],          // Доминирующая анатомия
  poseType: 'intimate',         // Тип позы
  intensity: 8                  // Интенсивность (0-10)
}
```

### Типы поз

- **`intimate`** - Интимная и близкая (много чувствительных зон)
- **`exposed`** - Открытая и уязвимая (много открытых зон)
- **`restrained`** - Ограниченная и подчиненная
- **`neutral`** - Нейтральная и естественная

### Примеры промптов

#### Интимная поза
```
Твоя текущая поза: сидячая поза
Категория: intimate
Описание: Интимная сидячая поза

Тип позы: интимная и близкая
Интенсивность: 8/10

Активные зоны:
- центр груди (грудь)
- внутренняя поверхность бедер

Чувствительные области:
- центр груди - требует особого внимания
- внутренняя поверхность бедер - требует особого внимания

Будь особенно внимателен к чувствам и реакциям.
Проявляй нежность и заботу.
```

#### Ограниченная поза
```
Твоя текущая поза: связанная поза
Категория: restrained
Описание: Поза с ограничениями

Тип позы: ограниченная и подчиненная
Интенсивность: 7/10

Ощущай ограничения, но не сопротивляйся.
Принимай подчиненную роль.
```

## 🔄 Комбинированный конструктор

### Контексты взаимодействия

- **`interaction`** - Общее взаимодействие
- **`action`** - Реакция на действия
- **`emotion`** - Эмоциональные реакции
- **`general`** - Общее поведение

### Пример комбинированного промпта

```
Твое текущее состояние:

Характеристики:
- Доминирующие: чувствительность, покорность
- Общее состояние: возбужден и отзывчив

Поза: сидячая поза (intimate, интенсивность 8/10)
- Чувствительные области: центр груди, внутренняя поверхность бедер

Взаимодействуй естественно, учитывая свои характеристики и текущую позу.
```

## 🎯 Интеграция с основной системой

### Автоматическое создание промптов

```typescript
// В CharacterAIService
const fullContext = await this.getCharacterContextWithDynamicPrompts(characterId, userId)

// Автоматически создаются:
// 1. Промпт на основе характеристик (с учетом среднего значения)
// 2. Промпт на основе текущей позы
// 3. Комбинированный промпт для взаимодействия
```

### Ручное управление

```typescript
// Создание конкретного промпта
const prompt = await promptSystem.createCharacteristicPrompt(characterId, 'high')

// Получение всех динамических промптов
const dynamicPrompts = await promptSystem.getDynamicPrompts(characterId)

// Обновление промптов
const refreshedPrompts = await promptSystem.refreshDynamicPrompts(characterId)
```

## 📝 Структура генерируемых промптов

### Шаблон характеристик

```typescript
{
  id: 'characteristic-normal-{timestamp}',
  name: 'Промпт на основе характеристик (normal)',
  category: 'characteristics',
  template: `
    Твои характеристики влияют на твое поведение:

    {{#if dominant.length}}
    Доминирующие черты (высокие значения):
    {{#each dominant}}
    - {{definition.name}}: {{currentValue}}/100 - {{description}}
    {{/each}}
    {{/if}}

    {{#if extreme.length}}
    Экстремальные состояния:
    {{#each extreme}}
    - {{definition.name}}: {{currentValue}}/100 - {{description}}
    {{/each}}
    {{/if}}

    Общее состояние: {{overallDescription}}

    {{contextualInstructions}}
  `,
  variables: [
    { name: 'dominant', type: 'array', required: false },
    { name: 'extreme', type: 'array', required: false },
    { name: 'overall', type: 'object', required: false }
  ]
}
```

### Шаблон позы

```typescript
{
  id: 'pose-intimate-{timestamp}',
  name: 'Промпт на основе позы (intimate)',
  category: 'situation',
  template: `
    Твоя текущая поза: {{pose.definition.name}}
    Категория: {{pose.definition.category}}
    {{#if pose.definition.description}}
    Описание: {{pose.definition.description}}
    {{/if}}

    Тип позы: {{poseTypeDescription}}
    Интенсивность: {{intensity}}/10

    {{#if activeZones.length}}
    Активные зоны:
    {{#each activeZones}}
    - {{name}}{{#if anatomy}} ({{anatomy.name}}){{/if}}
    {{/each}}
    {{/if}}

    {{poseBehaviorInstructions}}
  `,
  variables: [
    { name: 'pose', type: 'object', required: true },
    { name: 'activeZones', type: 'array', required: false },
    { name: 'poseType', type: 'string', required: false }
  ]
}
```

## 🔧 API методы

### PromptConstructors

```typescript
// Основные методы
buildCharacteristicBasedPrompt(characterId, context): Promise<PromptTemplate>
buildPoseBasedPrompt(characterId, poseId?): Promise<PromptTemplate>
buildCombinedPrompt(characterId, context): Promise<PromptTemplate>

// Вспомогательные методы
addDynamicPrompt(characterId, type, context?): Promise<PromptTemplate>
getDynamicPrompts(characterId): Promise<PromptTemplate[]>
refreshDynamicPrompts(characterId): Promise<PromptTemplate[]>
```

### PromptSystem (расширенные методы)

```typescript
// Создание динамических промптов
createCharacteristicPrompt(characterId, context): Promise<PromptTemplate>
createPosePrompt(characterId, poseId?): Promise<PromptTemplate>
createCombinedPrompt(characterId, context): Promise<PromptTemplate>

// Управление динамическими промптами
getDynamicPrompts(characterId): Promise<PromptTemplate[]>
refreshDynamicPrompts(characterId): Promise<PromptTemplate[]>

// Построение с динамическими промптами
buildDynamicPrompt(characterId, context, includeDynamic): Promise<string>

// Получение конструкторов
getConstructors(): PromptConstructors
```

## 🧪 Тестирование

### Запуск тестов

```bash
npx tsx scripts/test-prompt-constructors.ts
```

### Тестовые сценарии

1. **Создание тестового персонажа** с характеристиками и позой
2. **Конструктор характеристик** - анализ и генерация промптов
3. **Конструктор поз** - анализ позы и активных зон
4. **Комбинированный конструктор** - объединение характеристик и позы
5. **Интеграция с системой** - добавление в PromptSystem
6. **Валидация промптов** - проверка корректности
7. **Построение промптов** - генерация финального промпта

### Результаты тестирования

```
✅ Конструктор характеристик: работает
✅ Конструктор поз: работает
✅ Комбинированный конструктор: работает
✅ Динамические промпты: 3 создано
✅ Валидация: 3/3 промптов валидны
✅ Построение промптов: работает
```

## 🎨 Кастомизация

### Добавление новых типов анализа

```typescript
// В PromptConstructors
private analyzeCustomAspect(data: any) {
  // Ваша логика анализа
  return {
    // Результаты анализа
  }
}

private generateCustomPrompt(analysis: any): PromptTemplate {
  // Генерация промпта на основе анализа
  return {
    id: `custom-${Date.now()}`,
    name: 'Кастомный промпт',
    category: PromptCategory.CUSTOM,
    template: 'Ваш шаблон',
    variables: []
  }
}
```

### Добавление новых контекстов

```typescript
// Расширение типов контекста
type ExtendedContext = 'interaction' | 'action' | 'emotion' | 'general' | 'custom'

// Добавление обработки в getCombinedContextualInstructions
private getCombinedContextualInstructions(context: ExtendedContext, ...) {
  const instructions = {
    // ... существующие
    custom: 'Ваши кастомные инструкции'
  }
  return instructions[context] || 'Реагируй естественно.'
}
```

## 📈 Производительность

### Оптимизация

- **Кэширование анализа** - результаты анализа кэшируются
- **Ленивая генерация** - промпты создаются только при необходимости
- **Батчинг запросов** - группировка запросов к БД
- **Валидация** - проверка корректности перед созданием

### Мониторинг

- **Время генерации** - отслеживание производительности
- **Количество промптов** - контроль объема
- **Качество анализа** - оценка точности анализа
- **Использование памяти** - контроль ресурсов

## 🔮 Планы развития

### Ближайшие улучшения

- [ ] **Кэширование анализа** - Redis для кэширования результатов
- [ ] **A/B тестирование** - сравнение эффективности промптов
- [ ] **Машинное обучение** - улучшение анализа на основе данных
- [ ] **Персонализация** - адаптация под пользователей

### Долгосрочные цели

- [ ] **Автоматическая оптимизация** - самообучающиеся промпты
- [ ] **Многоязычная поддержка** - промпты на разных языках
- [ ] **Интеграция с внешними API** - дополнительные источники данных
- [ ] **Система рекомендаций** - предложение оптимальных промптов

## 🎯 Лучшие практики

### Разработка

1. **Модульность** - разделение логики анализа и генерации
2. **Типизация** - строгие типы для всех компонентов
3. **Валидация** - проверка данных на каждом этапе
4. **Тестирование** - покрытие всех сценариев
5. **Документация** - подробные комментарии

### Использование

1. **Контекст** - всегда передавайте актуальный контекст
2. **Кэширование** - используйте кэширование для производительности
3. **Мониторинг** - отслеживайте качество генерируемых промптов
4. **Оптимизация** - регулярно обновляйте промпты
5. **Тестирование** - проверяйте эффективность промптов

---

**Версия документации:** 1.0
**Дата обновления:** 2024
**Автор:** CyberJack Development Team
