# 🔄 ПЛАН РЕФАКТОРИНГА CYBERJACK

## 📋 **ОБЩИЙ ОБЗОР**

Проект Cyberjack имеет множественные архитектуры, которые развивались параллельно и создали значительное дублирование. Цель рефакторинга - унификация системы и устранение дублирования.

## 🎯 **ЭТАП 1: ОПРЕДЕЛЕНИЕ ЕДИНОЙ СИСТЕМЫ СУЩНОСТЕЙ**

### **1.1 АНАЛИЗ ТЕКУЩИХ НАЗВАНИЙ СУЩНОСТЕЙ**

#### **Персонажи/Активы:**
- `Asset` (lib/types.ts)
- `Character` (lib/character/types.ts)
- `Talent` (app/prod/page.tsx)
- `character` (data/characters-unified.json)

#### **Действия:**
- `GameAction` (lib/types.ts)
- `Action` (lib/unified-types.ts)
- `action` (data/actions-unified.json)

#### **Контракты:**
- `GameContract` (lib/types.ts)
- `Contract` (lib/unified-types.ts)
- `contract` (data/contracts-unified.json)

#### **События:**
- `GameEvent` (lib/types.ts)
- `Event` (lib/unified-types.ts)
- `event` (data/events-unified.json)

#### **Оборудование:**
- `GameEquipment` (lib/types.ts)
- `Equipment` (lib/unified-types.ts)
- `equipment` (data/equipment-unified.json)

### **1.2 ПРЕДЛАГАЕМАЯ ЕДИНАЯ СИСТЕМА СУЩНОСТЕЙ**

```typescript
// Единые названия для всех сущностей
export interface Character {
  id: string
  name: string
  // ... остальные поля
}

export interface Action {
  id: string
  title: string
  // ... остальные поля
}

export interface Contract {
  id: string
  title: string
  // ... остальные поля
}

export interface Event {
  id: string
  title: string
  // ... остальные поля
}

export interface Equipment {
  id: string
  name: string
  // ... остальные поля
}

export interface User {
  id: string
  username: string
  // ... остальные поля
}

export interface StoryScene {
  id: string
  title: string
  // ... остальные поля
}
```

## 🎯 **ЭТАП 2: УНИФИКАЦИЯ ТИПОВ**

### **2.1 КОНСОЛИДАЦИЯ ФАЙЛОВ ТИПОВ**

**Текущее состояние:**
- `lib/types.ts` (1283 строки) - основные типы
- `lib/unified-types.ts` (468 строк) - унифицированные типы
- `lib/character/types.ts` (326 строк) - типы персонажей

**Цель:**
- `lib/types.ts` - единый файл типов
- Удалить `lib/unified-types.ts`
- Удалить `lib/character/types.ts`

### **2.2 ПЛАН МИГРАЦИИ ТИПОВ**

1. **Создать новый `lib/types.ts`** с едиными интерфейсами
2. **Обновить все импорты** в проекте
3. **Удалить старые файлы типов**
4. **Проверить совместимость** TypeScript

## 🎯 **ЭТАП 3: УНИФИКАЦИЯ КОНФИГУРАЦИЙ**

### **3.1 КОНСОЛИДАЦИЯ ЗАГРУЗЧИКОВ**

**Текущее состояние:**
- `lib/config-loader.ts` (185 строк) - старый загрузчик
- `lib/unified-config-loader.ts` (419 строк) - новый загрузчик
- `lib/unified-config-adapter.ts` (247 строк) - адаптер
- `lib/config-sync.ts` (214 строк) - синхронизация

**Цель:**
- `lib/config-loader.ts` - единый загрузчик
- Удалить дублирующие файлы

### **3.2 КОНСОЛИДАЦИЯ ДАННЫХ**

**Текущее состояние:**
- 20 конфигурационных файлов с пересекающимися данными

**Цель:**
- `data/game-config.json` - единая конфигурация
- Удалить дублирующие файлы

## 🎯 **ЭТАП 4: УНИФИКАЦИЯ СТРАНИЦ ИГРЫ**

### **4.1 КОНСОЛИДАЦИЯ СТРАНИЦ**

**Текущее состояние:**
- `app/page.tsx` (749 строк) - главная страница с GDD
- `app/prod/page.tsx` (3022 строки) - основная игровая страница
- `app/prod/page-old.tsx` (3157 строк) - старая версия
- `app/prod/page-simple.tsx` (396 строк) - упрощенная версия
- `app/prod/page-broken.tsx` (607 строк) - сломанная версия
- `app/game/page.tsx` (1463 строки) - редактор конфигураций
- `app/game/page-new.tsx` (499 строк) - новая версия редактора

**Цель:**
- `app/page.tsx` - главная страница с GDD
- `app/game/page.tsx` - основная игровая страница
- `app/editor/page.tsx` - редактор конфигураций
- Удалить дублирующие страницы

## 🎯 **ЭТАП 5: УНИФИКАЦИЯ СИСТЕМЫ ПЕРСОНАЖЕЙ**

### **5.1 КОНСОЛИДАЦИЯ CHARACTER AI С JSON КОНФИГАМИ**

**Текущее состояние:**
- Character AI система изолирована от JSON конфигов
- Использует собственные типы Character (lib/character/types.ts)
- Создает Character объекты вручную
- Адаптер character-adapter.ts преобразует в legacy формат

**Цель:**
- Character AI использует те же JSON конфиги, что редактируются в DEV
- Единый тип Character из lib/unified-types.ts для всех систем
- Устранение дублирования типов и данных

### **5.2 ПОДРОБНЫЙ ПЛАН СЛИЯНИЯ**

#### **Шаг 1: Обновить импорты в Character AI системе**
```typescript
// Заменить во всех файлах lib/character/*.ts
// БЫЛО:
import { Character } from './types'

// СТАЛО:
import { Character } from '../unified-types'
```

**Файлы для обновления:**
- `lib/character/ai-service.ts`
- `lib/character/prompt-system.ts`
- `lib/character/memory.ts`
- `lib/character/fetishes.ts`
- `lib/character/response.ts`
- `lib/character/personal-work-integration.ts`
- `lib/character/stats.ts`
- `lib/character/prompts.ts`
- `lib/character/integration-types.ts`

#### **Шаг 2: Обновить CharacterAIService для загрузки из JSON**
```typescript
export class CharacterAIService {
  private characters: Character[] = []
  
  async loadCharactersFromConfig() {
    const config = await loadUnifiedConfig()
    this.characters = config.characters.characters
  }
  
  async getCharacterById(id: string): Character | undefined {
    return this.characters.find(c => c.id === id)
  }
  
  async analyzeInteraction(
    action: string, 
    context: any, 
    characterId: string  // Теперь принимаем ID вместо объекта
  ): Promise<CharacterResponse> {
    const character = await this.getCharacterById(characterId)
    if (!character) throw new Error(`Character ${characterId} not found`)
    
    // Остальная логика остается той же
    return this.responseManager.createCharacterResponse(character, action, context)
  }
}
```

#### **Шаг 3: Обновить useCharacterAI hook**
```typescript
// app/prod/hooks/useCharacterAI.ts
export function useCharacterAI() {
  const [characters, setCharacters] = useState<Character[]>([])
  
  useEffect(() => {
    const loadCharacters = async () => {
      const config = await loadUnifiedConfig()
      setCharacters(config.characters.characters)
    }
    loadCharacters()
  }, [])
  
  const analyzeInteraction = async (characterId: string, action: string, context: any) => {
    const character = characters.find(c => c.id === characterId)
    if (!character) return null
    
    return await characterAIService.analyzeInteraction(action, context, characterId)
  }
  
  return { characters, analyzeInteraction }
}
```

#### **Шаг 4: Обновить CharacterChat компонент**
```typescript
// app/prod/components/CharacterChat.tsx
const CharacterChat = ({ characterId }: { characterId: string }) => {
  const { characters, analyzeInteraction } = useCharacterAI()
  const character = characters.find(c => c.id === characterId)
  
  // Используем character напрямую из JSON конфига
}
```

#### **Шаг 5: Архивировать устаревшие файлы**
**Переместить в архив:**
- `lib/character/character-adapter.ts` → `backups/character-adapter.ts`
- `lib/character/types.ts` → `backups/character-types.ts`

#### **Шаг 6: Удалить дублирующие типы**
**Удалить из lib/character/types.ts:**
- `Character` interface (используем из unified-types)
- `CharacterStats` interface (используем CharacterAttributes)
- `CharacterMemory` interface (оставляем только специфичные для AI)

**Оставить только AI-специфичные типы:**
- `CharacterResponse`
- `MemoryEntry`
- `FetishAnalysis`
- `EmotionalState`

#### **Шаг 7: Обновить миграционные скрипты**
```typescript
// scripts/migrate-attributes.ts
// Обновить импорты для работы с unified-types
import { Character } from '../lib/unified-types'
```

### **5.3 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ**

#### **До слияния:**
```
📁 Character AI (изолированная)
├── Character (lib/character/types.ts)
├── Ручное создание данных
└── character-adapter.ts

📁 DEV система
├── Character (lib/unified-types.ts)
├── data/characters-unified.json
└── Редактирование в UI

📁 PROD система  
├── GameAsset (через адаптер)
├── data/characters-unified.json (через адаптер)
└── Игра
```

#### **После слияния:**
```
📁 ЕДИНАЯ СИСТЕМА
├── Character (lib/unified-types.ts) - ЕДИНЫЙ ТИП
├── data/characters-unified.json - ЕДИНЫЙ ИСТОЧНИК ДАННЫХ
├── Character AI (использует JSON напрямую)
├── DEV (редактирует JSON)
└── PROD (использует JSON через адаптер)
```

### **5.4 ПРЕИМУЩЕСТВА**

1. **Единый источник данных** - все системы используют один JSON файл
2. **Редактирование в DEV** - изменения сразу доступны в Character AI
3. **Устранение дублирования** - один тип Character для всех систем
4. **Упрощение архитектуры** - меньше адаптеров и преобразований
5. **Лучшая типизация** - единые типы для всего проекта

### **5.5 РИСКИ И МЕРЫ ПРЕДОСТОРОЖНОСТИ**

#### **Риски:**
1. Нарушение работы Character AI при изменении типов
2. Потеря данных при миграции
3. Несовместимость с существующим кодом

#### **Меры предосторожности:**
1. Создать резервные копии всех файлов
2. Поэтапное тестирование каждого компонента
3. Сохранение старых файлов в архиве
4. Тщательное тестирование Character AI функциональности

## 🎯 **ЭТАП 6: УНИФИКАЦИЯ СИСТЕМЫ СЮЖЕТОВ**

### **6.1 КОНСОЛИДАЦИЯ КОМПОНЕНТОВ**

**Текущее состояние:**
- 10 компонентов в `app/game/components/story/` с дублированием

**Цель:**
- `app/game/components/story/StoryEditor.tsx` - основной редактор
- `app/game/components/story/StoryManager.tsx` - управление
- `app/game/components/story/StoryPreview.tsx` - предпросмотр
- Удалить дублирующие компоненты

## 🎯 **ЭТАП 7: УНИФИКАЦИЯ СИСТЕМЫ УСЛОВИЙ**

### **7.1 КОНСОЛИДАЦИЯ ЛОГИКИ**

**Текущее состояние:**
- `lib/condition-utils.ts` (796 строк)
- `lib/field-configs.ts` (423 строки)
- Множественные UI компоненты

**Цель:**
- `lib/conditions/core.ts` - основная логика
- `lib/conditions/ui.tsx` - UI компоненты
- Удалить дублирующие файлы

## 🎯 **ЭТАП 8: ОЧИСТКА СКРИПТОВ И ТЕСТОВ**

### **8.1 КОНСОЛИДАЦИЯ СКРИПТОВ**

**Текущее состояние:**
- 10 миграционных скриптов
- 9 тестовых скриптов
- Множественные отладочные скрипты

**Цель:**
- `scripts/migrate.ts` - единый миграционный скрипт
- `scripts/test.ts` - единый тестовый скрипт
- Удалить дублирующие скрипты

### **8.2 КОНСОЛИДАЦИЯ ОТЧЕТОВ**

**Текущее состояние:**
- Более 50 отчетов о разработке

**Цель:**
- Архивировать устаревшие отчеты
- Оставить только актуальные

## 🎯 **ЭТАП 9: ОПТИМИЗАЦИЯ ПРОИЗВОДИТЕЛЬНОСТИ**

### **9.1 ОЧИСТКА КОДА**

- Удаление неиспользуемых импортов
- Удаление мертвого кода
- Оптимизация бандла

### **9.2 УЛУЧШЕНИЕ ТИПИЗАЦИИ**

- Строгая типизация всех компонентов
- Удаление any типов
- Добавление интерфейсов

## 🎯 **ЭТАП 10: ДОКУМЕНТАЦИЯ И ТЕСТИРОВАНИЕ**

### **10.1 ОБНОВЛЕНИЕ ДОКУМЕНТАЦИИ**

- Создание README.md с новой архитектурой
- Документирование API
- Создание руководства по разработке

### **10.2 ТЕСТИРОВАНИЕ**

- Обновление тестов под новую архитектуру
- Добавление интеграционных тестов
- Проверка работоспособности всех функций

## 📊 **ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ**

### **Экономия кода:**
- Страницы игры: 6 файлов → 3 файла (экономия 50%)
- Системы типов: 3 файла → 1 файл (экономия 67%)
- Конфигурации: 20 файлов → 5 файлов (экономия 75%)
- Компоненты сюжетов: 10 файлов → 3 файла (экономия 70%)
- Миграционные скрипты: 10 файлов → 2 файла (экономия 80%)
- Character AI система: 12 файлов → 8 файлов (экономия 33%)

### **Унификация данных:**
- **Единый источник данных:** data/characters-unified.json для всех систем
- **Единый тип Character:** lib/unified-types.ts для всех компонентов
- **Устранение адаптеров:** character-adapter.ts → архив
- **Прямое использование JSON:** Character AI использует конфиги напрямую

### **Общая экономия:** примерно 70-80% от текущего объема

## ⚠️ **РИСКИ И МЕРЫ ПРЕДОСТОРОЖНОСТИ**

### **Риски:**
1. Потеря функциональности при удалении кода
2. Нарушение совместимости между компонентами
3. Увеличение времени разработки

### **Меры предосторожности:**
1. Поэтапное выполнение с тестированием
2. Создание резервных копий перед каждым этапом
3. Тщательное тестирование после каждого этапа

## 🚀 **ПЛАН ВЫПОЛНЕНИЯ**

### **Неделя 1:**
- Этап 1: Определение единой системы сущностей
- Этап 2: Унификация типов

### **Неделя 2:**
- Этап 3: Унификация конфигураций
- Этап 4: Унификация страниц игры

### **Неделя 3:**
- Этап 5: Унификация системы персонажей (Character AI + JSON конфиги)
  - Шаг 1-2: Обновить импорты и CharacterAIService
  - Шаг 3-4: Обновить hooks и компоненты
  - Шаг 5-6: Архивировать устаревшие файлы
  - Шаг 7: Обновить миграционные скрипты

### **Неделя 4:**
- Этап 6: Унификация системы сюжетов
- Этап 7: Унификация системы условий

### **Неделя 5:**
- Этап 8: Очистка скриптов и тестов
- Этап 9: Оптимизация производительности
- Этап 10: Документация и тестирование

## 🎯 **КРИТЕРИИ УСПЕХА**

1. **Уменьшение размера кодовой базы** на 70-80%
2. **Устранение дублирования** функциональности
3. **Улучшение производительности** приложения
4. **Упрощение поддержки** кода
5. **Сохранение всей функциональности** игры

---

*План создан на основе полной инвентаризации проекта от 25.08.2025*
