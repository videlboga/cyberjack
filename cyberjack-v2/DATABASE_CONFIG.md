# 🗄️ CyberJack v2 - Конфигурация базы данных

## 📋 Основная информация

### PostgreSQL Docker контейнер
- **Контейнер**: `cyberjack-postgres`
- **Образ**: `postgres:15-alpine`
- **Порт**: `5432` (проброшен на localhost:5432)
- **Статус**: Запущен и работает

### Учетные данные
- **Пользователь**: `cyberjack_user`
- **Пароль**: `cyberjack2025`
- **База данных**: `cyberjack_v2`
- **Строка подключения**: `postgresql://cyberjack_user:cyberjack2025@localhost:5432/cyberjack_v2`

## 🔧 Команды для управления

### Подключение к базе данных
```bash
# Через Docker контейнер
docker exec -it cyberjack-postgres psql -U cyberjack_user -d cyberjack_v2

# Через psql с паролем
PGPASSWORD=cyberjack2025 psql -h localhost -p 5432 -U cyberjack_user -d cyberjack_v2
```

### Сброс пароля
```bash
docker exec -it cyberjack-postgres psql -U cyberjack_user -d cyberjack_v2 -c "ALTER USER cyberjack_user WITH PASSWORD 'cyberjack2025';"
```

### Проверка статуса контейнера
```bash
docker ps | grep postgres
```

### Остановка/запуск контейнера
```bash
# Остановка
docker stop cyberjack-postgres

# Запуск
docker start cyberjack-postgres
```

## 📊 Содержимое базы данных

### Персонажи
- Линь Сюэжань
- Анечка
- Кай

### Схема Prisma
- **Provider**: `postgresql`
- **URL**: `env("DATABASE_URL")`
- **Статус**: Синхронизирована с базой данных

## 🚀 Настройка приложения

### .env файл
```env
DATABASE_URL="postgresql://cyberjack_user:cyberjack2025@localhost:5432/cyberjack_v2"
```

### Команды Prisma
```bash
# Генерация клиента
npm run db:generate

# Синхронизация схемы
npm run db:push

# Создание миграции
npm run db:migrate

# Заполнение тестовыми данными
npm run db:seed

# Просмотр в браузере
npm run db:studio
```

## 🔍 Диагностика

### Проверка подключения
```bash
# Тест подключения
npm run db:push

# Проверка персонажей
docker exec -it cyberjack-postgres psql -U cyberjack_user -d cyberjack_v2 -c "SELECT name FROM characters;"
```

### Логи контейнера
```bash
docker logs cyberjack-postgres
```

## ⚠️ Важные заметки

1. **PostgreSQL запущен в Docker** - не через системный сервис
2. **Пароль был сброшен** с помощью команды ALTER USER
3. **Все компоненты** (админка, игровой интерфейс, ИИ) теперь используют одну базу данных
4. **Характеристики должны изменяться** через ИИ систему

## 📅 Дата обновления
**15 сентября 2025** - Настроена конфигурация PostgreSQL, сброшен пароль, синхронизирована схема Prisma
