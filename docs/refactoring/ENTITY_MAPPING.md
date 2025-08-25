# 🗺️ КАРТА СУЩНОСТЕЙ CYBERJACK - ПОЛНАЯ ИЕРАРХИЯ С ДУБЛЯМИ

## 📋 **ОБЩИЙ ОБЗОР**

Данный документ содержит полную карту всех сущностей в проекте Cyberjack с указанием дублей, различий и мест использования.

## 🎭 **1. СУЩНОСТИ ПЕРСОНАЖЕЙ (ДУБЛИРОВАНИЕ)**

### **1.1 Character (Персонаж) - 4 РАЗНЫХ ОПРЕДЕЛЕНИЯ**

#### **A. Character (lib/character/types.ts)**
```typescript
export interface Character {
  id: string
  name: string
  archetype: string
  description: string
  stats: CharacterStats
  memory: CharacterMemory
  fetishes: CharacterFetishes
  emotionalState: string
  prompts: CharacterPrompts
  createdAt: string
  lastInteraction: string
  totalInteractions: number
  communicationStyle: string
}
```
**Использование:**
- `lib/character/ai-service.ts`
- `lib/character/character-adapter.ts`
- `lib/character/personal-work-integration.ts`

**Конфигурация:** Нет прямой связи с JSON файлами

---

#### **B. Character (lib/unified-types.ts)**
```typescript
export interface Character {
  id: string
  name: string
  rank: CharacterRank
  avatar: string
  price: number
  specialization: string
  description: string
  status: CharacterStatus
  owner: string | null
  location: CharacterLocation
  attributes: CharacterAttributes
  states: CharacterStates
  fetishes: CharacterFetishes
  characteristics?: { /* структурированные характеристики */ }
  traits?: string[]
  preferences?: CharacterPreferences
  condition?: CharacterCondition
  history?: CharacterHistory
  skills?: { [key: string]: number }
  deleted?: boolean
  deletedAt?: string | null
  metadata: CharacterMetadata
}
```
**Использование:**
- `lib/unified-config-loader.ts`
- `lib/unified-config-adapter.ts`
- `app/game/page.tsx`

**Конфигурация:** `data/characters-unified.json`

---

#### **C. GameAsset (lib/types.ts)**
```typescript
export interface GameAsset {
  id: string
  name: string
  rank: string
  avatar: string
  price: number
  specialization: string
  description: string
  status: string
  owner: string
  location: string
  attributes: AssetAttributes
  skills: AssetSkills
  preferences: AssetPreferences
  fetishes: AssetFetishes
  condition: AssetCondition
  history: AssetHistory
  traits: string[]
  deleted: boolean
  deletedAt: string | null
}
```
**Использование:**
- `app/prod/page.tsx`
- `lib/condition-utils.ts`
- `lib/config-loader.ts`

**Конфигурация:** `data/assets-from-characters.json`

---

#### **D. Asset (lib/types.ts)**
```typescript
export interface Asset {
  id: string
  name: string
  rank: string
  avatar: string
  price: number
  specialization: string
  description: string
  status: string
  owner: string
  location: string
  attributes: AssetAttributes
  skills: AssetSkills
  preferences: AssetPreferences
  fetishes: AssetFetishes
  condition: AssetCondition
  history: AssetHistory
  traits: string[]
  deleted: boolean
  deletedAt: string | null
}
```
**Использование:**
- `lib/condition-utils.ts`
- `lib/field-configs.ts`

**Конфигурация:** Используется в условиях и конфигурациях полей

---

### **1.2 Talent (app/prod/page.tsx)**
```typescript
interface Talent {
  id: string
  name: string
  role: string
  level: number
  mood: number
  fear: number
  despair: number
  devotion: number
  strength: number
  empathy: number
  intelligence: number
  creativity: number
  status: "available" | "working" | "resting"
  memories: string[]
  experience: number
  maxExperience: number
  statusEffects: StatusEffect[]
  equippedItems: Equipment[]
  inventory: Equipment[]
  neuralPulses?: number
  attributes: { /* плоские атрибуты */ }
  states: { /* состояния */ }
  skills: { /* навыки */ }
}
```
**Использование:** Только в `app/prod/page.tsx`
**Конфигурация:** Нет прямой связи с JSON файлами

---

## ⚡ **2. СУЩНОСТИ ДЕЙСТВИЙ (ДУБЛИРОВАНИЕ)**

### **2.1 Action - 3 РАЗНЫХ ОПРЕДЕЛЕНИЯ**

#### **A. GameAction (lib/types.ts)**
```typescript
export interface GameAction {
  title: string
  description: string
  cost: number
  risk?: "low" | "medium" | "high" | number
  effects: ActionEffect
  memory?: ActionMemory
  probability?: ActionProbability
  outcomes?: ActionOutcomes
  riskEffects?: ActionEffect
}
```
**Использование:**
- `app/prod/page.tsx`
- `lib/config-loader.ts`

**Конфигурация:** `data/actions-unified.json`

---

#### **B. Action (lib/unified-types.ts)**
```typescript
export interface Action {
  id: string
  category: string
  title: string
  description: string
  cost: number
  risk?: ActionRisk
  effects: ActionEffect
  riskEffects?: ActionEffect
  probability?: ActionProbability
  outcomes?: ActionOutcomes
  memory?: ActionMemory
  metadata: {
    source: string
    createdAt: string
    lastModified: string
  }
}
```
**Использование:**
- `lib/unified-config-loader.ts`
- `lib/unified-config-adapter.ts`

**Конфигурация:** `data/actions-unified.json`

---

#### **C. Action (lib/types/actions.ts)**
```typescript
export interface Action {
  id: string
  title: string
  description: string
  category: string
  cost: number
  requirements: ActionRequirements
  effects: ActionEffect
  cooldown?: number
  duration?: number
  risk?: "low" | "medium" | "high"
  successRate?: number
  metadata?: {
    source: string
    createdAt: string
    lastModified: string
  }
}
```
**Использование:** Нет прямого использования
**Конфигурация:** Нет прямой связи

---

### **2.2 QuickAction - 2 РАЗНЫХ ОПРЕДЕЛЕНИЯ**

#### **A. QuickAction (lib/types/actions.ts)**
```typescript
export interface QuickAction {
  id: string
  title: string
  description: string
  category: string
  requirements: QuickActionRequirements
  effects: QuickActionEffect
  cooldown: number
  duration: number
  risk: "low" | "medium" | "high"
  successRate: number
}
```

#### **B. QuickAction (lib/types.ts)**
```typescript
export interface QuickAction {
  id: string
  title: string
  description: string
  category: string
  cost: number
  requirements: { [key: string]: number }
  effects: { [key: string]: number }
  cooldown: number
  duration: number
  risk: "low" | "medium" | "high"
  successRate: number
  metadata?: {
    source: string
    createdAt: string
    lastModified: string
  }
}
```

---

## 📋 **3. СУЩНОСТИ КОНТРАКТОВ (ДУБЛИРОВАНИЕ)**

### **3.1 Contract - 2 РАЗНЫХ ОПРЕДЕЛЕНИЯ**

#### **A. GameContract (lib/types.ts)**
```typescript
export interface GameContract {
  id: string
  client: string
  title: string
  description: string
  requirements: ContractRequirement
  reward: number
  deadline: number
  kpi: ContractKPI[]
  assignedTalents: string[]
}
```

#### **B. Contract (lib/unified-types.ts)**
```typescript
export interface Contract {
  id: string
  client: string
  title: string
  description: string
  requirements: ContractRequirement
  reward: number
  deadline: number
  kpi: ContractKPI[]
  assignedTalents: string[]
  status: string
  storyScenes: { [key: string]: any }
}
```

---

## 🎲 **4. СУЩНОСТИ СОБЫТИЙ (ДУБЛИРОВАНИЕ)**

### **4.1 Event - 2 РАЗНЫХ ОПРЕДЕЛЕНИЯ**

#### **A. GameEvent (lib/types.ts)**
```typescript
export interface GameEvent {
  id: string
  title: string
  description: string
  probability: number
  effects: ActionEffect
  conditions?: { [key: string]: any }
}
```

#### **B. Event (lib/unified-types.ts)**
```typescript
export interface Event {
  id: string
  title: string
  description: string
  type: EventType
  probability: number
  effects: ActionEffect
  conditions?: { [key: string]: any }
  metadata: {
    source: string
    createdAt: string
    lastModified: string
  }
}
```

---

## 🛠️ **5. СУЩНОСТИ ОБОРУДОВАНИЯ (ДУБЛИРОВАНИЕ)**

### **5.1 Equipment - 3 РАЗНЫХ ОПРЕДЕЛЕНИЯ**

#### **A. GameEquipment (lib/types.ts)**
```typescript
export interface GameEquipment {
  id: string
  name: string
  type: string
  description: string
  price: number
  effects: EquipmentEffect[]
  powerSettings: EquipmentPowerSettings
  requirements: { [key: string]: number }
  cooldown: number
  duration: number
  risk: "low" | "medium" | "high"
  metadata?: {
    source: string
    createdAt: string
    lastModified: string
  }
}
```

#### **B. Equipment (lib/unified-types.ts)**
```typescript
export interface Equipment {
  id: string
  name: string
  type: string
  description: string
  price: number
  effects: { [key: string]: number }
  requirements: { [key: string]: number }
  cooldown: number
  duration: number
  risk: "low" | "medium" | "high"
  metadata: {
    source: string
    createdAt: string
    lastModified: string
  }
}
```

#### **C. Equipment (lib/types/character.ts)**
```typescript
export interface Equipment {
  id: string
  name: string
  type: string
  description: string
  effects: EquipmentEffect[]
  settings: EquipmentSettings
  requirements: { [key: string]: number }
  cooldown: number
  duration: number
  risk: "low" | "medium" | "high"
}
```

---

## 👤 **6. СУЩНОСТИ ПОЛЬЗОВАТЕЛЕЙ (ДУБЛИРОВАНИЕ)**

### **6.1 User - 2 РАЗНЫХ ОПРЕДЕЛЕНИЯ**

#### **A. GameUser (lib/types.ts)**
```typescript
export interface GameUser {
  id: string
  username: string
  email: string
  role: UserRole
  status: string
  created: string
  lastLogin: string
  account: UserAccount
  assets: UserAsset[]
  equipment: UserEquipment[]
  settings: UserSettings
}
```

#### **B. User (lib/unified-types.ts)**
```typescript
export interface User {
  id: string
  username: string
  email: string
  role: string
  status: string
  created: string
  lastLogin: string
  account: {
    balance: number
    currency: string
  }
  assets: string[]
  equipment: string[]
  settings: {
    riskTolerance: string
    theme: string
    notifications: boolean
    autoAssign: boolean
  }
}
```

---

## 📖 **7. СУЩНОСТИ СЮЖЕТОВ (ДУБЛИРОВАНИЕ)**

### **7.1 StoryScene - 4 РАЗНЫХ ОПРЕДЕЛЕНИЯ**

#### **A. StoryScene (lib/types.ts)**
```typescript
export interface StoryScene {
  id: string
  title: string
  description: string
  screens: StoryScreen[]
  conditions?: { [key: string]: any }
  metadata?: {
    source: string
    createdAt: string
    lastModified: string
  }
}
```

#### **B. StoryScene (lib/unified-types.ts)**
```typescript
export interface StoryScene {
  id: string
  title: string
  description: string
  type: string
  conditions?: { [key: string]: any }
  metadata: {
    source: string
    createdAt: string
    lastModified: string
  }
}
```

#### **C. StoryScene (lib/simple-story-types.ts)**
```typescript
export interface SimpleScene {
  id: string
  title: string
  description: string
  conditions?: SimpleCondition[]
  probability?: number
  content: {
    text: string
    background?: string
    music?: string
  }
  choices: SimpleChoice[]
}
```

#### **D. StoryScene (lib/story-binding-types.ts)**
```typescript
export interface StorySceneWithBindings {
  scene: StoryScene
  bindings: SceneEventBinding[]
}
```

---

## 🎯 **8. СУЩНОСТИ УСЛОВИЙ (ДУБЛИРОВАНИЕ)**

### **8.1 Condition - МНОЖЕСТВЕННЫЕ ОПРЕДЕЛЕНИЯ**

#### **A. BaseCondition (lib/types.ts)**
```typescript
export interface BaseCondition {
  entityType: string
  entityId?: string
  property: string
  operator: string
  value: any
  logic?: "AND" | "OR"
  conditions?: BaseCondition[]
}
```

#### **B. SimpleCondition (lib/simple-story-types.ts)**
```typescript
export interface SimpleCondition {
  entityType: 'asset' | 'user' | 'equipment' | 'station' | 'story_point'
  entityId?: string
  property: string
  operator: '==' | '!=' | '>' | '<' | '>=' | '<='
  value: any
  logic?: 'AND' | 'OR'
  conditions?: SimpleCondition[]
}
```

---

## 📊 **9. СУЩНОСТИ КОНФИГУРАЦИЙ (ДУБЛИРОВАНИЕ)**

### **9.1 GameConfig - 2 РАЗНЫХ ОПРЕДЕЛЕНИЯ**

#### **A. GameConfig (lib/types.ts)**
```typescript
export interface GameConfig {
  assets: AssetsConfig
  actions: ActionsConfig
  contracts: ContractsConfig
  events: EventsConfig
  equipment: EquipmentConfig
  system: SystemDefinitions
  storyScenes: StoryScenesConfig
  users: UsersConfig
  characterAI: CharacterAIConfig
}
```

#### **B. UnifiedGameConfig (lib/unified-types.ts)**
```typescript
export interface UnifiedGameConfig {
  characters: {
    characters: Character[]
    templates: { [key: string]: any }
    config: { [key: string]: any }
  }
  actions: {
    categories: { [key: string]: ActionCategory }
  }
  contracts: {
    available: Contract[]
  }
  events: {
    events: Event[]
  }
  equipment: {
    equipment: Equipment[]
  }
  system: SystemDefinitions
  storyScenes: {
    scenes: StoryScene[]
  }
  users: {
    users: User[]
  }
  characterAI: any
}
```

---

## 🔄 **10. ПЛАН УНИФИКАЦИИ**

### **10.1 ПРИОРИТЕТЫ СЛИЯНИЯ**

1. **Character/Asset/GameAsset** → **Character** (lib/unified-types.ts)
2. **GameAction/Action** → **Action** (lib/unified-types.ts)
3. **GameContract/Contract** → **Contract** (lib/unified-types.ts)
4. **GameEvent/Event** → **Event** (lib/unified-types.ts)
5. **GameEquipment/Equipment** → **Equipment** (lib/unified-types.ts)
6. **GameUser/User** → **User** (lib/unified-types.ts)
7. **StoryScene/SimpleScene** → **StoryScene** (lib/unified-types.ts)

### **10.2 СТРАТЕГИЯ СЛИЯНИЯ**

1. **Выбрать базовую сущность** (обычно из lib/unified-types.ts)
2. **Добавить недостающие поля** из других определений
3. **Создать адаптеры** для совместимости
4. **Обновить импорты** во всех файлах
5. **Удалить дублирующие определения**

### **10.3 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ**

- **Уменьшение количества интерфейсов** с ~50 до ~15
- **Устранение дублирования** типов
- **Упрощение поддержки** кода
- **Улучшение типизации** проекта

---

*Карта создана на основе анализа всех TypeScript файлов проекта от 25.08.2025*
