# План очистки дублирующихся конфигов

## Текущее состояние
- ✅ Сервер работает
- ✅ Страницы загружаются
- ✅ Основная ошибка с хуками исправлена

## Анализ дублирования

### Полные дубликаты (можно удалить):
1. `characters.json` ↔ `characters-unified.json` (34 персонажа, идентичны)
2. `equipment.json` ↔ `equipment-unified.json` (15 предметов, идентичны)
3. `events.json` ↔ `events-unified.json` (5 событий, идентичны)
4. `story-scenes.json` ↔ `story-scenes-unified.json` (идентичны)
5. `users.json` ↔ `users-unified.json` (1 пользователь, идентичны)

### Частичные дубликаты (нужно проверить):
1. `actions.json` ↔ `actions-unified.json` (структура похожа)
2. `contracts.json` ↔ `contracts-unified.json` (структура похожа)
3. `system-definitions.json` ↔ `system-unified.json` (структура похожа)

### Уникальные файлы (оставить):
1. `game-config-unified.json` - основной конфиг
2. `market.json` - уникальный
3. `assets-from-characters.json` - уникальный
4. `archetypes.json` - уникальный
5. `station-entities.json` - уникальный
6. `story-bindings-examples.json` - уникальный
7. `*-config.json` файлы - конфигурационные

## План действий

### Этап 1: Создание резервных копий
```bash
mkdir -p backups/config-cleanup-$(date +%Y%m%d-%H%M%S)
cp data/characters.json backups/config-cleanup-*/characters.json.backup
cp data/equipment.json backups/config-cleanup-*/equipment.json.backup
cp data/events.json backups/config-cleanup-*/events.json.backup
cp data/story-scenes.json backups/config-cleanup-*/story-scenes.json.backup
cp data/users.json backups/config-cleanup-*/users.json.backup
```

### Этап 2: Удаление полных дубликатов
```bash
rm data/characters.json
rm data/equipment.json
rm data/events.json
rm data/story-scenes.json
rm data/users.json
```

### Этап 3: Проверка частичных дубликатов
- Сравнить содержимое `actions.json` и `actions-unified.json`
- Сравнить содержимое `contracts.json` и `contracts-unified.json`
- Сравнить содержимое `system-definitions.json` и `system-unified.json`

### Этап 4: Обновление импортов
- Найти все импорты удаленных файлов
- Заменить на unified версии

### Этап 5: Тестирование
- Проверить загрузку всех страниц
- Проверить функциональность
- Проверить загрузку конфигов

## Риски
- Некоторые файлы могут импортироваться напрямую
- Возможны различия в структуре данных
- Нужно проверить все места использования

## Критерии успеха
- ✅ Все страницы загружаются
- ✅ Конфиги загружаются корректно
- ✅ Функциональность не нарушена
- ✅ Уменьшение количества дублирующихся файлов









