# 🚀 CYBERJACK v2.0 - Инструкция по запуску

## 📋 Предварительные требования

- **Node.js** 18+
- **PostgreSQL** 14+
- **npm** или **yarn**

## 🔧 Установка и настройка

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка базы данных

#### Создание базы данных PostgreSQL
```sql
CREATE DATABASE cyberjack_v2;
CREATE USER cyberjack_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE cyberjack_v2 TO cyberjack_user;
```

#### Настройка переменных окружения
Скопируйте `.env.example` в `.env` и заполните:
```bash
cp env.example .env
```

Отредактируйте `.env`:
```env
# Database
DATABASE_URL="postgresql://cyberjack_user:your_password@localhost:5432/cyberjack_v2"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# OpenRouter API (для ИИ чата)
OPENROUTER_API_KEY="your-openrouter-api-key-here"
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
OPENROUTER_MODEL="z-ai/glm-4.5"
OPENROUTER_MODEL_2="google/gemini-2.5-flash-lite"

# Environment
NODE_ENV="development"
```

### 3. Настройка базы данных

#### Генерация Prisma клиента
```bash
npm run db:generate
```

#### Применение миграций
```bash
npm run db:push
```

#### Заполнение тестовыми данными
```bash
npm run db:seed
```

## 🎮 Запуск приложения

### Режим разработки
```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:3000

## 🧪 Тестирование систем

После запуска проверьте работоспособность API:
```bash
curl http://localhost:3000/api/test
```

## 📱 Основные страницы

- **`/`** - Главная страница
- **`/db`** - Интерфейс базы данных
- **`/admin`** - Админ-панель для настройки
- **`/game`** - Игровой интерфейс

## 🔧 Полезные команды

```bash
# Генерация Prisma клиента
npm run db:generate

# Применение миграций
npm run db:push

# Создание миграции
npm run db:migrate

# Заполнение БД тестовыми данными
npm run db:seed

# Просмотр БД в браузере
npm run db:studio

# Сборка для продакшена
npm run build

# Запуск продакшен версии
npm run start

# Проверка кода
npm run lint
```

## 🎯 Основные функции

### ✅ Реализовано:
- ✅ Система аутентификации с NextAuth.js
- ✅ Система характеристик с восстановлением
- ✅ Система действий с эффектами
- ✅ Character AI с GLM 4.5
- ✅ Система времени с ускорением
- ✅ Полная админ-панель для управления
- ✅ Управление персонажами
- ✅ Управление позами
- ✅ Управление анатомией
- ✅ Игровой интерфейс с чатом
- ✅ API endpoints
- ✅ База данных PostgreSQL

### 🚧 В разработке:
- 🔄 Сюжетный конструктор
- 🔄 Система активных зон
- 🔄 Загрузка изображений
- 🔄 Расширенная система поз

## 🐛 Устранение проблем

### Ошибка подключения к БД
1. Проверьте, что PostgreSQL запущен
2. Убедитесь, что DATABASE_URL правильный
3. Проверьте права пользователя БД

### Ошибка OpenRouter API
1. Убедитесь, что API ключ правильный
2. Проверьте баланс на OpenRouter
3. Убедитесь, что модель доступна

### Ошибки сборки
```bash
# Очистите кэш и переустановите зависимости
rm -rf node_modules package-lock.json
npm install
npm run db:generate
```

## 📚 Документация

- [Техническая спецификация](./CYBERJACK_v2_TECHNICAL_SPECIFICATION.md)
- [Лог разработки](./DEVELOPMENT_LOG.md)
- [Заметки миграции](./MIGRATION_NOTES.md)

## 🤝 Поддержка

При возникновении проблем:
1. Проверьте логи в консоли браузера
2. Проверьте логи сервера в терминале
3. Используйте `/api/test` для диагностики систем
4. Обратитесь к технической спецификации
