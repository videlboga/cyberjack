// Упрощенные типы для сюжетного редактора
// Основаны на существующих сущностях игры

// Основные сущности игры, которые можно использовать в условиях
export interface GameEntity {
  type: 'asset' | 'user' | 'equipment' | 'station' | 'story_point'
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

// Упрощенная система условий - основана на реальных данных игры
export interface SimpleCondition {
  // Что проверяем
  entityType: 'asset' | 'user' | 'equipment' | 'station' | 'story_point'
  entityId?: string // Если не указан - проверяем всех/любого
  
  // Какое свойство проверяем
  property: string // например: 'rank', 'skills.neural_hacking', 'condition.health'
  
  // Как сравниваем
  operator: '==' | '!=' | '>' | '<' | '>=' | '<='
  
  // С чем сравниваем
  value: any
  
  // Для множественных условий
  logic?: 'AND' | 'OR'
  conditions?: SimpleCondition[]
}

// Упрощенная сцена
export interface SimpleScene {
  id: string
  title: string
  description: string
  
  // Когда показывать сцену
  conditions?: SimpleCondition[]
  probability?: number // 0-100, если не указано - всегда показывать
  
  // Содержимое сцены
  content: {
    text: string
    background?: string
    music?: string
  }
  
  // Выборы игрока
  choices: SimpleChoice[]
}

// Упрощенный выбор
export interface SimpleChoice {
  id: string
  text: string
  
  // Условия для показа этого выбора
  conditions?: SimpleCondition[]
  
  // Что происходит при выборе
  effects: SimpleEffect[]
  
  // Куда переходим
  nextScene?: string // ID следующей сцены
  endScene?: boolean // Завершить сцену
}

// Упрощенные эффекты - основаны на реальных действиях в игре
export interface SimpleEffect {
  type: 'change_asset_stat' | 'change_user_stat' | 'change_story_point' | 
        'gain_credits' | 'lose_credits' | 'gain_equipment' | 'lose_equipment' |
        'trigger_station_event' | 'end_scene'
  
  // Для изменения характеристик
  entityType?: 'asset' | 'user'
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
}

// Упрощенная конфигурация сюжетов
export interface SimpleStoryConfig {
  // Сюжетные точки (как в оригинале)
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
  
  // Сущности станции
  stationEntities: {
    [key: string]: StationEntity
  }
  
  // Упрощенные сцены
  scenes: SimpleScene[]
  
  // Глобальные настройки
  settings?: {
    defaultProbability?: number
    autoSave?: boolean
  }
}
