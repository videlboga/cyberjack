# 🔄 ЭТАП 2: УНИФИКАЦИЯ ТИПОВ - ДЕТАЛЬНЫЙ ПЛАН

## 📋 Обзор

Этот этап направлен на обновление всех импортов в проекте для использования новой единой системы типов из `lib/unified-entities.ts`.

## 🎯 Цель

Заменить все импорты старых типов на новую систему, обеспечив полную совместимость и функциональность проекта.

## 📊 Статус

- **Прогресс:** 5% (начальная подготовка)
- **Статус:** Готов к началу
- **Приоритет:** Высокий

---

## 🔍 ПОДЭТАП 2.1: АНАЛИЗ И ПОДГОТОВКА

### 🎯 Цель
Проанализировать все файлы, использующие старые типы, и создать план обновления.

### 📋 Задачи
- [ ] Проанализировать все файлы, использующие старые типы
- [ ] Создать список файлов для обновления
- [ ] Определить приоритеты обновления
- [ ] Создать план тестирования

### 🔧 Выполнение

#### 1. Анализ файлов с импортами старых типов
```bash
# Найти все файлы, импортирующие старые типы
grep -r "from.*types" lib/ app/ components/ --include="*.ts" --include="*.tsx"
grep -r "from.*unified-types" lib/ app/ components/ --include="*.ts" --include="*.tsx"
grep -r "from.*character/types" lib/ app/ components/ --include="*.ts" --include="*.tsx"
```

#### 2. Создание списка файлов для обновления
**Character AI файлы (высокий приоритет):**
- `lib/character/ai-service.ts`
- `lib/character/character-adapter.ts`
- `lib/character/prompt-system.ts`
- `lib/character/memory.ts`
- `lib/character/stats.ts`
- `lib/character/prompts.ts`
- `lib/character/integration-types.ts`
- `lib/character/response.ts`
- `lib/character/personal-work-integration.ts`
- `lib/character/fetishes.ts`
- `lib/character/character-ai-config.ts`
- `lib/character/message-analysis-service.ts`
- `lib/character/pose-management-service.ts`

**Утилиты и загрузчики (средний приоритет):**
- `lib/story-scene-utils.ts`
- `lib/config-sync.ts`
- `lib/condition-utils.ts`
- `lib/unified-config-adapter.ts`
- `lib/config-loader.ts`

**Компоненты UI (средний приоритет):**
- `app/game/components/ui/EntityCard.tsx`
- `app/game/components/ui/EntityList.tsx`
- `app/game/components/ui/EditModal.tsx`
- `app/game/components/ui/EnhancedEditModal.tsx`
- `components/ui/AttributeSelector.tsx`
- `components/ui/EntitySelector.tsx`
- `components/ui/OperatorSelector.tsx`
- `components/ui/ValueInput.tsx`

**Хуки и утилиты (низкий приоритет):**
- `app/game/hooks/useEntityEditor.ts`
- `app/game/utils/entityHelpers.ts`
- `app/game/utils/validation.ts`
- `app/game/utils/configHelpers.ts`

### 📊 Критерии успеха
- [ ] Создан полный список файлов для обновления
- [ ] Определены приоритеты обновления
- [ ] Создан план тестирования
- [ ] Документированы зависимости между файлами

---

## 🔧 ПОДЭТАП 2.2: ОБНОВЛЕНИЕ CHARACTER AI СИСТЕМЫ

### 🎯 Цель
Обновить все файлы Character AI системы для использования новых типов.

### 📋 Задачи
- [ ] Обновить `lib/character/ai-service.ts`
- [ ] Обновить `lib/character/character-adapter.ts`
- [ ] Обновить `lib/character/prompt-system.ts`
- [ ] Обновить `lib/character/memory.ts`
- [ ] Обновить `lib/character/stats.ts`
- [ ] Обновить `lib/character/prompts.ts`
- [ ] Обновить `lib/character/integration-types.ts`
- [ ] Обновить `lib/character/response.ts`
- [ ] Обновить `lib/character/personal-work-integration.ts`
- [ ] Обновить `lib/character/fetishes.ts`
- [ ] Обновить `lib/character/character-ai-config.ts`
- [ ] Обновить `lib/character/message-analysis-service.ts`
- [ ] Обновить `lib/character/pose-management-service.ts`

### 🔧 Выполнение

#### 1. Обновление импортов
Заменить все импорты на:
```typescript
import { 
  Character, 
  Action, 
  Contract, 
  Event, 
  GameConfig,
  StoryScene,
  Condition 
} from '@/lib/unified-entities';
```

#### 2. Замена типов
- `UnifiedGameConfig` → `GameConfig`
- `GameAction` → `Action`
- `GameContract` → `Contract`
- `GameEvent` → `Event`
- `GameAsset` → `Character`
- `Talent` → `Character`

#### 3. Тестирование после каждого файла
```bash
npm run build
npm run dev
```

### 📊 Критерии успеха
- [ ] Все Character AI файлы обновлены
- [ ] Проект компилируется без ошибок
- [ ] Character AI система функционирует
- [ ] Тесты проходят успешно

---

## 🔧 ПОДЭТАП 2.3: ОБНОВЛЕНИЕ УТИЛИТ И ЗАГРУЗЧИКОВ

### 🎯 Цель
Обновить все утилиты и загрузчики для использования новых типов.

### 📋 Задачи
- [ ] Обновить `lib/story-scene-utils.ts`
- [ ] Обновить `lib/config-sync.ts`
- [ ] Обновить `lib/condition-utils.ts`
- [ ] Обновить `lib/unified-config-adapter.ts`
- [ ] Обновить `lib/config-loader.ts`

### 🔧 Выполнение

#### 1. Обновление импортов
Заменить все импорты на новые типы.

#### 2. Обновление функций
Убедиться, что все функции работают с новыми типами.

#### 3. Тестирование
```bash
npm run build
npm test
```

### 📊 Критерии успеха
- [ ] Все утилиты обновлены
- [ ] Загрузчики работают корректно
- [ ] Проект компилируется без ошибок
- [ ] Функциональность сохранена

---

## 🔧 ПОДЭТАП 2.4: ОБНОВЛЕНИЕ КОМПОНЕНТОВ UI

### 🎯 Цель
Обновить все UI компоненты для использования новых типов.

### 📋 Задачи
- [ ] Обновить `app/game/components/ui/EntityCard.tsx`
- [ ] Обновить `app/game/components/ui/EntityList.tsx`
- [ ] Обновить `app/game/components/ui/EditModal.tsx`
- [ ] Обновить `app/game/components/ui/EnhancedEditModal.tsx`
- [ ] Обновить `components/ui/AttributeSelector.tsx`
- [ ] Обновить `components/ui/EntitySelector.tsx`
- [ ] Обновить `components/ui/OperatorSelector.tsx`
- [ ] Обновить `components/ui/ValueInput.tsx`

### 🔧 Выполнение

#### 1. Обновление пропсов
Убедиться, что все пропсы используют новые типы.

#### 2. Обновление состояний
Обновить все useState и useReducer для новых типов.

#### 3. Тестирование UI
```bash
npm run dev
# Проверить все страницы в браузере
```

### 📊 Критерии успеха
- [ ] Все компоненты обновлены
- [ ] UI отображается корректно
- [ ] Интерактивность работает
- [ ] Нет ошибок в консоли

---

## 🔧 ПОДЭТАП 2.5: ОБНОВЛЕНИЕ ХУКОВ И УТИЛИТ

### 🎯 Цель
Обновить все хуки и утилиты для использования новых типов.

### 📋 Задачи
- [ ] Обновить `app/game/hooks/useEntityEditor.ts`
- [ ] Обновить `app/game/utils/entityHelpers.ts`
- [ ] Обновить `app/game/utils/validation.ts`
- [ ] Обновить `app/game/utils/configHelpers.ts`

### 🔧 Выполнение

#### 1. Обновление типов в хуках
Заменить все типы на новые.

#### 2. Обновление утилит
Убедиться, что все функции работают с новыми типами.

#### 3. Тестирование
```bash
npm run build
npm test
```

### 📊 Критерии успеха
- [ ] Все хуки обновлены
- [ ] Утилиты работают корректно
- [ ] Проект компилируется без ошибок
- [ ] Функциональность сохранена

---

## 🔧 ПОДЭТАП 2.6: ЗАМЕНА ТИПОВ

### 🎯 Цель
Заменить все старые типы на новые во всем проекте.

### 📋 Задачи
- [ ] Заменить `UnifiedGameConfig` на `GameConfig`
- [ ] Заменить `GameAction` на `Action`
- [ ] Заменить `GameContract` на `Contract`
- [ ] Заменить `GameEvent` на `Event`
- [ ] Заменить `GameAsset` на `Character`
- [ ] Заменить `Talent` на `Character`

### 🔧 Выполнение

#### 1. Глобальный поиск и замена
```bash
# Заменить все вхождения старых типов
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/UnifiedGameConfig/GameConfig/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/GameAction/Action/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/GameContract/Contract/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/GameEvent/Event/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/GameAsset/Character/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/Talent/Character/g'
```

#### 2. Проверка компиляции
```bash
npm run build
```

#### 3. Исправление ошибок
Исправить все ошибки компиляции, связанные с заменой типов.

### 📊 Критерии успеха
- [ ] Все старые типы заменены
- [ ] Проект компилируется без ошибок
- [ ] Функциональность сохранена
- [ ] Нет конфликтов типов

---

## 🔧 ПОДЭТАП 2.7: УДАЛЕНИЕ СТАРЫХ ФАЙЛОВ

### 🎯 Цель
Удалить старые файлы типов, которые больше не нужны.

### 📋 Задачи
- [ ] Удалить `lib/types.ts`
- [ ] Удалить `lib/unified-types.ts`
- [ ] Удалить `lib/character/types.ts`

### 🔧 Выполнение

#### 1. Проверка зависимостей
Убедиться, что ни один файл не импортирует старые типы.

#### 2. Удаление файлов
```bash
rm lib/types.ts
rm lib/unified-types.ts
rm lib/character/types.ts
```

#### 3. Финальная проверка
```bash
npm run build
npm run dev
```

### 📊 Критерии успеха
- [ ] Старые файлы удалены
- [ ] Проект компилируется без ошибок
- [ ] Все функции работают
- [ ] Нет ссылок на удаленные файлы

---

## 🧪 ТЕСТИРОВАНИЕ

### 📋 План тестирования

#### 1. Компиляция
```bash
npm run build
```

#### 2. Запуск в режиме разработки
```bash
npm run dev
```

#### 3. Проверка основных страниц
- [ ] `/` - главная страница
- [ ] `/game` - игровая страница
- [ ] `/prod` - production страница
- [ ] `/game/story-editor` - редактор историй

#### 4. Проверка Character AI
- [ ] Загрузка персонажей
- [ ] Отправка сообщений
- [ ] Получение ответов

#### 5. Запуск тестов
```bash
npm test
```

### 📊 Критерии успеха
- [ ] Проект компилируется без ошибок
- [ ] Все страницы загружаются
- [ ] Character AI работает
- [ ] Все тесты проходят
- [ ] Нет ошибок в консоли

---

## 📊 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

### ✅ После завершения Этапа 2:
- **100% файлов** используют новые типы
- **0 дублирований** типов в проекте
- **Улучшенная производительность** компиляции
- **Упрощенная поддержка** кода
- **Единая система типов** во всем проекте

### 📈 Метрики успеха:
- **Сокращение файлов типов:** 3 файла → 1 файл
- **Унификация импортов:** 100%
- **Сохранение функциональности:** 100%
- **Время компиляции:** улучшение на 20-30%

---

## 🚨 РИСКИ И МИТИГАЦИЯ

### ⚠️ Потенциальные риски:
1. **Потеря функциональности** - тщательное тестирование
2. **Конфликты типов** - пошаговое обновление
3. **Проблемы с Character AI** - приоритетное обновление

### 🛡️ Стратегии митигации:
1. **Пошаговое обновление** - обновлять по одному файлу
2. **Частое тестирование** - после каждого файла
3. **Резервные копии** - коммиты после каждого подэтапа
4. **Откат плана** - возможность вернуться к предыдущему состоянию

---

## 📝 ЗАМЕТКИ

- Каждый подэтап должен быть завершен и протестирован перед переходом к следующему
- Делать коммиты после каждого значимого изменения
- Документировать все проблемы и их решения
- Поддерживать обратную совместимость где возможно
