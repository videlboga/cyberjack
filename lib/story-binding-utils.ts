import { 
  SceneEventBinding, 
  SceneCondition, 
  SceneBindingUtils 
} from './story-binding-types'

/**
 * Утилиты для работы с привязками сцен к событиям
 */
export class StoryBindingUtils {
  /**
   * Создать привязку сцены к событию
   */
  static createBinding(
    eventType: 'auction' | 'anomaly',
    sceneId: string,
    conditions: SceneCondition[],
    probability: number,
    priority: number = 1,
    isBaseChance: boolean = false
  ): SceneEventBinding {
    return {
      id: `binding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      sceneId,
      conditions,
      probability,
      priority,
      isBaseChance,
      metadata: {
        source: 'manual',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
    }
  }

  /**
   * Создать условие для привязки
   */
  static createCondition(
    type: 'asset' | 'player' | 'game_state',
    field: string,
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=',
    value: any,
    description: string
  ): SceneCondition {
    return {
      id: `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      field,
      operator,
      value,
      description
    }
  }

  /**
   * Проверить условия привязки
   */
  static checkConditions(
    binding: SceneEventBinding,
    gameState: any
  ): boolean {
    return binding.conditions.every(condition => 
      this.checkSingleCondition(condition, gameState)
    )
  }

  /**
   * Проверить одно условие
   */
  private static checkSingleCondition(
    condition: SceneCondition,
    gameState: any
  ): boolean {
    const { type, field, operator, value } = condition

    let actualValue: any

    switch (type) {
      case 'asset':
        // Проверяем активы
        if (field === 'any_asset_price') {
          actualValue = Math.max(...(gameState.assets || []).map((a: any) => a.price), 0)
        } else if (field === 'owned_assets_count') {
          actualValue = (gameState.assets || []).filter((a: any) => a.owner === gameState.userId).length
        } else if (field === 'total_assets_value') {
          actualValue = (gameState.assets || []).filter((a: any) => a.owner === gameState.userId).reduce((sum: number, a: any) => sum + a.price, 0)
        } else {
          // Проверяем конкретный атрибут у всех активов
          const assetValues = (gameState.assets || []).map((asset: any) => {
            if (field in asset.attributes) return asset.attributes[field]
            if (field in asset.skills) return asset.skills[field]
            if (field in asset.condition) return asset.condition[field]
            return null
          }).filter((v: any) => v !== null)
          
          actualValue = assetValues.length > 0 ? Math.max(...assetValues) : 0
        }
        break

      case 'player':
        if (field === 'balance') {
          actualValue = gameState.user?.account?.balance || 0
        } else if (field === 'owned_assets_count') {
          actualValue = gameState.user?.assets?.length || 0
        } else if (field === 'equipment_count') {
          actualValue = gameState.user?.equipment?.length || 0
        } else {
          actualValue = gameState.user?.[field] || 0
        }
        break

      case 'game_state':
        actualValue = gameState[field] || 0
        break

      default:
        return false
    }

    // Применяем оператор
    switch (operator) {
      case '==': return actualValue === value
      case '!=': return actualValue !== value
      case '>': return actualValue > value
      case '<': return actualValue < value
      case '>=': return actualValue >= value
      case '<=': return actualValue <= value
      default: return false
    }
  }

  /**
   * Получить доступные сцены для события
   */
  static getAvailableScenes(
    eventType: 'auction' | 'anomaly',
    scenes: any[],
    gameState: any
  ): { scene: any; probability: number }[] {
    const availableScenes: { scene: any; probability: number }[] = []

    scenes.forEach(scene => {
      if (scene.type !== eventType) return

      // Проверяем привязки сцены
      if (scene.eventBindings) {
        scene.eventBindings.forEach((binding: SceneEventBinding) => {
          if (binding.eventType === eventType && this.checkConditions(binding, gameState)) {
            availableScenes.push({
              scene,
              probability: binding.probability
            })
          }
        })
      }

      // Если нет привязок, используем базовую вероятность сцены
      if (!scene.eventBindings || scene.eventBindings.length === 0) {
        availableScenes.push({
          scene,
          probability: scene.probability || 10 // Базовая вероятность
        })
      }
    })

    // Сортируем по приоритету и вероятности
    return availableScenes.sort((a, b) => {
      const aBinding = a.scene.eventBindings?.find((b: SceneEventBinding) => b.eventType === eventType)
      const bBinding = b.scene.eventBindings?.find((b: SceneEventBinding) => b.eventType === eventType)
      
      if (aBinding?.priority !== bBinding?.priority) {
        return (bBinding?.priority || 0) - (aBinding?.priority || 0)
      }
      
      return b.probability - a.probability
    })
  }

  /**
   * Выбрать случайную сцену на основе вероятностей
   */
  static selectRandomScene(
    availableScenes: { scene: any; probability: number }[]
  ): any | null {
    if (availableScenes.length === 0) return null

    // Вычисляем общую вероятность
    const totalProbability = availableScenes.reduce((sum, item) => sum + item.probability, 0)
    
    if (totalProbability === 0) return null

    // Генерируем случайное число
    const random = Math.random() * totalProbability
    
    // Выбираем сцену на основе вероятности
    let currentSum = 0
    for (const item of availableScenes) {
      currentSum += item.probability
      if (random <= currentSum) {
        return item.scene
      }
    }

    return availableScenes[0].scene
  }

  /**
   * Получить доступные поля для условий
   */
  static getAvailableFields(type: 'asset' | 'player' | 'game_state'): { value: string; label: string; description: string }[] {
    switch (type) {
      case 'asset':
        return [
          { value: 'any_asset_price', label: 'Цена любого актива', description: 'Максимальная цена среди всех активов' },
          { value: 'owned_assets_count', label: 'Количество активов', description: 'Количество принадлежащих активов' },
          { value: 'total_assets_value', label: 'Общая стоимость активов', description: 'Сумма стоимости всех активов' },
          { value: 'strength', label: 'Сила', description: 'Физическая сила актива' },
          { value: 'intelligence', label: 'Интеллект', description: 'Интеллектуальные способности' },
          { value: 'price', label: 'Цена', description: 'Стоимость актива' },
          { value: 'rank', label: 'Ранг', description: 'Ранг актива' }
        ]
      
      case 'player':
        return [
          { value: 'balance', label: 'Баланс', description: 'Количество кредитов' },
          { value: 'owned_assets_count', label: 'Количество активов', description: 'Количество принадлежащих активов' },
          { value: 'equipment_count', label: 'Количество оборудования', description: 'Количество единиц оборудования' }
        ]
      
      case 'game_state':
        return [
          { value: 'day', label: 'День', description: 'Текущий день игры' },
          { value: 'reputation', label: 'Репутация', description: 'Репутация игрока' },
          { value: 'void_experience', label: 'Опыт в Void', description: 'Количество операций в Void' }
        ]
      
      default:
        return []
    }
  }

  /**
   * Создать базовую привязку для аукциона
   */
  static createAuctionBaseBinding(sceneId: string): SceneEventBinding {
    return this.createBinding(
      'auction',
      sceneId,
      [], // Без условий - базовый шанс
      30, // 30% вероятность
      1, // Низкий приоритет
      true // Базовый шанс
    )
  }

  /**
   * Создать базовую привязку для аномалий
   */
  static createAnomalyBaseBinding(sceneId: string): SceneEventBinding {
    return this.createBinding(
      'anomaly',
      sceneId,
      [], // Без условий - базовый шанс
      20, // 20% вероятность
      1, // Низкий приоритет
      true // Базовый шанс
    )
  }

  /**
   * Создать привязку с условием на активы
   */
  static createAssetConditionBinding(
    eventType: 'auction' | 'anomaly',
    sceneId: string,
    field: string,
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=',
    value: any,
    probability: number,
    priority: number = 2
  ): SceneEventBinding {
    const condition = this.createCondition(
      'asset',
      field,
      operator,
      value,
      `Актив: ${field} ${operator} ${value}`
    )

    return this.createBinding(
      eventType,
      sceneId,
      [condition],
      probability,
      priority,
      false
    )
  }

  /**
   * Создать привязку с условием на игрока
   */
  static createPlayerConditionBinding(
    eventType: 'auction' | 'anomaly',
    sceneId: string,
    field: string,
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=',
    value: any,
    probability: number,
    priority: number = 2
  ): SceneEventBinding {
    const condition = this.createCondition(
      'player',
      field,
      operator,
      value,
      `Игрок: ${field} ${operator} ${value}`
    )

    return this.createBinding(
      eventType,
      sceneId,
      [condition],
      probability,
      priority,
      false
    )
  }
}
