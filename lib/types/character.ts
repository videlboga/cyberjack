// Типы для системы характеристик активов

// Импортируем из unified-entities
import { MemoryType, FetishCategory } from '../unified-entities'

export interface CharacterStats {
  // Физические характеристики
  endurance: number        // Выносливость (0-10)
  sensitivity: number      // Чувствительность (0-10)
  flexibility: number      // Гибкость (0-10)
  
  // Психологические характеристики
  emotionalStability: number  // Эмоциональная стабильность (0-10)
  adaptability: number        // Адаптивность (0-10)
  intelligence: number        // Интеллект (0-10)
  
  // Социальные характеристики
  sociability: number         // Общительность (0-10)
  submission: number          // Подчинение (0-10)
  resistance: number          // Сопротивление (0-10)
  
  // Специальные характеристики
  painTolerance: number       // Толерантность к боли (0-10)
  pleasureResponse: number    // Реакция на удовольствие (0-10)
  obedience: number           // Послушание (0-10)
  
  // Новые поля для персонажей из Obsidian
  age?: number                    // Возраст персонажа
  dateTransformation?: string    // Дата превращения в актив
  
  // Расширенные характеристики
  personality?: {
    selfEsteem: number           // Самооценка
    optimism: number             // Оптимизм
    curiosity: number            // Любопытство
  }
  
  special?: {
    sexualExperience: number     // Сексуальная опытность
    resistance: number           // Сопротивляемость
    dependency: number           // Зависимость
  }
}

export interface CharacterFetish {
  id: string
  name: string
  category: FetishCategory
  intensity: number           // Интенсивность фетиша (0-10)
  triggers: string[]          // Триггеры для активации
  reactions: string[]         // Возможные реакции
  description: string
  isActive: boolean           // Активен ли фетиш
  lastTriggered?: Date        // Когда последний раз активировался
}



export interface CharacterPose {
  id: string
  name: string
  description: string
  category: PoseCategory
  requirements: {
    flexibility?: number      // Требуемая гибкость
    obedience?: number        // Требуемое послушание
    equipment?: string[]      // Требуемое оборудование
  }
  effects: {
    comfort?: number          // Уровень комфорта (-10 до 10)
    vulnerability?: number    // Уровень уязвимости (0-10)
    arousal?: number          // Уровень возбуждения (0-10)
  }
}

export enum PoseCategory {
  STANDING = 'standing',
  KNEELING = 'kneeling',
  LYING = 'lying',
  BOUND = 'bound',
  RESTRAINED = 'restrained',
  SUSPENDED = 'suspended'
}

export interface CharacterMemory {
  id: string
  type: MemoryType
  content: string
  timestamp: Date
  intensity: number           // Интенсивность памяти (0-10)
  associatedEmotions: string[]
  triggers: string[]          // Что может вызвать эту память
}



export interface CharacterState {
  currentPose: CharacterPose | null
  currentRoom: string
  isRestrained: boolean
  isStimulated: boolean
  emotionalState: EmotionalState
  arousal: number            // Уровень возбуждения (0-10)
  fear: number               // Уровень страха (0-10)
  trust: number              // Уровень доверия (0-10)
}

// Новый интерфейс для промтов персонажей
export interface CharacterPrompt {
  character: string              // Общий характер
  communication: string          // Стиль общения
  behavior: string               // Особенности поведения
  characteristicInterpretations?: {
    [key: string]: {
      [range: string]: string    // Интерпретации характеристик
    }
  }
}
  obedience: number          // Уровень послушания (0-10)
  lastInteraction: Date
  activeEffects: CharacterEffect[]
}

export enum EmotionalState {
  CALM = 'calm',
  EXCITED = 'excited',
  FEARFUL = 'fearful',
  AROUSED = 'aroused',
  SUBMISSIVE = 'submissive',
  RESISTANT = 'resistant',
  TRUSTING = 'trusting',
  HUMILIATED = 'humiliated'
}

export interface CharacterEffect {
  id: string
  name: string
  type: EffectType
  duration: number           // Длительность в минутах
  intensity: number          // Интенсивность эффекта (0-10)
  effects: {
    [key: string]: number    // Влияние на характеристики
  }
  source: string             // Источник эффекта
}

export enum EffectType {
  STIMULATION = 'stimulation',
  RESTRAINT = 'restraint',
  PAIN = 'pain',
  PLEASURE = 'pleasure',
  FEAR = 'fear',
  TRUST = 'trust',
  OBEDIENCE = 'obedience'
}

export interface Character {
  id: string
  name: string
  archetype: string
  stats: CharacterStats
  fetishes: CharacterFetish[]
  currentState: CharacterState
  memories: CharacterMemory[]
  equipment: Equipment[]
  rooms: Room[]
}

export interface Equipment {
  id: string
  name: string
  type: EquipmentType
  category: EquipmentCategory
  isActive: boolean
  settings: EquipmentSettings
  effects: EquipmentEffect[]
  targetAreas: string[]      // Области тела, на которые влияет
}

export enum EquipmentType {
  RESTRAINT = 'restraint',
  STIMULATOR = 'stimulator',
  CLOTHING = 'clothing',
  FURNITURE = 'furniture',
  TOOL = 'tool'
}

export enum EquipmentCategory {
  HANDCUFFS = 'handcuffs',
  COLLAR = 'collar',
  VIBRATOR = 'vibrator',
  ELECTROSTIM = 'electrostim',
  THERMO = 'thermo',
  WHIP = 'whip',
  BRUSH = 'brush',
  UNIFORM = 'uniform',
  BDSM_SUIT = 'bdsm_suit',
  TABLE = 'table',
  CROSS = 'cross',
  CHAIR = 'chair'
}

export interface EquipmentSettings {
  intensity?: number         // Интенсивность (0-10)
  frequency?: number         // Частота (0-10)
  duration?: number          // Длительность в минутах
  pattern?: string           // Паттерн работы
  temperature?: number       // Температура для термоустройств
  voltage?: number           // Напряжение для электростимуляторов
}

export interface EquipmentEffect {
  type: EffectType
  intensity: number
  duration: number
  targetStats: string[]      // На какие характеристики влияет
}

export interface Room {
  id: string
  name: string
  type: RoomType
  description: string
  availableEquipment: Equipment[]
  availablePoses: CharacterPose[]
  atmosphere: RoomAtmosphere
}

export enum RoomType {
  LABORATORY = 'laboratory',
  CELL = 'cell',
  TRAINING_ROOM = 'training_room',
  MEDICAL = 'medical',
  RECREATION = 'recreation',
  PUNISHMENT = 'punishment'
}

export interface RoomAtmosphere {
  lighting: 'bright' | 'dim' | 'dark'
  temperature: 'cold' | 'normal' | 'warm'
  sound: 'quiet' | 'ambient' | 'loud'
  privacy: 'public' | 'semi_private' | 'private'
}
