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
  scenes: StoryScenesConfig
}
