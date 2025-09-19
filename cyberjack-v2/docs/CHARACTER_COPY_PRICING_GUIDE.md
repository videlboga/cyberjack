# 💰 Система расчета цены копии персонажа

## 🎯 Обзор

Динамическая система расчета цены пользовательской копии персонажа на основе:
- **Характеристик персонажа** - модификаторы цены в зависимости от значений характеристик
- **Знаний пользователя** - бонусы к цене продажи в зависимости от уровня раскрытия характеристик

## 🏗️ Архитектура

### Основные компоненты:
- `lib/core/pricing/character-copy-pricing.ts` - сервис расчета цен
- `src/app/api/characters/[characterId]/copy-price/route.ts` - API endpoint
- Интеграция с `lib/story/screen-based-story-manager.ts` - переменные для сюжетного редактора

## 📊 Алгоритм расчета

### 1. Базовая цена
```typescript
const basePrice = character.price // 500 кредитов по умолчанию
```

### 2. Модификатор характеристик
```typescript
// Анализ каждой характеристики персонажа
characteristics.forEach(char => {
  if (char.currentValue > 90) modifier += 0.2      // +20% за экстремальные значения
  else if (char.currentValue > 70) modifier += 0.1 // +10% за высокие значения
  else if (char.currentValue < 30) modifier -= 0.05 // -5% за низкие значения
})

// Средний модификатор по всем характеристикам
characteristicModifier = totalModifier / characteristicsCount
```

### 3. Бонус за знания
```typescript
const knowledgeRatio = knownCharacteristics / totalCharacteristics

if (knowledgeRatio >= 0.8) bonus = 0.3      // +30% за полное знание
else if (knowledgeRatio >= 0.5) bonus = 0.15 // +15% за частичное знание
else if (knowledgeRatio >= 0.2) bonus = 0.05 // +5% за базовое знание
else bonus = 0                               // 0% за отсутствие знаний
```

### 4. Итоговая цена
```typescript
finalPrice = Math.round(
  basePrice * (1 + characteristicModifier) * (1 + knowledgeBonus)
)
```

## 🔧 API Endpoints

### GET `/api/characters/[characterId]/copy-price?userId=[userId]`
Рассчитывает цену копии персонажа для конкретного пользователя.

**Ответ:**
```json
{
  "basePrice": 500,
  "characteristicModifier": 0.019,
  "knowledgeBonus": 0.0,
  "finalPrice": 509,
  "breakdown": {
    "characteristics": {
      "highValue": 8,
      "lowValue": 4,
      "extremeValue": 1,
      "averageValue": 53.51
    },
    "knowledge": {
      "knownCharacteristics": 0,
      "totalCharacteristics": 37,
      "knowledgeRatio": 0.0,
      "bonusLevel": "none"
    }
  }
}
```

### POST `/api/characters/[characterId]/copy-price`
Рассчитывает цены для нескольких персонажей.

**Тело запроса:**
```json
{
  "userId": "user_id",
  "characterIds": ["char1", "char2", "char3"]
}
```

## 🎮 Интеграция с сюжетным редактором

### Переменные для последствий:

#### `character_copy_price`
Цена копии персонажа по ID копии (для продажи существующих копий).

**Использование в последствиях:**
```json
{
  "type": "sell_character_copy",
  "sellCharacterCopyId": "copy_id",
  "price": "{{character_copy_price}}"
}
```

#### `character_copy_price_by_id`
Цена копии персонажа по ID персонажа (для покупки новых копий).

**Использование в последствиях:**
```json
{
  "type": "buy_character_copy",
  "characterId": "character_id",
  "price": "{{character_copy_price_by_id}}"
}
```

## ⚙️ Конфигурация

### Настройка модификаторов характеристик:
```typescript
const config = {
  characteristicModifiers: {
    highValue: 0.1,      // +10% за характеристики > 70
    lowValue: -0.05,     // -5% за характеристики < 30
    extremeValue: 0.2    // +20% за характеристики > 90
  }
}
```

### Настройка бонусов за знания:
```typescript
const config = {
  knowledgeBonuses: {
    full: 0.3,           // +30% за полное знание (>80%)
    partial: 0.15,       // +15% за частичное знание (50-80%)
    basic: 0.05,         // +5% за базовое знание (20-50%)
    none: 0              // 0% за отсутствие знаний (<20%)
  }
}
```

## 📈 Примеры расчета

### Персонаж с высокими характеристиками:
- Базовая цена: 500 кредитов
- 8 характеристик > 70: +8 × 10% = +80%
- 1 характеристика > 90: +1 × 20% = +20%
- Средний модификатор: (80% + 20%) / 37 = +2.7%
- **Итоговая цена: 513 кредитов**

### Персонаж с частичным знанием (78% характеристик):
- Базовая цена: 500 кредитов
- Модификатор характеристик: +1.9%
- Бонус за знания: +15%
- **Итоговая цена: 586 кредитов**
- **Экономический эффект: +77 кредитов (+15.1%)**

### Персонаж с низкими характеристиками:
- Базовая цена: 500 кредитов
- 4 характеристики < 30: -4 × 5% = -20%
- Средний модификатор: -20% / 37 = -0.5%
- **Итоговая цена: 497 кредитов**

## 🧪 Тестирование

Запуск тестового скрипта:
```bash
node test-character-copy-pricing.js
```

Тест проверяет:
- Расчет цены для разных пользователей
- Влияние характеристик на цену
- Влияние знаний пользователя на скидку
- API endpoints
- Интеграцию с базой данных

## 🔄 Обновление конфигурации

```typescript
import { characterCopyPricingService } from '@/lib/core/pricing/character-copy-pricing'

// Обновить конфигурацию
characterCopyPricingService.updateConfig({
  characteristicModifiers: {
    highValue: 0.15,     // Увеличить до +15%
    lowValue: -0.1,      // Увеличить до -10%
    extremeValue: 0.25   // Увеличить до +25%
  }
})
```

## 🎯 Преимущества системы

1. **Динамичность** - цена меняется в зависимости от состояния персонажа
2. **Справедливость** - пользователи с большими знаниями получают бонусы к цене продажи
3. **Гибкость** - легко настраиваемые параметры
4. **Интеграция** - работает с существующим сюжетным редактором
5. **Прозрачность** - детальная разбивка расчета цены

## 🚀 Будущие улучшения

- Добавление экономических факторов (популярность, редкость)
- Учет покупательной способности пользователя
- Система лояльности и постоянных клиентов
- Аналитика цен и трендов
- A/B тестирование различных алгоритмов ценообразования
