// Единые TypeScript интерфейсы для всех конфигураций игры

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

export interface ActionCategory {
  title: string
  description: string
  actions: { [key: string]: GameAction }
}

export interface ActionsConfig {
  categories: { [key: string]: ActionCategory }
}

// Контракты
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

export interface ContractsConfig {
  available: GameContract[]
}

// События
export interface GameEvent {
  id: string
  title: string
  description: string
  probability: number
  effects: ActionEffect
  conditions?: { [key: string]: any }
}

export interface EventsConfig {
  events?: GameEvent[]
  anomalies?: GameEvent[]
  crises?: GameEvent[]
  opportunities?: GameEvent[]
}

// Активы
export interface AssetAttributes {
  // Основные атрибуты (существующие)
  strength: number
  empathy: number
  intelligence: number
  temperament: number
  grit: number
  ego: number
  loyalty: number
  obedience: number
  resistance: number
  
  // Дополнительные атрибуты (новые)
  creativity?: number
  endurance?: number
  sensitivity?: number
  flexibility?: number
  emotional_stability?: number
  adaptability?: number
  sociability?: number
  dominance?: number
  self_esteem?: number
  optimism?: number
  curiosity?: number
  sexual_experience?: number
  dependency?: number
}

export interface AssetSkills {
  // Домашние навыки
  maid?: number
  cooking?: number
  
  // Технические навыки
  neural_hacking?: number
  maintenance?: number
  data?: number
  
  // Сексуальные навыки
  orgasm_control?: number
  massage?: number
  bondage?: number
  roleplay?: number
  
  // Практические навыки
  field?: number
  logistics?: number
  medical?: number
  
  // Социальные навыки
  etiquette?: number
  seduction?: number
  communication?: number
  leadership?: number
  
  // Творческие навыки
  dance?: number
  stage?: number
  creativity?: number
  
  // Специализированные навыки
  interrogation?: number
  surveillance?: number
  problem_solving?: number
  adaptability?: number
  stress_management?: number
  self_control?: number
  
  [key: string]: number | undefined
}

export interface AssetPreferences {
  work_type: string[]
  environment: string[]
  avoid: string[]
}

export interface AssetFetishes {
  bdsm?: number
  humiliation?: number
  bondage?: number
  masochism?: number
  sadism?: number
  voyeurism?: number
  exhibitionism?: number
  roleplay?: number
  sensory_deprivation?: number
  sensory_overload?: number
  electricity?: number
  vibration?: number
  temperature?: number
  pressure?: number
  tickling?: number
  feet?: number
  hands?: number
  breasts?: number
  anal?: number
  latex?: number
  leather?: number
  silk?: number
  rope?: number
  uniform?: number
  age_play?: number
  pregnancy?: number
  lactation?: number
  [key: string]: number | undefined
}

export interface AssetCondition {
  // Основные состояния (существующие)
  health: number
  mental_state: number
  stress: number
  fatigue: number
  
  // Дополнительные состояния (новые)
  mood?: number
  fear?: number
  despair?: number
  devotion?: number
  trust?: number
  relationship?: number
  pleasure?: number
  pain?: number
  arousal?: number
  anxiety?: number
  happiness?: number
  sadness?: number
  anger?: number
  shame?: number
  guilt?: number
  pride?: number
  humiliation?: number
  submission?: number
  dominance?: number
  vulnerability?: number
  confidence?: number
  helplessness?: number
  entitlement?: number
  awareness?: number
  routine?: number
  compliance?: number
  sensuality?: number
  sensory_overload?: number
}

export interface AssetHistory {
  created: string
  last_training: string
  assignments: number
  success_rate: number
}

export interface GameAsset {
  id: string
  name: string
  rank: 'Низкое' | 'Среднее' | 'Высокое' | 'Премиум' | 'Элитное'
  price: number
  specialization: string
  description: string
  attributes: AssetAttributes
  skills: AssetSkills
  fetishes?: AssetFetishes
  traits: string[]
  preferences: AssetPreferences
  condition: AssetCondition
  history: AssetHistory
}

export interface AssetType {
  name: string
  description: string
  priceRange: [number, number]
  skillCap: number
}

export interface AssetsConfig {
  assets: GameAsset[]
  assetTypes: { [key: string]: AssetType }
  skillCategories: { [key: string]: string[] }
}

// Пользователи
export interface UserTransaction {
  id: string
  type: 'purchase' | 'income' | 'expense' | 'refund'
  amount: number
  description: string
  date: string
}

export interface UserAccount {
  balance: number
  currency: string
  transactions: UserTransaction[]
}

export interface UserAsset {
  assetId: string
  name: string
  acquired: string
  status: 'active' | 'training' | 'inactive'
  location: string
  currentAssignment: string | null
}

export interface UserEquipment {
  itemId: string
  name: string
  type: string
  slot: string
  installed: string
  status: 'active' | 'inactive' | 'damaged'
}

export interface UserSettings {
  theme: string
  notifications: boolean
  autoAssign: boolean
  riskTolerance: 'low' | 'medium' | 'high'
}

export interface GameUser {
  id: string
  username: string
  email: string
  role: string
  status: 'active' | 'inactive' | 'banned'
  created: string
  lastLogin: string
  account: UserAccount
  assets: UserAsset[]
  equipment: UserEquipment[]
  settings: UserSettings
}

export interface UserRole {
  name: string
  permissions: string[]
  description: string
}

export interface UsersConfig {
  users: GameUser[]
  userRoles: { [key: string]: UserRole }
}

// Рынок
export interface MarketTalent {
  id: string
  name: string
  specialization: string
  rank: string
  price: number
  availability: number
}

export interface MarketSection {
  id: string
  name: string
  description: string
  talents: MarketTalent[]
}

export interface CharacterConfig {
  characters: any[]
  templates: { [key: string]: any }
  config: {
    skillCategories?: { [key: string]: any }
    fetishCategories?: { [key: string]: any }
  }
}

export interface MarketConfig {
  talentExchange?: MarketTalent[]
  voidRescues?: any[]
  corporateContracts?: any[]
  neuralForge?: { [key: string]: any }
}

// Оборудование
export interface EquipmentEffect {
  [key: string]: number
}

export interface EquipmentPowerSettings {
  min: number
  max: number
  default: number
}

export interface GameEquipment {
  id: string
  name: string
  type: "clothing" | "implant" | "device"
  slot: string
  description: string
  effects: EquipmentEffect
  enabled: boolean
  targetTalents: string[]
  powerLevel?: number
  mode?: string
  removable?: boolean
  powerSettings?: EquipmentPowerSettings
  settings?: {
    targetTalents?: string[]
    effectMultiplier?: number
  }
  maxPowerLevel?: number
  activeMode?: string
  energyConsumption?: number
  cooldownTime?: number
  lastUsed?: number
  equippedBy?: string
  rarity?: string
}

export interface EquipmentConfig {
  equipment: GameEquipment[]
}

// Системные определения
export interface SystemAttribute {
  id: string
  name: string
  description: string
  category: string
  minValue: number
  maxValue: number
}

export interface SystemState {
  id: string
  name: string
  description: string
  category: string
  minValue: number
  maxValue: number
  colorType: string
}

export interface SystemSkill {
  id: string
  name: string
  description: string
  category: string
  minValue: number
  maxValue: number
}

export interface SystemDefinitions {
  attributes: { [key: string]: SystemAttribute }
  states: { [key: string]: SystemState }
  skills: { [key: string]: SystemSkill }
}

// Сюжетные сцены
export interface StoryPoint {
  name: string
  description: string
  defaultValue: number
  minValue: number
  maxValue: number
}

export interface StoryChoice {
  id: string
  text: string
  consequences: Array<{
    type: string
    [key: string]: any
  }>
  navigation: {
    type: string
    [key: string]: any
  }
}

export interface StoryScreen {
  id: string
  title: string
  background?: string
  description: string
  choices: StoryChoice[]
}

export interface StoryScene {
  id: string
  title: string
  description: string
  triggerConditions: Array<{
    type: string
    pointId?: string
    operator?: string
    value?: number
  }>
  probability: number
  screens: StoryScreen[]
}

export interface StoryScenesConfig {
  storyPoints: { [key: string]: StoryPoint }
  scenes: StoryScene[]
}

// Общий конфиг игры
export interface GameConfig {
  actions: ActionsConfig
  contracts: ContractsConfig
  events: EventsConfig
  characters: CharacterConfig
  equipment: EquipmentConfig
  system: SystemDefinitions
  assets: AssetsConfig
  users: UsersConfig
  characterAI?: any
}

// Универсальные типы для сюжетного редактора
export interface StoryTrigger {
  id: string
  type: 'story_point' | 'game_state' | 'talent_state' | 'equipment' | 'time' | 'random'
  condition: TriggerCondition
  probability?: number
  cooldown?: number
  priority?: number
}

export interface TriggerCondition {
  type: 'comparison' | 'range' | 'boolean' | 'complex'
  field?: string
  operator?: '==' | '!=' | '>' | '<' | '>=' | '<='
  value?: any
  minValue?: number
  maxValue?: number
  conditions?: TriggerCondition[]
  logic?: 'AND' | 'OR'
}



export interface StoryScreen {
  id: string
  title: string
  description: string
  background?: string
  music?: string
  effects?: {
    visual?: string[]
    audio?: string[]
    particle?: string[]
  }
  choices: StoryChoice[]
  autoProgress?: boolean
  autoProgressDelay?: number
  conditions?: TriggerCondition[]
}

export interface StoryChoice {
  id: string
  text: string
  consequences: StoryConsequence[]
  navigation: StoryNavigation
  conditions?: TriggerCondition[]
  probability?: number
  cost?: {
    credits?: number
    reputation?: number
    items?: string[]
  }
}

export interface StoryConsequence {
  type: 'gain_credits' | 'lose_credits' | 'gain_reputation' | 'lose_reputation' | 
         'gain_talent' | 'lose_talent' | 'talent_stat_change' | 'story_point_change' |
         'gain_equipment' | 'lose_equipment' | 'gain_memory' | 'lose_memory' |
         'trigger_event' | 'end_scene' | 'custom'
  amount?: number
  talentId?: string
  stat?: string
  change?: number
  pointId?: string
  equipmentId?: string
  memoryData?: any
  eventId?: string
  customData?: any
}

export interface StoryNavigation {
  type: 'goto_screen' | 'end_scene' | 'goto_scene' | 'conditional'
  screenId?: string
  sceneId?: string
  condition?: TriggerCondition
  fallback?: StoryNavigation
}

// Типы для интеграции с игровыми системами
export interface GameEvent {
  id: string
  title: string
  description: string
  type: 'market' | 'auction' | 'anomaly' | 'contract' | 'void_rescue' | 'corporate'
  storySceneId?: string
  triggerConditions: StoryTrigger[]
  probability: number
  effects: GameEventEffects
  duration?: number
  cooldown?: number
  metadata?: {
    category?: string
    tags?: string[]
    difficulty?: number
    rewards?: string[]
  }
}

export interface GameEventEffects {
  global?: {
    credits?: number
    reputation?: number
    neuralPulses?: number
    [key: string]: any
  }
  talent?: {
    skills?: { [key: string]: number }
    states?: { [key: string]: number }
    attributes?: { [key: string]: number }
    [key: string]: any
  }
  equipment?: {
    gain?: string[]
    lose?: string[]
    modify?: { [key: string]: any }
  }
  story?: {
    points?: { [key: string]: number }
    memories?: any[]
    flags?: { [key: string]: boolean }
  }
}

// Типы для редактора сюжетов
export interface StoryEditorConfig {
  availableTypes: string[]
  availableConsequences: string[]
  availableConditions: string[]
  templates: StoryTemplate[]
  validation: StoryValidationRules
}

export interface StoryTemplate {
  id: string
  name: string
  description: string
  type: string
  template: Partial<StoryScene>
  tags: string[]
}

export interface StoryValidationRules {
  maxScreensPerScene: number
  maxChoicesPerScreen: number
  maxConsequencesPerChoice: number
  requiredFields: string[]
  forbiddenFields: string[]
}

// ===== СИСТЕМА УСЛОВИЙ =====

// Базовые типы условий
export type ConditionType = 
  | "asset_condition"      // Условие на актив
  | "player_condition"     // Условие на игрока
  | "scene_choice_condition" // Условие на выбор в сцене
  | "story_point_condition"  // Условие на сюжетную точку
  | "compound_condition"     // Составное условие

// Операторы сравнения
export type Operator = "=" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "not_contains" | "in" | "not_in"
export type LogicOperator = "AND" | "OR"

// Атрибуты активов
export type AssetAttribute = 
  // Основные атрибуты
  | "strength" | "empathy" | "intelligence" | "temperament" | "grit" | "ego" | "loyalty" | "obedience" | "resistance"
  // Навыки
  | "maid" | "cooking" | "neural_hacking" | "orgasm_control" | "field" | "etiquette" | "logistics" | "medical" | "maintenance" | "data" | "dance" | "seduction" | "interrogation" | "surveillance"
  // Состояние
  | "health" | "mental_state" | "stress" | "fatigue"
  // Метаданные
  | "rank" | "price" | "status" | "location" | "specialization"
  // История
  | "assignments" | "success_rate"
  // Трейты (массив)
  | "traits"
  // Предпочтения (объекты)
  | "work_type" | "environment" | "avoid"

// Атрибуты игрока
export type PlayerAttribute = 
  // Аккаунт
  | "balance" | "currency"
  // Активы
  | "assets_count" | "owned_assets_count"
  // Оборудование
  | "equipment_count" | "has_equipment"
  // Настройки
  | "riskTolerance" | "theme" | "notifications" | "autoAssign"
  // Метаданные
  | "role" | "status" | "created" | "lastLogin"

// Интерфейсы условий
export interface BaseCondition {
  type: ConditionType
  id: string
  name: string
  description: string
}

export interface AssetCondition extends BaseCondition {
  type: "asset_condition"
  target: {
    entityId: string | "any" | "current" | "owned"
    attribute: AssetAttribute
    operator: Operator
    value: number | string | boolean | string[]
  }
}

export interface PlayerCondition extends BaseCondition {
  type: "player_condition"
  target: {
    attribute: PlayerAttribute
    operator: Operator
    value: number | string | boolean | string[]
  }
}

export interface SceneChoiceCondition extends BaseCondition {
  type: "scene_choice_condition"
  target: {
    sceneId: string
    screenId?: string
    choiceId: string
    status: "completed" | "not_completed" | "selected" | "not_selected"
  }
}

export interface StoryPointCondition extends BaseCondition {
  type: "story_point_condition"
  target: {
    pointId: string
    operator: Operator
    value: number | string
  }
}

export interface CompoundCondition extends BaseCondition {
  type: "compound_condition"
  logic: LogicOperator
  conditions: (AssetCondition | PlayerCondition | SceneChoiceCondition | StoryPointCondition)[]
}

// Объединенный тип всех условий
export type Condition = AssetCondition | PlayerCondition | SceneChoiceCondition | StoryPointCondition | CompoundCondition

// Типы значений атрибутов
export type AttributeValue = number | string | boolean | string[]

// Интерфейс для состояния игры
export interface GameState {
  assets: Asset[]
  users: User[]
  storyScenes: StoryScene[]
  storyPoints: Record<string, StoryPoint>
  currentUser: User
  sceneHistory: SceneHistory[]
}

// Интерфейс для истории сцен
export interface SceneHistory {
  sceneId: string
  screenId: string
  choiceId: string
  timestamp: string
  completed: boolean
}

// Интерфейс для сюжетной точки
export interface StoryPoint {
  name: string
  description: string
  value: number
  defaultValue: number
  minValue: number
  maxValue: number
  type: "numeric" | "string" | "boolean"
  category: string
  tags: string[]
}

// Интерфейс для активов (расширенный)
export interface Asset {
  id: string
  name: string
  rank: "Junior" | "Middle" | "Senior" | "Elite"
  avatar: string
  price: number
  specialization: string
  description: string
  status: "available" | "training" | "assigned" | "sold"
  owner: string | null
  location: string
  attributes: {
    strength: number
    empathy: number
    intelligence: number
    temperament: number
    grit: number
    ego: number
    loyalty: number
    obedience: number
    resistance: number
  }
  skills: {
    maid: number
    cooking: number
    neural_hacking: number
    orgasm_control: number
    field: number
    etiquette: number
    logistics: number
    medical: number
    maintenance: number
    data: number
    dance: number
    seduction: number
    interrogation: number
    surveillance: number
  }
  traits: string[]
  preferences: {
    work_type: string[]
    environment: string[]
    avoid: string[]
  }
  condition: {
    health: number
    mental_state: number
    stress: number
    fatigue: number
  }
  history: {
    created: string
    last_training: string
    assignments: number
    success_rate: number
  }
}

// Интерфейс для пользователей (расширенный)
export interface User {
  id: string
  username: string
  email: string
  role: "admin" | "user" | "trader"
  status: "active" | "inactive" | "banned"
  created: string
  lastLogin: string
  account: {
    balance: number
    currency: string
    transactions: Transaction[]
  }
  assets: UserAsset[]
  equipment: UserEquipment[]
  settings: {
    theme: string
    notifications: boolean
    autoAssign: boolean
    riskTolerance: "low" | "medium" | "high"
  }
}

// Дополнительные интерфейсы
export interface Transaction {
  id: string
  type: string
  amount: number
  description: string
  date: string
}

export interface UserAsset {
  assetId: string
  name: string
  acquired: string
  status: string
  location: string
  currentAssignment: string | null
}

export interface UserEquipment {
  itemId: string
  name: string
  type: string
  slot: string
  installed: string
  status: string
}

export interface StoryScene {
  id: string
  title: string
  description: string
  triggerConditions: Condition[]
  probability: number
  screens: StoryScreen[]
}

export interface StoryScreen {
  id: string
  title: string
  background: string
  description: string
  accessConditions?: Condition[]
  choices: StoryChoice[]
}

export interface StoryChoice {
  id: string
  text: string
  consequences: Consequence[]
  navigation: Navigation
}

export interface Consequence {
  type: string
  [key: string]: any
}

export interface Navigation {
  type: string
  [key: string]: any
}

// Упрощенная система сюжетных сцен
export interface StorySceneBinding {
  id: string
  type: 'auction' | 'anomaly'
  sceneId: string
  conditions: StorySceneCondition[]
  probability: number
  priority: number
  metadata: {
    source: string
    createdAt: string
    lastModified: string
  }
}

export interface StorySceneCondition {
  id: string
  type: 'asset' | 'player' | 'game_state'
  field: string
  operator: '==' | '!=' | '>' | '<' | '>=' | '<='
  value: any
  description: string
}

export interface SimplifiedStoryScene {
  id: string
  title: string
  description: string
  type: 'auction' | 'anomaly'
  screens: StoryScreen[]
  bindings: StorySceneBinding[]
  metadata: {
    author?: string
    version?: string
    createdAt: string
    lastModified: string
  }
}

// Привязка сцен к событиям
export interface SceneEventBinding {
  id: string
  eventType: 'auction' | 'anomaly'
  sceneId: string
  conditions: SceneCondition[]
  probability: number
  priority: number
  isBaseChance: boolean // Базовый шанс (срабатывает если не сработали другие)
  metadata: {
    source: string
    createdAt: string
    lastModified: string
  }
}

export interface SceneCondition {
  id: string
  type: 'asset' | 'player' | 'game_state'
  field: string
  operator: '==' | '!=' | '>' | '<' | '>=' | '<='
  value: any
  description: string
}

// Обновляем существующий StoryScene для поддержки привязок
// Добавляем поле eventBindings к существующему интерфейсу

// ===== НОВЫЕ ТИПЫ ДЛЯ CHARACTER AI INTEGRATION =====

// Система действий и инструментов
export interface InteractiveAction {
  id: string
  name: string
  description: string
  icon: string
  category: 'physical' | 'emotional' | 'intimate' | 'punishment' | 'reward'
  intensity: number // 1-10
  cost: number // Neural Pulses
  effects: {
    physical?: { [key: string]: number }
    emotional?: { [key: string]: number }
    fetish?: { [key: string]: number }
  }
  requirements: {
    trustLevel?: number
    relationshipLevel?: number
    specificFetishes?: string[]
    equipment?: string[]
  }
  cooldown: number // в секундах
  area?: string // область воздействия
}

export interface InteractiveTool {
  id: string
  name: string
  description: string
  icon: string
  type: 'vibration' | 'electricity' | 'temperature' | 'pressure' | 'stimulation'
  intensity: number // 1-10
  duration: number // в секундах
  effects: {
    physical?: { [key: string]: number }
    emotional?: { [key: string]: number }
    fetish?: { [key: string]: number }
  }
  requirements: {
    equipment?: string[]
    powerLevel?: number
  }
  cooldown: number
  area?: string
}

// Система поз
export interface Pose {
  id: string
  name: string
  description: string
  category: 'standing' | 'sitting' | 'lying' | 'kneeling' | 'restrained' | 'submissive' | 'dominant'
  difficulty: number // 1-10
  requirements: {
    flexibility?: number
    strength?: number
    trustLevel?: number
    relationshipLevel?: number
  }
  effects: {
    physical?: { [key: string]: number }
    emotional?: { [key: string]: number }
    fetish?: { [key: string]: number }
  }
  image?: string
  tags: string[]
}

// Условия для смены позы
export interface PoseChangeCondition {
  id: string
  name: string
  description: string
  type: 'trust' | 'fear' | 'obedience' | 'pleasure' | 'pain' | 'command' | 'automatic'
  conditions: {
    // Условия на характеристики
    attributes?: {
      [key: string]: {
        operator: '==' | '!=' | '>' | '<' | '>=' | '<='
        value: number
      }
    }
    // Условия на состояния
    states?: {
      [key: string]: {
        operator: '==' | '!=' | '>' | '<' | '>=' | '<='
        value: number
      }
    }
    // Условия на фетиши
    fetishes?: {
      active?: string[]
      intensity?: { [key: string]: number }
    }
    // Условия на отношения
    relationship?: {
      trustLevel?: { operator: '==' | '!=' | '>' | '<' | '>=' | '<='; value: number }
      relationshipLevel?: { operator: '==' | '!=' | '>' | '<' | '>=' | '<='; value: number }
    }
    // Условия на действия пользователя
    userActions?: {
      recentActions?: string[]
      actionIntensity?: number
      timeSinceLastAction?: number
    }
    // Условия на окружение
    environment?: {
      equipment?: string[]
      location?: string
      privacy?: 'public' | 'private' | 'intimate'
    }
  }
  targetPose: string // ID позы
  probability: number // 0-1, вероятность смены позы
  cooldown: number // в секундах
  message?: string // сообщение при смене позы
}

// Система анализа сообщений через Gemini
export interface MessageAnalysis {
  emotionalContent: {
    threat: number // 0-1
    pleasure: number // 0-1
    pain: number // 0-1
    fear: number // 0-1
    arousal: number // 0-1
  }
  commands: {
    poseChange?: string | null
    action?: string | null
    tool?: string | null
  }
  fetishTriggers: string[]
  statChanges: {
    [key: string]: number
  }
  response: string
}

// Система промтов для LLM
export interface LLMPrompt {
  basePrompt: string
  characterContext: {
    name: string
    role: string
    personality: string
    currentState: string
  }
  characteristics: {
    [key: string]: {
      value: number // 0-10
      interpretation: string
    }
  }
  fetishes: {
    [key: string]: {
      intensity: number // 0-1
      triggers: string[]
      responses: string[]
    }
  }
  memory: {
    recent: string[]
    important: string[]
    traumatic: string[]
  }
  currentSituation: {
    location: string
    equipment: string[]
    pose: string
    emotionalState: string
    activeFetishes: string[]
  }
}

// Система интерактивных областей
export interface InteractiveArea {
  id: string
  name: string
  description: string
  x: number // процент от ширины изображения
  y: number // процент от высоты изображения
  width: number // процент от ширины
  height: number // процент от высоты
  sensitivity: number // 1-10
  fetishes: string[] // связанные фетиши
  actions: string[] // доступные действия
  tools: string[] // доступные инструменты
  effects: {
    [key: string]: number
  }
}

// Система быстрых действий
export interface QuickAction {
  id: string
  name: string
  description: string
  icon: string
  category: 'pose' | 'action' | 'tool' | 'command' | 'reward' | 'punishment'
  action: {
    type: 'pose_change' | 'interactive_action' | 'tool_use' | 'command' | 'message'
    target: string // ID цели
    parameters?: any
  }
  requirements: {
    trustLevel?: number
    relationshipLevel?: number
    equipment?: string[]
    cooldown?: number
  }
  effects: {
    immediate?: { [key: string]: number }
    longTerm?: { [key: string]: number }
  }
}

// Конфигурация системы Character AI
export interface CharacterAIConfig {
  actions: {
    [key: string]: InteractiveAction
  }
  tools: {
    [key: string]: InteractiveTool
  }
  poses: {
    [key: string]: Pose
  }
  poseChangeConditions: {
    [key: string]: PoseChangeCondition
  }
  quickActions: {
    [key: string]: QuickAction
  }
  interactiveAreas: {
    [key: string]: InteractiveArea
  }
  llmPrompts: {
    basePrompt: string
    characteristicInterpretations: {
      [key: string]: {
        [key: number]: string // значение -> интерпретация
      }
    }
    fetishResponses: {
      [key: string]: {
        [key: number]: string // интенсивность -> ответ
      }
    }
  }
}

// Расширение GameConfig
export interface GameConfig {
  actions: ActionsConfig
  contracts: ContractsConfig
  events: EventsConfig
  market: MarketConfig
  equipment: EquipmentConfig
  system: SystemDefinitions
  assets: AssetsConfig
  users: UsersConfig
  characterAI?: CharacterAIConfig // Новое поле
}
