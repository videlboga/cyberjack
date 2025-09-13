// types/game.ts

import { KnowledgeLevel, CharacterKnowledge } from './database'

// AI и чат типы
export interface AIResponse {
  message: string
  characterId: string
  timestamp: Date
  metadata?: any
}

export interface CharacterContext {
  characterId: string
  characteristics: CharacteristicDisplay[]
  currentPose?: string
  anatomy: AnatomyDisplay[]
  knowledge: CharacterKnowledge[]
  lastAction?: string
}

// Игровые типы
export interface GameState {
  currentCharacter: string | null
  currentPose: string | null
  isActionHolding: boolean
  gameTime: number
  userCredits: number
}

export interface CharacterDisplay {
  id: string
  name: string
  avatar?: string
  currentPose?: string
  characteristics: CharacteristicDisplay[]
  anatomy: AnatomyDisplay[]
}

export interface CharacteristicDisplay {
  id: string
  name: string
  category: string
  currentValue: number
  baseValue: number
  knowledgeLevel: KnowledgeLevel
  revealedValue?: number
  accuracy?: number
  isRevealed: boolean
}

export interface AnatomyDisplay {
  id: string
  name: string
  category?: string
  hasPart: boolean
  sensitivity: number
  isRevealed: boolean
}

export interface PoseDisplay {
  id: string
  name: string
  category: string
  description?: string
  currentAngle: string
  angles: PoseAngleDisplay[]
  isActive: boolean
}

export interface PoseAngleDisplay {
  id: string
  name: string
  angle: string
  media: MediaDisplay
  activeZones: ActiveZoneDisplay[]
}

export interface MediaDisplay {
  images: string[]
  videos: string[]
  gifs: string[]
}

export interface ActiveZoneDisplay {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  anatomyId?: string
  anatomyName?: string
}

export interface ActionDisplay {
  id: string
  name: string
  category: string
  description?: string
  intensity: number
  cost: number
  duration: number
  isAvailable: boolean
  requirements: ActionRequirement[]
}

export interface ActionRequirement {
  type: 'characteristic' | 'anatomy' | 'pose' | 'credits'
  id: string
  operator: 'gte' | 'lte' | 'eq' | 'ne'
  value: number | string | boolean
}

export interface ActionExecution {
  actionId: string
  characterId: string
  userId: string
  zoneId?: string
  startTime: Date
  endTime?: Date
  effects: ActionEffect[]
}

export interface ActionEffect {
  characteristicId: string
  change: number
  permanent: boolean
  message: string
}

// Типы для чата
export interface ChatMessage {
  id: string
  characterId: string
  userId: string
  content: string
  timestamp: Date
  isUser: boolean
}

export interface ChatSession {
  id: string
  characterId: string
  userId: string
  messages: ChatMessage[]
  lastActivity: Date
}

// Типы для системы времени
export interface TimeSystemState {
  gameTime: number
  formattedTime: string
  isRunning: boolean
  actionHoldStart: Date | null
  lastUpdate: Date
}

export interface TimeAdvancement {
  minutes: number
  reason: 'manual' | 'action_hold' | 'recovery'
}

// Типы для восстановления характеристик
export interface RecoveryState {
  characterId: string
  characteristicId: string
  currentValue: number
  baseValue: number
  recoveryRate: number
  timeInAlteredState: number
  lastRecovery: Date
}

export interface RecoveryUpdate {
  characterId: string
  characteristicId: string
  oldValue: number
  newValue: number
  recoveryAmount: number
  isFullyRecovered: boolean
}

// Типы для раскрытия характеристик
export interface RevealTrigger {
  characterId: string
  characteristicId: string
  oldValue: number
  newValue: number
  changePercent: number
  level: KnowledgeLevel
}

export interface RevealResult {
  characterId: string
  characteristicId: string
  level: KnowledgeLevel
  revealedValue: number
  accuracy: number
  timestamp: Date
}

// Типы для формул
export interface FormulaContext {
  character: CharacterDisplay
  user: {
    id: string
    modifiers: Record<string, number>
    credits: number
  }
  action?: ActionDisplay
  zone?: ActiveZoneDisplay
  time: TimeSystemState
}

export interface FormulaResult {
  value: number
  factors: FormulaFactor[]
}

export interface FormulaFactor {
  name: string
  value: number
  multiplier: number
  description: string
}

// Типы для админ-панели
export interface AdminPanelState {
  activeTab: 'characteristics' | 'actions' | 'poses' | 'anatomy' | 'story'
  selectedItem: string | null
  isEditing: boolean
  hasUnsavedChanges: boolean
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface AdminFormData {
  type: 'characteristic' | 'action' | 'pose' | 'anatomy' | 'story'
  data: any
  validation: ValidationResult
}

// Типы для интерфейса БД
export interface DatabaseInterfaceState {
  activeSection: 'characters' | 'users' | 'system'
  selectedCharacter: string | null
  selectedUser: string | null
  filter: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

// Типы для экспорта/импорта
export interface ExportOptions {
  includeCharacters: boolean
  includeCharacteristics: boolean
  includeActions: boolean
  includePoses: boolean
  includeAnatomy: boolean
  includeStoryPoints: boolean
  includeScenes: boolean
  format: 'json' | 'csv' | 'xlsx'
}

export interface ImportOptions {
  overwriteExisting: boolean
  validateData: boolean
  createMissing: boolean
  dryRun: boolean
}

// Типы для уведомлений
export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: Date
  duration?: number
  actions?: NotificationAction[]
}

export interface NotificationAction {
  label: string
  action: () => void
  variant?: 'primary' | 'secondary' | 'destructive'
}

// Типы для модальных окон
export interface ModalState {
  isOpen: boolean
  type: 'character' | 'action' | 'pose' | 'anatomy' | 'story' | 'confirm' | 'info'
  data?: any
  onConfirm?: () => void
  onCancel?: () => void
}

// Типы для навигации
export interface NavigationItem {
  id: string
  label: string
  href: string
  icon?: string
  badge?: number
  children?: NavigationItem[]
}

export interface BreadcrumbItem {
  label: string
  href?: string
  isActive?: boolean
}
