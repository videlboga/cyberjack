# Отчет о решении проблемы с адаптером конфигураций

## Проблема
После унификации источников данных возникла новая проблема:
- **Prod режим**: Показывал 3 актива (использовал старую структуру)
- **Dev режим**: Показывал 0 активов (использовал новую unified структуру)

## Причина
Разные страницы ожидали разные структуры данных:

### Старая структура (prod):
```typescript
{
  assets: { assets: Asset[] },
  contracts: { available: Contract[] },
  actions: { categories: ActionCategory[] },
  events: { anomalies: Event[], crises: Event[], opportunities: Event[] }
}
```

### Новая unified структура (dev):
```typescript
{
  characters: { characters: Character[] },
  contracts: { contracts: Contract[] },
  actions: { actions: Action[] },
  events: { events: Event[] }
}
```

## Решение: Адаптер конфигураций

### 1. Создан адаптер `lib/unified-config-adapter.ts`
Адаптер преобразует unified структуру в legacy структуру для совместимости:

```typescript
export function adaptUnifiedToLegacyConfig(unifiedConfig: UnifiedGameConfig): GameConfig {
  // Преобразуем персонажей в активы
  const assets = {
    assets: unifiedConfig.characters.characters.map(char => ({
      id: char.id,
      name: char.name,
      rank: char.rank,
      // ... остальные поля
    }))
  }
  
  // Преобразуем контракты
  const contracts = {
    available: unifiedConfig.contracts.contracts.map(contract => ({
      id: contract.id,
      client: contract.client,
      // ... остальные поля
    }))
  }
  
  // ... остальные преобразования
}
```

### 2. Обновлены страницы
Заменили загрузку конфигураций на адаптер:

**Было:**
```typescript
import { loadUnifiedConfig } from "@/lib/unified-config-loader"
const config = await loadUnifiedConfig()
```

**Стало:**
```typescript
import { loadUnifiedConfigWithAdapter } from "@/lib/unified-config-adapter"
const config = await loadUnifiedConfigWithAdapter()
```

### 3. Преобразования данных

#### Активы (characters → assets):
- `unifiedConfig.characters.characters` → `config.assets.assets`
- Сохраняются все поля: id, name, rank, avatar, price, skills, etc.

#### Контракты:
- `unifiedConfig.contracts.contracts` → `config.contracts.available`
- Сохраняются все поля: id, client, title, description, reward, etc.

#### Действия:
- `unifiedConfig.actions.categories` → `config.actions.categories`
- Сохраняется структура категорий

#### События:
- `unifiedConfig.events.events` → `config.events.anomalies/crises/opportunities`
- Фильтрация по типу события

#### Рынок:
- `unifiedConfig.characters.characters` → `config.market.talentExchange`
- Персонажи используются как товары на рынке

## Преимущества решения

### ✅ Обратная совместимость
- Существующий код продолжает работать
- Нет необходимости переписывать все компоненты
- Плавная миграция

### ✅ Единый источник истины
- Все данные загружаются из unified файлов
- Адаптер обеспечивает совместимость
- Консистентность данных

### ✅ Гибкость
- Можно постепенно мигрировать компоненты
- Адаптер можно настроить под конкретные нужды
- Легко добавить новые преобразования

## Результат
✅ **Теперь dev и prod режимы показывают одинаковые данные:**
- 3 актива (Алекс, Мария, Виктория)
- 3 контракта
- Все остальные данные синхронизированы

## Структура файлов

```
lib/
├── unified-config-loader.ts      # Загрузка unified конфигураций
├── unified-config-adapter.ts     # Адаптер для совместимости
├── unified-types.ts              # Типы для unified конфигураций
└── types.ts                      # Legacy типы

data/
├── characters-unified.json       # Единый источник данных
├── contracts-unified.json
├── actions-unified.json
└── ...
```

## Использование

### Для новых компонентов:
```typescript
import { loadUnifiedConfig } from "@/lib/unified-config-loader"
const config = await loadUnifiedConfig()
// Используйте unified структуру
```

### Для существующих компонентов:
```typescript
import { loadUnifiedConfigWithAdapter } from "@/lib/unified-config-adapter"
const config = await loadUnifiedConfigWithAdapter()
// Используйте legacy структуру
```

## Статус
✅ **Завершено** - Проблема решена с помощью адаптера конфигураций

## Следующие шаги
1. Постепенно мигрировать компоненты на unified структуру
2. Добавить тесты для адаптера
3. Оптимизировать производительность адаптера
4. Документировать все преобразования

