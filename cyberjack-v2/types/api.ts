// types/api.ts

import { UserRole, KnowledgeLevel, StoryPointType } from './database'

// API Response типы
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Аутентификация
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: {
    id: string
    email: string
    name: string
    role: UserRole
  }
  token: string
  expiresAt: Date
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  credits: number
  modifiers: Record<string, number>
}

// Персонажи
export interface CreateCharacterRequest {
  name: string
  description?: string
  age?: number
  avatar?: string
  price?: number
  characteristics: CharacteristicCreateRequest[]
  anatomy: AnatomyCreateRequest[]
  poses: PoseCreateRequest[]
  prompts: Record<string, any>
}

export interface CharacteristicCreateRequest {
  characteristicDefId: string
  currentValue: number
  baseValue: number
  recoveryRate?: number
  shiftThreshold?: number
  shiftRate?: number
}

export interface AnatomyCreateRequest {
  anatomyDefId: string
  hasPart: boolean
  sensitivity: number
}

export interface PoseCreateRequest {
  poseDefId: string
  customSettings: Record<string, any>
}

export interface UpdateCharacterRequest {
  name?: string
  description?: string
  age?: number
  avatar?: string
  price?: number
  isActive?: boolean
  prompts?: Record<string, any>
}

export interface CharacterListResponse {
  characters: Array<{
    id: string
    name: string
    description?: string
    age?: number
    avatar?: string
    price: number
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  }>
}

// Характеристики
export interface CreateCharacteristicDefinitionRequest {
  name: string
  category: string
  description?: string
  minValue?: number
  maxValue?: number
}

export interface UpdateCharacteristicDefinitionRequest {
  name?: string
  category?: string
  description?: string
  minValue?: number
  maxValue?: number
  isActive?: boolean
}

export interface ChangeCharacteristicRequest {
  characterId: string
  characteristicId: string
  change: number
  permanent?: boolean
}

export interface CharacteristicResponse {
  id: string
  name: string
  category: string
  description?: string
  minValue: number
  maxValue: number
  isActive: boolean
}

// Действия
export interface CreateActionRequest {
  name: string
  category: string
  description?: string
  intensity?: number
  cost?: number
  duration?: number
  effects: Record<string, any>
  requirements: Record<string, any>
}

export interface UpdateActionRequest {
  name?: string
  category?: string
  description?: string
  intensity?: number
  cost?: number
  duration?: number
  effects?: Record<string, any>
  requirements?: Record<string, any>
  isActive?: boolean
}

export interface ExecuteActionRequest {
  characterId: string
  actionId: string
  userId: string
  zoneId?: string
}

export interface ExecuteActionResponse {
  success: boolean
  effects: Array<{
    characteristicId: string
    change: number
    permanent: boolean
    message: string
  }>
  message: string
  cost: number
  newCredits: number
}

// Позы
export interface CreatePoseDefinitionRequest {
  name: string
  category: string
  description?: string
  effects: Record<string, any>
  requirements: Record<string, any>
  angles: PoseAngleCreateRequest[]
}

export interface PoseAngleCreateRequest {
  name: string
  angle: string
  media: {
    images: string[]
    videos: string[]
    gifs: string[]
  }
  zones: ActiveZoneCreateRequest[]
}

export interface ActiveZoneCreateRequest {
  name: string
  x: number
  y: number
  width: number
  height: number
  anatomyDefId?: string
}

export interface UpdatePoseDefinitionRequest {
  name?: string
  category?: string
  description?: string
  effects?: Record<string, any>
  requirements?: Record<string, any>
  isActive?: boolean
}

// Анатомия
export interface CreateAnatomyDefinitionRequest {
  name: string
  category?: string
  description?: string
}

export interface UpdateAnatomyDefinitionRequest {
  name?: string
  category?: string
  description?: string
  isActive?: boolean
}

// Чат
export interface SendMessageRequest {
  characterId: string
  message: string
  userId: string
}

export interface SendMessageResponse {
  response: string
  characterId: string
  timestamp: Date
  cost: number
  newCredits: number
}

export interface ChatHistoryResponse {
  messages: Array<{
    id: string
    content: string
    timestamp: Date
    isUser: boolean
  }>
}

// Время
export interface TimeAdvanceRequest {
  minutes: number
  reason: 'manual' | 'action_hold' | 'recovery'
}

export interface TimeAdvanceResponse {
  gameTime: number
  formattedTime: string
  recoveryUpdates: Array<{
    characterId: string
    characteristicId: string
    oldValue: number
    newValue: number
    recoveryAmount: number
  }>
}

// Сюжетные точки
export interface CreateStoryPointRequest {
  name: string
  type: StoryPointType
  category?: string
  description?: string
  defaultValue?: number
  minValue?: number
  maxValue?: number
  tags: string[]
}

export interface UpdateStoryPointRequest {
  name?: string
  type?: StoryPointType
  category?: string
  description?: string
  defaultValue?: number
  minValue?: number
  maxValue?: number
  tags?: string[]
  isActive?: boolean
}

// Сцены
export interface CreateSceneRequest {
  name: string
  type: string
  description?: string
  triggerConditions: Record<string, any>
  probability?: number
  screens: ScreenCreateRequest[]
}

export interface ScreenCreateRequest {
  name: string
  description?: string
  content: Record<string, any>
  choices: ChoiceCreateRequest[]
  accessConditions: Record<string, any>
}

export interface ChoiceCreateRequest {
  text: string
  description?: string
  consequences: Record<string, any>
  showConditions: Record<string, any>
}

export interface UpdateSceneRequest {
  name?: string
  type?: string
  description?: string
  triggerConditions?: Record<string, any>
  probability?: number
  isActive?: boolean
}

// Пользователи
export interface CreateUserRequest {
  email: string
  name: string
  password: string
  role?: UserRole
}

export interface UpdateUserRequest {
  email?: string
  name?: string
  role?: UserRole
  credits?: number
  modifiers?: Record<string, number>
}

export interface UserListResponse {
  users: Array<{
    id: string
    email: string
    name: string
    role: UserRole
    credits: number
    createdAt: Date
    lastLogin?: Date
  }>
}

// Знания персонажей
export interface CharacterKnowledgeResponse {
  characterId: string
  knowledge: Array<{
    characteristicId: string
    level: KnowledgeLevel
    value?: number
    accuracy?: number
    lastRevealed?: Date
  }>
}

// Экспорт/импорт
export interface ExportRequest {
  format: 'json' | 'csv' | 'xlsx'
  includeCharacters: boolean
  includeCharacteristics: boolean
  includeActions: boolean
  includePoses: boolean
  includeAnatomy: boolean
  includeStoryPoints: boolean
  includeScenes: boolean
}

export interface ImportRequest {
  data: any
  overwriteExisting: boolean
  validateData: boolean
  createMissing: boolean
  dryRun: boolean
}

export interface ImportResponse {
  success: boolean
  imported: {
    characters: number
    characteristics: number
    actions: number
    poses: number
    anatomy: number
    storyPoints: number
    scenes: number
  }
  errors: string[]
  warnings: string[]
}

// Валидация
export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationResult {
  success: boolean
  errors: ValidationError[]
}

// Поиск
export interface SearchRequest {
  query: string
  type: 'characters' | 'actions' | 'poses' | 'anatomy' | 'story' | 'all'
  limit?: number
  offset?: number
}

export interface SearchResponse {
  results: Array<{
    id: string
    type: string
    name: string
    description?: string
    relevance: number
  }>
  total: number
  query: string
}

// Статистика
export interface StatisticsResponse {
  characters: {
    total: number
    active: number
    inactive: number
  }
  users: {
    total: number
    active: number
    admins: number
  }
  actions: {
    total: number
    active: number
  }
  poses: {
    total: number
    active: number
  }
  anatomy: {
    total: number
    active: number
  }
  storyPoints: {
    total: number
    active: number
  }
  scenes: {
    total: number
    active: number
  }
}
