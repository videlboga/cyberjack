// Утилиты для работы с упрощенной сюжетной системой

import { SimpleCondition, SimpleEffect, SimpleStoryConfig } from './simple-story-types'

// Проверка условий
export function evaluateCondition(
  condition: SimpleCondition, 
  gameState: {
    assets: any[]
    users: any[]
    equipment: any[]
    stationEntities: { [key: string]: any }
    storyPoints: { [key: string]: any }
  }
): boolean {
  let entities: any[] = []
  
  // Получаем сущности для проверки
  switch (condition.entityType) {
    case 'asset':
      entities = condition.entityId 
        ? gameState.assets.filter(a => a.id === condition.entityId)
        : gameState.assets
      break
    case 'user':
      entities = condition.entityId 
        ? gameState.users.filter(u => u.id === condition.entityId)
        : gameState.users
      break
    case 'equipment':
      entities = condition.entityId 
        ? gameState.equipment.filter(e => e.id === condition.entityId)
        : gameState.equipment
      break
    case 'station':
      const stationEntity = gameState.stationEntities[condition.entityId || '']
      if (stationEntity) {
        entities = [stationEntity]
      }
      break
    case 'story_point':
      const storyPoint = gameState.storyPoints[condition.entityId || '']
      if (storyPoint) {
        entities = [storyPoint]
      }
      break
  }
  
  // Если нет сущностей для проверки
  if (entities.length === 0) {
    return false
  }
  
  // Проверяем каждую сущность
  const results = entities.map(entity => {
    const value = getNestedValue(entity, condition.property)
    return compareValues(value, condition.operator, condition.value)
  })
  
  // Если проверяем конкретную сущность - достаточно одного совпадения
  if (condition.entityId) {
    return results.some(result => result)
  }
  
  // Если проверяем все сущности - все должны соответствовать
  return results.every(result => result)
}

// Получение вложенного значения из объекта
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null
  }, obj)
}

// Сравнение значений
function compareValues(a: any, operator: string, b: any): boolean {
  switch (operator) {
    case '==':
      return a == b
    case '!=':
      return a != b
    case '>':
      return a > b
    case '<':
      return a < b
    case '>=':
      return a >= b
    case '<=':
      return a <= b
    default:
      return false
  }
}

// Применение эффектов
export function applyEffects(
  effects: SimpleEffect[],
  gameState: {
    assets: any[]
    users: any[]
    equipment: any[]
    stationEntities: { [key: string]: any }
    storyPoints: { [key: string]: any }
  }
): { 
  newGameState: any
  changes: Array<{ type: string, description: string }>
} {
  const newGameState = JSON.parse(JSON.stringify(gameState)) // Глубокое копирование
  const changes: Array<{ type: string, description: string }> = []
  
  effects.forEach(effect => {
    switch (effect.type) {
      case 'change_asset_stat':
        if (effect.entityId && effect.stat && effect.change) {
          const asset = newGameState.assets.find((a: any) => a.id === effect.entityId)
          if (asset) {
            setNestedValue(asset, effect.stat, getNestedValue(asset, effect.stat) + effect.change)
            changes.push({
              type: 'asset_stat_change',
              description: `Изменена характеристика ${effect.stat} актива ${asset.name} на ${effect.change}`
            })
          }
        }
        break
        
      case 'change_user_stat':
        if (effect.entityId && effect.stat && effect.change) {
          const user = newGameState.users.find((u: any) => u.id === effect.entityId)
          if (user) {
            setNestedValue(user, effect.stat, getNestedValue(user, effect.stat) + effect.change)
            changes.push({
              type: 'user_stat_change',
              description: `Изменена характеристика ${effect.stat} пользователя ${user.username} на ${effect.change}`
            })
          }
        }
        break
        
      case 'change_story_point':
        if (effect.storyPointId && effect.storyPointChange) {
          const storyPoint = newGameState.storyPoints[effect.storyPointId]
          if (storyPoint) {
            storyPoint.value += effect.storyPointChange
            changes.push({
              type: 'story_point_change',
              description: `Сюжетная точка "${storyPoint.name}" изменена на ${effect.storyPointChange}`
            })
          }
        }
        break
        
      case 'gain_credits':
        if (effect.creditsChange) {
          // Здесь нужно найти пользователя и изменить его баланс
          // Пока просто добавляем в изменения
          changes.push({
            type: 'credits_gain',
            description: `Получено ${effect.creditsChange} кредитов`
          })
        }
        break
        
      case 'lose_credits':
        if (effect.creditsChange) {
          changes.push({
            type: 'credits_loss',
            description: `Потеряно ${effect.creditsChange} кредитов`
          })
        }
        break
        
      case 'gain_equipment':
        if (effect.equipmentId) {
          changes.push({
            type: 'equipment_gain',
            description: `Получено оборудование ${effect.equipmentId}`
          })
        }
        break
        
      case 'lose_equipment':
        if (effect.equipmentId) {
          changes.push({
            type: 'equipment_loss',
            description: `Потеряно оборудование ${effect.equipmentId}`
          })
        }
        break
        
      case 'trigger_station_event':
        if (effect.stationEventId) {
          changes.push({
            type: 'station_event_trigger',
            description: `Запущено событие станции ${effect.stationEventId}`
          })
        }
        break
        
      case 'end_scene':
        changes.push({
          type: 'scene_end',
          description: 'Сцена завершена'
        })
        break
    }
  })
  
  return { newGameState, changes }
}

// Установка вложенного значения
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.')
  const lastKey = keys.pop()!
  const target = keys.reduce((current, key) => {
    if (!current[key]) {
      current[key] = {}
    }
    return current[key]
  }, obj)
  target[lastKey] = value
}

// Проверка всех условий сцены
export function evaluateSceneConditions(
  conditions: SimpleCondition[] | undefined,
  gameState: any
): boolean {
  if (!conditions || conditions.length === 0) {
    return true // Нет условий - сцена показывается всегда
  }
  
  return conditions.every(condition => evaluateCondition(condition, gameState))
}

// Конвертация старого формата в новый
export function convertToSimpleFormat(oldStoryData: any): SimpleStoryConfig {
  return {
    storyPoints: oldStoryData.storyPoints || {},
    stationEntities: oldStoryData.stationEntities || {},
    scenes: (oldStoryData.scenes || []).map((oldScene: any) => ({
      id: oldScene.id,
      title: oldScene.title,
      description: oldScene.description,
      probability: oldScene.probability,
      conditions: oldScene.triggerConditions?.map((condition: any) => ({
        entityType: condition.type === 'story_point' ? 'story_point' : 'asset',
        entityId: condition.pointId,
        property: 'value',
        operator: condition.operator || '>=',
        value: condition.value || 0
      })),
      content: {
        text: oldScene.screens?.[0]?.description || 'Текст сцены...'
      },
      choices: oldScene.screens?.[0]?.choices?.map((oldChoice: any) => ({
        id: oldChoice.id,
        text: oldChoice.text,
        effects: oldChoice.consequences?.map((consequence: any) => ({
          type: consequence.type,
          ...consequence
        })) || []
      })) || []
    })),
    settings: {
      defaultProbability: 100,
      autoSave: true
    }
  }
}

// Валидация сюжетной конфигурации
export function validateStoryConfig(config: SimpleStoryConfig): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  // Проверяем сюжетные точки
  Object.entries(config.storyPoints).forEach(([id, point]) => {
    if (point.value < point.minValue || point.value > point.maxValue) {
      errors.push(`Сюжетная точка "${point.name}" имеет недопустимое значение`)
    }
  })
  
  // Проверяем сцены
  config.scenes.forEach((scene, index) => {
    if (!scene.title.trim()) {
      errors.push(`Сцена ${index + 1} не имеет названия`)
    }
    
    if (!scene.content.text.trim()) {
      errors.push(`Сцена "${scene.title}" не имеет текста`)
    }
    
    if (scene.probability && (scene.probability < 0 || scene.probability > 100)) {
      errors.push(`Сцена "${scene.title}" имеет недопустимую вероятность`)
    }
    
    // Проверяем выборы
    scene.choices.forEach((choice, choiceIndex) => {
      if (!choice.text.trim()) {
        errors.push(`Выбор ${choiceIndex + 1} в сцене "${scene.title}" не имеет текста`)
      }
    })
  })
  
  return {
    isValid: errors.length === 0,
    errors
  }
}
