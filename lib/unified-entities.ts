// ===== ЕДИНАЯ СИСТЕМА ТИПОВ CYBERJACK =====
// Объединяет все типы из lib/types.ts, lib/unified-types.ts, lib/character/types.ts

// ===== БАЗОВЫЕ ТИПЫ =====

export type CharacterRank = 'F-' | 'F' | 'F+' | 'D-' | 'D' | 'D+' | 'C-' | 'C' | 'C+' | 'B-' | 'B' | 'B+' | 'A-' | 'A' | 'A+' | 'S-' | 'S' | 'S+'
export type CharacterStatus = 'available' | 'owned' | 'training' | 'assigned' | 'inactive' | 'deleted'
export type CharacterLocation = 'talent_exchange' | 'void_border' | 'corporate_lab' | 'neural_forge' | 'player_base'
export type CharacterSource = 'market' | 'void' | 'corporate' | 'custom'

export type ActionRisk = 'low' | 'medium' | 'high' | number
export type ActionType = 'training' | 'coaching' | 'therapy' | 'punishment' | 'reward' | 'medical' | 'neural'

export type EventType = 'anomaly' | 'crisis' | 'opportunity' | 'story' | 'random'
export type EventTrigger = 'daily' | 'weekly' | 'monthly' | 'conditional' | 'random'

// ===== ХАРАКТЕРИСТИКИ ПЕРСОНАЖА =====

export interface CharacterAttributes {
  // Физические (1-10)
  strength: number      // Физическая сила и выносливость
  endurance: number     // Общая выносливость
  
  // Ментальные (1-10)
  intelligence: number  // Когнитивные способности
  creativity: number    // Творческие способности
  temperament: number   // Эмоциональная стабильность
  grit: number         // Упорство и стойкость
  
  // Социальные (1-10)
  empathy: number      // Способность понимать других
  ego: number          // Самооценка и уверенность
}

export interface CharacterStates {
  // Эмоциональные (0-100)
  mood: number         // Общее настроение
  stress: number       // Уровень стресса (объединяет fear + despair)
  
  // Поведенческие (0-5)
  obedience: number    // Послушание (объединяет compliance + habit)
  awareness: number    // Понимание ситуации
  
  // Специальные (0-5)
  devotion: number     // Преданность мастеру
  sensuality: number   // Чувственность
  sensory_overload: number // Сенсорная перегрузка
}

export interface CharacterFetishes {
  // Власть и контроль
  bdsm: number         // БДСМ
  humiliation: number  // Унижение
  masochism: number    // Мазохизм
  sadism: number       // Садизм
  
  // Психологические
  voyeurism: number    // Вуайеризм
  exhibitionism: number // Эксгибиционизм
  roleplay: number     // Ролевые игры
  
  // Физические воздействия
  bondage: number      // Связывание
  sensory_deprivation: number // Сенсорная депривация
  sensory_overload: number // Сенсорная перегрузка
  electricity: number  // Электричество
  vibration: number    // Вибрация
  temperature: number  // Температура
  pressure: number     // Давление
  tickling: number     // Щекотка
  
  // Части тела
  feet: number         // Фут-фетиш
  hands: number        // Хенд-фетиш
  breasts: number      // Брест-фетиш
  anal: number         // Анал-фетиш
  
  // Материалы
  latex: number        // Латекс
  leather: number      // Кожа
  silk: number         // Шёлк
  rope: number         // Верёвки
  
  // Специальные
  uniform: number      // Униформа
  age_play: number     // Возрастные роли
  
  // Физиологические
  pregnancy: number    // Беременность
  lactation: number    // Лактация
}

export interface CharacterPreferences {
  work_type: string[]   // Предпочитаемые типы работы
  environment: string[] // Предпочитаемая среда
  avoid: string[]       // Что избегает
}

export interface CharacterCondition {
  health: number        // Здоровье (0-100)
  mental_state: number  // Психическое состояние (0-100)
  energy: number        // Энергия (0-100)
  stress: number        // Стресс (0-100)
}

// ===== ПЕРСОНАЖ (Character) =====

export interface Character {
  // Базовые поля
  id: string
  name: string
  archetype: string
  description: string
  
  // Ранг и статус
  rank: CharacterRank
  status: CharacterStatus
  location: CharacterLocation
  source: CharacterSource
  
  // Характеристики
  attributes: CharacterAttributes
  states: CharacterStates
  fetishes: CharacterFetishes
  preferences: CharacterPreferences
  condition: CharacterCondition
  
  // AI система (из Character AI)
  memory?: CharacterMemory
  prompts?: CharacterPrompts
  
  // Метаданные
  createdAt: string
  lastInteraction?: string
  totalInteractions: number
  communicationStyle?: string
}

// ===== ДЕЙСТВИЯ (Action) =====

export interface ActionEffect {
  attributes?: { [key: string]: number }
  states?: { [key: string]: number }
  skills?: { [key: string]: number }
}

export interface ActionMemory {
  type: "positive" | "traumatic" | "professional"
  summary: string
  intensity: number
  tags: string[]
  effects?: { [key: string]: number }
}

export interface ActionProbability {
  success: number
  partial?: number
  failure: number
}

export interface ActionOutcome {
  attributes?: { [key: string]: number }
  states?: { [key: string]: number }
  skills?: { [key: string]: number }
  memory?: ActionMemory
}

export interface ActionOutcomes {
  success: ActionOutcome
  partial?: ActionOutcome
  failure: ActionOutcome
}

export interface Action {
  id: string
  title: string
  description: string
  type: ActionType
  category: string
  cost: number
  risk: ActionRisk
  duration: number
  
  // Эффекты
  effects: ActionEffect
  outcomes?: ActionOutcomes
  memory?: ActionMemory
  probability?: ActionProbability
  
  // Условия
  requirements?: { [key: string]: any }
  conditions?: { [key: string]: any }
}

export interface ActionCategory {
  title: string
  description: string
  actions: { [key: string]: Action }
}

export interface ActionsConfig {
  categories: { [key: string]: ActionCategory }
}

// ===== КОНТРАКТЫ (Contract) =====

export interface ContractRequirement {
  skills: { [key: string]: number }
  minRank: string
}

export interface ContractKPI {
  name: string
  weight: number
  current: number
  target: number
}

export interface Contract {
  id: string
  client: string
  title: string
  description: string
  type: string
  
  // Требования
  requirements: ContractRequirement
  reward: number
  deadline: number
  kpi: ContractKPI[]
  
  // Назначения
  assignedCharacters: string[]
  status: string
}

export interface ContractsConfig {
  available: Contract[]
}

// ===== СОБЫТИЯ (Event) =====

export interface Event {
  id: string
  title: string
  description: string
  type: EventType
  trigger: EventTrigger
  
  // Логика
  probability: number
  effects: ActionEffect
  conditions?: { [key: string]: any }
  
  // Время
  duration?: number
  cooldown?: number
}

export interface EventsConfig {
  events?: Event[]
  anomalies?: Event[]
  crises?: Event[]
}

// ===== ОБОРУДОВАНИЕ (Equipment) =====

export interface Equipment {
  id: string
  name: string
  description: string
  type: string
  category: string
  
  // Характеристики
  stats: { [key: string]: number }
  effects: ActionEffect
  
  // Использование
  requirements?: { [key: string]: any }
  durability?: number
  cost: number
}

export interface EquipmentConfig {
  equipment: Equipment[]
}

// ===== ПОЛЬЗОВАТЕЛИ (User) =====

export interface User {
  id: string
  name: string
  email: string
  
  // Игровые данные
  characters: string[]
  equipment: string[]
  contracts: string[]
  
  // Настройки
  preferences: { [key: string]: any }
  settings: { [key: string]: any }
}

export interface UsersConfig {
  users: User[]
}

// ===== ИСТОРИИ (StoryScene) =====

export interface StoryScene {
  id: string
  title: string
  description: string
  type: string
  
  // Содержание
  content: string
  characters: string[]
  
  // Логика
  conditions?: { [key: string]: any }
  outcomes?: { [key: string]: any }
}

// ===== УСЛОВИЯ (Condition) =====

export interface Condition {
  id: string
  name: string
  description: string
  type: string
  
  // Логика
  operator: string
  conditions: { [key: string]: any }
  
  // Результат
  effects?: { [key: string]: any }
  actions?: string[]
}

// ===== КОНФИГУРАЦИЯ ИГРЫ (GameConfig) =====

export interface GameConfig {
  // Основные сущности
  characters: Character[]
  actions: ActionsConfig
  contracts: ContractsConfig
  events: EventsConfig
  equipment: EquipmentConfig
  users: UsersConfig
  storyScenes: StoryScene[]
  conditions: Condition[]
  
  // Системные настройки
  system: { [key: string]: any }
  ui: { [key: string]: any }
  ai: { [key: string]: any }
}

// ===== CHARACTER AI ТИПЫ =====

export interface CharacterMemory {
  episodic: MemoryEntry[]
  semantic: MemoryEntry[]
  emotional: MemoryEntry[]
  summary: SummaryEntry[]
}

export interface MemoryEntry {
  id: string
  type: MemoryType
  content: string
  timestamp: string
  intensity: number
  tags: string[]
  relatedCharacters?: string[]
}

export type MemoryType = 'conversation' | 'action' | 'event' | 'emotion' | 'relationship'

export interface SummaryEntry {
  period: string
  summary: string
  keyEvents: string[]
  emotionalTrend: string
}

export interface CharacterPrompts {
  base: string
  characteristicInterpretations: CharacteristicInterpretations
  situational: SituationalPrompt[]
}

export interface CharacteristicInterpretations {
  physical: { [key: string]: string }
  psychological: { [key: string]: string }
  social: { [key: string]: string }
  personality: { [key: string]: string }
  special: { [key: string]: string }
}

export interface SituationalPrompt {
  id: string
  condition: PromptCondition
  prompt: string
  priority: number
}

export interface PromptCondition {
  type: string
  parameters: { [key: string]: any }
}

export interface CharacterResponse {
  content: string
  emotionalState: EmotionalState
  impactAnalysis: ImpactAnalysis
  fetishAnalysis?: FetishAnalysis
  memoryUpdate?: MemoryEntry
}

export interface EmotionalState {
  primary: string
  intensity: number
  secondary: string[]
  triggers: string[]
}

export interface ImpactAnalysis {
  characterImpact: { [key: string]: number }
  relationshipChange: number
  trustChange: number
  obedienceChange: number
}

export interface FetishAnalysis {
  triggeredFetishes: string[]
  intensity: number
  influence: FetishInfluence
  response: string
}

export interface FetishInfluence {
  arousal: number
  submission: number
  resistance: number
  pleasure: number
}

export interface CharacterFetish {
  name: string
  category: string
  intensity: number
  description: string
  triggers: string[]
}

export interface CharacterStats {
  physical: { [key: string]: number }
  psychological: { [key: string]: number }
  social: { [key: string]: number }
  personality: { [key: string]: number }
  special: { [key: string]: number }
}

// ===== АЛИАСЫ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ =====

export type GameAction = Action
export type GameContract = Contract
export type GameEvent = Event
export type GameAsset = Character
export type GameUser = User
export type GameEquipment = Equipment
export type Talent = Character
export type UnifiedGameConfig = GameConfig
