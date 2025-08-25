# 🎭 Character AI System - Подробный анализ

## 📋 **Обзор системы**

Character AI - это комплексная система для создания интерактивных ИИ-персонажей в NSFW игре с элементами БДСМ. Система обеспечивает естественные реакции персонажей на действия пользователя, автоматическую смену поз, анализ сообщений через Gemini API и богатую систему действий и инструментов.

## 🏗️ **Архитектура системы**

### **Основные компоненты:**

```
Character AI System
├── 🧠 MessageAnalysisService (Анализ сообщений)
├── 🎭 PoseManagementService (Управление позами)
├── 🔧 useCharacterAI Hook (Основной хук)
├── 🎨 UI Components (Панели интерфейса)
├── 📊 CharacterAdapter (Адаптер данных)
└── ⚙️ Configuration (Конфигурация)
```

## 🔍 **Детальный разбор компонентов**

### **1. MessageAnalysisService - Анализ сообщений**

**Назначение:** Анализирует сообщения пользователя через Gemini API для извлечения эмоционального содержания, команд и триггеров.

**Как работает:**
```typescript
// 1. Строит промт с контекстом персонажа
const prompt = this.buildAnalysisPrompt(message, characterContext, currentStates);

// 2. Отправляет запрос к Gemini API
const response = await this.callGeminiAPI(prompt);

// 3. Парсит структурированный ответ
return this.parseAnalysisResponse(response);
```

**Анализируемые аспекты:**
- **Эмоциональное содержание**: угроза, удовольствие, боль, страх, возбуждение
- **Команды**: смена позы, выполнение действий, использование инструментов
- **Триггеры фетишей**: активация фетишей на основе контента
- **Изменения характеристик**: предложения изменений статов

**Пример промта:**
```typescript
{
  "emotionalContent": {
    "threat": 0.8,      // Угроза
    "pleasure": 0.3,    // Удовольствие
    "pain": 0.1,        // Боль
    "fear": 0.6,        // Страх
    "arousal": 0.2      // Возбуждение
  },
  "commands": {
    "poseChange": {
      "poseId": "kneeling_submissive",
      "force": false
    },
    "action": {
      "actionId": "verbal_command",
      "intensity": 7
    }
  },
  "fetishTriggers": ["dominance", "submission"],
  "statChanges": {
    "fear": 2,
    "obedience": 1
  },
  "response": "Да, хозяин... *опускается на колени*"
}
```

### **2. PoseManagementService - Управление позами**

**Назначение:** Управляет автоматической сменой поз на основе условий, состояний персонажа и действий пользователя.

**Основные функции:**

#### **Проверка условий смены позы:**
```typescript
checkPoseChangeConditions(
  currentPose: string,
  characterStates: { [key: string]: number },
  characterAttributes: { [key: string]: number },
  activeFetishes: { [key: string]: number },
  userActions: string[],
  environment: { equipment: string[], location: string, privacy: string }
)
```

#### **Типы условий:**
- **trust** - на основе доверия
- **fear** - на основе страха
- **obedience** - на основе подчинения
- **pleasure** - на основе удовольствия
- **pain** - на основе боли
- **command** - по команде
- **automatic** - автоматические

#### **Пример условия:**
```typescript
{
  id: "high_fear_kneeling",
  type: "fear",
  conditions: {
    states: { fear: { min: 7 } },
    attributes: { obedience: { min: 5 } }
  },
  targetPose: "kneeling_submissive",
  probability: 0.8,
  cooldown: 30,
  message: "От страха опускается на колени"
}
```

### **3. useCharacterAI Hook - Основной хук**

**Назначение:** Центральный хук, объединяющий все сервисы и предоставляющий API для взаимодействия с системой.

**Состояние хука:**
```typescript
interface UseCharacterAIReturn {
  // Состояние
  currentPose: string;
  poseHistory: Array<{ poseId: string; timestamp: number; reason: string }>;
  lastAction: string | null;
  lastTool: string | null;
  cooldowns: { [key: string]: number };
  
  // Сервисы
  messageAnalysisService: MessageAnalysisService | null;
  poseManagementService: PoseManagementService | null;
  
  // Действия
  executeAction: (actionId: string, intensity: number, area?: string) => Promise<void>;
  useTool: (toolId: string, intensity: number, duration: number, area?: string) => Promise<void>;
  changePose: (poseId: string, force?: boolean) => Promise<boolean>;
  analyzeMessage: (message: string) => Promise<MessageAnalysis>;
  
  // Проверки
  canExecuteAction: (actionId: string) => boolean;
  canUseTool: (toolId: string) => boolean;
  canChangePose: (poseId: string) => boolean;
}
```

**Основные методы:**

#### **executeAction - Выполнение действия:**
```typescript
const executeAction = async (actionId: string, intensity: number, area?: string) => {
  const action = characterAIConfig.actions[actionId];
  if (!action) return;
  
  // Проверяем требования
  if (!canExecuteAction(actionId)) return;
  
  // Применяем эффекты
  const effects = calculateActionEffects(action, intensity, characterStates);
  applyEffects(effects);
  
  // Проверяем автоматическую смену позы
  await checkAutomaticPoseChanges();
  
  // Обновляем кулдауны
  setCooldowns(prev => ({ ...prev, [actionId]: action.cooldown }));
};
```

#### **analyzeMessage - Анализ сообщения:**
```typescript
const analyzeMessage = async (message: string): Promise<MessageAnalysis> => {
  if (!messageAnalysisService) {
    return getDefaultAnalysis();
  }
  
  const analysis = await messageAnalysisService.analyzeMessage(
    message,
    characterContext,
    characterStates
  );
  
  // Применяем изменения из анализа
  if (analysis.statChanges) {
    applyStatChanges(analysis.statChanges);
  }
  
  // Выполняем команды
  if (analysis.commands.poseChange?.poseId) {
    await changePose(analysis.commands.poseChange.poseId, analysis.commands.poseChange.force);
  }
  
  return analysis;
};
```

### **4. CharacterAdapter - Адаптер данных**

**Назначение:** Преобразует данные из системы Talent в формат, понятный Character AI.

**Основные преобразования:**

#### **Talent → Character:**
```typescript
static talentToCharacter(talent: any): Character {
  return {
    id: talent.id,
    name: talent.name,
    archetype: talent.role || 'default',
    
    // Преобразуем характеристики (0-100 → 0-10)
    stats: this.convertTalentStatsToCharacterStats(talent),
    
    // Преобразуем фетиши
    fetishes: this.convertTalentFetishesToCharacterFetishes(talent),
    
    // Определяем эмоциональное состояние
    emotionalState: this.determineEmotionalState(talent)
  };
}
```

#### **Нормализация характеристик:**
```typescript
private static convertTalentStatsToCharacterStats(talent: any): CharacterStats {
  const normalize = (value: number) => Math.min(10, Math.max(0, value / 10));
  
  return {
    physical: {
      endurance: normalize(talent.states?.endurance || 50),
      sensitivity: normalize(talent.states?.sensuality || 50),
      flexibility: normalize(talent.attributes?.strength || 50)
    },
    psychological: {
      emotionalStability: normalize(talent.states?.mood || 50),
      adaptability: normalize(talent.attributes?.empathy || 50),
      intelligence: normalize(talent.attributes?.intelligence || 50)
    }
    // ... другие характеристики
  };
}
```

## 🎯 **Система действий и инструментов**

### **Действия (Actions):**
```typescript
interface InteractiveAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'physical' | 'emotional' | 'intimate' | 'punishment' | 'reward';
  intensity: number;        // 1-10
  cost: number;            // Стоимость в НП
  effects: {
    physical?: { [key: string]: number };
    emotional?: { [key: string]: number };
    fetish?: { [key: string]: number };
  };
  requirements: {
    trustLevel?: number;
    equipment?: string[];
  };
  cooldown: number;        // В секундах
}
```

**Пример действия:**
```typescript
{
  id: "hit_whip",
  name: "Ударить плетью",
  description: "Удар плетью по телу",
  icon: "🪢",
  category: "punishment",
  intensity: 7,
  cost: 2,
  effects: {
    physical: { pain: 3, sensitivity: 2 },
    emotional: { fear: 2, obedience: 2 }
  },
  requirements: { trustLevel: 3 },
  cooldown: 10
}
```

### **Инструменты (Tools):**
```typescript
interface InteractiveTool {
  id: string;
  name: string;
  type: 'vibration' | 'electricity' | 'temperature' | 'pressure' | 'stimulation';
  intensity: number;        // 1-10
  duration: number;         // В секундах
  effects: {
    physical?: { [key: string]: number };
    emotional?: { [key: string]: number };
    fetish?: { [key: string]: number };
  };
  requirements: {
    equipment?: string[];
    powerLevel?: number;
  };
  cooldown: number;
}
```

**Пример инструмента:**
```typescript
{
  id: "electric_stimulator",
  name: "Электростимулятор",
  description: "Устройство для электрической стимуляции",
  icon: "⚡",
  type: "electricity",
  intensity: 8,
  duration: 20,
  effects: {
    physical: { arousal: 3, pain: 2 },
    emotional: { fear: 1 },
    fetish: { electricity: 1 }
  },
  requirements: {
    equipment: ["electric_stimulator"],
    powerLevel: 3
  },
  cooldown: 20
}
```

## 🎭 **Система поз**

### **Структура позы:**
```typescript
interface Pose {
  id: string;
  name: string;
  category: 'standing' | 'sitting' | 'lying' | 'kneeling' | 'restrained';
  difficulty: number;       // 1-5
  requirements: {
    flexibility?: number;
    strength?: number;
    trustLevel?: number;
  };
  effects: {
    physical?: { [key: string]: number };
    emotional?: { [key: string]: number };
    fetish?: { [key: string]: number };
  };
  tags: string[];
}
```

**Пример позы:**
```typescript
{
  id: "kneeling_submissive",
  name: "Поза подчинения",
  description: "Стоя на коленях, голова опущена",
  category: "kneeling",
  difficulty: 2,
  requirements: {
    flexibility: 2,
    trustLevel: 3
  },
  effects: {
    emotional: { obedience: 1, submission: 1 },
    fetish: { submission: 1 }
  },
  tags: ["submissive", "formal", "respectful"]
}
```

## 🔄 **Поток данных в системе**

### **1. Инициализация:**
```
Talent Data → CharacterAdapter → Character → useCharacterAI → Services
```

### **2. Выполнение действия:**
```
User Action → executeAction() → Check Requirements → Apply Effects → Check Pose Changes → Update State
```

### **3. Анализ сообщения:**
```
User Message → analyzeMessage() → Gemini API → Parse Response → Apply Changes → Execute Commands
```

### **4. Автоматическая смена позы:**
```
State Change → checkAutomaticPoseChanges() → Check Conditions → Calculate Probability → Execute Pose Change
```

## 🎨 **UI Компоненты**

### **ActionToolPanel:**
- **Вкладки**: Действия, Инструменты, Позы
- **Настройка интенсивности**: Слайдеры для настройки силы воздействия
- **Фильтрация**: По доступности, категориям, требованиям
- **Подсказки**: Описания эффектов и требований

### **CharacterChat:**
- **Чат с персонажем**: Анализ сообщений через Gemini
- **Автоматические реакции**: На основе анализа
- **Применение изменений**: Автоматическое изменение характеристик

## 📊 **Конфигурация системы**

### **Основные файлы:**
- `game-config-unified.json` - Основная конфигурация Character AI
- `character-ai-config.json` - Детальная конфигурация (удален, теперь в unified)
- `lib/types.ts` - TypeScript типы системы

### **Структура конфигурации:**
```json
{
  "characterAI": {
    "actionCategories": { /* Категории действий */ },
    "toolCategories": { /* Категории инструментов */ },
    "actions": { /* Действия */ },
    "tools": { /* Инструменты */ },
    "poses": { /* Позы */ },
    "poseChangeConditions": { /* Условия смены позы */ },
    "quickActions": { /* Быстрые действия */ },
    "interactiveAreas": { /* Интерактивные области */ },
    "llmPrompts": { /* Промты для LLM */ }
  }
}
```

## 🔧 **Технические особенности**

### **1. Нормализация данных:**
- Все значения характеристик нормализуются в диапазон 0-10
- Автоматическое преобразование между системами Talent и Character

### **2. Система кулдаунов:**
- Предотвращение спама действий
- Настраиваемые кулдауны для каждого действия/инструмента
- Автоматическое обновление таймеров

### **3. Вероятностная система:**
- Условия смены позы имеют вероятность срабатывания
- Учет множественных факторов при расчете вероятности
- Случайность для естественности поведения

### **4. Интеграция с Gemini API:**
- Анализ естественного языка
- Извлечение команд и эмоций
- Генерация контекстных ответов

## 🎯 **Преимущества системы**

### **1. Модульность:**
- Разделение ответственности между сервисами
- Легкое расширение и модификация
- Переиспользование компонентов

### **2. Гибкость:**
- Настраиваемые условия и эффекты
- Поддержка различных типов действий
- Расширяемая система фетишей

### **3. Естественность:**
- Анализ естественного языка
- Вероятностные реакции
- Контекстные ответы

### **4. Производительность:**
- Кэширование результатов анализа
- Оптимизированные проверки условий
- Эффективное управление состоянием

## 📝 **Заключение**

Character AI система представляет собой сложную, но хорошо структурированную архитектуру для создания интерактивных ИИ-персонажей. Система обеспечивает естественное поведение персонажей через анализ сообщений, автоматическую смену поз и богатую систему действий и инструментов.

**Ключевые особенности:**
- ✅ **Модульная архитектура** с четким разделением ответственности
- ✅ **Интеграция с Gemini API** для анализа естественного языка
- ✅ **Вероятностная система** для естественных реакций
- ✅ **Гибкая конфигурация** для настройки поведения
- ✅ **Адаптер данных** для интеграции с существующей системой
- ✅ **Богатый UI** для взаимодействия с системой

**Статус:** ✅ **Система полностью функциональна и готова к использованию**
