import { 
  AttributeParser, 
  ConditionValidator, 
  ConditionEvaluator, 
  ConditionUtils 
} from '@/lib/condition-utils'
import { Character, User, CharacterCondition, PlayerCondition, GameState } from '@/lib/unified-entities'

// Тестовые данные
const testAsset: Character = {
  id: "asset_1",
  name: "Алекс",
  archetype: "Junior",
  description: "Молодая актив с хорошими навыками обслуживания",
  rank: "C",
  status: "available",
  location: "talent_exchange",
  source: "market",
  attributes: {
    strength: 2,
    endurance: 3,
    intelligence: 4,
    creativity: 3,
    temperament: 3,
    grit: 3,
    empathy: 3,
    ego: 2
  },
  states: {
    mood: 70,
    stress: 15,
    obedience: 2,
    awareness: 3,
    devotion: 1,
    sensuality: 2,
    sensory_overload: 0
  },
  fetishes: {
    bdsm: 2,
    humiliation: 1,
    masochism: 1,
    sadism: 0,
    voyeurism: 1,
    exhibitionism: 1,
    roleplay: 2,
    bondage: 2,
    sensory_deprivation: 1,
    sensory_overload: 0,
    electricity: 0,
    vibration: 1,
    temperature: 1,
    pressure: 1,
    tickling: 1,
    feet: 0,
    hands: 1,
    breasts: 1,
    anal: 0,
    latex: 1,
    leather: 1,
    silk: 1,
    rope: 2,
    uniform: 2,
    age_play: 0,
    pregnancy: 0,
    lactation: 0
  },
  preferences: {
    work_type: ["service", "technical"],
    environment: ["clean", "quiet"],
    avoid: ["violence", "chaos"]
  },
  condition: {
    health: 100,
    mental_state: 85,
    stress: 15,
    fatigue: 20
  },
  createdAt: "2024-01-15",
  totalInteractions: 0
}

const testUser: User = {
  id: "user_1",
  username: "Master_Control",
  email: "master@nexus.com",
  role: "admin",
  status: "active",
  created: "2024-01-01",
  lastLogin: "2024-01-25",
  account: {
    balance: 2500,
    currency: "credits",
    transactions: []
  },
  assets: [
    {
      assetId: "asset_1",
      name: "Алекс",
      acquired: "2024-01-15",
      status: "active",
      location: "estate",
      currentAssignment: null
    }
  ],
  equipment: [
    {
      itemId: "implant_1",
      name: "Neural Interface",
      type: "implant",
      slot: "neural",
      installed: "2024-01-10",
      status: "active"
    }
  ],
  settings: {
    theme: "dark",
    notifications: true,
    autoAssign: false,
    riskTolerance: "medium"
  }
}

const testGameState: GameState = {
  assets: [testAsset],
  users: [testUser],
  storyScenes: [],
  storyPoints: {},
  currentUser: testUser,
  sceneHistory: []
}

describe('AttributeParser', () => {
  describe('getAssetAttributes', () => {
    it('должен извлечь все атрибуты актива', () => {
      const attributes = AttributeParser.getAssetAttributes(testAsset)
      
      expect(attributes.strength).toBe(2)
      expect(attributes.intelligence).toBe(4)
      expect(attributes.maid).toBe(2)
      expect(attributes.health).toBe(100)
      expect(attributes.rank).toBe("Junior")
      expect(attributes.price).toBe(150)
      expect(attributes.assignments).toBe(3)
      expect(attributes.success_rate).toBe(0.85)
      expect(attributes.traits).toEqual(["loyal", "quick_learner", "tech_savvy"])
      expect(attributes.work_type).toEqual(["service", "technical"])
    })
  })

  describe('getPlayerAttributes', () => {
    it('должен извлечь все атрибуты игрока', () => {
      const attributes = AttributeParser.getPlayerAttributes(testUser)
      
      expect(attributes.balance).toBe(2500)
      expect(attributes.currency).toBe("credits")
      expect(attributes.assets_count).toBe(1)
      expect(attributes.owned_assets_count).toBe(1)
      expect(attributes.equipment_count).toBe(1)
      expect(attributes.has_equipment).toBe(true)
      expect(attributes.riskTolerance).toBe("medium")
      expect(attributes.notifications).toBe(true)
      expect(attributes.autoAssign).toBe(false)
      expect(attributes.role).toBe("admin")
      expect(attributes.status).toBe("active")
    })
  })

  describe('getAttributeType', () => {
    it('должен правильно определять типы атрибутов', () => {
      expect(AttributeParser.getAttributeType("strength")).toBe("numeric")
      expect(AttributeParser.getAttributeType("intelligence")).toBe("numeric")
      expect(AttributeParser.getAttributeType("maid")).toBe("numeric")
      expect(AttributeParser.getAttributeType("health")).toBe("numeric")
      expect(AttributeParser.getAttributeType("price")).toBe("numeric")
      expect(AttributeParser.getAttributeType("balance")).toBe("numeric")
      
      expect(AttributeParser.getAttributeType("rank")).toBe("string")
      expect(AttributeParser.getAttributeType("status")).toBe("string")
      expect(AttributeParser.getAttributeType("specialization")).toBe("string")
      
      expect(AttributeParser.getAttributeType("has_equipment")).toBe("boolean")
      expect(AttributeParser.getAttributeType("notifications")).toBe("boolean")
      expect(AttributeParser.getAttributeType("autoAssign")).toBe("boolean")
      
      expect(AttributeParser.getAttributeType("traits")).toBe("array")
      expect(AttributeParser.getAttributeType("work_type")).toBe("array")
      expect(AttributeParser.getAttributeType("environment")).toBe("array")
      expect(AttributeParser.getAttributeType("avoid")).toBe("array")
    })
  })
})

describe('ConditionValidator', () => {
  describe('validateCharacterCondition', () => {
    it('должен валидировать корректное условие на персонажа', () => {
      const condition: CharacterCondition = {
        id: "test",
        type: "asset_condition",
        name: "Тест",
        description: "Тестовое условие",
        target: {
          entityId: "any",
          attribute: "strength",
          operator: ">=",
          value: 3
        }
      }
      
      expect(ConditionValidator.validateCharacterCondition(condition)).toBe(true)
    })

    it('должен отклонять условие с невалидным атрибутом', () => {
      const condition: CharacterCondition = {
        id: "test",
        type: "character_condition",
        name: "Тест",
        description: "Тестовое условие",
        target: {
          entityId: "any",
          attribute: "invalid_attribute",
          operator: ">=",
          value: 3
        }
      }
      
      expect(ConditionValidator.validateCharacterCondition(condition)).toBe(false)
    })

    it('должен отклонять условие с невалидным оператором', () => {
      const condition: CharacterCondition = {
        id: "test",
        type: "character_condition",
        name: "Тест",
        description: "Тестовое условие",
        target: {
          entityId: "any",
          attribute: "strength",
          operator: "invalid_operator",
          value: 3
        }
      }
      
      expect(ConditionValidator.validateCharacterCondition(condition)).toBe(false)
    })
  })

  describe('validatePlayerCondition', () => {
    it('должен валидировать корректное условие на игрока', () => {
      const condition: PlayerCondition = {
        id: "test",
        type: "player_condition",
        name: "Тест",
        description: "Тестовое условие",
        target: {
          attribute: "balance",
          operator: ">=",
          value: 1000
        }
      }
      
      expect(ConditionValidator.validatePlayerCondition(condition)).toBe(true)
    })
  })

  describe('getValidOperators', () => {
    it('должен возвращать правильные операторы для числовых атрибутов', () => {
      const operators = ConditionValidator.getValidOperators("numeric")
      expect(operators).toEqual(["=", "!=", ">", "<", ">=", "<="])
    })

    it('должен возвращать правильные операторы для строковых атрибутов', () => {
      const operators = ConditionValidator.getValidOperators("string")
      expect(operators).toEqual(["=", "!=", "contains", "not_contains"])
    })

    it('должен возвращать правильные операторы для булевых атрибутов', () => {
      const operators = ConditionValidator.getValidOperators("boolean")
      expect(operators).toEqual(["=", "!="])
    })

    it('должен возвращать правильные операторы для массивов', () => {
      const operators = ConditionValidator.getValidOperators("array")
      expect(operators).toEqual(["contains", "not_contains", "in", "not_in"])
    })
  })
})

describe('ConditionEvaluator', () => {
  describe('evaluateCharacterCondition', () => {
    it('должен правильно вычислять условие на силу', () => {
      const condition: CharacterCondition = {
        id: "test",
        type: "character_condition",
        name: "Тест",
        description: "Тестовое условие",
        target: {
          entityId: "any",
          attribute: "strength",
          operator: ">=",
          value: 3
        }
      }
      
      const result = ConditionEvaluator.evaluateCharacterCondition(condition, [testAsset], testUser)
      expect(result).toBe(false) // strength = 2, не >= 3
    })

    it('должен правильно вычислять условие на интеллект', () => {
      const condition: CharacterCondition = {
        id: "test",
        type: "character_condition",
        name: "Тест",
        description: "Тестовое условие",
        target: {
          entityId: "any",
          attribute: "intelligence",
          operator: ">=",
          value: 3
        }
      }
      
      const result = ConditionEvaluator.evaluateCharacterCondition(condition, [testAsset], testUser)
      expect(result).toBe(true) // intelligence = 4, >= 3
    })

    it('должен правильно вычислять условие на трейты', () => {
      const condition: CharacterCondition = {
        id: "test",
        type: "character_condition",
        name: "Тест",
        description: "Тестовое условие",
        target: {
          entityId: "any",
          attribute: "traits",
          operator: "contains",
          value: "loyal"
        }
      }
      
      const result = ConditionEvaluator.evaluateCharacterCondition(condition, [testAsset], testUser)
      expect(result).toBe(true) // traits содержит "loyal"
    })

    it('должен правильно вычислять условие на принадлежащие активы', () => {
      const condition: CharacterCondition = {
        id: "test",
        type: "character_condition",
        name: "Тест",
        description: "Тестовое условие",
        target: {
          entityId: "owned",
          attribute: "strength",
          operator: ">=",
          value: 1
        }
      }
      
      const result = ConditionEvaluator.evaluateCharacterCondition(condition, [testAsset], testUser)
      expect(result).toBe(true) // owned asset имеет strength = 2, >= 1
    })
  })

  describe('evaluatePlayerCondition', () => {
    it('должен правильно вычислять условие на баланс', () => {
      const condition: PlayerCondition = {
        id: "test",
        type: "player_condition",
        name: "Тест",
        description: "Тестовое условие",
        target: {
          attribute: "balance",
          operator: ">=",
          value: 1000
        }
      }
      
      const result = ConditionEvaluator.evaluatePlayerCondition(condition, testUser)
      expect(result).toBe(true) // balance = 2500, >= 1000
    })

    it('должен правильно вычислять условие на количество активов', () => {
      const condition: PlayerCondition = {
        id: "test",
        type: "player_condition",
        name: "Тест",
        description: "Тестовое условие",
        target: {
          attribute: "assets_count",
          operator: "=",
          value: 1
        }
      }
      
      const result = ConditionEvaluator.evaluatePlayerCondition(condition, testUser)
      expect(result).toBe(true) // assets_count = 1
    })
  })

  describe('compareValues', () => {
    it('должен правильно сравнивать числовые значения', () => {
      expect(ConditionEvaluator.compareValues(5, 3, ">")).toBe(true)
      expect(ConditionEvaluator.compareValues(5, 3, "<")).toBe(false)
      expect(ConditionEvaluator.compareValues(5, 5, "=")).toBe(true)
      expect(ConditionEvaluator.compareValues(5, 3, ">=")).toBe(true)
      expect(ConditionEvaluator.compareValues(5, 5, ">=")).toBe(true)
    })

    it('должен правильно сравнивать строковые значения', () => {
      expect(ConditionEvaluator.compareValues("hello", "hello", "=")).toBe(true)
      expect(ConditionEvaluator.compareValues("hello", "world", "!=")).toBe(true)
      expect(ConditionEvaluator.compareValues("hello world", "world", "contains")).toBe(true)
      expect(ConditionEvaluator.compareValues("hello", "world", "contains")).toBe(false)
    })

    it('должен правильно сравнивать массивы', () => {
      const array = ["a", "b", "c"]
      expect(ConditionEvaluator.compareValues(array, "a", "contains")).toBe(true)
      expect(ConditionEvaluator.compareValues(array, "d", "contains")).toBe(false)
      expect(ConditionEvaluator.compareValues("a", ["a", "b"], "in")).toBe(true)
      expect(ConditionEvaluator.compareValues("d", ["a", "b"], "in")).toBe(false)
    })
  })
})

describe('ConditionUtils', () => {
  describe('generateConditionId', () => {
    it('должен генерировать уникальные ID', () => {
      const id1 = ConditionUtils.generateConditionId()
      const id2 = ConditionUtils.generateConditionId()
      
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^condition_\d+_[a-z0-9]+$/)
      expect(id2).toMatch(/^condition_\d+_[a-z0-9]+$/)
    })
  })

  describe('getConditionDescription', () => {
    it('должен генерировать описание для условия на персонажа', () => {
      const condition: CharacterCondition = {
        id: "test",
        type: "character_condition",
        name: "Тест",
        description: "Тестовое условие",
        target: {
          entityId: "any",
          attribute: "strength",
          operator: ">=",
          value: 3
        }
      }
      
      const description = ConditionUtils.getConditionDescription(condition)
      expect(description).toBe("Любой персонаж Сила больше или равно 3")
    })

    it('должен генерировать описание для условия на игрока', () => {
      const condition: PlayerCondition = {
        id: "test",
        type: "player_condition",
        name: "Тест",
        description: "Тестовое условие",
        target: {
          attribute: "balance",
          operator: ">=",
          value: 1000
        }
      }
      
      const description = ConditionUtils.getConditionDescription(condition)
      expect(description).toBe("Игрок Баланс больше или равно 1000")
    })
  })

  describe('getAttributeDisplayName', () => {
    it('должен возвращать правильные отображаемые имена', () => {
      expect(ConditionUtils.getAttributeDisplayName("strength")).toBe("Сила")
      expect(ConditionUtils.getAttributeDisplayName("intelligence")).toBe("Интеллект")
      expect(ConditionUtils.getAttributeDisplayName("maid")).toBe("Обслуживание")
      expect(ConditionUtils.getAttributeDisplayName("balance")).toBe("Баланс")
      expect(ConditionUtils.getAttributeDisplayName("unknown")).toBe("unknown")
    })
  })

  describe('getOperatorDisplayName', () => {
    it('должен возвращать правильные отображаемые имена операторов', () => {
      expect(ConditionUtils.getOperatorDisplayName("=")).toBe("равно")
      expect(ConditionUtils.getOperatorDisplayName(">")).toBe("больше")
      expect(ConditionUtils.getOperatorDisplayName("contains")).toBe("содержит")
      expect(ConditionUtils.getOperatorDisplayName("in")).toBe("входит в")
    })
  })
})

