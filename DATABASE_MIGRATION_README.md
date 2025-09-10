# 🗄️ Миграция на базу данных PostgreSQL

## 📋 Обзор

Этот документ описывает процесс миграции проекта CyberJack с файловой системы JSON конфигов на реляционную базу данных PostgreSQL.

## 🎯 Цели миграции

- ✅ **Единый источник истины** - убрать множественные источники данных
- ✅ **Улучшение производительности** - индексы, оптимизированные запросы
- ✅ **Упрощение архитектуры** - убрать адаптеры и дублирование
- ✅ **Масштабируемость** - легкое добавление новых типов данных
- ✅ **Консистентность** - ACID транзакции, валидация на уровне БД

## 🚀 Быстрый старт

### 1. Установка PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql
brew services start postgresql

# Windows
# Скачать с https://www.postgresql.org/download/windows/
```

### 2. Создание базы данных

```bash
# Подключение к PostgreSQL
sudo -u postgres psql

# Создание базы данных и пользователя
CREATE DATABASE cyberjack;
CREATE USER cyberjack WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE cyberjack TO cyberjack;
\q
```

### 3. Настройка переменных окружения

```bash
# Копируем пример файла
cp env.example .env.local

# Редактируем настройки БД
nano .env.local
```

### 4. Создание схемы БД

```bash
# Применяем схему
psql -h localhost -U cyberjack -d cyberjack -f database-schema.sql
```

### 5. Миграция данных

```bash
# Устанавливаем зависимости
npm install pg

# Запускаем миграцию персонажей
node scripts/migrate-characters.js

# Запускаем другие миграции
node scripts/migrate-actions.js
node scripts/migrate-contracts.js
# ... и т.д.
```

### 6. Тестирование

```bash
# Проверяем подключение к БД
curl http://localhost:3000/api/db/health

# Загружаем конфигурацию из БД
curl http://localhost:3000/api/db/config
```

## 📊 Структура базы данных

### Основные таблицы:

- **characters** - Персонажи/Активы
- **actions** - Действия
- **contracts** - Контракты
- **events** - События
- **equipment** - Оборудование
- **users** - Пользователи
- **story_scenes** - Сюжетные сцены
- **conditions** - Условия
- **station_entities** - Сущности станции
- **character_ai_config** - Конфигурация ИИ персонажей

### Связанные таблицы:

- **character_attributes** - Атрибуты персонажей
- **character_states** - Состояния персонажей
- **character_skills** - Навыки персонажей
- **character_fetishes** - Фетиши персонажей
- **character_memories** - Память персонажей
- **player_knowledge** - Знания игроков о персонажах

## 🔧 API Endpoints

### Новые endpoints для работы с БД:

- `GET /api/db/health` - Проверка здоровья БД
- `GET /api/db/config` - Загрузка конфигурации из БД
- `GET /api/db/characters` - Получить персонажей
- `POST /api/db/characters` - Создать персонажа
- `PUT /api/db/characters` - Обновить персонажа
- `DELETE /api/db/characters` - Удалить персонажа

### Примеры использования:

```typescript
// Загрузка конфигурации
const response = await fetch('/api/db/config')
const { config } = await response.json()

// Поиск персонажей
const characters = await fetch('/api/db/characters?rank=A&status=available')
const { data } = await characters.json()

// Создание персонажа
const newCharacter = await fetch('/api/db/characters', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Новый персонаж',
    rank: 'C',
    attributes: { /* ... */ }
  })
})
```

## 🎣 React Hooks

### Новые хуки для работы с БД:

```typescript
// Загрузка конфигурации
const { config, loading, error, refresh } = useDatabaseConfig()

// Работа с персонажами
const {
  characters,
  loading,
  error,
  createCharacter,
  updateCharacter,
  deleteCharacter
} = useCharacters()

// Проверка подключения к БД
const { connected, loading, checkConnection } = useDatabaseConnection()
```

## 📁 Структура файлов

```
lib/database/
├── client.ts                    # Подключение к БД
├── config-loader.ts             # Загрузчик конфигурации
└── repositories/
    ├── characters.ts            # Репозиторий персонажей
    ├── actions.ts               # Репозиторий действий
    ├── contracts.ts             # Репозиторий контрактов
    └── ...

app/api/db/
├── health/route.ts              # Проверка здоровья БД
├── config/route.ts              # Загрузка конфигурации
└── characters/route.ts          # CRUD персонажей

scripts/
├── migrate-characters.js        # Миграция персонажей
├── migrate-actions.js           # Миграция действий
└── ...

hooks/
└── useDatabaseConfig.ts         # Хуки для работы с БД
```

## ⚙️ Конфигурация

### Переменные окружения:

```bash
# База данных
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cyberjack
DB_USER=cyberjack
DB_PASSWORD=password

# Режим работы
USE_DATABASE=true  # true - БД, false - JSON файлы
```

### Feature Flag:

```typescript
// Переключение между БД и файлами
const useDatabase = process.env.USE_DATABASE === 'true'

if (useDatabase) {
  // Используем БД
  const config = await loadDatabaseConfig()
} else {
  // Используем JSON файлы
  const config = await loadUnifiedConfig()
}
```

## 🔍 Мониторинг и отладка

### Проверка здоровья БД:

```bash
curl http://localhost:3000/api/db/health
```

### Логирование:

```typescript
// Включение подробных логов
console.log('🔄 Загружаем конфигурацию из БД...')
console.log('✅ Конфигурация загружена:', { charactersCount: 150 })
```

### Статистика БД:

```typescript
const { stats } = await fetch('/api/db/health').then(r => r.json())
console.log('Статистика БД:', stats)
```

## 🚨 Устранение неполадок

### Проблема: Нет подключения к БД

```bash
# Проверяем статус PostgreSQL
sudo systemctl status postgresql

# Проверяем подключение
psql -h localhost -U cyberjack -d cyberjack -c "SELECT 1"
```

### Проблема: Ошибки миграции

```bash
# Проверяем логи
tail -f logs/migration.log

# Откатываем транзакцию
psql -h localhost -U cyberjack -d cyberjack -c "ROLLBACK;"
```

### Проблема: Медленные запросы

```sql
-- Анализ медленных запросов
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## 📈 Производительность

### Индексы для оптимизации:

```sql
-- Индексы для быстрого поиска
CREATE INDEX idx_characters_rank ON characters(rank);
CREATE INDEX idx_characters_status ON characters(status);
CREATE INDEX idx_character_skills_level ON character_skills(level);
```

### Кэширование:

```typescript
// Кэш конфигурации (5 минут)
const CACHE_DURATION = 5 * 60 * 1000
let configCache: GameConfig | null = null
let cacheTimestamp = 0
```

## 🔄 Откат к файловой системе

Если нужно вернуться к JSON файлам:

```bash
# Отключаем БД
export USE_DATABASE=false

# Перезапускаем приложение
npm run dev
```

## 📚 Дополнительные ресурсы

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js PostgreSQL Driver](https://node-postgres.com/)
- [Prisma ORM](https://www.prisma.io/docs/)
- [Database Migration Best Practices](https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate)

## 🤝 Поддержка

При возникновении проблем:

1. Проверьте логи приложения
2. Убедитесь в корректности переменных окружения
3. Проверьте подключение к БД
4. Создайте issue в репозитории проекта
