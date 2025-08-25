# 🎯 Руководство по системе условий

## Обзор

Система условий представляет собой универсальный механизм для создания сложных логических выражений, которые могут проверять различные аспекты игрового состояния. Система поддерживает условия на активы, игроков, сцены и сюжетные точки.

## 🏗️ Архитектура системы

### Основные компоненты

1. **Типы условий** (`lib/types.ts`)
   - Определяет все типы условий и их интерфейсы
   - Содержит типы для атрибутов активов и игроков

2. **Утилиты условий** (`lib/condition-utils.ts`)
   - `AttributeParser` - извлечение атрибутов из сущностей
   - `ConditionValidator` - валидация условий
   - `ConditionEvaluator` - вычисление условий
   - `ConditionUtils` - вспомогательные функции

3. **Компоненты интерфейса**
   - `EntitySelector` - выбор сущностей
   - `AttributeSelector` - выбор атрибутов
   - `OperatorSelector` - выбор операторов
   - `ValueInput` - ввод значений
   - `ConditionBuilder` - основной построитель условий

## 📋 Типы условий

### 1. Условие на актив (AssetCondition)

Проверяет атрибуты активов (персонажей).

```typescript
interface AssetCondition {
  type: "asset_condition"
  target: {
    entityId: string | "any" | "current" | "owned"
    attribute: AssetAttribute
    operator: Operator
    value: number | string | boolean | string[]
  }
}
```

**Примеры:**
- Актив с интеллектом больше 4
- Принадлежащий актив с навыком обслуживания >= 3
- Любой актив с трейтом "loyal"

### 2. Условие на игрока (PlayerCondition)

Проверяет атрибуты игрока.

```typescript
interface PlayerCondition {
  type: "player_condition"
  target: {
    attribute: PlayerAttribute
    operator: Operator
    value: number | string | boolean | string[]
  }
}
```

**Примеры:**
- Баланс игрока >= 1000
- Количество активов = 5
- Игрок имеет оборудование

### 3. Условие на выбор в сцене (SceneChoiceCondition)

Проверяет состояние выборов в сценах.

```typescript
interface SceneChoiceCondition {
  type: "scene_choice_condition"
  target: {
    sceneId: string
    screenId?: string
    choiceId: string
    status: "completed" | "not_completed" | "selected" | "not_selected"
  }
}
```

### 4. Условие на сюжетную точку (StoryPointCondition)

Проверяет значения сюжетных точек.

```typescript
interface StoryPointCondition {
  type: "story_point_condition"
  target: {
    pointId: string
    operator: Operator
    value: number | string
  }
}
```

### 5. Составное условие (CompoundCondition)

Объединяет несколько условий логическими операторами.

```typescript
interface CompoundCondition {
  type: "compound_condition"
  logic: "AND" | "OR"
  conditions: Condition[]
}
```

## 🔧 Операторы

### Числовые операторы
- `=` - равно
- `!=` - не равно
- `>` - больше
- `<` - меньше
- `>=` - больше или равно
- `<=` - меньше или равно

### Строковые операторы
- `=` - равно
- `!=` - не равно
- `contains` - содержит
- `not_contains` - не содержит

### Булевые операторы
- `=` - равно
- `!=` - не равно

### Операторы для массивов
- `contains` - содержит элемент
- `not_contains` - не содержит элемент
- `in` - элемент входит в массив
- `not_in` - элемент не входит в массив

## 📊 Атрибуты активов

### Основные атрибуты
- `strength` - Сила
- `empathy` - Эмпатия
- `intelligence` - Интеллект
- `temperament` - Темперамент
- `grit` - Стойкость
- `ego` - Эго
- `loyalty` - Лояльность
- `obedience` - Послушание
- `resistance` - Сопротивление

### Навыки
- `maid` - Обслуживание
- `cooking` - Кулинария
- `neural_hacking` - Нейрохакерство
- `orgasm_control` - Контроль оргазма
- `field` - Полевая работа
- `etiquette` - Этикет
- `logistics` - Логистика
- `medical` - Медицина
- `maintenance` - Техобслуживание
- `data` - Работа с данными
- `dance` - Танец
- `seduction` - Соблазнение
- `interrogation` - Допрос
- `surveillance` - Наблюдение

### Состояние
- `health` - Здоровье
- `mental_state` - Психическое состояние
- `stress` - Стресс
- `fatigue` - Усталость

### Метаданные
- `rank` - Ранг
- `price` - Цена
- `status` - Статус
- `location` - Местоположение
- `specialization` - Специализация

### История
- `assignments` - Задания
- `success_rate` - Успешность

### Трейты и предпочтения
- `traits` - Трейты (массив)
- `work_type` - Тип работы (массив)
- `environment` - Окружение (массив)
- `avoid` - Избегает (массив)

## 👤 Атрибуты игрока

### Аккаунт
- `balance` - Баланс
- `currency` - Валюта

### Активы
- `assets_count` - Количество активов
- `owned_assets_count` - Количество принадлежащих активов

### Оборудование
- `equipment_count` - Количество оборудования
- `has_equipment` - Имеет оборудование

### Настройки
- `riskTolerance` - Толерантность к риску
- `theme` - Тема
- `notifications` - Уведомления
- `autoAssign` - Автоназначение

### Метаданные
- `role` - Роль
- `status` - Статус
- `created` - Дата создания
- `lastLogin` - Последний вход

## 🎮 Использование в игре

### Создание условий

```typescript
import { ConditionBuilder } from '@/components/ui/ConditionBuilder'
import { ConditionUtils } from '@/lib/condition-utils'

// Создание простого условия
const condition: AssetCondition = {
  id: ConditionUtils.generateConditionId(),
  type: "asset_condition",
  name: "Высокий интеллект",
  description: "Актив с интеллектом больше 4",
  target: {
    entityId: "any",
    attribute: "intelligence",
    operator: ">",
    value: 4
  }
}
```

### Вычисление условий

```typescript
import { ConditionEvaluator } from '@/lib/condition-utils'

const result = ConditionEvaluator.evaluateCondition(condition, gameState)
console.log(result) // true или false
```

### Валидация условий

```typescript
import { ConditionValidator } from '@/lib/condition-utils'

const isValid = ConditionValidator.validateCondition(condition)
console.log(isValid) // true или false
```

## 🧪 Тестирование

### Запуск тестов

```bash
npm test -- __tests__/lib/condition-utils.test.ts
```

### Тестовая страница

Посетите `/condition-test` для интерактивного тестирования системы условий.

## 📝 Примеры использования

### 1. Система репутации

```typescript
// Условие: игрок с высокой репутацией может получить доступ к элитным активам
const reputationCondition: PlayerCondition = {
  type: "player_condition",
  target: {
    attribute: "reputation",
    operator: ">=",
    value: 50
  }
}
```

### 2. Система специализации

```typescript
// Условие: актив с навыками нейрохакерства для технических заданий
const hackerCondition: AssetCondition = {
  type: "asset_condition",
  target: {
    entityId: "any",
    attribute: "neural_hacking",
    operator: ">=",
    value: 3
  }
}
```

### 3. Система прогрессии

```typescript
// Условие: актив с определенным количеством выполненных заданий
const experienceCondition: AssetCondition = {
  type: "asset_condition",
  target: {
    entityId: "any",
    attribute: "assignments",
    operator: ">=",
    value: 10
  }
}
```

### 4. Составные условия

```typescript
// Условие: элитный актив ИЛИ актив с высокими навыками
const eliteOrSkilledCondition: CompoundCondition = {
  type: "compound_condition",
  logic: "OR",
  conditions: [
    {
      type: "asset_condition",
      target: {
        entityId: "any",
        attribute: "rank",
        operator: "=",
        value: "Elite"
      }
    },
    {
      type: "asset_condition",
      target: {
        entityId: "any",
        attribute: "maid",
        operator: ">=",
        value: 4
      }
    }
  ]
}
```

## 🔄 Интеграция с существующими системами

### StoryPointsManager

Система условий интегрируется с существующим `StoryPointsManager` для создания сложных триггеров сюжетных событий.

### EnhancedEditModal

Может быть использована в модальных окнах редактирования для создания условий доступа к различным функциям.

## 🚀 Расширение системы

### Добавление новых типов условий

1. Определите новый тип в `lib/types.ts`
2. Добавьте валидацию в `ConditionValidator`
3. Добавьте вычисление в `ConditionEvaluator`
4. Создайте компоненты интерфейса

### Добавление новых атрибутов

1. Добавьте атрибут в соответствующий тип
2. Обновите `AttributeParser`
3. Добавьте отображаемое имя в `ConditionUtils`
4. Обновите тесты

## 📚 Дополнительные ресурсы

- [Тестовая страница](/condition-test) - интерактивное тестирование
- [Исходный код утилит](/lib/condition-utils.ts) - полная реализация
- [Тесты](/__tests__/lib/condition-utils.test.ts) - покрытие тестами
- [Компоненты UI](/components/ui/) - интерфейсные компоненты

---

**Система условий предоставляет мощный и гибкий механизм для создания сложной игровой логики, который легко расширяется и поддерживается.**

