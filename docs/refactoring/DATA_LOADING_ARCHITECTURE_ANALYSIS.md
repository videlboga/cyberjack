# Анализ механики загрузки данных из БД на продакшене

## Обзор архитектуры

Система загрузки данных в проекте построена на принципе **универсального загрузчика конфигураций**, который может переключаться между JSON файлами и базой данных PostgreSQL в зависимости от feature flags.

## Схема архитектуры

```mermaid
graph TB
    subgraph "Frontend (app/prod)"
        A[page.tsx] --> B[useUniversalConfig Hook]
        B --> C[API Request to /api/db/config]
    end

    subgraph "API Layer"
        C --> D[/api/db/config/route.ts]
        D --> E[loadUniversalConfig]
        E --> F[getFeatureFlags]
        F --> G{Feature Flags Check}
    end

    subgraph "Data Sources"
        G -->|useDatabase=true| H[loadDatabaseConfig]
        G -->|useDatabase=false| I[loadUnifiedConfig]
        H --> J[(PostgreSQL Database)]
        I --> K[JSON Files in /data]
    end

    subgraph "Database Tables"
        J --> L[characters]
        J --> M[users]
        J --> N[equipment]
        J --> O[actions]
        J --> P[contracts]
        J --> Q[events]
        J --> R[story_scenes]
        J --> S[conditions]
        J --> T[station_entities]
        J --> U[character_ai_config]
    end

    subgraph "JSON Files"
        K --> V[characters-unified.json]
        K --> W[users-unified.json]
        K --> X[equipment-unified.json]
        K --> Y[actions-unified.json]
        K --> Z[contracts-unified.json]
        K --> AA[events-unified.json]
        K --> BB[story-scenes-unified.json]
        K --> CC[conditions.json]
        K --> DD[station-entities.json]
    end

    H --> EE[GameConfig Object]
    I --> EE
    EE --> FF[Frontend Components]
```

## Ключевые компоненты

### 1. Feature Flags System (`lib/feature-flags.ts`)
- **Назначение**: Управление переключением между источниками данных
- **Основные флаги**:
  - `USE_DATABASE` - общий флаг для БД
  - `USE_DATABASE_CHARACTERS` - персонажи из БД
  - `USE_DATABASE_USERS` - пользователи из БД
  - И другие специфичные флаги для каждого типа данных

### 2. Universal Config Loader (`lib/universal-config-loader.ts`)
- **Назначение**: Главный загрузчик, который решает откуда брать данные
- **Логика**: Проверяет feature flags и вызывает соответствующий загрузчик
- **Fallback**: При ошибке БД автоматически переключается на JSON файлы

### 3. Database Config Loader (`lib/database/config-loader.ts`)
- **Назначение**: Загрузка данных из PostgreSQL
- **Функции**:
  - `loadDatabaseConfig()` - загрузка полной конфигурации
  - `loadCharacters()`, `loadUsers()`, etc. - загрузка конкретных типов данных
  - `testDatabaseConnection()` - проверка подключения к БД

### 4. Unified Config Loader (`lib/unified-config-loader.ts`)
- **Назначение**: Загрузка данных из JSON файлов
- **Используется**: Как fallback при недоступности БД

### 5. API Endpoints
- **`/api/db/config`** - универсальный endpoint для загрузки конфигурации
- **`/api/config`** - legacy endpoint для JSON файлов
- **`/api/db/*`** - специфичные endpoints для каждого типа данных

## Поток загрузки данных

### На продакшене (app/prod/page.tsx):

1. **Инициализация**: Компонент вызывает `useUniversalConfig()`
2. **API запрос**: Хук делает запрос к `/api/db/config`
3. **Feature flags**: API проверяет переменные окружения
4. **Выбор источника**:
   - Если `USE_DATABASE=true` → загрузка из PostgreSQL
   - Если `USE_DATABASE=false` → загрузка из JSON файлов
5. **Обработка данных**: Данные нормализуются в структуру `GameConfig`
6. **Возврат**: Конфигурация передается в компоненты

### Обработка пользовательских данных:

```typescript
// В page.tsx происходит фильтрация данных пользователя
const userCharacters = usersArr.find((u: any) =>
  u.id === currentUser.id || u.name === currentUser.username ||
  u.username === currentUser.username || u.email === currentUser.username
)

// Фильтрация персонажей по принадлежности пользователю
const filteredAssets = userCharacters.length > 0
  ? charactersArr.filter((asset: any) => userCharacters.includes(asset.id))
  : []
```

## Проблемы и особенности

### 1. Дублирование логики
- Есть несколько версий загрузчиков (`unified-config-loader.ts`, `universal-config-loader.ts`)
- Разные API endpoints для одних и тех же данных

### 2. Сложная нормализация данных
- Данные из БД и JSON имеют разную структуру
- Требуется сложная логика нормализации в `useUniversalConfig`

### 3. Кэширование
- Кэш временно отключен для отладки
- Нет единой стратегии кэширования

### 4. Обработка ошибок
- Есть fallback механизм, но он может быть неполным
- Нет централизованной обработки ошибок

## Рекомендации по улучшению

### 1. Упрощение архитектуры
- Объединить загрузчики в один универсальный
- Убрать дублирование API endpoints

### 2. Улучшение типизации
- Создать строгие типы для всех источников данных
- Унифицировать структуру данных

### 3. Оптимизация производительности
- Включить кэширование с правильной стратегией
- Добавить lazy loading для больших данных

### 4. Мониторинг
- Добавить логирование производительности
- Создать метрики для отслеживания источников данных

## Детальный анализ кода

### Проблемы в app/prod/page.tsx

1. **Сложная логика нормализации данных** (строки 238-258):
```typescript
const getUsersArray = (cfg: any) => {
  if (!cfg) return [] as any[]
  const u = (cfg as any).users
  return Array.isArray(u) ? u : (u?.users ?? [])
}
```
- Дублирование логики для каждого типа данных
- Отсутствие типизации (`any` везде)
- Сложная логика определения структуры данных

2. **Избыточная обработка пользовательских данных** (строки 365-401):
```typescript
// Ищем пользователя сначала по ID/username/email (для обратной совместимости)
let userData = usersArr.find((u: any) =>
  u.id === currentUser.id || u.name === currentUser.username ||
  u.username === currentUser.username || u.email === currentUser.username
)
```
- Множественные проверки для поиска пользователя
- Отсутствие единого стандарта полей пользователя
- Сложная логика фильтрации данных

3. **Сложная нормализация атрибутов** (строки 410-485):
- 75+ строк кода для нормализации атрибутов персонажей
- Сложная логика маппинга ключей
- Дублирование логики обработки разных типов данных

### Проблемы в системе загрузки

1. **Дублирование загрузчиков**:
   - `unified-config-loader.ts` - для JSON файлов
   - `universal-config-loader.ts` - универсальный загрузчик
   - `database/config-loader.ts` - для БД
   - Разные API endpoints для одних данных

2. **Отсутствие кэширования**:
   - Кэш отключен во всех загрузчиках
   - Каждый запрос идет в БД/файлы
   - Нет оптимизации производительности

3. **Слабая типизация**:
   - Везде используется `any`
   - Нет строгих типов для источников данных
   - Сложно отследить структуру данных

## Критические проблемы

### 1. Производительность
- **Проблема**: Каждый запрос загружает все данные из БД
- **Влияние**: Медленная загрузка страницы, высокая нагрузка на БД
- **Решение**: Включить кэширование, добавить lazy loading

### 2. Сложность поддержки
- **Проблема**: Дублирование логики в разных местах
- **Влияние**: Сложно вносить изменения, высокая вероятность ошибок
- **Решение**: Создать единый загрузчик данных

### 3. Отсутствие типизации
- **Проблема**: Везде используется `any`, нет строгих типов
- **Влияние**: Сложно отследить ошибки, нет автодополнения
- **Решение**: Создать строгие типы для всех источников данных

### 4. Неэффективная фильтрация данных
- **Проблема**: Сложная логика поиска и фильтрации пользовательских данных
- **Влияние**: Медленная обработка, сложность понимания
- **Решение**: Упростить логику, создать утилиты для фильтрации

## Рекомендации по рефакторингу

### Приоритет 1: Критические исправления

1. **Включить кэширование**:
```typescript
// В lib/universal-config-loader.ts
const CACHE_DURATION = 5 * 60 * 1000 // 5 минут
if (configCache && (now - cacheTimestamp) < CACHE_DURATION) {
  return configCache
}
```

2. **Создать строгие типы**:
```typescript
interface UserData {
  id: string
  username: string
  email: string
  characters: string[]
  user_equipment: string[]
  // ... другие поля
}
```

3. **Упростить логику поиска пользователя**:
```typescript
const findUser = (users: UserData[], currentUser: CurrentUser): UserData | null => {
  return users.find(user =>
    user.id === currentUser.id ||
    user.username === currentUser.username ||
    user.email === currentUser.username
  ) || null
}
```

### Приоритет 2: Архитектурные улучшения

1. **Объединить загрузчики**:
   - Создать единый `DataLoader` класс
   - Убрать дублирование кода
   - Унифицировать API

2. **Создать утилиты для нормализации**:
```typescript
class DataNormalizer {
  static normalizeUsers(data: any): UserData[]
  static normalizeCharacters(data: any): CharacterData[]
  static normalizeEquipment(data: any): EquipmentData[]
}
```

3. **Добавить мониторинг**:
   - Логирование времени загрузки
   - Метрики использования источников данных
   - Алерты при ошибках

### Приоритет 3: Долгосрочные улучшения

1. **Создать единый API Gateway**:
   - Один endpoint для всех данных
   - Автоматическое переключение источников
   - Кэширование на уровне API

2. **Добавить GraphQL**:
   - Типизированные запросы
   - Ленивая загрузка данных
   - Оптимизация запросов

3. **Создать систему миграций**:
   - Автоматическая миграция между источниками
   - Валидация данных
   - Откат изменений

## План реализации

### Фаза 1 (1-2 недели): Критические исправления
- [ ] Включить кэширование
- [ ] Создать базовые типы
- [ ] Упростить логику поиска пользователя
- [ ] Добавить обработку ошибок

### Фаза 2 (2-3 недели): Архитектурные улучшения
- [ ] Объединить загрузчики
- [ ] Создать утилиты нормализации
- [ ] Добавить мониторинг
- [ ] Оптимизировать производительность

### Фаза 3 (3-4 недели): Долгосрочные улучшения
- [ ] Создать API Gateway
- [ ] Добавить GraphQL
- [ ] Создать систему миграций
- [ ] Полное тестирование

## Текущее состояние

- ✅ Базовая архитектура работает
- ✅ Feature flags система функционирует
- ✅ Fallback механизм реализован
- ❌ Кэширование отключено (критично)
- ❌ Слабая типизация (критично)
- ❌ Дублирование кода (высокий приоритет)
- ❌ Сложная нормализация данных (высокий приоритет)
- ❌ Неэффективная фильтрация (средний приоритет)
