// Типы для привязки сцен к событиям (аукцион/аномалии)

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

// Расширение существующего StoryScene
export interface StorySceneWithBindings {
  eventBindings?: SceneEventBinding[]
}

// Утилиты для работы с привязками
export interface SceneBindingUtils {
  createBinding(
    eventType: 'auction' | 'anomaly',
    sceneId: string,
    conditions: SceneCondition[],
    probability: number,
    priority?: number,
    isBaseChance?: boolean
  ): SceneEventBinding

  createCondition(
    type: 'asset' | 'player' | 'game_state',
    field: string,
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=',
    value: any,
    description: string
  ): SceneCondition

  checkConditions(
    binding: SceneEventBinding,
    gameState: any
  ): boolean

  getAvailableScenes(
    eventType: 'auction' | 'anomaly',
    scenes: any[],
    gameState: any
  ): { scene: any; probability: number }[]

  selectRandomScene(
    availableScenes: { scene: any; probability: number }[]
  ): any | null
}

