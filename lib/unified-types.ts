// Унифицированные TypeScript интерфейсы для оптимизированной системы

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
  stress: number        // Уровень стресса (0-100)
  fatigue: number       // Усталость (0-100)
}

export interface CharacterHistory {
  created: string       // Дата создания
  last_training: string // Последняя тренировка
  assignments: number   // Количество заданий
  success_rate: number  // Процент успешности
}

export interface CharacterMetadata {
  source: CharacterSource
  createdAt: string
  lastModified: string
}

// ===== УНИФИЦИРОВАННЫЙ ПЕРСОНАЖ =====

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
  
  // Базовые характеристики
  attributes: CharacterAttributes
  states: CharacterStates
  fetishes: CharacterFetishes
  
  // Структурированные характеристики (для совместимости с characters-unified.json)
  characteristics?: {
    physical?: { [key: string]: number }
    psychological?: { [key: string]: number }
    social?: { [key: string]: number }
    personality?: { [key: string]: number }
    special?: { [key: string]: number }
  }
  
  // Расширенные данные (опционально)
  traits?: string[]
  preferences?: CharacterPreferences
  condition?: CharacterCondition
  history?: CharacterHistory
  skills?: { [key: string]: number }
  deleted?: boolean
  deletedAt?: string | null
  
  // Метаданные
  metadata: CharacterMetadata
}

// ===== ДЕЙСТВИЯ =====

export interface ActionEffect {
  attributes?: Partial<CharacterAttributes>
  states?: Partial<CharacterStates>
  fetishes?: Partial<CharacterFetishes>
}

export interface ActionMemory {
  type: 'positive' | 'traumatic' | 'conditioned'
  summary: string
  intensity: number
  tags: string[]
  effects?: ActionEffect
}

export interface ActionProbability {
  success: number
  partial?: number
  failure: number
}

export interface ActionOutcome {
  attributes?: Partial<CharacterAttributes>
  states?: Partial<CharacterStates>
  fetishes?: Partial<CharacterFetishes>
  memory?: ActionMemory
}

export interface ActionOutcomes {
  success: ActionOutcome
  partial?: ActionOutcome
  failure: ActionOutcome
}

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

export interface ActionCategory {
  title: string
  description: string
  actions: { [key: string]: Action }
}

export interface ActionsConfig {
  categories: { [key: string]: ActionCategory }
  config: {
    settings: Record<string, any>
    conditions: any[]
    risks: any[]
  }
}

// ===== СОБЫТИЯ =====

export interface Event {
  id: string
  title: string
  description: string
  type: EventType
  trigger: EventTrigger
  probability: number
  effects: ActionEffect
  conditions?: Record<string, any>
  metadata: {
    source: string
    createdAt: string
    lastModified: string
  }
}

export interface EventsConfig {
  events: Event[]
  config: {
    settings: Record<string, any>
    conditions: any[]
    risks: any[]
  }
}

// ===== КОНТРАКТЫ =====

export interface ContractRequirement {
  skills: Partial<{ [key: string]: number }>
  minRank: CharacterRank
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
  requirements: ContractRequirement
  reward: number
  deadline: number
  kpi: ContractKPI[]
  assignedCharacters: string[]
  metadata: {
    source: string
    createdAt: string
    lastModified: string
  }
}

export interface ContractsConfig {
  contracts: Contract[]
  config: {
    settings: Record<string, any>
    conditions: any[]
    risks: any[]
  }
}

// ===== ОБОРУДОВАНИЕ =====

export interface Equipment {
  id: string
  name: string
  type: string
  description: string
  cost: number
  effects: ActionEffect
  requirements?: Record<string, any>
  metadata: {
    source: string
    createdAt: string
    lastModified: string
  }
}

export interface EquipmentConfig {
  equipment: Equipment[]
  config: {
    settings: Record<string, any>
    categories: Record<string, any>
  }
}

// ===== СИСТЕМНЫЕ ОПРЕДЕЛЕНИЯ =====

export interface SystemDefinition {
  id: string
  name: string
  description: string
  category: string
  minValue: number
  maxValue: number
  colorType?: string
}

export interface SystemDefinitions {
  attributes: SystemDefinition[]
  states: SystemDefinition[]
  fetishes: SystemDefinition[]
}

// ===== СЮЖЕТНЫЕ СЦЕНЫ =====

export interface StoryScene {
  id: string
  title: string
  description: string
  type: string
  content: string
  conditions?: Record<string, any>
  metadata: {
    source: string
    createdAt: string
    lastModified: string
  }
}

export interface StoryScenesConfig {
  scenes: StoryScene[]
  config: {
    settings: Record<string, any>
    categories: Record<string, any>
  }
}

// ===== ПОЛЬЗОВАТЕЛИ =====

export interface User {
  id: string
  username: string
  email: string
  role: string
  account: {
    balance: number
    currency: string
    transactions: any[]
  }
  characters: string[]
  lastLogin: string
  metadata: {
    source: string
    createdAt: string
    lastModified: string
  }
}

export interface UsersConfig {
  users: User[]
  config: {
    roles: Record<string, any>
    settings: Record<string, any>
  }
}

// ===== ОБЪЕДИНЕННАЯ КОНФИГУРАЦИЯ =====

export interface UnifiedGameConfig {
  characters: {
    characters: Character[]
    templates: {
      market: any[]
      void: any[]
      corporate: any[]
      neuralForge: any[]
    }
    config: {
      priceRanges: Record<string, any>
      conditions: any[]
      risks: any[]
    }
  }
  actions: ActionsConfig
  events: EventsConfig
  contracts: ContractsConfig
  equipment: EquipmentConfig
  system: SystemDefinitions
  storyScenes: StoryScenesConfig
  users: UsersConfig
  characterAI?: any // CharacterAIConfig
}

// ===== УТИЛИТЫ ДЛЯ РАБОТЫ С ТИПАМИ =====

export function isCharacter(obj: any): obj is Character {
  return obj && 
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.rank === 'string' &&
    obj.attributes &&
    obj.states &&
    obj.fetishes
}

export function isAction(obj: any): obj is Action {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.cost === 'number' &&
    obj.effects
}

export function isEvent(obj: any): obj is Event {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.probability === 'number' &&
    obj.effects
}

export function isContract(obj: any): obj is Contract {
  return obj &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.reward === 'number' &&
    obj.requirements
}

// ===== ТИПЫ ДЛЯ КОМПОНЕНТОВ =====

export type EntityType = 'character' | 'action' | 'event' | 'contract' | 'equipment' | 'storyScene' | 'user'

export interface EntityCardProps {
  entity: Character | Action | Event | Contract | Equipment | StoryScene | User
  type: EntityType
  onEdit?: (entity: any) => void
  onDelete?: (entityId: string) => void
  onView?: (entity: any) => void
  showActions?: boolean
  className?: string
}

