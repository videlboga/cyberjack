import { 
  Character as Asset, 
  User, 
  StoryScene, 
  AssetAttribute, 
  PlayerAttribute, 
  Operator, 
  AttributeValue,
  Condition,
  AssetCondition,
  PlayerCondition,
  SceneChoiceCondition,
  StoryPointCondition,
  CompoundCondition,
  GameState,
  SceneHistory
} from './unified-entities'

/**
 * Парсер атрибутов для извлечения значений из сущностей
 */
export class AttributeParser {
  /**
   * Получить все атрибуты актива в виде плоского объекта
   */
  static getAssetAttributes(asset: Asset): Record<string, AttributeValue> {
    return {
      // Основные атрибуты
      ...asset.attributes,
      
      // Навыки
      ...asset.skills,
      
      // Состояние
      ...asset.condition,
      
      // Метаданные
      rank: asset.rank,
      price: asset.price,
      status: asset.status,
      location: asset.location,
      specialization: asset.specialization,
      
      // История
      assignments: asset.history.assignments,
      success_rate: asset.history.success_rate,
      
      // Трейты (массив)
      traits: asset.traits,
      
      // Предпочтения (массивы)
      work_type: asset.preferences.work_type,
      environment: asset.preferences.environment,
      avoid: asset.preferences.avoid
    }
  }

  /**
   * Получить все атрибуты игрока в виде плоского объекта
   */
  static getPlayerAttributes(user: User): Record<string, AttributeValue> {
    return {
      // Аккаунт
      balance: user.account.balance,
      currency: user.account.currency,
      
      // Активы
      assets_count: user.assets.length,
      owned_assets_count: user.assets.filter(asset => asset.status === 'active').length,
      
      // Оборудование
      equipment_count: user.equipment.length,
      has_equipment: user.equipment.length > 0,
      
      // Настройки
      riskTolerance: user.settings.riskTolerance,
      theme: user.settings.theme,
      notifications: user.settings.notifications,
      autoAssign: user.settings.autoAssign,
      
      // Метаданные
      role: user.role,
      status: user.status,
      created: user.created,
      lastLogin: user.lastLogin
    }
  }

  /**
   * Получить доступные выборы из сцены
   */
  static getSceneChoices(scene: StoryScene): Record<string, any> {
    const choices: Record<string, any> = {}
    
    scene.screens.forEach(screen => {
      screen.choices.forEach(choice => {
        choices[`${screen.id}_${choice.id}`] = {
          screenId: screen.id,
          choiceId: choice.id,
          text: choice.text
        }
      })
    })
    
    return choices
  }

  /**
   * Определить тип атрибута
   */
  static getAttributeType(attribute: string): "numeric" | "string" | "boolean" | "array" {
    // Числовые атрибуты
    const numericAttributes = [
      // Атрибуты активов
      "strength", "empathy", "intelligence", "temperament", "grit", "ego", "loyalty", "obedience", "resistance",
      // Навыки
      "maid", "cooking", "neural_hacking", "orgasm_control", "field", "etiquette", "logistics", "medical", "maintenance", "data", "dance", "seduction", "interrogation", "surveillance",
      // Состояние
      "health", "mental_state", "stress", "fatigue",
      // Метаданные
      "price", "assignments", "success_rate",
      // Атрибуты игрока
      "balance", "assets_count", "owned_assets_count", "equipment_count"
    ]

    // Булевые атрибуты
    const booleanAttributes = [
      "has_equipment", "notifications", "autoAssign"
    ]

    // Массивы
    const arrayAttributes = [
      "traits", "work_type", "environment", "avoid"
    ]

    if (numericAttributes.includes(attribute)) {
      return "numeric"
    } else if (booleanAttributes.includes(attribute)) {
      return "boolean"
    } else if (arrayAttributes.includes(attribute)) {
      return "array"
    } else {
      return "string"
    }
  }

  /**
   * Получить значение атрибута из сущности
   */
  static getAttributeValue(entity: any, attribute: string): AttributeValue {
    const attributes = this.getAssetAttributes(entity)
    return attributes[attribute] || null
  }
}

/**
 * Валидатор условий
 */
export class ConditionValidator {
  /**
   * Валидировать условие
   */
  static validateCondition(condition: Condition): boolean {
    try {
      switch (condition.type) {
        case "asset_condition":
          return this.validateAssetCondition(condition)
        case "player_condition":
          return this.validatePlayerCondition(condition)
        case "scene_choice_condition":
          return this.validateSceneChoiceCondition(condition)
        case "story_point_condition":
          return this.validateStoryPointCondition(condition)
        case "compound_condition":
          return this.validateCompoundCondition(condition)
        default:
          return false
      }
    } catch (error) {
      console.error("Ошибка валидации условия:", error)
      return false
    }
  }

  /**
   * Валидировать условие на актив
   */
  static validateAssetCondition(condition: AssetCondition): boolean {
    const { target } = condition
    
    // Проверить атрибут
    if (!this.isValidAssetAttribute(target.attribute)) {
      return false
    }

    // Проверить оператор
    if (!this.isValidOperator(target.operator, target.attribute)) {
      return false
    }

    // Проверить значение
    return this.validateValue(target.attribute, target.value, target.operator)
  }

  /**
   * Валидировать условие на игрока
   */
  static validatePlayerCondition(condition: PlayerCondition): boolean {
    const { target } = condition
    
    // Проверить атрибут
    if (!this.isValidPlayerAttribute(target.attribute)) {
      return false
    }

    // Проверить оператор
    if (!this.isValidOperator(target.operator, target.attribute)) {
      return false
    }

    // Проверить значение
    return this.validateValue(target.attribute, target.value, target.operator)
  }

  /**
   * Валидировать условие на выбор в сцене
   */
  static validateSceneChoiceCondition(condition: SceneChoiceCondition): boolean {
    const { target } = condition
    
    // Проверить обязательные поля
    if (!target.sceneId || !target.choiceId) {
      return false
    }

    // Проверить статус
    const validStatuses = ["completed", "not_completed", "selected", "not_selected"]
    if (!validStatuses.includes(target.status)) {
      return false
    }

    return true
  }

  /**
   * Валидировать условие на сюжетную точку
   */
  static validateStoryPointCondition(condition: StoryPointCondition): boolean {
    const { target } = condition
    
    // Проверить обязательные поля
    if (!target.pointId) {
      return false
    }

    // Проверить оператор
    const numericOperators = ["=", "!=", ">", "<", ">=", "<="]
    if (!numericOperators.includes(target.operator)) {
      return false
    }

    // Проверить значение (должно быть числом)
    if (typeof target.value !== "number") {
      return false
    }

    return true
  }

  /**
   * Валидировать составное условие
   */
  static validateCompoundCondition(condition: CompoundCondition): boolean {
    const { logic, conditions } = condition
    
    // Проверить логический оператор
    if (!["AND", "OR"].includes(logic)) {
      return false
    }

    // Проверить наличие условий
    if (!conditions || conditions.length < 2) {
      return false
    }

    // Валидировать каждое условие
    return conditions.every(cond => this.validateCondition(cond))
  }

  /**
   * Проверить, является ли атрибут валидным для активов
   */
  static isValidAssetAttribute(attribute: string): boolean {
    const validAttributes = [
      // Основные атрибуты
      "strength", "empathy", "intelligence", "temperament", "grit", "ego", "loyalty", "obedience", "resistance",
      // Навыки
      "maid", "cooking", "neural_hacking", "orgasm_control", "field", "etiquette", "logistics", "medical", "maintenance", "data", "dance", "seduction", "interrogation", "surveillance",
      // Состояние
      "health", "mental_state", "stress", "fatigue",
      // Метаданные
      "rank", "price", "status", "location", "specialization",
      // История
      "assignments", "success_rate",
      // Трейты и предпочтения
      "traits", "work_type", "environment", "avoid"
    ]
    
    return validAttributes.includes(attribute)
  }

  /**
   * Проверить, является ли атрибут валидным для игроков
   */
  static isValidPlayerAttribute(attribute: string): boolean {
    const validAttributes = [
      // Аккаунт
      "balance", "currency",
      // Активы
      "assets_count", "owned_assets_count",
      // Оборудование
      "equipment_count", "has_equipment",
      // Настройки
      "riskTolerance", "theme", "notifications", "autoAssign",
      // Метаданные
      "role", "status", "created", "lastLogin"
    ]
    
    return validAttributes.includes(attribute)
  }

  /**
   * Проверить, является ли оператор валидным для атрибута
   */
  static isValidOperator(operator: Operator, attribute: string): boolean {
    const attributeType = AttributeParser.getAttributeType(attribute)
    
    switch (attributeType) {
      case "numeric":
        return ["=", "!=", ">", "<", ">=", "<="].includes(operator)
      case "string":
        return ["=", "!=", "contains", "not_contains"].includes(operator)
      case "boolean":
        return ["=", "!="].includes(operator)
      case "array":
        return ["contains", "not_contains", "in", "not_in"].includes(operator)
      default:
        return false
    }
  }

  /**
   * Валидировать значение для атрибута и оператора
   */
  static validateValue(attribute: string, value: any, operator: Operator): boolean {
    const attributeType = AttributeParser.getAttributeType(attribute)
    
    switch (attributeType) {
      case "numeric":
        return typeof value === "number" && !isNaN(value)
      case "string":
        return typeof value === "string"
      case "boolean":
        return typeof value === "boolean"
      case "array":
        if (["contains", "not_contains"].includes(operator)) {
          return typeof value === "string"
        } else if (["in", "not_in"].includes(operator)) {
          return Array.isArray(value) && value.every(v => typeof v === "string")
        }
        return false
      default:
        return false
    }
  }

  /**
   * Получить валидные операторы для типа атрибута
   */
  static getValidOperators(attributeType: string): Operator[] {
    switch (attributeType) {
      case "numeric":
        return ["=", "!=", ">", "<", ">=", "<="]
      case "string":
        return ["=", "!=", "contains", "not_contains"]
      case "boolean":
        return ["=", "!="]
      case "array":
        return ["contains", "not_contains", "in", "not_in"]
      default:
        return []
    }
  }
}

/**
 * Вычислитель условий
 */
export class ConditionEvaluator {
  /**
   * Вычислить условие
   */
  static evaluateCondition(condition: Condition, gameState: GameState): boolean {
    try {
      switch (condition.type) {
        case "asset_condition":
          return this.evaluateAssetCondition(condition, gameState.assets, gameState.currentUser)
        case "player_condition":
          return this.evaluatePlayerCondition(condition, gameState.currentUser)
        case "scene_choice_condition":
          return this.evaluateSceneChoiceCondition(condition, gameState.sceneHistory)
        case "story_point_condition":
          return this.evaluateStoryPointCondition(condition, gameState.storyPoints)
        case "compound_condition":
          return this.evaluateCompoundCondition(condition, gameState)
        default:
          return false
      }
    } catch (error) {
      console.error("Ошибка вычисления условия:", error)
      return false
    }
  }

  /**
   * Вычислить условие на актив
   */
  static evaluateAssetCondition(condition: AssetCondition, assets: Asset[], currentUser: User): boolean {
    const { target } = condition
    let targetAssets: Asset[] = []

    // Определить целевые активы
    switch (target.entityId) {
      case "any":
        targetAssets = assets
        break
      case "current":
        // Текущий актив (нужно реализовать логику)
        targetAssets = []
        break
      case "owned":
        targetAssets = assets.filter(asset => 
          currentUser.assets.some(userAsset => userAsset.assetId === asset.id)
        )
        break
      default:
        targetAssets = assets.filter(asset => asset.id === target.entityId)
    }

    // Проверить условие для каждого актива
    return targetAssets.some(asset => {
      const assetAttributes = AttributeParser.getAssetAttributes(asset)
      const actualValue = assetAttributes[target.attribute]
      return this.compareValues(actualValue, target.value, target.operator)
    })
  }

  /**
   * Вычислить условие на игрока
   */
  static evaluatePlayerCondition(condition: PlayerCondition, user: User): boolean {
    const { target } = condition
    const playerAttributes = AttributeParser.getPlayerAttributes(user)
    const actualValue = playerAttributes[target.attribute]
    return this.compareValues(actualValue, target.value, target.operator)
  }

  /**
   * Вычислить условие на выбор в сцене
   */
  static evaluateSceneChoiceCondition(condition: SceneChoiceCondition, sceneHistory: SceneHistory[]): boolean {
    const { target } = condition
    
    const relevantHistory = sceneHistory.filter(history => 
      history.sceneId === target.sceneId && 
      history.choiceId === target.choiceId &&
      (!target.screenId || history.screenId === target.screenId)
    )

    switch (target.status) {
      case "completed":
        return relevantHistory.some(h => h.completed)
      case "not_completed":
        return !relevantHistory.some(h => h.completed)
      case "selected":
        return relevantHistory.length > 0
      case "not_selected":
        return relevantHistory.length === 0
      default:
        return false
    }
  }

  /**
   * Вычислить условие на сюжетную точку
   */
  static evaluateStoryPointCondition(condition: StoryPointCondition, storyPoints: Record<string, any>): boolean {
    const { target } = condition
    const storyPoint = storyPoints[target.pointId]
    
    if (!storyPoint) {
      return false
    }

    return this.compareValues(storyPoint.value, target.value, target.operator)
  }

  /**
   * Вычислить составное условие
   */
  static evaluateCompoundCondition(condition: CompoundCondition, gameState: GameState): boolean {
    const { logic, conditions } = condition
    
    const results = conditions.map(cond => this.evaluateCondition(cond, gameState))
    
    if (logic === "AND") {
      return results.every(result => result)
    } else if (logic === "OR") {
      return results.some(result => result)
    }
    
    return false
  }

  /**
   * Сравнить значения с учетом оператора
   */
  static compareValues(actual: any, expected: any, operator: Operator): boolean {
    switch (operator) {
      case "=":
        return actual === expected
      case "!=":
        return actual !== expected
      case ">":
        return typeof actual === "number" && typeof expected === "number" && actual > expected
      case "<":
        return typeof actual === "number" && typeof expected === "number" && actual < expected
      case ">=":
        return typeof actual === "number" && typeof expected === "number" && actual >= expected
      case "<=":
        return typeof actual === "number" && typeof expected === "number" && actual <= expected
      case "contains":
        if (Array.isArray(actual)) {
          return actual.includes(expected)
        } else if (typeof actual === "string") {
          return actual.includes(expected)
        }
        return false
      case "not_contains":
        if (Array.isArray(actual)) {
          return !actual.includes(expected)
        } else if (typeof actual === "string") {
          return !actual.includes(expected)
        }
        return false
      case "in":
        if (Array.isArray(expected)) {
          return expected.includes(actual)
        }
        return false
      case "not_in":
        if (Array.isArray(expected)) {
          return !expected.includes(actual)
        }
        return false
      default:
        return false
    }
  }
}

/**
 * Утилиты для работы с условиями
 */
export class ConditionUtils {
  /**
   * Создать уникальный ID для условия
   */
  static generateConditionId(): string {
    return `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Получить человекочитаемое описание условия
   */
  static getConditionDescription(condition: Condition): string {
    switch (condition.type) {
      case "asset_condition":
        return this.getAssetConditionDescription(condition)
      case "player_condition":
        return this.getPlayerConditionDescription(condition)
      case "scene_choice_condition":
        return this.getSceneChoiceConditionDescription(condition)
      case "story_point_condition":
        return this.getStoryPointConditionDescription(condition)
      case "compound_condition":
        return this.getCompoundConditionDescription(condition)
      default:
        return "Неизвестное условие"
    }
  }

  /**
   * Описание условия на актив
   */
  static getAssetConditionDescription(condition: AssetCondition): string {
    const { target } = condition
    const entityName = this.getEntityName(target.entityId)
    const attributeName = this.getAttributeDisplayName(target.attribute)
    const operatorName = this.getOperatorDisplayName(target.operator)
    const valueName = this.getValueDisplayName(target.value)
    
    return `${entityName} ${attributeName} ${operatorName} ${valueName}`
  }

  /**
   * Описание условия на игрока
   */
  static getPlayerConditionDescription(condition: PlayerCondition): string {
    const { target } = condition
    const attributeName = this.getAttributeDisplayName(target.attribute)
    const operatorName = this.getOperatorDisplayName(target.operator)
    const valueName = this.getValueDisplayName(target.value)
    
    return `Игрок ${attributeName} ${operatorName} ${valueName}`
  }

  /**
   * Описание условия на выбор в сцене
   */
  static getSceneChoiceConditionDescription(condition: SceneChoiceCondition): string {
    const { target } = condition
    const statusName = this.getStatusDisplayName(target.status)
    
    return `Выбор "${target.choiceId}" в сцене "${target.sceneId}" ${statusName}`
  }

  /**
   * Описание условия на сюжетную точку
   */
  static getStoryPointConditionDescription(condition: StoryPointCondition): string {
    const { target } = condition
    const operatorName = this.getOperatorDisplayName(target.operator)
    const valueName = this.getValueDisplayName(target.value)
    
    return `Сюжетная точка "${target.pointId}" ${operatorName} ${valueName}`
  }

  /**
   * Описание составного условия
   */
  static getCompoundConditionDescription(condition: CompoundCondition): string {
    const { logic, conditions } = condition
    const logicName = logic === "AND" ? "И" : "ИЛИ"
    const descriptions = conditions.map(cond => this.getConditionDescription(cond))
    
    return descriptions.join(` ${logicName} `)
  }

  /**
   * Получить отображаемое имя сущности
   */
  static getEntityName(entityId: string): string {
    switch (entityId) {
      case "any":
        return "Любой актив"
      case "current":
        return "Текущий актив"
      case "owned":
        return "Принадлежащий актив"
      default:
        return `Актив ${entityId}`
    }
  }

  /**
   * Получить отображаемое имя атрибута
   */
  static getAttributeDisplayName(attribute: string): string {
    const displayNames: Record<string, string> = {
      // Атрибуты активов
      strength: "Сила",
      empathy: "Эмпатия",
      intelligence: "Интеллект",
      temperament: "Темперамент",
      grit: "Стойкость",
      ego: "Эго",
      loyalty: "Лояльность",
      obedience: "Послушание",
      resistance: "Сопротивление",
      
      // Навыки
      maid: "Обслуживание",
      cooking: "Кулинария",
      neural_hacking: "Нейрохакерство",
      orgasm_control: "Контроль оргазма",
      field: "Полевая работа",
      etiquette: "Этикет",
      logistics: "Логистика",
      medical: "Медицина",
      maintenance: "Техобслуживание",
      data: "Работа с данными",
      dance: "Танец",
      seduction: "Соблазнение",
      interrogation: "Допрос",
      surveillance: "Наблюдение",
      
      // Состояние
      health: "Здоровье",
      mental_state: "Психическое состояние",
      stress: "Стресс",
      fatigue: "Усталость",
      
      // Метаданные
      rank: "Ранг",
      price: "Цена",
      status: "Статус",
      location: "Местоположение",
      specialization: "Специализация",
      
      // История
      assignments: "Задания",
      success_rate: "Успешность",
      
      // Трейты и предпочтения
      traits: "Трейты",
      work_type: "Тип работы",
      environment: "Окружение",
      avoid: "Избегает",
      
      // Атрибуты игрока
      balance: "Баланс",
      currency: "Валюта",
      assets_count: "Количество активов",
      owned_assets_count: "Количество принадлежащих активов",
      equipment_count: "Количество оборудования",
      has_equipment: "Имеет оборудование",
      riskTolerance: "Толерантность к риску",
      theme: "Тема",
      notifications: "Уведомления",
      autoAssign: "Автоназначение",
      role: "Роль",
      status: "Статус",
      created: "Дата создания",
      lastLogin: "Последний вход"
    }
    
    return displayNames[attribute] || attribute
  }

  /**
   * Получить отображаемое имя оператора
   */
  static getOperatorDisplayName(operator: Operator): string {
    const displayNames: Record<Operator, string> = {
      "=": "равно",
      "!=": "не равно",
      ">": "больше",
      "<": "меньше",
      ">=": "больше или равно",
      "<=": "меньше или равно",
      "contains": "содержит",
      "not_contains": "не содержит",
      "in": "входит в",
      "not_in": "не входит в"
    }
    
    return displayNames[operator] || operator
  }

  /**
   * Получить отображаемое имя значения
   */
  static getValueDisplayName(value: any): string {
    if (Array.isArray(value)) {
      return value.join(", ")
    }
    return String(value)
  }

  /**
   * Получить отображаемое имя статуса
   */
  static getStatusDisplayName(status: string): string {
    const displayNames: Record<string, string> = {
      "completed": "завершен",
      "not_completed": "не завершен",
      "selected": "выбран",
      "not_selected": "не выбран"
    }
    
    return displayNames[status] || status
  }
}

