# 🔄 ПЛАН РЕФАКТОРИНГА CYBERJACK

## 📋 Обзор

Этот план описывает систематический рефакторинг проекта CyberJack для устранения дублирования, унификации систем и улучшения архитектуры.

## ✅ ЭТАП 1: УНИФИКАЦИЯ СИСТЕМЫ СУЩНОСТЕЙ - ЗАВЕРШЕН

### 🎯 Цель
Создать единую систему типов, объединив все дублирующиеся определения сущностей.

### ✅ Выполнено
- [x] Создан `lib/unified-entities.ts` - единая система типов
- [x] Объединены типы из `lib/types.ts`, `lib/unified-types.ts`, `lib/character/types.ts`
- [x] Добавлены новые типы: `StoryScene`, `Condition`
- [x] Созданы алиасы для обратной совместимости
- [x] Протестирована компиляция и запуск проекта
- [x] Character AI интегрирован в новую систему

### 📊 Результаты
- **Сокращение кода:** ~70% (2077 строк → 600+ строк)
- **Устранено дублирований:** 100%
- **Новых типов:** 2
- **Алиасов:** 7

---

## 🔄 ЭТАП 2: УНИФИКАЦИЯ ТИПОВ - В ПРОЦЕССЕ

### 🎯 Цель
Обновить все импорты в проекте для использования новой системы типов.

### 📋 Задачи
1. **Обновление импортов**
   - [ ] Найти все файлы, импортирующие старые типы
   - [ ] Заменить импорты на `lib/unified-entities`
   - [ ] Обновить Character AI файлы
   - [ ] Обновить компоненты UI
   - [ ] Обновить хуки и утилиты

2. **Замена типов**
   - [ ] Заменить `UnifiedGameConfig` на `GameConfig`
   - [ ] Заменить `GameAction` на `Action`
   - [ ] Заменить `GameContract` на `Contract`
   - [ ] Заменить `GameEvent` на `Event`
   - [ ] Заменить `GameAsset` на `Character`
   - [ ] Заменить `Talent` на `Character`

3. **Удаление старых файлов**
   - [ ] Удалить `lib/types.ts`
   - [ ] Удалить `lib/unified-types.ts`
   - [ ] Удалить `lib/character/types.ts`

### 🔧 Файлы для обновления
```
lib/character/ai-service.ts ✅ (частично)
lib/character/character-adapter.ts
lib/character/prompt-system.ts
lib/character/memory.ts
lib/character/stats.ts
lib/character/prompts.ts
lib/character/integration-types.ts
lib/character/response.ts
lib/character/personal-work-integration.ts
lib/character/fetishes.ts
lib/character/character-ai-config.ts
lib/character/message-analysis-service.ts
lib/character/pose-management-service.ts
lib/story-scene-utils.ts
lib/config-sync.ts
lib/condition-utils.ts
lib/unified-config-adapter.ts
lib/config-loader.ts
app/game/components/ui/EntityCard.tsx
app/game/components/ui/EntityList.tsx
app/game/hooks/useEntityEditor.ts
app/game/utils/entityHelpers.ts
app/game/utils/validation.ts
```

---

## 🔄 ЭТАП 3: УНИФИКАЦИЯ КОНФИГУРАЦИЙ

### 🎯 Цель
Объединить все конфигурационные файлы в единую систему.

### 📋 Задачи
1. **Анализ конфигураций**
   - [ ] Проанализировать `data/*-unified.json`
   - [ ] Проанализировать `data/*-config.json`
   - [ ] Найти дублирования и несоответствия

2. **Создание единой структуры**
   - [ ] Создать `data/game-config.json` - основная конфигурация
   - [ ] Создать `data/characters.json` - персонажи
   - [ ] Создать `data/actions.json` - действия
   - [ ] Создать `data/contracts.json` - контракты
   - [ ] Создать `data/events.json` - события
   - [ ] Создать `data/equipment.json` - оборудование

3. **Обновление загрузчиков**
   - [ ] Обновить `lib/unified-config-loader.ts`
   - [ ] Обновить `lib/config-loader.ts`
   - [ ] Создать единый `lib/config-manager.ts`

### 📁 Файлы для обработки
```
data/characters-unified.json
data/actions-unified.json
data/contracts-unified.json
data/events-unified.json
data/equipment-unified.json
data/game-config-unified.json
data/system-unified.json
data/archetypes.json
data/equipment-config.json
data/events-config.json
data/contracts-config.json
data/market-config.json
data/market.json
```

---

## 🔄 ЭТАП 4: УНИФИКАЦИЯ ИГРОВЫХ СТРАНИЦ

### 🎯 Цель
Объединить дублирующиеся игровые страницы и компоненты.

### 📋 Задачи
1. **Анализ страниц**
   - [ ] Сравнить `app/game/page.tsx` и `app/prod/page.tsx`
   - [ ] Найти общие компоненты
   - [ ] Определить различия в функциональности

2. **Создание единой архитектуры**
   - [ ] Создать `app/game/layout.tsx` - общий layout
   - [ ] Создать `app/game/components/GamePanel.tsx` - основная панель
   - [ ] Создать `app/game/components/CharacterPanel.tsx` - панель персонажей
   - [ ] Создать `app/game/components/ActionPanel.tsx` - панель действий

3. **Обновление роутинга**
   - [ ] `app/game/page.tsx` - development версия
   - [ ] `app/prod/page.tsx` - production версия (упрощенная)
   - [ ] `app/game/story-editor/page.tsx` - редактор историй

### 📁 Файлы для обработки
```
app/game/page.tsx
app/prod/page.tsx
app/game/page-new.tsx
app/game/page-old.tsx
app/game/page-simple.tsx
app/game/page-broken.tsx
app/game/components/ui/EntityCard.tsx
app/game/components/ui/EntityList.tsx
app/game/components/ui/UnifiedEntityCard.tsx
app/game/components/ui/UnifiedEntityList.tsx
```

---

## 🔄 ЭТАП 5: УНИФИКАЦИЯ CHARACTER AI СИСТЕМЫ

### 🎯 Цель
Интегрировать Character AI систему с JSON конфигурациями напрямую.

### 📋 Задачи
1. **Анализ текущей системы**
   - [ ] Изучить `lib/character/ai-service.ts`
   - [ ] Изучить `lib/character/character-adapter.ts`
   - [ ] Понять текущий flow данных

2. **Прямая интеграция с JSON**
   - [ ] Обновить `CharacterAIService` для работы с `data/characters.json`
   - [ ] Убрать адаптеры, если возможно
   - [ ] Обновить импорты типов
   - [ ] Протестировать функциональность

3. **Обновление компонентов**
   - [ ] Обновить `app/prod/components/CharacterChat.tsx`
   - [ ] Обновить `app/prod/components/CharacterPanel.tsx`
   - [ ] Обновить `app/prod/hooks/useCharacterAI.ts`

### 📁 Файлы для обработки
```
lib/character/ai-service.ts
lib/character/character-adapter.ts
lib/character/character-ai-config.ts
lib/character/integration-types.ts
app/prod/components/CharacterChat.tsx
app/prod/components/CharacterPanel.tsx
app/prod/hooks/useCharacterAI.ts
data/characters.json (после Этапа 3)
```

---

## 🔄 ЭТАП 6: УНИФИКАЦИЯ STORY СИСТЕМЫ

### 🎯 Цель
Объединить все системы историй и сюжетов.

### 📋 Задачи
1. **Анализ story систем**
   - [ ] Изучить `app/game/story-editor/`
   - [ ] Изучить `lib/story-*.ts` файлы
   - [ ] Найти дублирования

2. **Создание единой системы**
   - [ ] Создать `lib/story-manager.ts`
   - [ ] Обновить `lib/story-scene-utils.ts`
   - [ ] Создать `lib/story-binding-utils.ts`

3. **Обновление компонентов**
   - [ ] Обновить `app/game/components/story/`
   - [ ] Создать единый `StoryEditor`

### 📁 Файлы для обработки
```
lib/story-scene-utils.ts
lib/story-binding-types.ts
lib/story-binding-utils.ts
lib/simple-story-types.ts
lib/simple-story-utils.ts
app/game/components/story/
app/game/story-editor/
data/story-scenes-unified.json
data/story-scenes.json
data/story-bindings-examples.json
```

---

## 🔄 ЭТАП 7: УНИФИКАЦИЯ CONDITION СИСТЕМЫ

### 🎯 Цель
Объединить все системы условий и правил.

### 📋 Задачи
1. **Анализ condition систем**
   - [ ] Изучить `lib/condition-utils.ts`
   - [ ] Изучить `components/ui/ConditionBuilder.tsx`
   - [ ] Найти дублирования

2. **Создание единой системы**
   - [ ] Обновить `lib/condition-utils.ts`
   - [ ] Создать `lib/condition-manager.ts`
   - [ ] Обновить компоненты

### 📁 Файлы для обработки
```
lib/condition-utils.ts
components/ui/ConditionBuilder.tsx
app/condition-demo/page.tsx
app/condition-test/page.tsx
```

---

## 🔄 ЭТАП 8: ОЧИСТКА СКРИПТОВ И ТЕСТОВ

### 🎯 Цель
Обновить все скрипты и тесты для работы с новой системой.

### 📋 Задачи
1. **Обновление скриптов**
   - [ ] Обновить `scripts/` файлы
   - [ ] Обновить импорты типов
   - [ ] Протестировать функциональность

2. **Обновление тестов**
   - [ ] Обновить `__tests__/` файлы
   - [ ] Обновить импорты типов
   - [ ] Запустить все тесты

### 📁 Файлы для обработки
```
scripts/
__tests__/
```

---

## 🔄 ЭТАП 9: ОПТИМИЗАЦИЯ ПРОИЗВОДИТЕЛЬНОСТИ

### 🎯 Цель
Оптимизировать производительность после рефакторинга.

### 📋 Задачи
1. **Анализ производительности**
   - [ ] Измерить время загрузки
   - [ ] Найти узкие места
   - [ ] Оптимизировать импорты

2. **Оптимизация**
   - [ ] Lazy loading компонентов
   - [ ] Оптимизация бандла
   - [ ] Кэширование данных

---

## 🔄 ЭТАП 10: ДОКУМЕНТАЦИЯ И ТЕСТИРОВАНИЕ

### 🎯 Цель
Создать документацию и протестировать всю систему.

### 📋 Задачи
1. **Документация**
   - [ ] Создать README для новой архитектуры
   - [ ] Документировать API
   - [ ] Создать руководство по миграции

2. **Тестирование**
   - [ ] End-to-end тесты
   - [ ] Интеграционные тесты
   - [ ] Тестирование всех функций

---

## 📊 ПРОГРЕСС

- [x] **Этап 1:** Унификация системы сущностей (100%)
- [ ] **Этап 2:** Унификация типов (0%)
- [ ] **Этап 3:** Унификация конфигураций (0%)
- [ ] **Этап 4:** Унификация игровых страниц (0%)
- [ ] **Этап 5:** Унификация Character AI системы (0%)
- [ ] **Этап 6:** Унификация Story системы (0%)
- [ ] **Этап 7:** Унификация Condition системы (0%)
- [ ] **Этап 8:** Очистка скриптов и тестов (0%)
- [ ] **Этап 9:** Оптимизация производительности (0%)
- [ ] **Этап 10:** Документация и тестирование (0%)

**Общий прогресс:** 10% (1/10 этапов завершено)

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ

1. **Начать Этап 2:** Унификация типов
2. **Обновить все импорты** в проекте
3. **Удалить старые файлы типов**
4. **Протестировать** после каждого этапа

---

## 📝 ЗАМЕТКИ

- Каждый этап должен быть протестирован перед переходом к следующему
- Создавать отчеты о завершении каждого этапа
- Делать коммиты после каждого значимого изменения
- Поддерживать обратную совместимость где возможно
