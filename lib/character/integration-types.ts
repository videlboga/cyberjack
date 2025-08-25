import { Character, CharacterResponse, ImpactAnalysis, FetishAnalysis, EmotionalState } from '../unified-entities'

/**
 * Расширенное состояние персонажа для интеграции с режимом "Личная работа"
 */
export interface CharacterState {
  currentEmotionalState: EmotionalState
  activeFetishes: string[] // ID активных фетишей
  lastInteraction: Date
  interactionCount: number
  relationshipLevel: number // Уровень отношений с пользователем (0-100)
  trustLevel: number // Уровень доверия (0-100)
  intimacyLevel: number // Уровень близости (0-100)
  lastSaveDate: Date
}

/**
 * Взаимодействие между пользователем и персонажем
 */
export interface CharacterInteraction {
  id: string
  timestamp: Date
  userAction: string
  characterResponse: CharacterResponse
  interactionType: string // Тип взаимодействия (personal-learning, coaching-session, etc.)
  context: any // Дополнительный контекст
  impactOnCharacter: {
    emotionalChange: number
    statChanges: any
    fetishActivations: string[]
  }
}

/**
 * Расширенный режим "Личная работа" с AI-персонажами
 */
export interface PersonalWorkModeExtended {
  // Существующие поля режима "Личная работа"
  isActive: boolean
  currentTask: string
  selectedInteractionType: string | null
  
  // Новые поля для AI-персонажей
  character: Character | null
  characterState: CharacterState | null
  interactionHistory: CharacterInteraction[]
  currentInteraction: CharacterInteraction | null
  
  // Настройки персонажа
  characterSettings: {
    autoSave: boolean
    showFetishIndicators: boolean
    showEmotionalState: boolean
    showStatChanges: boolean
    interactionLogLimit: number
  }
}

/**
 * Настройки интеграции
 */
export interface IntegrationSettings {
  // AI настройки
  aiService: {
    responseDelay: number // Задержка ответа в мс
    maxResponseLength: number
    enableFetishAwareness: boolean
    enableEmotionalMemory: boolean
  }
  
  // UI настройки
  ui: {
    showCharacterPanel: boolean
    showInteractionLog: boolean
    showQuickActions: boolean
    showFetishDisplay: boolean
    showEmotionalIndicator: boolean
  }
  
  // Сохранение
  persistence: {
    autoSaveInterval: number // Интервал автосохранения в мс
    maxHistorySize: number
    saveCharacterState: boolean
    saveInteractionHistory: boolean
  }
}

/**
 * Быстрые действия для персонажа
 */
export interface QuickAction {
  id: string
  name: string
  description: string
  icon: string
  action: string
  category: 'social' | 'intimate' | 'professional' | 'personal'
  requiresTrust: number // Минимальный уровень доверия
  cooldown: number // Время перезарядки в мс
}

/**
 * Контекст взаимодействия
 */
export interface InteractionContext {
  // Контекст режима "Личная работа"
  workMode: {
    currentTask: string
    selectedTool: string | null
    equipmentActive: boolean
    sessionDuration: number
  }
  
  // Контекст персонажа
  character: {
    currentEmotionalState: EmotionalState
    activeFetishes: string[]
    relationshipLevel: number
    trustLevel: number
    lastInteractionType: string | null
  }
  
  // Контекст пользователя
  user: {
    mood: 'positive' | 'neutral' | 'negative'
    relationship: 'stranger' | 'acquaintance' | 'friend' | 'trusted' | 'master'
    intimacy: 'low' | 'medium' | 'high'
    previousActions: string[]
  }
  
  // Внешний контекст
  environment: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
    location: string
    privacy: 'public' | 'private' | 'intimate'
    stressLevel: number
  }
}

/**
 * Результат обработки взаимодействия
 */
export interface InteractionResult {
  success: boolean
  characterResponse: CharacterResponse
  stateChanges: {
    emotionalState: EmotionalState
    statChanges: any
    fetishActivations: string[]
    relationshipChange: number
    trustChange: number
  }
  uiUpdates: {
    showNotification: boolean
    notificationMessage: string
    updateCharacterPanel: boolean
    updateInteractionLog: boolean
  }
  errors?: string[]
}

/**
 * Данные для сохранения состояния персонажа
 */
export interface CharacterSaveData {
  character: Character
  characterState: CharacterState
  interactionHistory: CharacterInteraction[]
  lastSaveDate: Date
  version: string
  metadata: {
    totalInteractions: number
    averageEmotionalState: string
    mostActiveFetishes: string[]
    relationshipProgress: number
  }
}

/**
 * Настройки персонажа для режима "Личная работа"
 */
export interface CharacterWorkSettings {
  // Настройки взаимодействий
  interactions: {
    enabledTypes: string[]
    defaultResponseStyle: 'professional' | 'friendly' | 'intimate' | 'submissive'
    autoRespond: boolean
    responseDelay: number
  }
  
  // Настройки фетишей
  fetishes: {
    autoActivate: boolean
    showTriggers: boolean
    intensityModifier: number
    discoveryEnabled: boolean
  }
  
  // Настройки эмоций
  emotions: {
    emotionalMemory: boolean
    moodInfluence: number
    stressResponse: 'calm' | 'anxious' | 'excited' | 'neutral'
  }
  
  // Настройки отношений
  relationships: {
    trustBuilding: boolean
    intimacyProgression: boolean
    boundaryRespect: boolean
  }
}

/**
 * Статистика взаимодействий
 */
export interface InteractionStats {
  totalInteractions: number
  interactionsByType: { [key: string]: number }
  averageResponseTime: number
  emotionalStateDistribution: { [key in EmotionalState]: number }
  mostActiveFetishes: Array<{ fetishId: string; activationCount: number }>
  relationshipProgress: {
    trustLevel: number
    intimacyLevel: number
    relationshipLevel: number
  }
  recentTrends: {
    emotionalStability: number
    fetishActivity: number
    responseQuality: number
  }
}
