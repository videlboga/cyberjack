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

export interface AssetSkills {
  maid?: number
  cooking?: number
  neural_hacking?: number
  orgasm_control?: number
  field?: number
  etiquette?: number
  logistics?: number
  medical?: number
  maintenance?: number
  data?: number
  dance?: number
  seduction?: number
  interrogation?: number
  surveillance?: number
  [key: string]: number | undefined
}

export interface AssetPreferences {
  work_type: string[]
  environment: string[]
  avoid: string[]
}

export interface AssetCondition {
  health: number
  mental_state: number
  stress: number
  fatigue: number
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
  rank: 'Junior' | 'Middle' | 'Senior' | 'Elite'
  avatar: string
  price: number
  specialization: string
  description: string
  status: 'available' | 'owned' | 'training' | 'assigned' | 'inactive'
  owner: string | null
  location: string
  attributes: AssetAttributes
  skills: AssetSkills
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
  market: MarketConfig
  equipment: EquipmentConfig
  system: SystemDefinitions
  assets: AssetsConfig
  users: UsersConfig
}
