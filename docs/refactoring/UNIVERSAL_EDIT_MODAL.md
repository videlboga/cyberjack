# Универсальная система редактирования

## Обзор

Создана полностью динамическая и универсальная система редактирования сущностей, которая автоматически генерирует поля на основе типа сущности. Система поддерживает все типы данных из проекта и легко расширяется для новых типов.

## Архитектура

### Основные компоненты

1. **EnhancedEditModal** (`app/game/components/ui/EnhancedEditModal.tsx`)
   - Основной компонент модального окна редактирования
   - Динамически рендерит поля на основе конфигурации
   - Поддерживает вкладки для разделения основных и дополнительных полей

2. **Field Configs** (`lib/field-configs.ts`)
   - Централизованная система конфигурации полей
   - Определяет структуру полей для каждого типа сущности
   - Легко расширяется для новых типов

### Поддерживаемые типы полей

- **text** - Текстовое поле
- **textarea** - Многострочное текстовое поле
- **number** - Числовое поле с валидацией
- **select** - Выпадающий список
- **slider** - Ползунок для числовых значений
- **switch** - Переключатель (boolean)
- **object** - JSON объект (ручной ввод)
- **array** - JSON массив (ручной ввод)
- **dynamic-object** - Динамический объект с предопределенными ключами
- **dynamic-array** - Динамический массив с предопределенными значениями

### Динамические типы данных

#### dynamic-object
Используется для сложных объектов с предопределенными ключами:
- **attributes** - Атрибуты персонажей (strength, empathy, intelligence и т.д.)
- **skills** - Навыки (maid, cooking, neural_hacking и т.д.)
- **effects** - Эффекты (влияние на характеристики)
- **states** - Состояния (mood, stress, engagement и т.д.)
- **preferences** - Предпочтения (work_type, environment и т.д.)
- **condition** - Состояние здоровья (health, mental_state и т.д.)
- **history** - История (created, last_training и т.д.)

#### dynamic-array
Используется для массивов с предопределенными значениями:
- **traits** - Черты характера
- **modes** - Режимы работы оборудования
- **characters** - Персонажи в сценах
- **choices** - Варианты выбора

## Поддерживаемые типы сущностей

### 1. Assets (Активы)
- Основные поля: id, name, description, rank, price, specialization, avatar, status, location, owner
- Динамические объекты: attributes, skills, preferences, condition, history
- Динамические массивы: traits

### 2. Actions (Действия)
- Основные поля: title, description, cost, risk
- Динамические объекты: effects, riskEffects

### 3. Equipment (Оборудование)
- Основные поля: id, name, description, type, slot, removable
- Динамические объекты: effects, powerSettings
- Динамические массивы: modes, progressiveEffects

### 4. Users (Пользователи)
- Основные поля: id, username, email, role, status

### 5. Events (События)
- Основные поля: id, title, description, probability, duration
- Динамические объекты: effects

### 6. Contracts (Контракты)
- Основные поля: id, title, description, client, reward, deadline, difficulty

### 7. Scenes (Сцены)
- Основные поля: id, title, description, type
- Динамические массивы: characters, choices

## Использование

### Базовое использование

```tsx
import { EnhancedEditModal } from '@/app/game/components/ui/EnhancedEditModal'

const [isModalOpen, setIsModalOpen] = useState(false)
const [entityData, setEntityData] = useState(null)

const handleSave = (data: any) => {
  // Сохранение данных
  console.log('Сохраненные данные:', data)
}

<EnhancedEditModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onSave={handleSave}
  entityType="assets"
  initialData={entityData}
  isNew={false}
/>
```

### Создание новой сущности

```tsx
<EnhancedEditModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onSave={handleSave}
  entityType="actions"
  isNew={true}
/>
```

## Расширение системы

### Добавление нового типа сущности

1. Добавить конфигурацию в `lib/field-configs.ts`:

```typescript
export const entityFieldConfigs: Record<string, FieldConfig[]> = {
  // ... существующие конфигурации
  
  newEntityType: [
    ...baseFields,
    { name: 'name', type: 'text', label: 'Название', required: true },
    { name: 'description', type: 'textarea', label: 'Описание', required: false },
    // ... дополнительные поля
  ]
}
```

2. Добавить отображаемое имя в функцию `getEntityDisplayName`:

```typescript
export const getEntityDisplayName = (entityType: string): string => {
  const displayNames: Record<string, string> = {
    // ... существующие имена
    newEntityType: 'новый тип сущности'
  }
  return displayNames[entityType] || entityType
}
```

### Добавление нового типа поля

1. Расширить интерфейс `FieldConfig`:

```typescript
interface FieldConfig {
  // ... существующие поля
  type: 'text' | 'textarea' | 'number' | 'select' | 'slider' | 'switch' | 'object' | 'array' | 'boolean' | 'dynamic-object' | 'dynamic-array' | 'new-field-type'
}
```

2. Добавить рендеринг в функцию `renderField` в `EnhancedEditModal`:

```typescript
const renderField = (field: FieldConfig) => {
  switch (field.type) {
    // ... существующие случаи
    
    case 'new-field-type':
      return (
        // Рендеринг нового типа поля
      )
  }
}
```

## Особенности

### Валидация
- Автоматическая валидация обязательных полей
- Валидация числовых диапазонов
- Валидация JSON для объектов и массивов

### UX/UI
- Разделение на вкладки для сложных форм
- Интуитивные элементы управления
- Подсказки и описания полей
- Адаптивный дизайн

### Производительность
- Динамическая загрузка конфигураций
- Оптимизированный рендеринг
- Минимальные перерендеры

## Преимущества

1. **Универсальность** - Один компонент для всех типов сущностей
2. **Расширяемость** - Легко добавлять новые типы и поля
3. **Консистентность** - Единообразный интерфейс для всех форм
4. **Поддержка** - Централизованная конфигурация упрощает поддержку
5. **Типобезопасность** - Полная типизация TypeScript
6. **Производительность** - Оптимизированный рендеринг

## Примеры использования

### Редактирование актива
```tsx
// Модалка автоматически покажет все поля для активов:
// - Основные поля (имя, описание, ранг, цена и т.д.)
// - Атрибуты (сила, эмпатия, интеллект и т.д.)
// - Навыки (обслуживание, кулинария, нейрохакерство и т.д.)
// - Черты характера
// - Предпочтения
// - Состояние
// - Историю
```

### Создание действия
```tsx
// Модалка покажет поля для действий:
// - Название и описание
// - Стоимость и риск
// - Эффекты (влияние на навыки и состояния)
// - Эффекты риска (негативные последствия)
```

Эта система обеспечивает полную гибкость и универсальность для редактирования любых типов сущностей в игре, сохраняя при этом простоту использования и расширения.
