import { 
  Condition, 
  AssetCondition, 
  PlayerCondition, 
  SceneChoiceCondition, 
  StoryPointCondition,
  CompoundCondition,
  Character as Asset,
  User,
  Operator,
  AttributeValue
} from '@/lib/unified-entities'
import { AttributeParser, ConditionValidator, ConditionUtils } from '@/lib/condition-utils'

// Кэширование конфигураций
const conditionCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 минут

// Основные типы данных
export interface ConditionData {
  conditions: Condition[]
  templates: ConditionTemplate[]
  examples: ConditionExample[]
  fieldConfigs: FieldConfig[]
}

export interface ConditionTemplate {
  id: string
  name: string
  description: string
  type: 'asset' | 'player' | 'scene' | 'compound'
  condition: Condition
  category: string
  tags: string[]
  metadata: {
    author: string
    version: string
    createdAt: string
    lastModified: string
    usageCount: number
  }
}

export interface ConditionExample {
  id: string
  name: string
  description: string
  condition: Condition
  expectedResult: boolean
  testData: {
    assets?: Asset[]
    users?: User[]
    gameState?: any
  }
}

export interface FieldConfig {
  entityType: 'asset' | 'player' | 'scene'
  field: string
  type: 'numeric' | 'string' | 'boolean' | 'array'
  label: string
  description: string
  category: string
  validation?: {
    min?: number
    max?: number
    pattern?: string
    required?: boolean
  }
}

// Загрузка всех Condition данных
export async function loadConditionData(): Promise<ConditionData> {
  const cacheKey = 'all_condition_data'
  const cached = conditionCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('🔧 Condition данные загружены из кэша')
    return cached.data
  }

  try {
    console.log('🔄 Загружаем Condition данные...')
    
    // Загружаем unified данные
    const [assetsData, usersData, fieldConfigsData] = await Promise.all([
      import('@/data/characters-unified.json').then(m => m.default),
      import('@/data/users-unified.json').then(m => m.default),
      import('@/lib/field-configs').then(m => m.default).catch(() => [])
    ])

    // Создаем базовые шаблоны условий
    const templates = createDefaultTemplates()
    
    // Создаем примеры условий
    const examples = createDefaultExamples(assetsData.characters || [], usersData.users || [])
    
    // Создаем конфигурации полей
    const fieldConfigs = createFieldConfigs()

    const conditionData: ConditionData = {
      conditions: [],
      templates,
      examples,
      fieldConfigs
    }

    // Кэшируем результат
    conditionCache.set(cacheKey, { data: conditionData, timestamp: Date.now() })
    
    console.log('✅ Condition данные загружены:', {
      templates: conditionData.templates.length,
      examples: conditionData.examples.length,
      fieldConfigs: conditionData.fieldConfigs.length
    })

    return conditionData
  } catch (error) {
    console.error('❌ Ошибка загрузки Condition данных:', error)
    throw new Error('Не удалось загрузить Condition данные')
  }
}

// Загрузка шаблонов условий
export async function loadConditionTemplates(): Promise<ConditionTemplate[]> {
  const conditionData = await loadConditionData()
  return conditionData.templates
}

// Загрузка примеров условий
export async function loadConditionExamples(): Promise<ConditionExample[]> {
  const conditionData = await loadConditionData()
  return conditionData.examples
}

// Загрузка конфигураций полей
export async function loadFieldConfigs(): Promise<FieldConfig[]> {
  const conditionData = await loadConditionData()
  return conditionData.fieldConfigs
}

// Создание нового условия
export function createNewCondition(type: Condition['type']): Condition {
  const baseCondition = {
    id: ConditionUtils.generateConditionId(),
    name: 'Новое условие',
    description: 'Описание нового условия'
  }

  switch (type) {
    case 'asset_condition':
      return {
        ...baseCondition,
        type: 'asset_condition',
        target: {
          entityId: 'any',
          attribute: 'strength',
          operator: '=',
          value: 50
        }
      } as AssetCondition

    case 'player_condition':
      return {
        ...baseCondition,
        type: 'player_condition',
        target: {
          attribute: 'balance',
          operator: '>=',
          value: 1000
        }
      } as PlayerCondition

    case 'scene_choice_condition':
      return {
        ...baseCondition,
        type: 'scene_choice_condition',
        target: {
          sceneId: '',
          choiceId: '',
          operator: '=',
          value: true
        }
      } as SceneChoiceCondition

    case 'story_point_condition':
      return {
        ...baseCondition,
        type: 'story_point_condition',
        target: {
          storyPointId: '',
          operator: '>=',
          value: 1
        }
      } as StoryPointCondition

    case 'compound_condition':
      return {
        ...baseCondition,
        type: 'compound_condition',
        operator: 'AND',
        conditions: []
      } as CompoundCondition

    default:
      throw new Error(`Неизвестный тип условия: ${type}`)
  }
}

// Создание шаблона условия
export function createConditionTemplate(
  name: string,
  description: string,
  condition: Condition,
  category: string = 'Общие',
  tags: string[] = []
): ConditionTemplate {
  return {
    id: `template_${Date.now()}`,
    name,
    description,
    type: condition.type as any,
    condition,
    category,
    tags,
    metadata: {
      author: 'user',
      version: '1.0',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      usageCount: 0
    }
  }
}

// Валидация условия
export function validateCondition(condition: Condition): { isValid: boolean; errors: string[] } {
  return ConditionValidator.validateCondition(condition)
}

// Проверка условия
export function checkCondition(
  condition: Condition,
  gameState: {
    assets?: Asset[]
    users?: User[]
    gameState?: any
  }
): boolean {
  return ConditionValidator.checkCondition(condition, gameState)
}

// Создание базовых шаблонов
function createDefaultTemplates(): ConditionTemplate[] {
  return [
    // Шаблоны для активов
    createConditionTemplate(
      'Сильный актив',
      'Актив с высокой силой',
      {
        id: 'template_strong_asset',
        name: 'Сильный актив',
        description: 'Актив с высокой силой',
        type: 'asset_condition',
        target: {
          entityId: 'any',
          attribute: 'strength',
          operator: '>=',
          value: 70
        }
      } as AssetCondition,
      'Активы',
      ['сила', 'атрибуты']
    ),

    createConditionTemplate(
      'Лояльный актив',
      'Актив с высокой лояльностью',
      {
        id: 'template_loyal_asset',
        name: 'Лояльный актив',
        description: 'Актив с высокой лояльностью',
        type: 'asset_condition',
        target: {
          entityId: 'any',
          attribute: 'loyalty',
          operator: '>=',
          value: 80
        }
      } as AssetCondition,
      'Активы',
      ['лояльность', 'атрибуты']
    ),

    // Шаблоны для игроков
    createConditionTemplate(
      'Богатый игрок',
      'Игрок с большим балансом',
      {
        id: 'template_rich_player',
        name: 'Богатый игрок',
        description: 'Игрок с большим балансом',
        type: 'player_condition',
        target: {
          attribute: 'balance',
          operator: '>=',
          value: 10000
        }
      } as PlayerCondition,
      'Игроки',
      ['баланс', 'экономика']
    ),

    // Составные условия
    createConditionTemplate(
      'Идеальный актив',
      'Сильный и лояльный актив',
      {
        id: 'template_perfect_asset',
        name: 'Идеальный актив',
        description: 'Сильный и лояльный актив',
        type: 'compound_condition',
        operator: 'AND',
        conditions: [
          {
            id: 'cond_1',
            name: 'Сила',
            description: 'Высокая сила',
            type: 'asset_condition',
            target: {
              entityId: 'any',
              attribute: 'strength',
              operator: '>=',
              value: 70
            }
          } as AssetCondition,
          {
            id: 'cond_2',
            name: 'Лояльность',
            description: 'Высокая лояльность',
            type: 'asset_condition',
            target: {
              entityId: 'any',
              attribute: 'loyalty',
              operator: '>=',
              value: 80
            }
          } as AssetCondition
        ]
      } as CompoundCondition,
      'Составные',
      ['составные', 'активы']
    )
  ]
}

// Создание примеров условий
function createDefaultExamples(assets: Asset[], users: User[]): ConditionExample[] {
  return [
    {
      id: 'example_1',
      name: 'Проверка силы актива',
      description: 'Проверяет, что актив имеет силу больше 50',
      condition: {
        id: 'example_condition_1',
        name: 'Сила > 50',
        description: 'Проверка силы актива',
        type: 'asset_condition',
        target: {
          entityId: 'any',
          attribute: 'strength',
          operator: '>',
          value: 50
        }
      } as AssetCondition,
      expectedResult: true,
      testData: {
        assets: assets.filter(asset => asset.attributes?.strength > 50).slice(0, 3),
        users: users.slice(0, 2)
      }
    },

    {
      id: 'example_2',
      name: 'Проверка баланса игрока',
      description: 'Проверяет, что у игрока есть деньги',
      condition: {
        id: 'example_condition_2',
        name: 'Баланс > 0',
        description: 'Проверка баланса игрока',
        type: 'player_condition',
        target: {
          attribute: 'balance',
          operator: '>',
          value: 0
        }
      } as PlayerCondition,
      expectedResult: true,
      testData: {
        assets: assets.slice(0, 2),
        users: users.filter(user => user.account?.balance > 0).slice(0, 3)
      }
    }
  ]
}

// Создание конфигураций полей
function createFieldConfigs(): FieldConfig[] {
  return [
    // Атрибуты активов
    {
      entityType: 'asset',
      field: 'strength',
      type: 'numeric',
      label: 'Сила',
      description: 'Физическая сила актива',
      category: 'Основные атрибуты',
      validation: { min: 0, max: 100 }
    },
    {
      entityType: 'asset',
      field: 'empathy',
      type: 'numeric',
      label: 'Эмпатия',
      description: 'Способность к сопереживанию',
      category: 'Основные атрибуты',
      validation: { min: 0, max: 100 }
    },
    {
      entityType: 'asset',
      field: 'intelligence',
      type: 'numeric',
      label: 'Интеллект',
      description: 'Умственные способности',
      category: 'Основные атрибуты',
      validation: { min: 0, max: 100 }
    },
    {
      entityType: 'asset',
      field: 'loyalty',
      type: 'numeric',
      label: 'Лояльность',
      description: 'Верность и преданность',
      category: 'Основные атрибуты',
      validation: { min: 0, max: 100 }
    },

    // Атрибуты игроков
    {
      entityType: 'player',
      field: 'balance',
      type: 'numeric',
      label: 'Баланс',
      description: 'Количество денег у игрока',
      category: 'Аккаунт',
      validation: { min: 0 }
    },
    {
      entityType: 'player',
      field: 'assets_count',
      type: 'numeric',
      label: 'Количество активов',
      description: 'Сколько активов у игрока',
      category: 'Активы',
      validation: { min: 0 }
    },

    // Фетиши
    {
      entityType: 'asset',
      field: 'bdsm',
      type: 'numeric',
      label: 'БДСМ',
      description: 'Интерес к БДСМ',
      category: 'Фетиши',
      validation: { min: 0, max: 100 }
    },
    {
      entityType: 'asset',
      field: 'humiliation',
      type: 'numeric',
      label: 'Унижение',
      description: 'Интерес к унижению',
      category: 'Фетиши',
      validation: { min: 0, max: 100 }
    }
  ]
}

// Утилиты для работы с условиями
export const ConditionLoaderUtils = {
  // Получить условие по ID
  getConditionById: (conditions: Condition[], conditionId: string): Condition | null => {
    return conditions.find(condition => condition.id === conditionId) || null
  },

  // Получить шаблон по ID
  getTemplateById: (templates: ConditionTemplate[], templateId: string): ConditionTemplate | null => {
    return templates.find(template => template.id === templateId) || null
  },

  // Получить шаблоны по категории
  getTemplatesByCategory: (templates: ConditionTemplate[], category: string): ConditionTemplate[] => {
    return templates.filter(template => template.category === category)
  },

  // Получить конфигурации полей по типу сущности
  getFieldConfigsByEntityType: (fieldConfigs: FieldConfig[], entityType: string): FieldConfig[] => {
    return fieldConfigs.filter(config => config.entityType === entityType)
  },

  // Получить конфигурации полей по категории
  getFieldConfigsByCategory: (fieldConfigs: FieldConfig[], category: string): FieldConfig[] => {
    return fieldConfigs.filter(config => config.category === category)
  },

  // Создать условие из шаблона
  createConditionFromTemplate: (template: ConditionTemplate): Condition => {
    return {
      ...template.condition,
      id: ConditionUtils.generateConditionId(),
      name: `${template.name} (копия)`,
      description: `Создано из шаблона: ${template.name}`
    }
  },

  // Обновить счетчик использования шаблона
  updateTemplateUsage: (template: ConditionTemplate): ConditionTemplate => {
    return {
      ...template,
      metadata: {
        ...template.metadata,
        usageCount: template.metadata.usageCount + 1,
        lastModified: new Date().toISOString()
      }
    }
  }
}

// Сохранение данных (заглушка - в реальном проекте здесь будет API)
export async function saveConditionData(data: Partial<ConditionData>): Promise<void> {
  console.log('💾 Сохранение Condition данных:', data)
  
  // В реальном проекте здесь будет отправка на сервер
  // await fetch('/api/condition/save', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(data)
  // })
  
  // Очищаем кэш после сохранения
  conditionCache.clear()
}

// Очистка кэша
export function clearConditionCache(): void {
  conditionCache.clear()
  console.log('🧹 Кэш Condition данных очищен')
}

