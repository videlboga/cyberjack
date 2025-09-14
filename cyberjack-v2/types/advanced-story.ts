// Продвинутые типы для системы сюжета
// Основаны на старой версии с улучшениями

// Основные сущности игры, которые можно использовать в условиях
export interface GameEntity {
  type: 'asset' | 'user' | 'equipment' | 'station' | 'story_point' | 'characteristic'
  id: string
  name: string
}

// Сущности станции
export interface StationEntity {
  id: string
  name: string
  type: 'market' | 'auction' | 'contract' | 'anomaly' | 'event' | 'location'
  description: string
  defaultSceneId?: string // ID дефолтной сцены
  probability?: number // Вероятность показа кастомной сцены
  customSceneId?: string // ID кастомной сцены (если probability сработала)
  isActive: boolean
  metadata?: {
    [key: string]: any
  }
}

// Продвинутая система условий
export interface AdvancedCondition {
  // Что проверяем
  entityType: 'asset' | 'user' | 'equipment' | 'station' | 'story_point' | 'characteristic'
  entityId?: string // Если не указан - проверяем всех/любого
  
  // Какое свойство проверяем
  property: string // например: 'rank', 'skills.neural_hacking', 'condition.health'
  
  // Как сравниваем
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'exists'
  
  // С чем сравниваем
  value: any
  
  // Для множественных условий
  logic?: 'AND' | 'OR'
  conditions?: AdvancedCondition[]
  
  // Метаданные
  description?: string
  isActive?: boolean
}

// Продвинутые эффекты
export interface AdvancedEffect {
  type: 'change_asset_stat' | 'change_user_stat' | 'change_story_point' | 
        'change_characteristic' | 'gain_credits' | 'lose_credits' | 
        'gain_equipment' | 'lose_equipment' | 'trigger_station_event' | 
        'end_scene' | 'trigger_action' | 'change_pose' | 'reveal_knowledge'
  
  // Для изменения характеристик
  entityType?: 'asset' | 'user' | 'characteristic'
  entityId?: string // если не указан - применяется к текущему активу/пользователю
  stat?: string // например: 'skills.neural_hacking', 'condition.health'
  change?: number
  
  // Для изменения сюжетных точек
  storyPointId?: string
  storyPointChange?: number
  
  // Для изменения кредитов
  creditsChange?: number
  
  // Для оборудования
  equipmentId?: string
  
  // Для событий станции
  stationEventId?: string
  
  // Для действий
  actionId?: string
  
  // Для поз
  poseId?: string
  
  // Для раскрытия знаний
  knowledgeType?: 'approximate' | 'detailed' | 'precise'
  characteristicId?: string
  
  // Метаданные
  description?: string
  isActive?: boolean
}

// Продвинутый экран
export interface AdvancedScreen {
  id: string
  title?: string
  description?: string
  content: {
    text: string
    background?: string
    music?: string
    backgroundFile?: File
    // Дополнительные медиа
    images?: string[]
    videos?: string[]
    audio?: string[]
  }
  choices: AdvancedChoice[]
  
  // Условия доступа к экрану
  accessConditions?: AdvancedCondition[]
  
  // Позиционирование на графе
  position?: { x: number; y: number }
  
  // Метаданные
  metadata?: {
    [key: string]: any
  }
}

// Продвинутый выбор
export interface AdvancedChoice {
  id: string
  text: string
  description?: string
  
  // Условия для показа этого выбора
  showConditions?: AdvancedCondition[]
  
  // Что происходит при выборе
  effects: AdvancedEffect[]
  
  // Куда переходим
  nextScene?: string // ID следующей сцены
  nextScreenId?: string // ID следующего экрана в текущей сцене
  endScene?: boolean // Завершить сцену
  
  // Позиционирование на графе
  position?: { x: number; y: number }
  
  // Метаданные
  metadata?: {
    [key: string]: any
  }
}

// Продвинутая сцена
export interface AdvancedScene {
  id: string
  title: string
  description: string
  
  // Когда показывать сцену
  triggerConditions?: AdvancedCondition[]
  probability?: number // 0-100, если не указано - всегда показывать
  
  // Содержимое сцены (legacy для совместимости)
  content?: {
    text: string
    background?: string
    music?: string
    backgroundFile?: File
  }
  
  // Выборы игрока (legacy для совместимости)
  choices?: AdvancedChoice[]

  // Многоэкранная сцена (новое)
  startScreenId?: string
  screens?: AdvancedScreen[]
  
  // Связанные сущности станции
  stationEntityIds?: string[]
  
  // Позиционирование узлов на графе
  layout?: {
    x?: number
    y?: number
    entryPosition?: { x: number; y: number }
    choicePositions?: {
      [choiceId: string]: { x: number; y: number }
    }
    screenPositions?: {
      [screenId: string]: { x: number; y: number }
    }
  }
  
  // Метаданные
  metadata?: {
    [key: string]: any
  }
  
  // Статус
  isActive?: boolean
  createdAt?: Date
  updatedAt?: Date
}

// Продвинутая конфигурация сюжетов
export interface AdvancedStoryConfig {
  // Сюжетные точки
  storyPoints: {
    [key: string]: {
      id: string
      name: string
      description: string
      type: 'NUMERIC' | 'BOOLEAN' | 'STRING'
      value: any
      defaultValue: any
      minValue?: number
      maxValue?: number
      category?: string
      tags?: string[]
    }
  }
  
  // Сущности станции
  stationEntities: {
    [key: string]: StationEntity
  }
  
  // Продвинутые сцены
  scenes: AdvancedScene[]
  
  // Глобальные настройки
  settings?: {
    defaultProbability?: number
    autoSave?: boolean
    enablePreview?: boolean
    enableValidation?: boolean
  }
  
  // Метаданные
  metadata?: {
    version: string
    lastModified: Date
    author?: string
    description?: string
  }
}

// Типы для графа
export interface GraphNode {
  id: string
  type: 'scene' | 'screen' | 'choice' | 'storypoint' | 'entry'
  position: { x: number; y: number }
  data: any
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: 'scene-to-screen' | 'screen-to-choice' | 'choice-to-storypoint' | 'choice-to-scene' | 'condition'
  label?: string
  style?: {
    stroke?: string
    strokeWidth?: number
  }
}

export interface StoryGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// Типы для предпросмотра
export interface PreviewState {
  currentSceneId?: string
  currentScreenId?: string
  visitedScreens: string[]
  madeChoices: string[]
  storyPointValues: { [key: string]: any }
}

// Типы для валидации
export interface ValidationError {
  type: 'error' | 'warning' | 'info'
  message: string
  nodeId?: string
  field?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  info: ValidationError[]
}
