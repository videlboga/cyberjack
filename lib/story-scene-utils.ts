import { 
  StorySceneBinding, 
  StorySceneCondition, 
  SimplifiedStoryScene,
  Character as GameAsset,
  User as GameUser,
  GameConfig
} from './types'

/**
 * Утилиты для работы с упрощенной системой сюжетных сцен
 */
export class StorySceneUtils {
  /**
   * Проверить условие сцены
   */
  static checkCondition(
    condition: StorySceneCondition, 
    assets: GameAsset[], 
    user: GameUser, 
    gameState: any
  ): boolean {
    const { type, field, operator, value } = condition

    let actualValue: any

    switch (type) {
      case 'asset':
        // Проверяем все активы
        if (field === 'any_asset_price') {
          actualValue = Math.max(...assets.map(a => a.price), 0)
        } else if (field === 'owned_assets_count') {
          actualValue = assets.filter(a => a.owner === user.id).length
        } else if (field === 'total_assets_value') {
          actualValue = assets.filter(a => a.owner === user.id).reduce((sum, a) => sum + a.price, 0)
        } else {
          // Проверяем конкретный атрибут у всех активов
          const assetValues = assets.map(asset => {
            if (field in asset.attributes) return asset.attributes[field as keyof typeof asset.attributes]
            if (field in asset.skills) return asset.skills[field as keyof typeof asset.skills]
            if (field in asset.condition) return asset.condition[field as keyof typeof asset.condition]
            return null
          }).filter(v => v !== null)
          
          actualValue = assetValues.length > 0 ? Math.max(...assetValues) : 0
        }
        break

      case 'player':
        if (field === 'balance') {
          actualValue = user.account.balance
        } else if (field === 'owned_assets_count') {
          actualValue = user.assets.length
        } else if (field === 'equipment_count') {
          actualValue = user.equipment.length
        } else {
          actualValue = (user as any)[field] || 0
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
   * Проверить все условия привязки сцены
   */
  static checkBindingConditions(
    binding: StorySceneBinding,
    assets: GameAsset[],
    user: GameUser,
    gameState: any
  ): boolean {
    return binding.conditions.every(condition => 
      this.checkCondition(condition, assets, user, gameState)
    )
  }

  /**
   * Получить доступные сцены для аукциона
   */
  static getAvailableAuctionScenes(
    scenes: SimplifiedStoryScene[],
    assets: GameAsset[],
    user: GameUser,
    gameState: any
  ): { scene: SimplifiedStoryScene; probability: number }[] {
    const availableScenes: { scene: SimplifiedStoryScene; probability: number }[] = []

    scenes.forEach(scene => {
      if (scene.type !== 'auction') return

      // Проверяем все привязки сцены
      scene.bindings.forEach(binding => {
        if (binding.type === 'auction' && this.checkBindingConditions(binding, assets, user, gameState)) {
          availableScenes.push({
            scene,
            probability: binding.probability
          })
        }
      })
    })

    // Сортируем по приоритету и вероятности
    return availableScenes.sort((a, b) => {
      const aBinding = a.scene.bindings.find(b => b.type === 'auction')
      const bBinding = b.scene.bindings.find(b => b.type === 'auction')
      
      if (aBinding?.priority !== bBinding?.priority) {
        return (bBinding?.priority || 0) - (aBinding?.priority || 0)
      }
      
      return b.probability - a.probability
    })
  }

  /**
   * Получить доступные сцены для аномалий
   */
  static getAvailableAnomalyScenes(
    scenes: SimplifiedStoryScene[],
    assets: GameAsset[],
    user: GameUser,
    gameState: any
  ): { scene: SimplifiedStoryScene; probability: number }[] {
    const availableScenes: { scene: SimplifiedStoryScene; probability: number }[] = []

    scenes.forEach(scene => {
      if (scene.type !== 'anomaly') return

      // Проверяем все привязки сцены
      scene.bindings.forEach(binding => {
        if (binding.type === 'anomaly' && this.checkBindingConditions(binding, assets, user, gameState)) {
          availableScenes.push({
            scene,
            probability: binding.probability
          })
        }
      })
    })

    // Сортируем по приоритету и вероятности
    return availableScenes.sort((a, b) => {
      const aBinding = a.scene.bindings.find(b => b.type === 'anomaly')
      const bBinding = b.scene.bindings.find(b => b.type === 'anomaly')
      
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
    availableScenes: { scene: SimplifiedStoryScene; probability: number }[]
  ): SimplifiedStoryScene | null {
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
   * Создать базовое условие
   */
  static createBaseCondition(
    type: 'asset' | 'player' | 'game_state',
    field: string,
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=',
    value: any,
    description: string
  ): StorySceneCondition {
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
   * Создать привязку сцены
   */
  static createSceneBinding(
    type: 'auction' | 'anomaly',
    sceneId: string,
    conditions: StorySceneCondition[],
    probability: number,
    priority: number = 1
  ): StorySceneBinding {
    return {
      id: `binding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      sceneId,
      conditions,
      probability,
      priority,
      metadata: {
        source: 'manual',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
    }
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
}

