/**
 * Типы для системы сюжета на основе экранов
 * Архитектура: Экран = узел, Выборы = переходы между экранами
 */

// Основные игровые сущности для условий
export interface GameEntity {
  type: 'character' | 'user' | 'equipment' | 'story_point'
  id: string
  name: string
}

// Условия для показа выборов/экранов
export interface StoryCondition {
  // Что проверяем
  entityType: 'character' | 'user' | 'equipment' | 'story_point'
  entityId?: string // Если не указан - проверяем текущего персонажа/пользователя

  // Какое свойство проверяем
  property: string // например: 'characteristics.health', 'credits', 'storyPoints.reputation'

  // Как сравниваем
  operator: '==' | '!=' | '>' | '<' | '>=' | '<='

  // С чем сравниваем
  value: any

  // Для множественных условий
  logic?: 'AND' | 'OR'
  conditions?: StoryCondition[]
}

// Последствия выборов (изменения в БД пользователя)
export interface ChoiceConsequence {
  type: 'change_characteristic' | 'change_credits' | 'change_equipment' |
        'change_story_point' | 'trigger_action' | 'end_scene'

  // Для изменения характеристик персонажа
  characterId?: string // если не указан - применяется к текущему персонажу
  characteristicId?: string
  change?: number

  // Для изменения кредитов пользователя
  creditsChange?: number

  // Для изменения оборудования
  equipmentId?: string
  equipmentAction?: 'add' | 'remove'

  // Для изменения сюжетных точек
  storyPointId?: string
  storyPointChange?: number

  // Для триггера действия
  actionId?: string
  actionIntensity?: number
}

// Выбор игрока
export interface StoryChoice {
  id: string
  text: string
  description?: string

  // Условия для показа этого выбора
  showConditions?: StoryCondition[]

  // Переход к другому экрану
  nextScreenId?: string

  // Последствия выбора
  consequences?: ChoiceConsequence[]

  // Является ли выбор финальным (завершает сцену)
  isFinal?: boolean
}

// Экран сцены
export interface StoryScreen {
  id: string
  sceneId: string
  name: string
  description?: string

  // Контент экрана
  content: {
    text: string
    background?: string // URL изображения/видео
    music?: string // URL аудио
    backgroundFile?: File // Загруженный файл
  }

  // Выборы игрока
  choices: StoryChoice[]

  // Условия доступа к экрану
  accessConditions?: StoryCondition[]

  // Является ли экран финальным
  isFinal: boolean

  // Позиция на графе
  position?: {
    x: number
    y: number
  }
}

// Сцена
export interface StoryScene {
  id: string
  name: string
  description?: string

  // Связанная станция
  stationId?: string

  // Условия активации (вместо дефолтной сцены станции)
  triggerConditions?: StoryCondition[]
  probability?: number // 0-100, если не указано - всегда показывать

  // Начальный экран сцены
  startScreenId?: string

  // Все экраны сцены
  screens: StoryScreen[]

  isActive: boolean
}

// Станция (точка входа в сцены)
export interface StoryStation {
  id: string
  name: string
  type: string
  description?: string

  // Дефолтная сцена станции
  defaultSceneId?: string

  // Настройки
  probability?: number
  isActive: boolean

  // Метаданные
  metadata?: {
    [key: string]: any
  }

  // Сцены, связанные с этой станцией
  scenes?: StoryScene[]
}

// Конфигурация системы сюжета
export interface StoryConfig {
  // Сюжетные точки
  storyPoints: {
    [key: string]: {
      name: string
      description: string
      value: number
      defaultValue: number
      minValue: number
      maxValue: number
    }
  }

  // Станции
  stations: {
    [key: string]: StoryStation
  }

  // Сцены
  scenes: {
    [key: string]: StoryScene
  }

  // Глобальные настройки
  settings?: {
    defaultProbability?: number
    autoSave?: boolean
  }
}

// Контекст игрока для выполнения сцены
export interface PlayerContext {
  userId: string
  currentCharacterId?: string
  currentStationId?: string
  storyPoints: {
    [key: string]: any
  }
  characteristics: {
    [key: string]: number
  }
  equipment: string[]
  credits: number
}

// Результат выполнения выбора
export interface ChoiceResult {
  success: boolean
  nextScreenId?: string
  consequences?: ChoiceConsequence[]
  error?: string
}

// Состояние сцены для игрока
export interface SceneState {
  sceneId: string
  currentScreenId: string
  availableChoices: StoryChoice[]
  canProceed: boolean
  isComplete: boolean
}
