# Скрипты для CyberJack v2.0

Этот каталог содержит скрипты для разработки, сборки и тестирования проекта CyberJack v2.0.

## 🚀 Быстрый старт

### Запуск в режиме разработки
```bash
./scripts/start-dev.sh
```
Этот скрипт:
- Останавливает все процессы Next.js
- Освобождает порт 3000
- Очищает кеш Next.js и npm
- Устанавливает зависимости
- Генерирует Prisma клиент
- Проверяет TypeScript
- Запускает сервер на порту 3000

### Тестирование API endpoints
```bash
./scripts/test-api.sh
```
Этот скрипт тестирует все основные API endpoints:
- `/api/characteristics/[characterId]/[characteristicId]`
- `/api/actions/execute`
- `/api/chat/[characterId]`
- `/api/time/advance`
- Главную страницу `/`
- Игровую страницу `/game`

### Полная сборка проекта
```bash
./scripts/build.sh
```
Этот скрипт:
- Останавливает все процессы
- Очищает все кеши и временные файлы
- Устанавливает зависимости
- Генерирует Prisma клиент
- Проверяет TypeScript
- Собирает проект для продакшна

## 📋 Доступные скрипты

| Скрипт | Описание | Порт |
|--------|----------|------|
| `start-dev.sh` | Запуск в режиме разработки | 3000 |
| `test-api.sh` | Тестирование API endpoints | 3000 |
| `build.sh` | Полная сборка проекта | - |

## 🔧 Требования

- Node.js 18+
- npm
- Prisma CLI
- TypeScript

## 🐛 Устранение проблем

### Порт 3000 занят
```bash
# Найти процесс, использующий порт 3000
lsof -i :3000

# Убить процесс
kill -9 <PID>
```

### Ошибки TypeScript
```bash
# Проверить ошибки TypeScript
npx tsc --noEmit --project .
```

### Ошибки Prisma
```bash
# Перегенерировать Prisma клиент
npx prisma generate
```

### Очистка кеша
```bash
# Очистить кеш Next.js
rm -rf .next

# Очистить кеш npm
npm cache clean --force
```

## 📊 API Endpoints

После запуска сервера доступны следующие API endpoints:

### Characteristics API
- `GET /api/characteristics/[characterId]/[characteristicId]` - Получить значение характеристики
- `PATCH /api/characteristics/[characterId]/[charactericId]` - Изменить значение характеристики

### Actions API
- `POST /api/actions/execute` - Выполнить действие

### Chat API
- `POST /api/chat/[characterId]` - Отправить сообщение персонажу

### Time API
- `POST /api/time/advance` - Продвинуть время

## 🌐 Веб-интерфейс

- `http://localhost:3000/` - Главная страница
- `http://localhost:3000/game` - Игровой интерфейс
- `http://localhost:3000/db` - Интерфейс базы данных
- `http://localhost:3000/admin` - Админ-панель

